<template>
	<view class="edit-page">
		<view v-if="loading" class="state-line">
			<text>加载修改页...</text>
		</view>

		<view v-else class="edit-panel">
			<view class="form-group">
				<text class="form-label">标题</text>
				<input class="form-control title-input" v-model="form.title" :maxlength="50" placeholder="请输入标题" />
			</view>

			<view class="form-group content-group">
				<view class="content-header">
					<text class="form-label">内容</text>
					<button class="browser-open-btn" size="mini" @click="openBrowser">浏览器打开</button>
				</view>
				<textarea class="form-control content-input" v-model="form.content" :maxlength="-1" :cursor-spacing="20"
					auto-height :adjust-position="true" :show-confirm-bar="false" placeholder="请输入帖子内容" />
			</view>

			<view class="editor-tools">
				<view class="tool-group">
					<view class="tool-button" @click="chooseImageHostUpload">
						<image src="../../static/picture.png" class="tool-image" mode="aspectFit"></image>
					</view>
					<view class="tool-button" @click="toggleUbbPanel">
						<view class="ubb-icon"><text>UBB</text></view>
					</view>
				</view>
				<text class="host-name">图床：{{currentImageHostName}}</text>
			</view>

			<view v-if="ubbPanelShow" class="ubb-panel">
				<view v-for="item in ubbTools" :key="item.label" class="ubb-chip" @click="handleUbbTool(item)">
					{{item.label}}
				</view>
			</view>

			<view class="reward-section">
				<view class="collapse-trigger" @click="showReward = !showReward">
					<view class="reward-title">
						<uni-icons type="gift" size="18" color="#3f8d65"></uni-icons>
						<text>追加悬赏</text>
					</view>
					<uni-icons :type="showReward ? 'arrowup' : 'arrowdown'" size="16" color="#68766f"></uni-icons>
				</view>
				<view v-if="showReward" class="reward-content">
					<input class="form-control reward-input" type="number" v-model="form.additionalReward"
						placeholder="选填，按官方规则追加" />
				</view>
			</view>

			<button class="submit-btn" type="primary" :loading="submitting" :disabled="submitting || loading"
				@click="submitEdit">确认修改</button>
		</view>
	</view>
</template>

