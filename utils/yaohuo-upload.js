import {
	getAuthHeader
} from './auth.js'

export const YH_LOCAL_FILE_EXTENSIONS = [
	'txt',
	'zip',
	'rar',
	'7z',
	'apk',
	'jpg',
	'jpeg',
	'png',
	'gif',
	'webp',
	'torrent',
	'mp3',
	'wma',
	'wav',
	'pdf',
	'xls',
	'doc',
	'docx'
]

let androidFileRequestSeed = 45200

export function getYaohuoReplyFileUrl(postInfo, fallbackClassId) {
	const postId = getFirstNumber(postInfo && postInfo.postId)
	if (!postId) {
		return ''
	}
	const classId = getFirstNumber(postInfo && (postInfo.classId || postInfo.classid)) || getFirstNumber(fallbackClassId)
	const params = [
		'action=class',
		'siteid=1000',
		'classid=' + encodeURIComponent(classId || ''),
		'id=' + encodeURIComponent(postId)
	]
	return 'https://yaohuo.me/bbs/book_re_addfile.aspx?' + params.join('&')
}

export function getYaohuoPostFileUrl(classId, page) {
	const params = [
		'action=class',
		'siteid=1000',
		'classid=' + encodeURIComponent(getFirstNumber(classId) || ''),
		'page=' + encodeURIComponent(page || '')
	]
	return 'https://yaohuo.me/bbs/Book_View_addfile.aspx?' + params.join('&')
}

export function chooseYaohuoLocalFile(count) {
	count = count || 1
	if (isAppPlusAndroid()) {
		return chooseAndroidDocumentFile(count)
	}
	return chooseUniFileWithTimeout(count)
}

function chooseUniFileWithTimeout(count) {
	return new Promise((resolve, reject) => {
		if (typeof uni.chooseFile !== 'function') {
			reject(new Error('当前环境不支持文件选择'))
			return
		}
		let settled = false
		const timer = setTimeout(() => {
			finish(() => reject(new Error('文件选择无响应，请重试')))
			console.log('[YAOHUO_LOCAL_FILE_PICK_TIMEOUT]', {
				count
			})
		}, 8000)
		const finish = callback => {
			if (settled) {
				return
			}
			settled = true
			clearTimeout(timer)
			callback()
		}
		console.log('[YAOHUO_LOCAL_FILE_PICK_START]', {
			mode: 'uni.chooseFile',
			count
		})
		uni.chooseFile({
			count,
			type: 'all',
			extension: YH_LOCAL_FILE_EXTENSIONS,
			success: res => {
				finish(() => {
					const files = normalizeChooseFiles(res)
					if (!files.length || !files[0].path) {
						reject(new Error('未选择文件'))
						return
					}
					resolve(files)
				})
			},
			fail: err => {
				finish(() => {
					reject(new Error((err && (err.errMsg || err.message)) || '未选择文件'))
				})
			}
		})
	})
}

function chooseAndroidDocumentFile(count) {
	return new Promise((resolve, reject) => {
		try {
			const requestCode = getAndroidFileRequestCode()
			const main = plus.android.runtimeMainActivity()
			const Intent = plus.android.importClass('android.content.Intent')
			const Activity = plus.android.importClass('android.app.Activity')
			const intent = new Intent('android.intent.action.OPEN_DOCUMENT')
			intent.addCategory('android.intent.category.OPENABLE')
			intent.setType('*/*')
			intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
			intent.addFlags(Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION)
			if (count > 1) {
				intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)
			}
			const previousResultHandler = main.onActivityResult
			main.onActivityResult = function(activityRequestCode, resultCode, data) {
				if (activityRequestCode !== requestCode) {
					if (typeof previousResultHandler === 'function') {
						previousResultHandler.apply(main, arguments)
					}
					return
				}
				main.onActivityResult = previousResultHandler
				if (resultCode !== Activity.RESULT_OK || !data) {
					reject(new Error('未选择文件'))
					return
				}
				try {
					const files = copyAndroidPickedFiles(data, count)
					if (!files.length || !files[0].path) {
						reject(new Error('未选择文件'))
						return
					}
					resolve(files)
				} catch (err) {
					reject(new Error((err && err.message) || '文件读取失败'))
				}
			}
			console.log('[YAOHUO_LOCAL_FILE_PICK_START]', {
				mode: 'android.document',
				count,
				requestCode
			})
			const chooser = Intent.createChooser(intent, '选择文件')
			main.startActivityForResult(chooser, requestCode)
		} catch (err) {
			reject(new Error((err && err.message) || '当前环境不支持文件选择'))
		}
	})
}

