<template>
	<view class="post-page">
		<view class="form-card">
			<view class="field-row">
				<text class="field-label">版块</text>
				<picker mode="selector" :range="boardOptions" range-key="name" :value="boardIndex"
					@change="changeBoard">
					<view class="picker-value">
						<text>{{currentBoardName}}</text>
						<uni-icons type="arrowright" size="16" color="#999"></uni-icons>
					</view>
				</picker>
			</view>

			<view class="field-block">
				<input class="title-input" v-model="form.title" maxlength="50" placeholder="帖子标题" />
			</view>

			<view class="tool-row">
				<view class="tool-group">
					<view class="tool-button" @click="toggleFacePanel">
						<image v-if="selectedFace" :src="getFaceUrl(selectedFace.face)" class="tool-image selected-face"
							mode="aspectFit"></image>
						<image v-else src="../../static/smile.png" class="tool-image" mode="aspectFit"></image>
					</view>
					<view class="tool-button" @click="uploadImage">
						<image src="../../static/picture.png" class="tool-image" mode="aspectFit"></image>
					</view>
					<view class="tool-button" @click="insertText('[b]加粗文字[/b]')">
						<text class="tool-text">B</text>
					</view>
					<view class="tool-button" @click="insertText('[url=链接]文字[/url]')">
						<uni-icons type="link" size="24" color="#555"></uni-icons>
					</view>
				</view>
				<button class="browser-open-btn" size="mini" @click="openBrowser">浏览器打开</button>
			</view>

			<view v-if="facePanelShow" class="face-panel">
				<scroll-view scroll-y class="face-scroll">
					<view class="face-grid">
						<view class="face-cell" :class="{active: !form.face}" @click="selectFace(0)">
							<text>无</text>
						</view>
						<view v-for="(item,index) in faceList" :key="item.face" class="face-cell"
							:class="{active: form.face === item.face}" @click="selectFace(index + 1)">
							<image :src="getFaceUrl(item.face)" mode="aspectFit"></image>
							<text>{{item.name}}</text>
						</view>
					</view>
				</scroll-view>
			</view>

			<view class="field-block content-block">
				<textarea class="content-input" v-model="form.content" :maxlength="-1" :cursor-spacing="20"
					:adjust-position="true" :show-confirm-bar="false" placeholder="写点内容..." />
			</view>
		</view>

		<view class="submit-bar">
			<button class="submit-btn" type="primary" :loading="submitting" :disabled="submitting || loadingForm"
				@click="submitPost">发表帖子</button>
		</view>
	</view>
</template>

