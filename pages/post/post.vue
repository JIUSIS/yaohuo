<template>
	<view class="post-page">
		<view class="upload-container">
			<view class="board-select-card">
				<picker mode="selector" :range="boardOptions" range-key="name" :value="boardIndex" @change="changeBoard">
					<view class="board-select-row">
						<view class="board-select-text">
							<text class="board-select-label">发帖版块</text>
							<text class="board-select-name">{{currentBoardName}}</text>
						</view>
						<uni-icons type="arrowdown" size="17" color="#7b8a82"></uni-icons>
					</view>
				</picker>
			</view>

			<view v-if="draftNotice" class="notification-container">
				<view class="custom-notification">
					<text>{{draftNotice}}</text>
				</view>
			</view>

			<view class="content-card">
				<view class="form-group">
					<text class="form-label">标题</text>
					<input class="form-control title-input" v-model="form.title" :maxlength="50"
						:placeholder="'最少' + minTitleLength + '个字符'" @input="handleDraftInput" />
				</view>

				<view class="form-group content-group">
					<view class="content-header">
						<text class="form-label">内容</text>
						<view class="textarea-actions">
							<button class="action-btn-small" size="mini" @click="saveDraft(false)">
								<uni-icons type="download" size="14" color="#2f6f55"></uni-icons>
								<text>保存草稿</text>
							</button>
							<button v-if="hasDraftContent" class="action-btn-small" size="mini" @click="clearDraft">
								<uni-icons type="trash" size="14" color="#7d3f3f"></uni-icons>
								<text>清除草稿</text>
							</button>
						</view>
					</view>
					<textarea class="form-control content-input" v-model="form.content" :maxlength="-1"
						:cursor-spacing="20" auto-height :adjust-position="true" :show-confirm-bar="false"
						:placeholder="contentPlaceholder" @input="handleDraftInput" />
				</view>

				<view class="editor-tools">
					<view class="tool-group">
						<view class="tool-button" @click="toggleFacePanel">
							<image v-if="selectedPluginEmoji" :src="selectedPluginEmoji" class="tool-image selected-face"
								mode="aspectFit"></image>
							<image v-else-if="selectedFace" :src="getFaceUrl(selectedFace.face)" class="tool-image selected-face"
								mode="aspectFit"></image>
							<image v-else src="../../static/smile.png" class="tool-image" mode="aspectFit"></image>
						</view>
						<view class="tool-button" @click="toggleMediaPanel">
							<image src="../../static/picture.png" class="tool-image" mode="aspectFit"></image>
						</view>
						<view class="tool-button" @click="toggleUbbPanel">
							<view class="ubb-icon"><text>UBB</text></view>
						</view>
					</view>
					<button class="browser-open-btn" size="mini" @click="openBrowser">浏览器打开</button>
				</view>

				<view v-if="mediaPanelShow" class="media-panel">
					<view class="media-circle-btn local" :class="{disabled: mediaActionBusy}" @click="openLocalPostUpload">本地上传</view>
					<view class="media-circle-btn upload" :class="{disabled: mediaActionBusy}" @click="chooseImageHostUpload">图床上传</view>
				</view>

				<view v-if="ubbPanelShow" class="ubb-panel">
					<view v-for="item in ubbTools" :key="item.label" class="ubb-chip" @click="handleUbbTool(item)">
						{{item.label}}
					</view>
				</view>

				<view v-if="facePanelShow" class="face-panel">
					<scroll-view scroll-y class="face-scroll">
						<view class="face-grid">
							<view class="face-cell" :class="{active: !form.face && !selectedPluginEmoji}" @click="selectFace(0)">
								<text>无</text>
							</view>
							<view v-for="(item,index) in faceList" :key="item.face" class="face-cell"
								:class="{active: form.face === item.face}" @click="selectFace(index + 1)">
								<image :src="getFaceUrl(item.face)" mode="aspectFit"></image>
								<text>{{item.name}}</text>
							</view>
							<view v-for="item in pluginEmojiList" :key="item.url" class="face-cell plugin-emoji-cell"
								:class="{active: selectedPluginEmoji === item.url}" @click="insertPluginEmoji(item)">
								<image :src="item.url" mode="aspectFit"></image>
								<text>{{item.name}}</text>
							</view>
						</view>
					</scroll-view>
				</view>

				<view v-if="localPostFile && localPostFile.path" class="local-file-card">
					<view class="local-file-info">
						<text class="local-file-name">{{localPostFile.name || '已选择文件'}}</text>
						<text class="local-file-meta">{{formatFileSize(localPostFile.size)}} · 将发表为文件帖</text>
					</view>
					<button class="local-file-remove" size="mini" @click="clearLocalPostFile">移除</button>
				</view>

				<view class="reward-section">
					<view class="collapse-trigger" @click="toggleReward">
						<view class="reward-title">
							<uni-icons type="gift" size="18" color="#3f8d65"></uni-icons>
							<text>悬赏妖晶</text>
						</view>
						<uni-icons :type="showReward ? 'arrowup' : 'arrowdown'" size="16" color="#68766f"></uni-icons>
					</view>
					<view v-if="showReward" class="reward-content">
						<input class="form-control reward-input" type="number" v-model="form.rewardMoney" :maxlength="8"
							:placeholder="'选填，最少' + rewardMin" @input="handleDraftInput" />
					</view>
				</view>

				<button class="submit-btn" type="primary" :loading="submitting" :disabled="submitting || loadingForm"
					@click="submitPost">{{localPostFile && localPostFile.path ? '发表文件帖' : '发表新帖'}}</button>
			</view>

			<view class="nav-buttons">
				<view v-for="item in postNavItems" :key="item.label" class="nav-btn" @click="openOfficialNav(item)">
					<uni-icons :type="item.icon" size="18" color="#4f6d60"></uni-icons>
					<text>{{item.label}}</text>
				</view>
			</view>
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
		PLUGIN_EMOJIS
	} from '@/utils/plugin-emojis.js'
	import {
		chooseYaohuoLocalFile,
		extractYaohuoUploadTip,
		getYaohuoPostFileUrl,
		isYaohuoUploadSuccess,
		uploadYaohuoPostFile
	} from '@/utils/yaohuo-upload.js'

	const POST_BOARD_OPTIONS = [{
		id: '177',
		name: '妖火茶馆'
	}, {
		id: '213',
		name: '悬赏问答'
	}, {
		id: '201',
		name: '资源分享'
	}, {
		id: '197',
		name: '技术教程'
	}, {
		id: '204',
		name: '活动线报'
	}, {
		id: '203',
		name: '免流讨论'
	}, {
		id: '240',
		name: '贴图视频'
	}, {
		id: '299',
		name: '拼团互助'
	}, {
		id: '199',
		name: '站务处理'
	}, {
		id: '198',
		name: '投诉建议'
	}]

	export default {
		data() {
			return {
				boardOptions: POST_BOARD_OPTIONS,
				boardIndex: 0,
				classid: '177',
				form: {
					title: '',
					content: '',
					face: '',
					rewardMoney: ''
				},
				formAction: '',
				hiddenFields: {},
				array: faces,
				faceIndex: 0,
				facePanelShow: false,
				mediaPanelShow: false,
				mediaActionBusy: false,
				mediaActionName: '',
				mediaActionTimer: null,
				ubbPanelShow: false,
				selectedPluginEmoji: '',
				localPostFile: null,
				imageHostIndex: getSelectedImageHostIndex(),
				showReward: false,
				draftNotice: '',
				draftTimer: null,
				draftNoticeTimer: null,
				minTitleLength: 5,
				minContentLength: 15,
				rewardMin: 1000,
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
			pluginEmojiList() {
				return PLUGIN_EMOJIS
			},
			selectedFace() {
				return this.array[this.faceIndex] && this.array[this.faceIndex].face ? this.array[this.faceIndex] : null
			},
			ubbTools() {
				return UBB_TOOLS
			},
			currentImageHostName() {
				return getImageHostShortName(this.imageHostIndex)
			},
			hasPostContent() {
				return !!(String(this.form.content || '').trim() || this.selectedPluginEmoji)
			},
			hasDraftContent() {
				return !!(String(this.form.title || '').trim() || String(this.form.content || '').trim())
			},
			postPageTitle() {
				return this.localPostFile && this.localPostFile.path ? '发表文件帖' : '发表新主题'
			},
			contentPlaceholder() {
				return '帖子发到对应版块，以免被删除。'
			},
			postNavItems() {
				return [{
					label: '发表派币帖',
					icon: 'wallet',
					type: 'sendmoney'
				}, {
					label: '发表投票帖',
					icon: 'checkbox',
					type: 'vote'
				}, {
					label: '发表资源帖',
					icon: 'paperclip',
					type: 'resource'
				}, {
					label: 'UBB方法',
					icon: 'compose',
					type: 'ubb'
				}]
			}
		},
		onLoad(options) {
			const classid = String((options && options.classid) || '177')
			const index = this.boardOptions.findIndex(item => item.id === classid)
			this.boardIndex = index > -1 ? index : 0
			this.classid = this.boardOptions[this.boardIndex].id
			this.restoreDraft()
			this.fetchPostForm()
		},
		onUnload() {
			this.clearDraftTimers()
		},
		methods: {
			getDraftKey() {
				return `yaohuo_post_draft_${this.classid || '177'}`
			},
			getPostUrl() {
				return `https://yaohuo.me/bbs/book_view_add.aspx?siteid=1000&classid=${this.classid}`
			},
			getLocalPostUploadUrl() {
				return getYaohuoPostFileUrl(this.classid)
			},
			changeBoard(e) {
				if (this.hasDraftContent) {
					this.saveDraft(true)
				}
				this.boardIndex = Number(e.detail.value || 0)
				this.classid = this.boardOptions[this.boardIndex].id
				this.restoreDraft()
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
				data.action = data.action || 'gomod'
				data.siteid = data.siteid || 1000
				data.classid = this.classid
				data.sid = getAuthSid()
				const title = this.form.title.trim()
				const content = this.getContentWithSelectedPluginEmoji(this.form.content).replace(/\n/g, '\r\n')
				data.book_title = title
				data.title = title
				data.book_content = content
				data.content = content
				data.face = this.form.face || data.face || ''
				const rewardMoney = String(this.form.rewardMoney || '').replace(/[^\d]/g, '')
				if (rewardMoney) {
					data.sendmoney = rewardMoney.slice(0, 8)
				} else {
					delete data.sendmoney
				}
				data.g = data.g || '发表主题'
				return data
			},
			submitPost() {
				const title = this.form.title.trim()
				const content = this.getContentWithSelectedPluginEmoji(this.form.content).trim()
				if (!title) {
					return uni.showToast({
						title: '标题不得为空',
						icon: 'none'
					})
				}
				if (title.length < this.minTitleLength) {
					return uni.showToast({
						title: `标题最少${this.minTitleLength}个字符`,
						icon: 'none'
					})
				}
				if (!content) {
					return uni.showToast({
						title: '内容不得为空',
						icon: 'none'
					})
				}
				if (content.length < this.minContentLength) {
					return uni.showToast({
						title: `内容最少${this.minContentLength}个字符`,
						icon: 'none'
					})
				}
				const rewardMoney = Number(String(this.form.rewardMoney || '').replace(/[^\d]/g, '') || 0)
				if (rewardMoney > 0 && rewardMoney < this.rewardMin) {
					return uni.showToast({
						title: `悬赏最少${this.rewardMin}妖晶`,
						icon: 'none'
					})
				}
				if (this.localPostFile && this.localPostFile.path) {
					return this.submitLocalPostFile()
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
						this.removeDraft()
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
			submitLocalPostFile() {
				const file = this.localPostFile || {}
				if (!file.path) {
					return uni.showToast({
						title: '请先选择文件',
						icon: 'none'
					})
				}
				const title = this.form.title.trim()
				const content = this.getContentWithSelectedPluginEmoji(this.form.content).replace(/\n/g, '\r\n')
				const sourceUrl = this.getLocalPostUploadUrl()
				this.submitting = true
				uni.showLoading({
					title: '文件帖上传中'
				})
				console.log('[YAOHUO_LOCAL_POST_UPLOAD_START]', {
					classId: this.classid,
					fileName: file.name || '',
					fileSize: file.size || 0
				})
				uploadYaohuoPostFile({
					file,
					url: sourceUrl,
					classId: this.classid,
					title,
					content,
					fileInfo: ''
				}).then(res => {
					const html = String(res.data || '')
					const tip = extractYaohuoUploadTip(html)
					const success = Number(res.statusCode || 0) < 400 && isYaohuoUploadSuccess(html)
					const postId = this.extractPostId(html)
					uni.hideLoading()
					console.log('[YAOHUO_LOCAL_POST_UPLOAD_END]', {
						statusCode: res.statusCode,
						success,
						postId,
						fileName: res.fileName,
						fileSize: res.fileSize,
						formData: res.formData,
						tip,
						text: stripHtml(html).slice(0, 800),
						html: html.slice(0, 800)
					})
					if (!success) {
						this.submitting = false
						return uni.showModal({
							title: '文件帖失败',
							content: tip || '服务器没有返回发表文件帖成功结果',
							showCancel: false
						})
					}
					this.localPostFile = null
					this.removeDraft()
					uni.showModal({
						title: '发表文件帖成功',
						content: tip || '发表文件帖成功',
						showCancel: false,
						success: () => {
							if (postId) {
								uni.redirectTo({
									url: `/pages/detail/detail?id=${postId}`
								})
								return
							}
							uni.navigateBack()
						}
					})
					this.submitting = false
				}).catch(err => {
					uni.hideLoading()
					console.log('[YAOHUO_LOCAL_POST_UPLOAD_END]', {
						success: false,
						errMsg: (err && err.message) || String(err || '')
					})
					uni.showModal({
						title: '文件帖失败',
						content: (err && err.message) || '妖火文件帖接口暂时不可用',
						showCancel: false
					})
					this.submitting = false
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
				if (this.facePanelShow) {
					this.ubbPanelShow = false
					this.mediaPanelShow = false
				}
			},
			toggleUbbPanel() {
				this.ubbPanelShow = !this.ubbPanelShow
				if (this.ubbPanelShow) {
					this.facePanelShow = false
					this.mediaPanelShow = false
				}
			},
			toggleMediaPanel() {
				this.mediaPanelShow = !this.mediaPanelShow
				if (this.mediaPanelShow) {
					this.facePanelShow = false
					this.ubbPanelShow = false
				}
			},
			toggleReward() {
				this.showReward = !this.showReward
			},
			selectFace(index) {
				this.faceIndex = index
				const item = this.array[index]
				this.form.face = item && item.face ? item.face : ''
				this.selectedPluginEmoji = ''
				this.facePanelShow = false
				this.ubbPanelShow = false
				this.mediaPanelShow = false
			},
			insertText(text) {
				this.form.content = appendText(this.form.content, text)
				this.handleDraftInput()
			},
			insertUbb(text) {
				this.insertText(text)
				this.ubbPanelShow = false
			},
			handleUbbTool(item) {
				if (!item) {
					return
				}
				if (item.url) {
					this.ubbPanelShow = false
					return openInBrowser(item.url)
				}
				this.insertUbb(item.text)
			},
			insertPluginEmoji(item) {
				if (!item || !item.url) {
					return
				}
				this.selectedPluginEmoji = item.url
				this.faceIndex = 0
				this.form.face = ''
				this.facePanelShow = false
				this.handleDraftInput()
			},
			getContentWithSelectedPluginEmoji(content) {
				if (!this.selectedPluginEmoji) {
					return String(content || '')
				}
				return appendText(content, `[img]${this.selectedPluginEmoji}[/img]`)
			},
			switchImageHost() {
				if (this.mediaActionBusy) {
					console.log('[YAOHUO_MEDIA_BUSY_SKIP]', {
						action: 'switchHost',
						current: this.mediaActionName
					})
					return uni.showToast({
						title: '请先完成当前操作',
						icon: 'none'
					})
				}
				chooseImageHost(index => {
					this.imageHostIndex = index
				})
			},
			startMediaAction(action) {
				if (this.mediaActionBusy) {
					console.log('[YAOHUO_MEDIA_BUSY_SKIP]', {
						action,
						current: this.mediaActionName
					})
					uni.showToast({
						title: '请先完成当前操作',
						icon: 'none'
					})
					return false
				}
				this.mediaActionBusy = true
				this.mediaActionName = action
				this.clearMediaActionTimer()
				this.mediaActionTimer = setTimeout(() => {
					if (this.mediaActionBusy && this.mediaActionName === action) {
						console.log('[YAOHUO_MEDIA_PICK_TIMEOUT]', {
							action
						})
						this.finishMediaAction(action)
					}
				}, 12000)
				console.log('[YAOHUO_MEDIA_PICK_START]', {
					action
				})
				return true
			},
			finishMediaAction(action) {
				if (!this.mediaActionBusy) {
					return
				}
				console.log('[YAOHUO_MEDIA_PICK_END]', {
					action: action || this.mediaActionName
				})
				this.clearMediaActionTimer()
				this.mediaActionBusy = false
				this.mediaActionName = ''
			},
			clearMediaActionTimer() {
				if (this.mediaActionTimer) {
					clearTimeout(this.mediaActionTimer)
					this.mediaActionTimer = null
				}
			},
			uploadPickedMedia(filePath, mediaType) {
				const action = this.mediaActionName || 'upload'
				if (!filePath) {
					console.log('[YAOHUO_MEDIA_PICK_RESULT]', {
						action,
						hasFile: false,
						mediaType: mediaType || ''
					})
					this.finishMediaAction(action)
					uni.showToast({
						title: '未选择文件',
						icon: 'none'
					})
					return
				}
				const isVideo = String(mediaType || '').toLowerCase() === 'video'
				console.log('[YAOHUO_MEDIA_UPLOAD_START]', {
					action,
					mediaType: isVideo ? 'video' : 'image',
					hostIndex: getSelectedImageHostIndex()
				})
				uni.showLoading({
					title: isVideo ? '视频上传中' : '图片上传中'
				})
				this.imageHostIndex = getSelectedImageHostIndex()
				const uploader = isVideo ? uploadImageToHost(filePath, 2) : uploadImageToSelectedHost(filePath)
				uploader.then(url => {
					this.insertText(isVideo ? `[movie=100%*100%]${url}|[/movie]` : `[img]${url}[/img]`)
					this.mediaPanelShow = false
					uni.hideLoading()
					this.finishMediaAction(action)
					console.log('[YAOHUO_MEDIA_UPLOAD_END]', {
						action,
						success: true,
						mediaType: isVideo ? 'video' : 'image',
						hasUrl: !!url
					})
					uni.showToast({
						title: '上传成功',
						icon: 'success'
					})
				}).catch(err => {
					uni.hideLoading()
					this.finishMediaAction(action)
					console.log('[YAOHUO_MEDIA_UPLOAD_END]', {
						action,
						success: false,
						mediaType: isVideo ? 'video' : 'image',
						errMsg: (err && err.message) || String(err || '')
					})
					uni.showModal({
						title: '上传失败',
						content: (err && err.message) || '图床接口暂时不可用',
						showCancel: false
					})
				})
			},
			captureMedia() {
				const action = 'camera'
				if (!this.startMediaAction(action)) {
					return
				}
				let picked = false
				try {
					uni.chooseImage({
						count: 1,
						sourceType: ['camera'],
						success: chooseImageRes => {
							picked = true
							const tempFilePaths = chooseImageRes.tempFilePaths || []
							console.log('[YAOHUO_MEDIA_PICK_RESULT]', {
								action,
								hasFile: !!tempFilePaths[0],
								count: tempFilePaths.length
							})
							this.uploadPickedMedia(tempFilePaths[0], 'image')
						},
						fail: err => {
							console.log('[YAOHUO_MEDIA_PICK_RESULT]', {
								action,
								hasFile: false,
								errMsg: err && err.errMsg || ''
							})
							uni.showToast({
								title: '未拍摄内容',
								icon: 'none'
							})
						},
						complete: () => {
							if (!picked) {
								this.finishMediaAction(action)
							}
						}
					})
				} catch (err) {
					this.finishMediaAction(action)
					console.log('[YAOHUO_MEDIA_PICK_RESULT]', {
						action,
						hasFile: false,
						errMsg: (err && err.message) || String(err || '')
					})
					uni.showToast({
						title: '拍摄失败',
						icon: 'none'
					})
				}
			},
			openLocalPostUpload() {
				if (this.mediaActionBusy) {
					console.log('[YAOHUO_MEDIA_BUSY_SKIP]', {
						action: 'localPost',
						current: this.mediaActionName
					})
					return uni.showToast({
						title: '请先完成当前操作',
						icon: 'none'
					})
				}
				this.mediaPanelShow = false
				this.chooseMediaSource(source => {
					const action = 'localPost'
					if (!this.startMediaAction(action)) {
						return
					}
					this.pickLocalPostSource(source, action)
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
			pickLocalPostSource(source, action) {
				if (source === 'camera') {
					this.pickPostImage(['camera'], action, file => {
						this.setLocalPostFile(file, action)
					})
					return
				}
				if (source === 'album') {
					this.chooseAlbumMedia(action, (file) => {
						this.setLocalPostFile(file, action)
					})
					return
				}
				chooseYaohuoLocalFile(1).then(files => {
					this.setLocalPostFile(files[0], action)
				}).catch(err => {
					console.log('[YAOHUO_LOCAL_POST_PICK_RESULT]', {
						hasFile: false,
						errMsg: (err && err.message) || String(err || '')
					})
					const message = (err && err.message) || ''
					this.finishMediaAction(action)
					if (/不支持文件选择/.test(message)) {
						this.openLocalPostUploadFallback()
						return
					}
					uni.showToast({
						title: '未选择文件',
						icon: 'none'
					})
				})
			},
			setLocalPostFile(file, action) {
				if (!file || !file.path) {
					this.finishMediaAction(action)
					return uni.showToast({
						title: '未选择文件',
						icon: 'none'
					})
				}
				this.localPostFile = file
				this.mediaPanelShow = false
				console.log('[YAOHUO_LOCAL_POST_PICK_RESULT]', {
					hasFile: true,
					fileName: file.name || '',
					fileSize: file.size || 0
				})
				uni.showToast({
					title: '已选择文件',
					icon: 'success'
				})
				this.finishMediaAction(action)
			},
			pickPostImage(sourceType, action, callback) {
				let picked = false
				try {
					uni.chooseImage({
						count: 1,
						sourceType,
						success: chooseImageRes => {
							picked = true
							const tempFilePaths = chooseImageRes.tempFilePaths || []
							const tempFiles = chooseImageRes.tempFiles || []
							const path = tempFilePaths[0] || (tempFiles[0] && (tempFiles[0].path || tempFiles[0].tempFilePath)) || ''
							console.log('[YAOHUO_MEDIA_PICK_RESULT]', {
								action,
								hasFile: !!path,
								count: tempFilePaths.length || tempFiles.length
							})
							callback && callback({
								path,
								name: this.getFileName(path),
								size: tempFiles[0] && tempFiles[0].size || 0
							}, 'image')
						},
						fail: err => {
							console.log('[YAOHUO_MEDIA_PICK_RESULT]', {
								action,
								hasFile: false,
								errMsg: err && err.errMsg || ''
							})
							uni.showToast({
								title: '未选择图片',
								icon: 'none'
							})
						},
						complete: () => {
							if (!picked) {
								this.finishMediaAction(action)
							}
						}
					})
				} catch (err) {
					this.finishMediaAction(action)
					console.log('[YAOHUO_MEDIA_PICK_RESULT]', {
						action,
						hasFile: false,
						errMsg: (err && err.message) || String(err || '')
					})
					uni.showToast({
						title: '选择失败',
						icon: 'none'
					})
				}
			},
			chooseAlbumMedia(action, callback) {
				uni.showActionSheet({
					itemList: ['图片', '视频'],
					success: res => {
						if (res.tapIndex === 1) {
							this.pickPostVideo(['album'], action, callback)
							return
						}
						this.pickPostImage(['album'], action, callback)
					},
					fail: err => {
						console.log('[YAOHUO_MEDIA_PICK_RESULT]', {
							action,
							hasFile: false,
							errMsg: err && err.errMsg || ''
						})
						this.finishMediaAction(action)
					}
				})
			},
			pickPostVideo(sourceType, action, callback) {
				if (typeof uni.chooseVideo !== 'function') {
					this.finishMediaAction(action)
					return uni.showToast({
						title: '当前环境不支持视频选择',
						icon: 'none'
					})
				}
				let picked = false
				try {
					uni.chooseVideo({
						sourceType,
						success: res => {
							picked = true
							const path = res.tempFilePath || res.path || ''
							console.log('[YAOHUO_MEDIA_PICK_RESULT]', {
								action,
								hasFile: !!path,
								mediaType: 'video',
								size: res.size || 0
							})
							callback && callback({
								path,
								name: this.getFileName(path),
								size: res.size || 0
							}, 'video')
						},
						fail: err => {
							console.log('[YAOHUO_MEDIA_PICK_RESULT]', {
								action,
								hasFile: false,
								errMsg: err && err.errMsg || ''
							})
							uni.showToast({
								title: '未选择视频',
								icon: 'none'
							})
						},
						complete: () => {
							if (!picked) {
								this.finishMediaAction(action)
							}
						}
					})
				} catch (err) {
					this.finishMediaAction(action)
					console.log('[YAOHUO_MEDIA_PICK_RESULT]', {
						action,
						hasFile: false,
						errMsg: (err && err.message) || String(err || '')
					})
					uni.showToast({
						title: '选择失败',
						icon: 'none'
					})
				}
			},
			getFileName(path) {
				path = String(path || '')
				return path.split(/[\\/]/).pop() || 'file'
			},
			isVideoFile(path) {
				return /\.(mp4|mov|m4v|3gp|avi|mkv|webm)$/i.test(String(path || '').split('?')[0])
			},
			uploadFileManagerToImageHost(action) {
				chooseYaohuoLocalFile(1).then(files => {
					const file = files[0] || {}
					this.uploadPickedMedia(file.path, this.isVideoFile(file.path || file.name) ? 'video' : 'image')
				}).catch(err => {
					console.log('[YAOHUO_MEDIA_PICK_RESULT]', {
						action,
						hasFile: false,
						errMsg: (err && err.message) || String(err || '')
					})
					this.finishMediaAction(action)
					uni.showToast({
						title: '未选择文件',
						icon: 'none'
					})
				})
			},
			openLocalPostUploadFallback() {
				const url = this.getLocalPostUploadUrl()
				uni.showModal({
					title: '本地上传',
					content: '当前环境暂不支持原生文件选择，可打开妖火官方文件帖页面上传。',
					confirmText: '打开',
					success: res => {
						if (res.confirm && url) {
							uni.navigateTo({
								url: `/pages/webview/webview?url=${encodeURIComponent(url)}`
							})
						}
					}
				})
			},
			clearLocalPostFile() {
				this.localPostFile = null
			},
			goHome() {
				uni.redirectTo({
					url: '/pages/index/index',
					fail: () => {
						uni.reLaunch({
							url: '/pages/index/index'
						})
					}
				})
			},
			openOfficialNav(item) {
				if (!item || !item.type) {
					return
				}
				uni.navigateTo({
					url: `/pages/post/special?type=${encodeURIComponent(item.type)}&classid=${encodeURIComponent(this.classid || '177')}`
				})
			},
			handleDraftInput() {
				this.clearDraftTimerOnly()
				this.draftTimer = setTimeout(() => {
					if (this.hasDraftContent) {
						this.saveDraft(true)
					}
				}, 2000)
			},
			saveDraft(silent) {
				if (!this.hasDraftContent) {
					return
				}
				try {
					uni.setStorageSync(this.getDraftKey(), {
						title: this.form.title,
						content: this.form.content,
						rewardMoney: this.form.rewardMoney || ''
					})
					if (!silent) {
						this.showDraftNotice('草稿保存成功!')
					}
				} catch (e) {
					this.showDraftNotice('草稿保存失败')
				}
			},
			restoreDraft() {
				try {
					const draft = uni.getStorageSync(this.getDraftKey())
					if (draft && (draft.title || draft.content || draft.rewardMoney)) {
						this.form.title = draft.title || ''
						this.form.content = draft.content || ''
						this.form.rewardMoney = draft.rewardMoney || ''
						this.showReward = !!this.form.rewardMoney
						this.showDraftNotice('已恢复草稿')
					} else {
						this.form.title = ''
						this.form.content = ''
						this.form.rewardMoney = ''
						this.showReward = false
					}
				} catch (e) {}
			},
			clearDraft() {
				uni.showModal({
					title: '清除草稿',
					content: '确定清除当前版块草稿吗？',
					success: res => {
						if (!res.confirm) {
							return
						}
						this.removeDraft()
						this.form.title = ''
						this.form.content = ''
						this.form.rewardMoney = ''
						this.showReward = false
						this.showDraftNotice('草稿箱已清除!')
					}
				})
			},
			removeDraft() {
				try {
					uni.removeStorageSync(this.getDraftKey())
				} catch (e) {}
			},
			showDraftNotice(message) {
				this.draftNotice = message
				if (this.draftNoticeTimer) {
					clearTimeout(this.draftNoticeTimer)
				}
				this.draftNoticeTimer = setTimeout(() => {
					this.draftNotice = ''
					this.draftNoticeTimer = null
				}, 1200)
			},
			clearDraftTimerOnly() {
				if (this.draftTimer) {
					clearTimeout(this.draftTimer)
					this.draftTimer = null
				}
			},
			clearDraftTimers() {
				this.clearDraftTimerOnly()
				if (this.draftNoticeTimer) {
					clearTimeout(this.draftNoticeTimer)
					this.draftNoticeTimer = null
				}
			},
			formatFileSize(size) {
				size = Number(size || 0)
				if (!size) {
					return '大小未知'
				}
				if (size < 1024) {
					return size + 'B'
				}
				if (size < 1024 * 1024) {
					return (size / 1024).toFixed(1) + 'KB'
				}
				return (size / 1024 / 1024).toFixed(1) + 'MB'
			},
			chooseImageHostUpload() {
				if (this.mediaActionBusy) {
					console.log('[YAOHUO_MEDIA_BUSY_SKIP]', {
						action: 'imageHost',
						current: this.mediaActionName
					})
					return uni.showToast({
						title: '请先完成当前操作',
						icon: 'none'
					})
				}
				this.mediaPanelShow = false
				chooseImageHost(index => {
					this.imageHostIndex = index
					this.chooseMediaSource(source => {
						const action = 'imageHost'
						if (!this.startMediaAction(action)) {
							return
						}
						if (source === 'camera') {
							this.pickPostImage(['camera'], action, file => {
								this.uploadPickedMedia(file.path, 'image')
							})
							return
						}
						if (source === 'album') {
							this.chooseAlbumMedia(action, (file, mediaType) => {
								this.uploadPickedMedia(file.path, mediaType)
							})
							return
						}
						this.uploadFileManagerToImageHost(action)
					})
				})
			},
			uploadImage() {
				this.chooseImageHostUpload()
			},
			uploadImageFromAlbum(action) {
				action = action || this.mediaActionName || 'image'
				if (!this.mediaActionBusy && !this.startMediaAction(action)) {
					return
				}
				let picked = false
				try {
					uni.chooseImage({
						count: 1,
						sourceType: ['album'],
						success: chooseImageRes => {
							picked = true
							const tempFilePaths = chooseImageRes.tempFilePaths || []
							console.log('[YAOHUO_MEDIA_PICK_RESULT]', {
								action,
								hasFile: !!tempFilePaths[0],
								count: tempFilePaths.length
							})
							this.uploadPickedMedia(tempFilePaths[0], 'image')
						},
						fail: err => {
							console.log('[YAOHUO_MEDIA_PICK_RESULT]', {
								action,
								hasFile: false,
								errMsg: err && err.errMsg || ''
							})
							uni.showToast({
								title: '未选择图片',
								icon: 'none'
							})
						},
						complete: () => {
							if (!picked) {
								this.finishMediaAction(action)
							}
						}
					})
				} catch (err) {
					this.finishMediaAction(action)
					console.log('[YAOHUO_MEDIA_PICK_RESULT]', {
						action,
						hasFile: false,
						errMsg: (err && err.message) || String(err || '')
					})
					uni.showToast({
						title: '选择失败',
						icon: 'none'
					})
				}
			},
			uploadVideoFromAlbum(action) {
				action = action || this.mediaActionName || 'video'
				if (!this.mediaActionBusy && !this.startMediaAction(action)) {
					return
				}
				if (typeof uni.chooseVideo !== 'function') {
					this.finishMediaAction(action)
					return uni.showToast({
						title: '当前环境不支持视频选择',
						icon: 'none'
					})
				}
				let picked = false
				try {
					uni.chooseVideo({
						sourceType: ['album'],
						success: res => {
							picked = true
							const filePath = res.tempFilePath || res.path || ''
							console.log('[YAOHUO_MEDIA_PICK_RESULT]', {
								action,
								hasFile: !!filePath,
								mediaType: 'video',
								size: res.size || 0
							})
							this.uploadPickedMedia(filePath, 'video')
						},
						fail: err => {
							console.log('[YAOHUO_MEDIA_PICK_RESULT]', {
								action,
								hasFile: false,
								errMsg: err && err.errMsg || ''
							})
							uni.showToast({
								title: '未选择视频',
								icon: 'none'
							})
						},
						complete: () => {
							if (!picked) {
								this.finishMediaAction(action)
							}
						}
					})
				} catch (err) {
					this.finishMediaAction(action)
					console.log('[YAOHUO_MEDIA_PICK_RESULT]', {
						action,
						hasFile: false,
						errMsg: (err && err.message) || String(err || '')
					})
					uni.showToast({
						title: '选择失败',
						icon: 'none'
					})
				}
			},
			openBrowser() {
				openInBrowser(this.getPostUrl())
			}
		}
	}
</script>

<style scoped>
	page {
		background-color: #f4f6f5;
	}

	.post-page {
		padding: 20rpx;
		box-sizing: border-box;
	}

	.upload-container {
		display: flex;
		flex-direction: column;
		gap: 18rpx;
	}

	.board-select-card {
		background: #fff;
		border-radius: 8px;
		box-shadow: 0 1px 5px rgba(20, 80, 50, .05);
		overflow: hidden;
	}

	.board-select-row {
		min-height: 86rpx;
		padding: 0 22rpx;
		display: flex;
		align-items: center;
		justify-content: space-between;
		box-sizing: border-box;
	}

	.board-select-text {
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 6rpx;
	}

	.board-select-label {
		color: #7b8a82;
		font-size: 12px;
	}

	.board-select-name {
		color: #18342b;
		font-size: 16px;
		font-weight: 600;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.notification-container {
		position: fixed;
		left: 50%;
		top: 120rpx;
		transform: translateX(-50%);
		z-index: 20;
	}

	.custom-notification {
		padding: 16rpx 28rpx;
		border-radius: 8px;
		background: rgba(29, 94, 63, .92);
		color: #fff;
		font-size: 13px;
		box-shadow: 0 8rpx 28rpx rgba(25, 85, 55, .22);
		white-space: nowrap;
	}

	.content-card {
		background: #fff;
		border-radius: 8px;
		overflow: hidden;
		box-shadow: 0 1px 5px rgba(20, 80, 50, .05);
	}

	.form-group {
		padding: 22rpx 24rpx;
		border-bottom: 1px solid #edf0ee;
		box-sizing: border-box;
	}

	.content-group {
		padding-bottom: 16rpx;
	}

	.form-label {
		display: block;
		color: #333;
		font-size: 15px;
		font-weight: 600;
		margin-bottom: 14rpx;
	}

	.content-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16rpx;
		margin-bottom: 14rpx;
	}

	.content-header .form-label {
		margin-bottom: 0;
	}

	.textarea-actions {
		display: flex;
		align-items: center;
		gap: 10rpx;
		flex-wrap: wrap;
		justify-content: flex-end;
	}

	.action-btn-small {
		height: 54rpx;
		line-height: 54rpx;
		padding: 0 16rpx;
		margin: 0;
		border-radius: 6px;
		background: #f5faf7;
		color: #2f6f55;
		border: 1px solid #dbe8df;
		font-size: 12px;
		display: flex;
		align-items: center;
		gap: 6rpx;
	}

	.form-control {
		width: 100%;
		border: 1px solid #dfe7e2;
		border-radius: 6px;
		background: #fff;
		color: #222;
		box-sizing: border-box;
	}

	.title-input {
		height: 76rpx;
		line-height: 76rpx;
		padding: 0 20rpx;
		font-size: 16px;
	}

	.content-input {
		min-height: 340rpx;
		padding: 18rpx 20rpx;
		font-size: 15px;
		line-height: 22px;
	}

	.editor-tools {
		min-height: 92rpx;
		padding: 10rpx 20rpx;
		border-bottom: 1px solid #edf0ee;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 18rpx;
		box-sizing: border-box;
	}

	.tool-group {
		display: flex;
		align-items: center;
		gap: 18rpx;
	}

	.tool-button {
		width: 74rpx;
		height: 74rpx;
		display: flex;
		align-items: center;
		justify-content: center;
		flex: 0 0 74rpx;
		background: transparent;
		border: none;
		box-sizing: border-box;
		overflow: visible;
	}

	.tool-image {
		width: 66rpx;
		height: 66rpx;
		display: block;
	}

	.selected-face {
		width: 66rpx;
		height: 66rpx;
	}

	.ubb-icon {
		width: 66rpx;
		height: 66rpx;
		border-radius: 50%;
		background: linear-gradient(135deg, #f7f7f7, #ffffff);
		border: 1px solid #eeeeee;
		display: flex;
		align-items: center;
		justify-content: center;
		box-sizing: border-box;
	}

	.ubb-icon text {
		color: #222;
		font-size: 13px;
		font-weight: 700;
		line-height: 1;
	}

	.browser-open-btn {
		height: 70rpx;
		line-height: 70rpx;
		margin: 0;
		padding: 0 24rpx;
		border-radius: 6px;
		background-color: #07c160;
		color: #fff;
		flex: 0 0 auto;
	}

	.media-panel {
		padding: 16rpx 20rpx;
		background: #fff;
		border-bottom: 1px solid #edf0ee;
		display: flex;
		flex-wrap: wrap;
		gap: 16rpx;
	}

	.media-circle-btn {
		width: 92rpx;
		height: 92rpx;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		text-align: center;
		background: #f7f7f7;
		color: #333;
		font-size: 12px;
		line-height: 15px;
		box-sizing: border-box;
		padding: 0 10rpx;
	}

	.media-circle-btn.upload {
		background: #f6ffed;
		color: #389e0d;
	}

	.media-circle-btn.local {
		background: #fff8e6;
		color: #9a6b00;
	}

	.media-circle-btn.disabled {
		opacity: .45;
	}

	.ubb-panel {
		padding: 14rpx 20rpx;
		background: #fff;
		border-bottom: 1px solid #edf0ee;
		display: flex;
		flex-wrap: wrap;
		gap: 12rpx;
	}

	.ubb-chip {
		min-width: 72rpx;
		height: 52rpx;
		line-height: 52rpx;
		padding: 0 16rpx;
		border-radius: 26rpx;
		background: #f6f6f6;
		color: #333;
		font-size: 13px;
		text-align: center;
		box-sizing: border-box;
	}

	.face-panel {
		background: #fff;
		border-bottom: 1px solid #edf0ee;
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

	.plugin-emoji-cell {
		height: 88rpx;
	}

	.plugin-emoji-cell image {
		width: 70rpx;
		height: 70rpx;
		margin-bottom: 0;
	}

	.plugin-emoji-cell text {
		display: none;
	}

	.local-file-card {
		margin: 18rpx 24rpx 0;
		padding: 18rpx 20rpx;
		border-radius: 8px;
		background: #f8fbff;
		border: 1px solid #dbeafe;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16rpx;
		box-sizing: border-box;
	}

	.local-file-info {
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 6rpx;
	}

	.local-file-name {
		color: #1f2937;
		font-size: 14px;
		font-weight: 600;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.local-file-meta {
		color: #64748b;
		font-size: 12px;
	}

	.local-file-remove {
		flex: 0 0 auto;
		margin: 0;
		color: #666;
		background: #fff;
		border: 1px solid #e5e7eb;
	}

	.reward-section {
		margin: 18rpx 24rpx 0;
		border-radius: 8px;
		border: 1px solid #e3ece6;
		overflow: hidden;
		box-sizing: border-box;
	}

	.collapse-trigger {
		min-height: 76rpx;
		padding: 0 20rpx;
		background: #f7fbf8;
		display: flex;
		align-items: center;
		justify-content: space-between;
		box-sizing: border-box;
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
		font-size: 14px;
	}

	.submit-btn {
		width: auto;
		height: 78rpx;
		line-height: 78rpx;
		margin: 22rpx 24rpx 24rpx 24rpx;
		padding: 0 30rpx;
		border-radius: 7px;
		background-color: #07c160;
		font-size: 16px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}

	.nav-buttons {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 14rpx;
	}

	.nav-btn {
		min-height: 78rpx;
		padding: 0 18rpx;
		border-radius: 8px;
		background: #fff;
		border: 1px solid #e2ebe5;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8rpx;
		color: #40564a;
		font-size: 14px;
		box-sizing: border-box;
	}
</style>