function copyAndroidPickedFiles(data, count) {
	const uris = getAndroidPickedUris(data, count)
	const files = []
	for (let i = 0; i < uris.length; i++) {
		const file = copyAndroidUriToCache(uris[i], i)
		if (file && file.path) {
			files.push(file)
		}
	}
	console.log('[YAOHUO_LOCAL_FILE_PICK_RESULT]', {
		mode: 'android.document',
		count: files.length,
		names: files.map(item => item.name)
	})
	return files
}

function getAndroidPickedUris(data, count) {
	const uris = []
	try {
		const clipData = data.getClipData && data.getClipData()
		if (clipData) {
			const itemCount = Math.min(clipData.getItemCount(), count || 1)
			for (let i = 0; i < itemCount; i++) {
				const item = clipData.getItemAt(i)
				const uri = item && item.getUri && item.getUri()
				if (uri) {
					uris.push(uri)
				}
			}
		}
	} catch (err) {
		console.log('[YAOHUO_LOCAL_FILE_CLIPDATA_FAIL]', {
			errMsg: (err && err.message) || String(err || '')
		})
	}
	if (!uris.length && data.getData) {
		const uri = data.getData()
		if (uri) {
			uris.push(uri)
		}
	}
	return uris
}

function copyAndroidUriToCache(uri, index) {
	const main = plus.android.runtimeMainActivity()
	const resolver = main.getContentResolver()
	plus.android.importClass(resolver)
	const meta = getAndroidUriMeta(resolver, uri)
	const fileName = sanitizeFileName(meta.name || getAndroidUriFileName(uri, resolver) || ('file-' + Date.now()))
	const targetPath = getAndroidUploadCachePath(fileName, index)
	const input = resolver.openInputStream(uri)
	if (!input) {
		throw new Error('文件读取失败')
	}
	const FileOutputStream = plus.android.importClass('java.io.FileOutputStream')
	const ArrayReflect = plus.android.importClass('java.lang.reflect.Array')
	const Byte = plus.android.importClass('java.lang.Byte')
	const output = new FileOutputStream(targetPath)
	const buffer = ArrayReflect.newInstance(Byte.TYPE, 8192)
	let size = 0
	try {
		let length = input.read(buffer)
		while (length > -1) {
			output.write(buffer, 0, length)
			size += length
			length = input.read(buffer)
		}
		output.flush()
	} finally {
		try {
			input.close()
		} catch (err) {}
		try {
			output.close()
		} catch (err) {}
	}
	return {
		path: targetPath,
		tempFilePath: targetPath,
		name: fileName,
		size: meta.size > 0 ? meta.size : size
	}
}

function getAndroidUriMeta(resolver, uri) {
	const meta = {
		name: '',
		size: 0
	}
	let cursor = null
	try {
		cursor = resolver.query(uri, null, null, null, null)
		if (cursor) {
			plus.android.importClass(cursor)
			if (cursor.moveToFirst()) {
				const nameIndex = cursor.getColumnIndex('_display_name')
				const sizeIndex = cursor.getColumnIndex('_size')
				if (nameIndex > -1) {
					meta.name = cursor.getString(nameIndex) || ''
				}
				if (sizeIndex > -1) {
					const size = Number(cursor.getLong(sizeIndex))
					meta.size = isNaN(size) ? 0 : size
				}
			}
		}
	} catch (err) {
		console.log('[YAOHUO_LOCAL_FILE_META_FAIL]', {
			errMsg: (err && err.message) || String(err || '')
		})
	} finally {
		if (cursor) {
			try {
				cursor.close()
			} catch (err) {}
		}
	}
	return meta
}