<script>
	import faces from '@/utils/faces.js'
	import {
		getAuthHeader,
		getAuthSid,
		isLoginRequiredHtml
	} from '@/utils/auth.js'
	import {
		getAttr,
		stripHtml
	} from '@/utils/html.js'
	import {
		idArr
	} from '@/utils/yaohuo.js'
	import {
		openInBrowser
	} from '@/utils/browser.js'

	export default {
		data() {
			return {
				boardOptions: idArr,
				boardIndex: 0,
				classid: '177',
				form: {
					title: '',
					content: '',
					face: ''
				},
				formAction: '',
				hiddenFields: {},
				array: faces,
				faceIndex: 0,
				facePanelShow: false,
				loadingForm: false,
				submitting: false
			}
		},
		computed: {
			currentBoardName() {
				const board = this.boardOptions[this.boardIndex]
				return board ? board.name : '妖火茶馆'
			},
			faceList() {
				return this.array.filter(item => item.face)
			},
			selectedFace() {
				return this.array[this.faceIndex] && this.array[this.faceIndex].face ? this.array[this.faceIndex] : null
			}
		},
		onLoad(options) {
			const classid = String((options && options.classid) || '177')
			const index = this.boardOptions.findIndex(item => item.id === classid)
			this.boardIndex = index > -1 ? index : 0
			this.classid = this.boardOptions[this.boardIndex].id
			this.fetchPostForm()
		},
		methods: {
			getPostUrl() {
				return `https://yaohuo.me/bbs/book_view_add.aspx?siteid=1000&classid=${this.classid}`
			},
			changeBoard(e) {
				this.boardIndex = Number(e.detail.value || 0)
				this.classid = this.boardOptions[this.boardIndex].id
				this.fetchPostForm()
			},
			fetchPostForm() {
				this.loadingForm = true
				uni.showLoading({
					title: '加载发帖'
				})
				uni.request({
					url: this.getPostUrl(),
					header: getAuthHeader(),
					success: res => {
						const html = String(res.data || '')
						if (isLoginRequiredHtml(html)) {
							return uni.showModal({
								title: '需要登录',
								content: '请先登录后再发帖。',
								showCancel: false,
								success: () => {
									uni.redirectTo({
										url: '/pages/login/login'
									})
								}
							})
						}
						const form = this.parseForm(html)
						this.formAction = form.action || this.getPostUrl()
						this.hiddenFields = form.fields
					},
					fail: () => {
						uni.showToast({
							title: '发帖页加载失败',
							icon: 'none'
						})
					},
					complete: () => {
						this.loadingForm = false
						uni.hideLoading()
					}
				})
			},
			parseForm(html) {
				const fields = {}
				const formHtml = this.extractPostFormHtml(html)
				const formTag = formHtml.match(/<form\b[^>]*>/i)
				const action = formTag && getAttr(formTag[0], 'action') ? this.normalizeFormAction(getAttr(formTag[0], 'action')) : ''
				const inputReg = /<input\b[^>]*>/ig
				let inputMatch
				while ((inputMatch = inputReg.exec(formHtml))) {
					const name = getAttr(inputMatch[0], 'name')
					if (name) {
						fields[name] = getAttr(inputMatch[0], 'value')
					}
				}
				const textareaReg = /<textarea\b[^>]*>[\s\S]*?<\/textarea>/ig
				let textareaMatch
				while ((textareaMatch = textareaReg.exec(formHtml))) {
					const name = getAttr(textareaMatch[0], 'name')
					if (name) {
						const valueMatch = textareaMatch[0].match(/<textarea\b[^>]*>([\s\S]*?)<\/textarea>/i)
						fields[name] = valueMatch ? stripHtml(valueMatch[1]) : ''
					}
				}
				const selectReg = /<select\b[^>]*>[\s\S]*?<\/select>/ig
				let selectMatch
				while ((selectMatch = selectReg.exec(formHtml))) {
					const name = getAttr(selectMatch[0], 'name')
					if (!name) {
						continue
					}
					const selected = selectMatch[0].match(/<option\b[^>]*selected[^>]*>/i) || selectMatch[0].match(/<option\b[^>]*>/i)
					if (selected) {
						fields[name] = getAttr(selected[0], 'value')
					}
				}
				return {
					action,
					fields
				}
			},
			extractPostFormHtml(html) {
				html = String(html || '')
				const formReg = /<form\b[^>]*>[\s\S]*?<\/form>/ig
				const forms = []
				let match
				while ((match = formReg.exec(html))) {
					forms.push(match[0])
				}
				const postForm = forms.find(form => /name\s*=\s*["']book_(?:title|content)["']/i.test(form) ||
					/book_view_add/i.test(form))
				return postForm || forms[forms.length - 1] || html
			},
			normalizeFormAction(action) {
				action = String(action || '').replace(/&amp;/g, '&').trim()
				if (!action) {
					return ''
				}
				if (/^https?:\/\//i.test(action)) {
					return action
				}
				if (action.indexOf('//') === 0) {
					return 'https:' + action
				}
				if (action[0] === '/') {
					return 'https://yaohuo.me' + action
				}
				return 'https://yaohuo.me/bbs/' + action.replace(/^\.?\//, '')
			},
			buildPostData() {
				const data = Object.assign({}, this.hiddenFields)
				data.action = data.action || 'add'
				data.siteid = data.siteid || 1000
				data.classid = this.classid
				data.sid = getAuthSid()
				const title = this.form.title.trim()
				const content = this.form.content.replace(/\n/g, '\r\n')
				data.book_title = title
				data.title = title
				data.book_content = content
				data.content = content
				data.face = this.form.face || data.face || ''
				data.g = data.g || '发表主题'
				return data
			},
			submitPost() {
				if (!this.form.title.trim()) {
					return uni.showToast({
						title: '标题不得为空',
						icon: 'none'
					})
				}
				if (!this.form.content.trim()) {
					return uni.showToast({
						title: '内容不得为空',
						icon: 'none'
					})
				}
				this.submitting = true
				uni.request({
					url: this.formAction || this.getPostUrl(),
					method: 'POST',
					header: getAuthHeader({
						'Content-Type': 'application/x-www-form-urlencoded'
					}),
					data: this.buildPostData(),
					success: res => {
						const html = String(res.data || '')
						if (isLoginRequiredHtml(html) || this.isFailureHtml(html)) {
							return uni.showModal({
								title: '发帖失败',
								content: this.extractTip(html) || '服务器返回失败',
								showCancel: false
							})
						}
						const postId = this.extractPostId(html)
						uni.showToast({
							title: '发帖成功',
							icon: 'success'
						})
						if (postId) {
							setTimeout(() => {
								uni.redirectTo({
									url: `/pages/detail/detail?id=${postId}`
								})
							}, 600)
						} else {
							setTimeout(() => {
								uni.navigateBack()
							}, 600)
						}
					},
					fail: () => {
						uni.showToast({
							title: '发帖失败',
							icon: 'none'
						})
					},
					complete: () => {
						this.submitting = false
					}
				})
			},
			isFailureHtml(html) {
				return /<div class=["']tip["'][^>]*>[\s\S]*?(失败|错误|验证码|登录|为空|加黑|限制|不能|请先)/.test(String(html || ''))
			},
			extractTip(html) {
				const match = String(html || '').match(/<div class=["']tip["'][^>]*>([\s\S]*?)<\/div>/i)
				return match ? stripHtml(match[1]) : ''
			},
			extractPostId(html) {
				const text = String(html || '')
				const patterns = [
					/bbs-(\d+)\.html/i,
					/book_view\.aspx[^"']*[?&]id=(\d+)/i,
					/[?&]id=(\d{3,})/i
				]
				for (let i = 0; i < patterns.length; i++) {
					const match = text.match(patterns[i])
					if (match) {
						return match[1]
					}
				}
				return ''
			},
			getFaceUrl(face) {
				return face ? `https://yaohuo.me/face/${encodeURIComponent(face)}` : ''
			},
			toggleFacePanel() {
				this.facePanelShow = !this.facePanelShow
			},
			selectFace(index) {
				this.faceIndex = index
				const item = this.array[index]
				this.form.face = item && item.face ? item.face : ''
				this.facePanelShow = false
			},
			insertText(text) {
				this.form.content += `${this.form.content ? '\n' : ''}${text}`
			},
			extractUploadUrl(data) {
				if (!data) {
					return ''
				}
				if (typeof data === 'string') {
					const text = data.trim()
					if (/^https?:\/\//i.test(text)) {
						return text
					}
					try {
						return this.extractUploadUrl(JSON.parse(text))
					} catch (e) {
						const urlMatch = text.match(/https?:\/\/[^\s"'<>\\]+/i)
						return urlMatch ? urlMatch[0] : ''
					}
				}
				if (data.code === 200 && data.data && data.data.url) {
					return data.data.url
				}
				if (data.data) {
					if (typeof data.data === 'string' && /^https?:\/\//i.test(data.data)) {
						return data.data
					}
					if (Array.isArray(data.data) && data.data[0]) {
						return this.extractUploadUrl(data.data[0])
					}
					const dataUrl = this.extractUploadUrl(data.data)
					if (dataUrl) {
						return dataUrl
					}
				}
				if (data.url && /^https?:\/\//i.test(data.url)) {
					return data.url
				}
				for (const key in data) {
					if (typeof data[key] === 'string' && /^https?:\/\//i.test(data[key])) {
						return data[key]
					}
				}
				return ''
			},
			uploadToHost(filePath, hostIndex) {
				const hosts = [{
					url: 'https://tc.qdqqd.com/uploadmt',
					field: 'file'
				}, {
					url: 'https://aapi.helioho.st/upload.php',
					field: 'image'
				}, {
					url: 'https://yh-pic.ihcloud.net/api/qq.php',
					field: 'image'
				}]
				const host = hosts[hostIndex]
				if (!host) {
					return Promise.reject(new Error('全部图床都上传失败'))
				}
				return new Promise((resolve, reject) => {
					uni.uploadFile({
						url: host.url,
						filePath,
						name: host.field,
						header: {
							Referer: 'https://yaohuo.me/'
						},
						success: uploadFileRes => {
							const url = this.extractUploadUrl(uploadFileRes.data)
							if (url) {
								resolve(url)
							} else {
								reject(new Error(String(uploadFileRes.data || '').slice(0, 80) || '图床未返回图片地址'))
							}
						},
						fail: err => {
							reject(new Error((err && (err.errMsg || err.message)) || '上传请求失败'))
						}
					})
				}).catch(() => this.uploadToHost(filePath, hostIndex + 1))
			},
			uploadImage() {
				uni.chooseImage({
					count: 1,
					success: chooseImageRes => {
						const tempFilePaths = chooseImageRes.tempFilePaths
						uni.showLoading({
							title: '图片上传中'
						})
						this.uploadToHost(tempFilePaths[0], 0).then(url => {
							this.insertText(`[img]${url}[/img]`)
							uni.hideLoading()
							uni.showToast({
								title: '上传成功',
								icon: 'success'
							})
						}).catch(err => {
							uni.hideLoading()
							uni.showModal({
								title: '上传失败',
								content: (err && err.message) || '图床接口暂时不可用',
								showCancel: false
							})
						})
					},
					fail: () => {
						uni.showToast({
							title: '未选择图片',
							icon: 'none'
						})
					}
				})
			},
			openBrowser() {
				openInBrowser(this.getPostUrl())
			}
		}
	}
</script>

<style scoped>
	page {
		background-color: #f3f3f3;
	}

	.post-page {
		padding: 20rpx 20rpx 150rpx;
		box-sizing: border-box;
	}

	.form-card {
		background: #fff;
		border-radius: 8px;
		overflow: hidden;
	}

	.field-row {
		min-height: 96rpx;
		padding: 0 24rpx;
		border-bottom: 1px solid #eee;
		display: flex;
		align-items: center;
		justify-content: space-between;
		box-sizing: border-box;
	}

	.field-label {
		color: #333;
		font-size: 15px;
	}

	.picker-value {
		min-width: 220rpx;
		display: flex;
		align-items: center;
		justify-content: flex-end;
		color: #666;
		font-size: 15px;
	}

	.field-block {
		padding: 20rpx 24rpx;
		border-bottom: 1px solid #eee;
		box-sizing: border-box;
	}

	.title-input {
		width: 100%;
		height: 52rpx;
		line-height: 52rpx;
		font-size: 16px;
		color: #222;
	}

	.tool-row {
		height: 92rpx;
		padding: 10rpx 20rpx;
		border-bottom: 1px solid #eee;
		display: flex;
		align-items: center;
		justify-content: space-between;
		box-sizing: border-box;
	}

	.tool-group {
		display: flex;
		align-items: center;
		gap: 18rpx;
	}

	.tool-button {
		width: 72rpx;
		height: 72rpx;
		display: flex;
		align-items: center;
		justify-content: center;
		flex: 0 0 72rpx;
	}

	.tool-image {
		width: 70rpx;
		height: 70rpx;
		display: block;
	}

	.selected-face {
		width: 70rpx;
		height: 70rpx;
	}

	.tool-text {
		font-weight: 700;
		color: #555;
		font-size: 20px;
	}

	.browser-open-btn {
		color: #fff;
		height: 70rpx;
		line-height: 70rpx;
		background-color: #07c160;
		margin: 0;
		padding: 0 28rpx;
		flex: 0 0 auto;
	}

	.face-panel {
		background: #fff;
		border-bottom: 1px solid #eee;
	}

	.face-scroll {
		height: 330rpx;
	}

	.face-grid {
		display: flex;
		flex-wrap: wrap;
		padding: 10rpx;
	}

	.face-cell {
		width: 20%;
		height: 106rpx;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		box-sizing: border-box;
		border-radius: 8rpx;
		color: #666;
		font-size: 10px;
	}

	.face-cell.active {
		background: #eaf7f4;
		color: #0a8f7c;
	}

	.face-cell image {
		width: 58rpx;
		height: 58rpx;
		margin-bottom: 4rpx;
	}

	.face-cell text {
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.content-block {
		border-bottom: none;
	}

	.content-input {
		width: 100%;
		min-height: 520rpx;
		font-size: 15px;
		line-height: 22px;
		color: #222;
	}

	.submit-bar {
		position: fixed;
		left: 0;
		right: 0;
		bottom: 0;
		padding: 16rpx 20rpx 24rpx;
		background: #f7f7f7;
		box-sizing: border-box;
	}

	.submit-btn {
		height: 84rpx;
		line-height: 84rpx;
		background-color: #07c160;
		font-size: 16px;
	}
</style>
