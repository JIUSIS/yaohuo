const IMAGE_HOST_INDEX_KEY = 'yaohuo_image_host_index'
const SUIMO_TOKEN_KEY = 'yaohuo_suimo_token'

export const IMAGE_HOSTS = [{
	key: 'meituan',
	label: '美团图床',
	shortName: '美团',
	url: 'https://mtbed.netsons.org/upload.php',
	field: 'image'
}, {
	key: 'suimo',
	label: '水墨图床',
	shortName: '水墨',
	url: 'https://img.ink/api/upload',
	field: 'image',
	tokenKey: SUIMO_TOKEN_KEY
}, {
	key: 'keyun',
	label: '柯艺云图床',
	shortName: '柯云',
	url: 'https://tc.qdqqd.com/uploadmt',
	field: 'file'
}]

const DEFAULT_IMAGE_HOST_INDEX = 2

function clampHostIndex(index) {
	index = Number(index)
	return index >= 0 && index < IMAGE_HOSTS.length ? index : DEFAULT_IMAGE_HOST_INDEX
}

export function getSelectedImageHostIndex() {
	try {
		return clampHostIndex(uni.getStorageSync(IMAGE_HOST_INDEX_KEY))
	} catch (e) {
		return DEFAULT_IMAGE_HOST_INDEX
	}
}

export function setSelectedImageHostIndex(index) {
	index = clampHostIndex(index)
	uni.setStorageSync(IMAGE_HOST_INDEX_KEY, String(index))
	return index
}

export function getImageHost(index) {
	return IMAGE_HOSTS[clampHostIndex(index)]
}

export function getSelectedImageHost() {
	return getImageHost(getSelectedImageHostIndex())
}

export function getImageHostShortName(index) {
	return getImageHost(index).shortName
}

export function getSuimoToken() {
	try {
		return String(uni.getStorageSync(SUIMO_TOKEN_KEY) || '').trim()
	} catch (e) {
		return ''
	}
}

export function setSuimoToken(token) {
	uni.setStorageSync(SUIMO_TOKEN_KEY, String(token || '').trim())
}

function getUploadHeader(host) {
	const header = {
		Referer: 'https://yaohuo.me/'
	}
	if (host && host.key === 'suimo') {
		const token = getSuimoToken()
		if (token) {
			header.token = token
		}
	}
	return header
}

function tryParseJson(text) {
	if (typeof text !== 'string') {
		return text
	}
	const trimmed = text.trim()
	if (!trimmed || !/^[\[{]/.test(trimmed)) {
		return text
	}
	try {
		return JSON.parse(trimmed)
	} catch (e) {
		return text
	}
}

export function extractImageUploadUrl(data) {
	data = tryParseJson(data)
	if (!data) {
		return ''
	}
	if (typeof data === 'string') {
		const text = data.trim()
		if (/^https?:\/\//i.test(text)) {
			return text
		}
		const match = text.match(/https?:\/\/[^\s"'<>\\]+/i)
		return match ? match[0] : ''
	}
	if (Array.isArray(data)) {
		for (let i = 0; i < data.length; i++) {
			const url = extractImageUploadUrl(data[i])
			if (url) {
				return url
			}
		}
		return ''
	}
	if (typeof data === 'object') {
		const directKeys = ['url', 'src', 'link', 'path', 'image', 'file', 'fileUrl', 'href']
		for (let i = 0; i < directKeys.length; i++) {
			const value = data[directKeys[i]]
			const url = typeof value === 'string' ? extractImageUploadUrl(value) : ''
			if (url) {
				return url
			}
		}
		if (data.data) {
			const url = extractImageUploadUrl(data.data)
			if (url) {
				return url
			}
		}
		for (const key in data) {
			const url = extractImageUploadUrl(data[key])
			if (url) {
				return url
			}
		}
	}
	return ''
}

export function uploadImageToHost(filePath, hostIndex) {
	const host = getImageHost(hostIndex)
	if (host.key === 'suimo' && !getSuimoToken()) {
		return Promise.reject(new Error('请先设置水墨图床 token'))
	}
	return new Promise((resolve, reject) => {
		uni.uploadFile({
			url: host.url,
			filePath,
			name: host.field,
			header: getUploadHeader(host),
			success: uploadFileRes => {
				const url = extractImageUploadUrl(uploadFileRes.data)
				if (url) {
					resolve(url)
				} else {
					reject(new Error(String(uploadFileRes.data || '').slice(0, 80) || `${host.label}未返回图片地址`))
				}
			},
			fail: err => {
				reject(new Error((err && (err.errMsg || err.message)) || `${host.label}上传请求失败`))
			}
		})
	})
}

export function uploadImageToSelectedHost(filePath) {
	return uploadImageToHost(filePath, getSelectedImageHostIndex())
}

function promptSuimoToken(onConfirm, onCancel) {
	uni.showModal({
		title: '水墨图床 token',
		content: '请输入 img.ink 的 token，留空不能上传。',
		editable: true,
		placeholderText: 'token',
		success: res => {
			if (res.confirm) {
				setSuimoToken(res.content || '')
				onConfirm && onConfirm()
			} else {
				onCancel && onCancel()
			}
		},
		fail: () => {
			onCancel && onCancel()
		}
	})
}

export function chooseImageHost(onChange) {
	const previousIndex = getSelectedImageHostIndex()
	const itemList = IMAGE_HOSTS.map((host, index) => `${host.label}${index === previousIndex ? '（当前）' : ''}`)
	uni.showActionSheet({
		itemList,
		success: res => {
			const index = clampHostIndex(res.tapIndex)
			const host = getImageHost(index)
			const finish = () => {
				setSelectedImageHostIndex(index)
				onChange && onChange(index)
				uni.showToast({
					title: `已切换${host.shortName}`,
					icon: 'none'
				})
			}
			if (host.key === 'suimo') {
				return promptSuimoToken(finish)
			}
			finish()
		}
	})
}