function getAndroidUriFileName(uri, resolver) {
	const text = String(uri || '')
	const tail = decodeURIComponent(text.split('/').pop() || '')
	if (tail && tail.indexOf(':') === -1) {
		return tail
	}
	try {
		const type = resolver.getType(uri)
		const MimeTypeMap = plus.android.importClass('android.webkit.MimeTypeMap')
		const ext = MimeTypeMap.getSingleton().getExtensionFromMimeType(type)
		if (ext) {
			return 'file-' + Date.now() + '.' + ext
		}
	} catch (err) {}
	return ''
}

function getAndroidUploadCachePath(fileName, index) {
	const main = plus.android.runtimeMainActivity()
	const File = plus.android.importClass('java.io.File')
	const cacheDir = new File(main.getCacheDir(), 'yaohuo_upload')
	if (!cacheDir.exists()) {
		cacheDir.mkdirs()
	}
	const dotIndex = fileName.lastIndexOf('.')
	const base = dotIndex > 0 ? fileName.slice(0, dotIndex) : fileName
	const ext = dotIndex > 0 ? fileName.slice(dotIndex) : ''
	const uniqueName = base + '-' + Date.now() + '-' + index + ext
	const target = new File(cacheDir, uniqueName)
	return String(target.getAbsolutePath())
}

function sanitizeFileName(name) {
	name = String(name || '').trim()
	name = name.replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, ' ')
	if (!name || name === '.' || name === '..') {
		return 'file-' + Date.now()
	}
	if (name.length > 120) {
		const dotIndex = name.lastIndexOf('.')
		const ext = dotIndex > 0 ? name.slice(dotIndex) : ''
		name = name.slice(0, Math.max(1, 120 - ext.length)) + ext
	}
	return name
}

function getAndroidFileRequestCode() {
	androidFileRequestSeed += 1
	if (androidFileRequestSeed > 45999) {
		androidFileRequestSeed = 45201
	}
	return androidFileRequestSeed
}

function isAppPlusAndroid() {
	return typeof plus !== 'undefined' && plus && plus.os && plus.os.name === 'Android' && plus.android
}

export function uploadYaohuoPostFile(options) {
	options = options || {}
	const file = options.file || {}
	const filePath = file.path || file.tempFilePath || options.filePath || ''
	const classId = getFirstNumber(options.classId)
	const page = options.page || ''
	const sourceUrl = options.url || getYaohuoPostFileUrl(classId, page)
	if (!filePath) {
		return Promise.reject(new Error('未选择文件'))
	}
	if (!classId) {
		return Promise.reject(new Error('缺少版块信息'))
	}
	const formData = {
		action: 'gomod',
		classid: classId,
		siteid: 1000,
		page,
		num: 1,
		book_title: options.title || '',
		book_content: options.content || '',
		book_file_info: options.fileInfo || '',
		g: '发表文件帖'
	}
	return new Promise((resolve, reject) => {
		uni.uploadFile({
			url: 'https://yaohuo.me/bbs/book_view_addfile.aspx',
			filePath,
			name: 'book_file',
			header: getAuthHeader({
				Referer: sourceUrl
			}),
			formData,
			success: res => {
				resolve({
					statusCode: res.statusCode,
					data: res.data || '',
					url: sourceUrl,
					formData: maskUploadFormData(formData),
					fileName: file.name || getFileName(filePath),
					fileSize: file.size || 0
				})
			},
			fail: err => {
				reject(new Error((err && (err.errMsg || err.message)) || '妖火文件帖上传失败'))
			}
		})
	})
}

export function uploadYaohuoReplyFile(options) {
	options = options || {}
	const file = options.file || {}
	const filePath = file.path || file.tempFilePath || options.filePath || ''
	const url = options.url || getYaohuoReplyFileUrl({
		postId: options.postId,
		classId: options.classId
	})
	if (!filePath) {
		return Promise.reject(new Error('未选择文件'))
	}
	if (!url) {
		return Promise.reject(new Error('缺少帖子信息'))
	}
	const formData = {
		action: 'gomod',
		classid: options.classId || '',
		siteid: 1000,
		lpage: options.lpage || '',
		id: options.postId || '',
		face: options.face || '',
		book_content: options.content || '',
		book_file_info: options.fileInfo || '',
		num: 1,
		g: '附件回帖'
	}
	return new Promise((resolve, reject) => {
		uni.uploadFile({
			url: 'https://yaohuo.me/bbs/book_re_addfile.aspx',
			filePath,
			name: 'book_file',
			header: getAuthHeader({
				Referer: url
			}),
			formData,
			success: res => {
				resolve({
					statusCode: res.statusCode,
					data: res.data || '',
					url,
					formData: maskUploadFormData(formData),
					fileName: file.name || getFileName(filePath),
					fileSize: file.size || 0
				})
			},
			fail: err => {
				reject(new Error((err && (err.errMsg || err.message)) || '妖火附件上传失败'))
			}
		})
	})
}