<script>
	import {
		getAuthHeader,
		isLoginRequiredHtml
	} from '@/utils/auth.js'
	import {
		absoluteYaohuoUrl,
		decodeHtml,
		getAttr,
		stripHtml
	} from '@/utils/html.js'
	import {
		openInBrowser
	} from '@/utils/browser.js'
	import {
		UBB_TOOLS,
		appendText
	} from '@/utils/plugin-features.js'
	import {
		chooseImageHost,
		getImageHostShortName,
		getSelectedImageHostIndex,
		uploadImageToHost,
		uploadImageToSelectedHost
	} from '@/utils/image-hosts.js'
	import {
		chooseYaohuoLocalFile
	} from '@/utils/yaohuo-upload.js'

	export default {
		data() {
			return {
				url: '',
				postId: '',
				classId: '',
				formAction: '',
				hiddenFields: {},
				form: {
					title: '',
					content: '',
					additionalReward: ''
				},
				loading: false,
				submitting: false,
				ubbPanelShow: false,
				mediaBusy: false,
				imageHostIndex: getSelectedImageHostIndex()
			}
		},
		computed: {
			ubbTools() {
				return UBB_TOOLS
			},
			currentImageHostName() {
				return getImageHostShortName(this.imageHostIndex)
			}
		},
		onLoad(options) {
			this.postId = String((options && options.id) || '')
			this.classId = String((options && options.classid) || '177')
			this.url = this.normalizeUrl((options && options.url) || this.buildEditUrl())
			this.fetchEditForm()
		},
		methods: {
			buildEditUrl() {
				if (!this.postId) {
					return ''
				}
				const params = [
					'action=go',
					'id=' + encodeURIComponent(this.postId),
					'siteid=1000',
					'classid=' + encodeURIComponent(this.classId || '177'),
					'lpage=1'
				]
				return 'https://yaohuo.me/bbs/book_view_mod.aspx?' + params.join('&')
			},
			normalizeUrl(url) {
				try {
					url = decodeURIComponent(String(url || ''))
				} catch (e) {
					url = String(url || '')
				}
				return absoluteYaohuoUrl(url)
			},
			fetchEditForm() {
				if (!this.url) {
					return uni.showToast({
						title: '缺少修改入口',
						icon: 'none'
					})
				}
				this.loading = true
				uni.showLoading({
					title: '加载修改页'
				})
				uni.request({
					url: this.url,
					header: getAuthHeader(),
					success: res => {
						const html = String(res.data || '')
						if (isLoginRequiredHtml(html)) {
							return uni.showModal({
								title: '需要登录',
								content: '请重新登录后再修改帖子。',
								showCancel: false
							})
						}
						const form = this.parseEditForm(html)
						if (!form.action || !Object.keys(form.fields).length) {
							return uni.showModal({
								title: '加载失败',
								content: this.extractTip(html) || '没有找到官方修改表单。',
								showCancel: false
							})
						}
						this.formAction = form.action
						this.hiddenFields = form.fields
						this.form.title = form.fields.book_title || ''
						this.form.content = form.fields.book_content || ''
						this.form.additionalReward = form.fields.additionalReward || ''
						this.postId = form.fields.id || this.postId
						this.classId = form.fields.classid || this.classId
					},
					fail: () => {
						uni.showToast({
							title: '修改页加载失败',
							icon: 'none'
						})
					},
					complete: () => {
						this.loading = false
						uni.hideLoading()
					}
				})
			},
			parseEditForm(html) {
				const fields = {}
				const formHtml = this.extractEditFormHtml(html)
				const formTag = formHtml.match(/<form\b[^>]*>/i)
				const action = formTag && getAttr(formTag[0], 'action') ? absoluteYaohuoUrl(getAttr(formTag[0], 'action')) : ''
				let inputMatch
				const inputReg = /<input\b[^>]*>/ig
				while ((inputMatch = inputReg.exec(formHtml))) {
					const name = getAttr(inputMatch[0], 'name')
					if (name && !/disabled/i.test(inputMatch[0])) {
						fields[name] = getAttr(inputMatch[0], 'value')
					}
				}
				let textareaMatch
				const textareaReg = /<textarea\b[^>]*>[\s\S]*?<\/textarea>/ig
				while ((textareaMatch = textareaReg.exec(formHtml))) {
					const name = getAttr(textareaMatch[0], 'name')
					if (name) {
						const body = textareaMatch[0].match(/<textarea\b[^>]*>([\s\S]*?)<\/textarea>/i)
						fields[name] = decodeHtml(body ? body[1] : '')
							.replace(/\r\n/g, '\n')
							.replace(/\r/g, '\n')
					}
				}
				return {
					action,
					fields
				}
			},
			extractEditFormHtml(html) {
				const source = String(html || '')
				const forms = []
				let match
				const formReg = /<form\b[^>]*>[\s\S]*?<\/form>/ig
				while ((match = formReg.exec(source))) {
					forms.push(match[0])
				}
				return forms.find(form => /book_view_mod\.aspx|name\s*=\s*["']book_(?:title|content)["']/i.test(form)) || forms[0] || ''
			},
			buildEditData() {
				const data = Object.assign({}, this.hiddenFields)
				data.action = data.action || 'gomod'
				data.siteid = data.siteid || 1000
				data.id = data.id || this.postId
				data.classid = data.classid || this.classId
				data.book_title = String(this.form.title || '').trim()
				data.book_content = String(this.form.content || '').replace(/\n/g, '\r\n')
				data.additionalReward = String(this.form.additionalReward || '').replace(/[^\d]/g, '')
				return data
			},
			submitEdit() {
				const title = String(this.form.title || '').trim()
				const content = String(this.form.content || '').trim()
				if (!title) {
					return uni.showToast({
						title: '标题不能为空',
						icon: 'none'
					})
				}
				if (!content) {
					return uni.showToast({
						title: '内容不能为空',
						icon: 'none'
					})
				}
				this.submitting = true
				uni.request({
					url: this.formAction || this.url,
					method: 'POST',
					header: getAuthHeader({
						'Content-Type': 'application/x-www-form-urlencoded',
						'Referer': this.url
					}),
					data: this.formEncode(this.buildEditData()),
					success: res => {
						this.handleEditResponse(res)
					},
					fail: () => {
						uni.showToast({
							title: '修改失败',
							icon: 'none'
						})
					},
					complete: () => {
						this.submitting = false
					}
				})
			},
			handleEditResponse(res) {
				const html = String(res.data || '')
				const tip = this.extractTip(html)
				const text = stripHtml(html).slice(0, 500)
				console.log('[YAOHUO_POST_EDIT_RESPONSE]', {
					statusCode: res.statusCode,
					tip,
					text
				})
				if (isLoginRequiredHtml(html) || this.isFailureHtml(html, tip || text)) {
					return uni.showModal({
						title: '修改失败',
						content: tip || text || '服务器没有返回修改成功结果',
						showCancel: false
					})
				}
				if (!this.isEditSuccess(html, tip || text)) {
					return uni.showModal({
						title: '修改失败',
						content: tip || text || '服务器没有返回修改成功结果',
						showCancel: false
					})
				}
				uni.showModal({
					title: '修改成功',
					content: tip || '帖子内容已修改。',
					showCancel: false,
					success: () => {
						const id = this.postId || this.hiddenFields.id
						if (id) {
							uni.redirectTo({
								url: `/pages/detail/detail?id=${encodeURIComponent(id)}${this.classId ? '&classid=' + encodeURIComponent(this.classId) : ''}`
							})
						} else {
							uni.navigateBack()
						}
					}
				})
			},
			isEditSuccess(html, text) {
				if (/修改成功|成功修改|操作成功/.test(text || stripHtml(html))) {
					return true
				}
				return /返回主题|查看帖子|帖子内容/i.test(text || '') && !/book_title|确认修改/.test(String(html || ''))
			},
			isFailureHtml(html, text) {
				return /(失败|错误|验证码|登录|为空|加黑|限制|不能|无权限|没有权限|token|非法|过期)/.test(text || stripHtml(html))
			},
			extractTip(html) {
				const source = String(html || '')
				const patterns = [
					/<div\b[^>]*class\s*=\s*(["'])[^"']*\btip\b[^"']*\1[^>]*>([\s\S]*?)<\/div>/i,
					/<div\b[^>]*class\s*=\s*(["'])[^"']*\bcontent\b[^"']*\1[^>]*>([\s\S]*?)<\/div>/i
				]
				for (let i = 0; i < patterns.length; i++) {
					const match = source.match(patterns[i])
					const text = match ? stripHtml(match[2]) : ''
					if (text && !/^(首页|论坛|返回|标题|内容)/.test(text)) {
						return text.slice(0, 180)
					}
				}
				return ''
			},
			formEncode(data) {
				return Object.keys(data || {}).map(key => {
					const value = data[key] === undefined || data[key] === null ? '' : data[key]
					return encodeURIComponent(key) + '=' + encodeURIComponent(value)
				}).join('&')
			},
			insertText(text) {
				this.form.content = appendText(this.form.content, text)
			},
			toggleUbbPanel() {
				this.ubbPanelShow = !this.ubbPanelShow
			},
			handleUbbTool(item) {
				if (!item) {
					return
				}
				if (item.url) {
					this.ubbPanelShow = false
					return openInBrowser(item.url)
				}
				this.insertText(item.text)
				this.ubbPanelShow = false
			},
			chooseImageHostUpload() {
				if (this.mediaBusy) {
					return uni.showToast({
						title: '请先完成当前上传',
						icon: 'none'
					})
				}
				chooseImageHost(index => {
					this.imageHostIndex = index
					this.chooseMediaSource(source => {
						this.pickAndUploadMedia(source)
					})
				})
			},
			chooseMediaSource(callback) {
				uni.showActionSheet({
					itemList: ['拍摄', '相册', '文件管理器'],
					success: res => {
						const sources = ['camera', 'album', 'file']
						callback && callback(sources[res.tapIndex] || 'album')
					}
				})
			},
			pickAndUploadMedia(source) {
				this.mediaBusy = true
				const finish = () => {
					this.mediaBusy = false
				}
				const upload = (path, type) => {
					if (!path) {
						finish()
						return uni.showToast({
							title: '未选择文件',
							icon: 'none'
						})
					}
					uni.showLoading({
						title: '上传中'
					})
					const task = type === 'video' ? uploadImageToHost(path, 2) : uploadImageToSelectedHost(path)
					task.then(url => {
						this.insertText(type === 'video' ? `[movie=100%*100%]${url}|[/movie]` : `[img]${url}[/img]`)
						uni.hideLoading()
						finish()
						uni.showToast({
							title: '上传成功',
							icon: 'success'
						})
					}).catch(err => {
						uni.hideLoading()
						finish()
						uni.showModal({
							title: '上传失败',
							content: (err && err.message) || '图床接口暂时不可用',
							showCancel: false
						})
					})
				}
				if (source === 'file') {
					chooseYaohuoLocalFile(1).then(files => {
						const file = files[0] || {}
						const path = file.path || ''
						upload(path, /\.(mp4|mov|m4v|3gp|avi|mkv|webm)$/i.test(path || file.name || '') ? 'video' : 'image')
					}).catch(err => {
						finish()
						uni.showToast({
							title: (err && err.message) || '未选择文件',
							icon: 'none'
						})
					})
					return
				}
				uni.chooseImage({
					count: 1,
					sourceType: [source === 'camera' ? 'camera' : 'album'],
					success: res => {
						upload((res.tempFilePaths || [])[0], 'image')
					},
					fail: () => {
						finish()
						uni.showToast({
							title: '未选择图片',
							icon: 'none'
						})
					}
				})
			},
			openBrowser() {
				if (this.url) {
					openInBrowser(this.url)
				}
			}
		}
	}
</script>

<style scoped>
	.edit-page {
		min-height: 100vh;
		background: #f5f7f6;
		padding: 20rpx;
		box-sizing: border-box;
	}

	.state-line {
		padding: 32rpx 0;
		text-align: center;
		color: #7b8a82;
		font-size: 14px;
	}

	.edit-panel {
		background: #fff;
		border-radius: 8px;
		border: 1px solid #e3ece6;
		overflow: hidden;
	}

	.form-group {
		padding: 22rpx 24rpx 0;
	}

	.form-label {
		display: block;
		margin-bottom: 12rpx;
		color: #33443b;
		font-size: 14px;
		font-weight: 600;
	}

	.form-control {
		width: 100%;
		box-sizing: border-box;
		border: 1px solid #dfe8e2;
		border-radius: 7px;
		background: #fbfdfc;
		color: #1f2a24;
		font-size: 14px;
	}

	.title-input {
		height: 76rpx;
		line-height: 76rpx;
		padding: 0 18rpx;
	}

	.content-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16rpx;
	}

	.content-input {
		min-height: 420rpx;
		padding: 18rpx;
		line-height: 1.65;
	}

	.browser-open-btn {
		margin: 0;
		height: 52rpx;
		line-height: 52rpx;
		padding: 0 16rpx;
		border-radius: 999px;
		background: #eef7f2;
		color: #2f6f55;
		font-size: 12px;
	}

	.editor-tools {
		padding: 20rpx 24rpx 0;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16rpx;
	}

	.tool-group {
		display: flex;
		align-items: center;
		gap: 14rpx;
	}

	.tool-button {
		width: 64rpx;
		height: 64rpx;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 50%;
		background: #f1f6f3;
	}

	.tool-image {
		width: 42rpx;
		height: 42rpx;
	}

	.ubb-icon {
		width: 44rpx;
		height: 44rpx;
		border-radius: 50%;
		background: #2f6f55;
		color: #fff;
		font-size: 9px;
		font-weight: 700;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.host-name {
		color: #68766f;
		font-size: 12px;
	}

	.ubb-panel {
		margin: 18rpx 24rpx 0;
		padding: 14rpx;
		border-radius: 8px;
		background: #f7fbf8;
		border: 1px solid #e3ece6;
		display: flex;
		flex-wrap: wrap;
		gap: 12rpx;
	}

	.ubb-chip {
		padding: 8rpx 16rpx;
		border-radius: 999px;
		background: #fff;
		border: 1px solid #dce8e0;
		color: #3e5549;
		font-size: 12px;
	}

	.reward-section {
		margin: 20rpx 24rpx 0;
		border-radius: 8px;
		border: 1px solid #e3ece6;
		overflow: hidden;
	}

	.collapse-trigger {
		min-height: 76rpx;
		padding: 0 20rpx;
		background: #f7fbf8;
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.reward-title {
		display: flex;
		align-items: center;
		gap: 10rpx;
		color: #2f6f55;
		font-size: 14px;
		font-weight: 600;
	}

	.reward-content {
		padding: 18rpx 20rpx;
		background: #fff;
	}

	.reward-input {
		height: 68rpx;
		line-height: 68rpx;
		padding: 0 18rpx;
	}

	.submit-btn {
		width: auto;
		height: 78rpx;
		line-height: 78rpx;
		margin: 24rpx;
		padding: 0 34rpx;
		border-radius: 7px;
		background-color: #07c160;
		font-size: 16px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}
</style>