export function isYaohuoUploadSuccess(html) {
	const text = stripHtml(html)
	if (/(发表文件帖|文件回复|附件回帖|回复).*成功|成功.*(发表文件帖|文件回复|附件回帖|回复)|获得\s*(妖晶|经验|金币|币)/.test(text)) {
		return true
	}
	if (/(失败|错误|验证码|登录|为空|限制|不能|请先|安全验证)/.test(text)) {
		return false
	}
	return /book_re_addfileshow|download\.aspx|进入主题|返回主题|查看回复|bbs-\d+\.html/.test(String(html || ''))
}

export function extractYaohuoUploadTip(html) {
	const tip = String(html || '').match(/<div class=["']tip["'][^>]*>([\s\S]*?)<\/div>/i)
	if (tip) {
		return stripHtml(tip[1])
	}
	const text = stripHtml(html)
	const successStart = Math.max(
		text.lastIndexOf('发表文件帖成功'),
		text.lastIndexOf('文件回复成功'),
		text.lastIndexOf('附件回帖成功'),
		text.lastIndexOf('回复成功')
	)
	if (successStart > -1) {
		const tail = text.slice(successStart)
		const endMarks = ['进入主题', '返回主题', '返回列表', '返回首页', '查看回复', 'UBB方法']
		let end = tail.length
		endMarks.forEach(mark => {
			const index = tail.indexOf(mark)
			if (index > -1 && index < end) {
				end = index
			}
		})
		const message = tail.slice(0, end).replace(/\s+/g, ' ').trim()
		if (message) {
			return message
		}
	}
	const successMatch = text.match(/((?:发表文件帖|文件回复|附件回帖|回复)[^返回进入查看]{0,80}成功[^返回进入查看]{0,120}(?:获得[^返回进入查看]{0,80})?)/)
	if (successMatch) {
		return successMatch[1].trim()
	}
	const lines = text.split(/\n+/).map(item => item.trim()).filter(Boolean)
	const useful = lines.filter(line => /(成功|失败|错误|获得|妖晶|经验|金币|币|请先|登录|限制|不能)/.test(line) &&
		!/返回主题|返回列表|返回首页|UBB方法/.test(line))
	return useful.slice(0, 3).join('\n')
}

function normalizeChooseFiles(res) {
	const files = res && res.tempFiles || []
	if (files.length) {
		return files.map((file, index) => {
			const path = file.path || file.tempFilePath || (res.tempFilePaths && res.tempFilePaths[index]) || ''
			return Object.assign({}, file, {
				path,
				name: file.name || getFileName(path)
			})
		})
	}
	return (res && res.tempFilePaths || []).map(path => ({
		path,
		name: getFileName(path),
		size: 0
	}))
}

function getFirstNumber(text) {
	const match = String(text || '').match(/\d+/)
	return match ? match[0] : ''
}

function getFileName(path) {
	path = String(path || '')
	return path.split(/[\\/]/).pop() || 'file'
}

function maskUploadFormData(data) {
	const copy = Object.assign({}, data || {})
	if (copy.book_content) {
		copy.contentLength = String(copy.book_content).length
		copy.contentPreview = String(copy.book_content).slice(0, 80)
		delete copy.book_content
	}
	return copy
}

function stripHtml(html) {
	return String(html || '')
		.replace(/<script\b[\s\S]*?<\/script>/gi, '')
		.replace(/<style\b[\s\S]*?<\/style>/gi, '')
		.replace(/<br\s*\/?>/gi, '\n')
		.replace(/<[^>]+>/g, '')
		.replace(/&nbsp;/g, ' ')
		.replace(/&amp;/g, '&')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.trim()
}
