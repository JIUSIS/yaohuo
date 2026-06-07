<template>
	<view>
		<view class="uni-padding-wrap">
			<!-- 评论区 start -->
			<uni-row>
				<uni-col :span="12">
					<view class="f-16">全部评论（共{{postInfo.replyCount}}条）</view>
				</uni-col>
				<uni-col :span="12">
					<view class="text-right">
						<button class="comment-order-btn" size="mini" @click="toggleCommentOrder">
							{{commentOrder === 'asc' ? '正序' : '倒序'}}
						</button>
						<uni-icons class="refresh-comment-icon" @click="$emit('fetchReply',{ refresh: true, order: commentOrder })"
							style="vertical-align: -5px;" type="refreshempty" size="20"></uni-icons>
					</view>
				</uni-col>
			</uni-row>
			<view class="uni-comment">
				<view style="border-bottom:  1px dashed #dcdcdc;" class="uni-comment-list" v-for="(comment,index) in displayComments" :key="getCommentKey(comment,index)">
					<view class="uni-comment-face" @click="goToUserArea(comment)">
						<image v-if="comment.avatar" class="comment-avatar" :src="comment.avatar" mode="aspectFill"
							@error="nativeImageError(comment.avatar,$event)"></image>
						<view class="floor" :class="{'floor-badge': comment.avatar}">
							{{comment.floor}}
						</view>
					</view>
					<view class="uni-comment-body">
						<view class="uni-comment-top">
							<text @click="goToUserArea(comment)">{{comment.user}}</text>
							<view v-if="comment.medals && comment.medals.length" class="comment-medals">
								<image v-for="medal in comment.medals" :key="medal" class="comment-medal" :src="medal"
									mode="aspectFit"></image>
							</view>
							<text v-if="comment.rewardText" class="comment-reward-chip">{{comment.rewardText}}</text>
						</view>
						<view class="uni-comment-date">
							<text>{{comment.time}}</text>
							<view class="flex">
								<view class="uni-comment-reply-btn danger" v-if="comment.remanage && comment.remanage.length"
									v-for="item in comment.remanage" @click="CommentOption(comment, item)">删除
								</view>
								<view class="uni-comment-reply-btn" @click="copyComment(comment)">复制
								</view>
								<view class="uni-comment-reply-btn" v-if="!postInfo.isEnd" @click="repeatComment(comment)">+1
								</view>
								<view class="uni-comment-reply-btn" v-if="!postInfo.isEnd" @click="replyToFloor(comment)">回复
								</view>
							</view>
						</view>
						<mp-html :content="comment.text" selectable domain="https://yaohuo.me"
							containerStyle="line-height:20px;word-break: break-all;font-size:15px" :copyLink="false"
							@linktap="linkTap"></mp-html>
						<view v-if="comment.images && comment.images.length" class="comment-image-list">
							<image v-for="(img,imgIndex) in comment.images" :key="img" class="comment-native-image"
								:src="img" mode="widthFix" @tap="previewCommentImages(comment.images,imgIndex)"
								@error="nativeImageError(img,$event)"></image>
						</view>
					</view>
				</view>
			</view>
		</view>
		<view class="comment-composer">
			<view class="comment-toolbar">
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
					<button v-if="hasMeatReward" class="meat-action-btn" size="mini" :disabled="loading"
						@click="eatMeat">{{meatButtonText}}</button>
				</view>
				<button v-if="!hasReplyDraft" class="browser-open-btn" size="mini"
					@click="$emit('open-browser')">浏览器打开</button>
				<button v-show="hasReplyDraft" :loading="loading" :disabled="loading"
					class="submit-btn" type="primary" size="mini" @click="reply()">发表</button>
			</view>
			<view v-if="facePanelShow" class="face-panel">
				<scroll-view scroll-y class="face-scroll">
					<view class="face-grid">
						<view class="face-cell" :class="{active: !replyData.face && !selectedPluginEmoji}" @click="selectFace(0)">
							<text>无</text>
						</view>
						<view v-for="(item,index) in faceList" :key="item.face" class="face-cell"
							:class="{active: replyData.face === item.face}" @click="selectFace(index + 1)">
							<image :src="getFaceUrl(item.face)" mode="aspectFit"></image>
							<text>{{item.name}}</text>
						</view>
						<view v-for="item in pluginEmojiList" :key="item.url" class="face-cell plugin-emoji-cell"
							:class="{active: selectedPluginEmoji === item.url}"
							@click="insertPluginEmoji(item)">
							<image :src="item.url" mode="aspectFit"></image>
							<text>{{item.name}}</text>
						</view>
					</view>
				</scroll-view>
			</view>
			<view v-if="mediaPanelShow" class="media-panel">
				<view class="media-circle-btn local" :class="{disabled: mediaActionBusy}" @click="chooseLocalUpload">本地上传</view>
				<view class="media-circle-btn upload" :class="{disabled: mediaActionBusy}" @click="chooseImageHostUpload">图床上传</view>
			</view>
			<view v-if="ubbPanelShow" class="ubb-panel">
				<view v-for="item in ubbTools" :key="item.label" class="ubb-chip" @click="handleUbbTool(item)">
					{{item.label}}
				</view>
			</view>
			<view style="background-color: #fff;padding: 20rpx;margin: 0 20rpx 20rpx;">
				<textarea :maxlength="-1" :fixed="true" style="width: 100%;" :cursor-spacing="20"
					:adjust-position='true' type="text" :focus="isReplyFloor" @blur="isReplyFloor=false"
					v-model="replyData.content" :placeholder="replyTips" :auto-height="true"
					:show-confirm-bar="false"></textarea>
			</view>
		</view>
	</view>
</template>

<script>
	import faces from '@/utils/faces.js'
	import {
		getAuthHeader
	} from '@/utils/auth.js'
	import {
		navigateToNativePost,
		navigateToNativeRoute
	} from '@/utils/route.js'
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
		getYaohuoReplyFileUrl,
		isYaohuoUploadSuccess,
		uploadYaohuoReplyFile
	} from '@/utils/yaohuo-upload.js'
	const MEAT_STORAGE_KEY = 'yaohuo_meat_list'
	const MEAT_EXPIRED_MS = 7 * 24 * 60 * 60 * 1000
	const MEAT_MAX_RECORDS = 200
	const MEAT_WORDS = ['吃', '吃吃', '吃肉', '来吃肉', '吃了', '肉肉肉', '先吃肉']
	export default {
		name: 'comment',
		props: {
			comments: {
				type: Array,
				default: () => {
					return []
				}
			},
			postInfo: {
				type: Object,
				default: () => {
					return {}
				}
			}
		},
		data() {
			return {
				replyTips: '请勿乱打字回复,以免被加黑。',
				array: faces,
				faceIndex: 0,
				facePanelShow: false,
				mediaPanelShow: false,
				mediaActionBusy: false,
				mediaActionName: '',
				mediaActionTimer: null,
				ubbPanelShow: false,
				selectedPluginEmoji: '',
				loading: false,
				isReplyFloor: false,
				replyModalShow: false,
				commentOrder: 'desc',
				replyData: {
					face: '',
					content: '',
					action: 'add',
					id: this.postInfo.postId,
					siteid: 1000,
					lpage: 1,
					classid: this.postInfo.classId,
					g: '快速回复'
				},
				originReplyData: {},
				meatRecordVersion: 0,
				pendingMeatPostId: '',
				imageHostIndex: getSelectedImageHostIndex()
			}
		},
		computed: {
			faceList() {
				return this.array.filter(item => item.face)
			},
			pluginEmojiList() {
				return PLUGIN_EMOJIS
			},
			ubbTools() {
				return UBB_TOOLS
			},
			currentImageHostName() {
				return getImageHostShortName(this.imageHostIndex)
			},
			selectedFace() {
				return this.array[this.faceIndex] && this.array[this.faceIndex].face ? this.array[this.faceIndex] : null
			},
			hasReplyDraft() {
				return !!(String(this.replyData.content || '').trim() || this.replyData.face || this.selectedPluginEmoji)
			},
			displayComments() {
				const list = (this.comments || []).slice()
				list.sort((a, b) => {
					const af = this.getFloorNumber(a && a.floor)
					const bf = this.getFloorNumber(b && b.floor)
					if (af !== bf) {
						return af - bf
					}
					return 0
				})
				return this.commentOrder === 'desc' ? list.reverse() : list
			},
			hasMeatReward() {
				const remain = this.getMeatRemainNumber()
				return remain > 0 && !(this.postInfo && this.postInfo.isEnd)
			},
			hasEatenMeatPost() {
				this.meatRecordVersion
				return this.hasMeatRecord(this.getMeatPostId())
			},
			meatButtonText() {
				return this.hasEatenMeatPost ? '已吃' : '吃肉'
			}
		},
		mounted() {
			this.originReplyData = JSON.parse(JSON.stringify(this.replyData))
			this.cleanMeatRecords()
		},
		methods: {
			getPostClassId() {
				const match = String(this.postInfo.classId || '').match(/\d+/)
				return match ? match[0] : ''
			},
			syncReplyData() {
				this.replyData.id = this.postInfo.postId
				this.replyData.classid = this.getPostClassId()
				this.replyData.siteid = 1000
				this.replyData.lpage = this.replyData.lpage || 1
			},
			toggleCommentOrder() {
				this.commentOrder = this.commentOrder === 'asc' ? 'desc' : 'asc'
				this.$emit('fetchReply', {
					order: this.commentOrder
				})
			},
			getFloorNumber(floor) {
				if (floor === '沙发') {
					return 1
				}
				if (floor === '椅子') {
					return 2
				}
				if (floor === '板凳') {
					return 3
				}
				const match = String(floor || '').match(/\d+/)
				return match ? Number(match[0]) : 0
			},
			getCommentKey(comment, index) {
				return [
					comment && comment.floor || '',
					comment && comment.userId || '',
					comment && comment.time || '',
					index
				].join('|')
			},
			normalizeReplyImageUrl(url) {
				url = this.decodeHtmlText(String(url || '').trim())
				if (!url || /^data:/i.test(url)) {
					return ''
				}
				return this.normalizeYaohuoUrl(url)
			},
			getCommentReplyText(comment) {
				comment = comment || {}
				const seenImages = {}
				let html = String(comment.text || '').replace(
					/<img\b[^>]*(?:src|data-src)\s*=\s*(["'])([^"']+)\1[^>]*>/ig,
					(all, quote, src) => {
						const url = this.normalizeReplyImageUrl(src)
						if (!url || seenImages[url]) {
							return ''
						}
						seenImages[url] = true
						return `\n[img]${url}[/img]\n`
					})
				html = html
					.replace(/<\/(?:p|div|section|article|li)>/ig, '\n')
					.replace(/<br\s*\/?>/ig, '\n')
				const parts = []
				const text = this.stripHtml(html).replace(/\n{3,}/g, '\n\n').trim()
				if (text) {
					parts.push(text)
				}
				;(comment.images || []).forEach(src => {
					const url = this.normalizeReplyImageUrl(src)
					if (url && !seenImages[url]) {
						seenImages[url] = true
						parts.push(`[img]${url}[/img]`)
					}
				})
				return parts.join('\n').trim()
			},
			appendReplyText(text) {
				text = String(text || '').trim()
				if (!text) {
					return
				}
				this.replyData.content = `${this.replyData.content ? this.replyData.content + '\n' : ''}${text}`
				this.isReplyFloor = true
			},
			copyComment(comment) {
				const text = this.getCommentReplyText(comment)
				if (!text) {
					return uni.showToast({
						title: '没有可复制内容',
						icon: 'none'
					})
				}
				this.appendReplyText(text)
				uni.setClipboardData({
					data: text,
					success: () => {
						uni.showToast({
							title: '已复制',
							icon: 'success'
						})
					},
					fail: () => {
						uni.showToast({
							title: '已加入回复框',
							icon: 'none'
						})
					}
				})
			},
			repeatComment(comment) {
				if (this.loading) {
					return
				}
				const text = this.getCommentReplyText(comment)
				if (!text) {
					return uni.showToast({
						title: '没有可复读内容',
						icon: 'none'
					})
				}
				this.cancelReply()
				this.replyData.content = text
				this.replyData.g = '快速回复'
				this.reply({
					_nativeAction: true
				})
			},
			getMeatPostId() {
				const match = String(this.postInfo && this.postInfo.postId || '').match(/\d+/)
				return match ? match[0] : ''
			},
			getMeatRemainNumber() {
				const info = this.postInfo || {}
				const fields = [info.giftRemain, info.meatRemain, info.rewardRemain]
				for (let i = 0; i < fields.length; i++) {
					const match = String(fields[i] === undefined || fields[i] === null ? '' : fields[i]).match(/[+-]?\d+/)
					if (match) {
						return Number(match[0])
					}
				}
				const texts = []
				;(info.rewardTags || []).forEach(item => {
					texts.push(item && item.text || item || '')
				})
				texts.push(info.extra || '')
				for (let i = 0; i < texts.length; i++) {
					const match = String(texts[i] || '').match(/(?:余|剩余)\s*([+-]?\d+)/)
					if (match) {
						return Number(match[1])
					}
				}
				return 0
			},
			getMeatRecords() {
				try {
					const raw = uni.getStorageSync(MEAT_STORAGE_KEY)
					if (!raw) {
						return {}
					}
					if (typeof raw === 'string') {
						return JSON.parse(raw) || {}
					}
					return raw && typeof raw === 'object' ? raw : {}
				} catch (e) {
					return {}
				}
			},
			setMeatRecords(list) {
				uni.setStorageSync(MEAT_STORAGE_KEY, JSON.stringify(list || {}))
				this.meatRecordVersion++
			},
			getCleanMeatRecords() {
				const now = Date.now()
				const list = this.getMeatRecords()
				const cleanList = {}
				Object.keys(list).forEach(id => {
					const time = Number(list[id] || 0)
					if (id && time > 0 && now - time <= MEAT_EXPIRED_MS) {
						cleanList[id] = time
					}
				})
				const keys = Object.keys(cleanList).sort((a, b) => cleanList[a] - cleanList[b])
				while (keys.length > MEAT_MAX_RECORDS) {
					delete cleanList[keys.shift()]
				}
				return cleanList
			},
			cleanMeatRecords() {
				this.setMeatRecords(this.getCleanMeatRecords())
			},
			hasMeatRecord(id) {
				id = String(id || '')
				if (!id) {
					return false
				}
				const time = Number(this.getMeatRecords()[id] || 0)
				return time > 0 && Date.now() - time <= MEAT_EXPIRED_MS
			},
			saveMeatRecord(id) {
				id = String(id || '')
				if (!id) {
					return
				}
				const list = this.getCleanMeatRecords()
				list[id] = Date.now()
				this.setMeatRecords(list)
			},
			getRandomMeatWord() {
				return MEAT_WORDS[Math.floor(Math.random() * MEAT_WORDS.length)] || '吃肉'
			},
			eatMeat() {
				if (this.loading) {
					return
				}
				const postId = this.getMeatPostId()
				if (!postId || !this.hasMeatReward) {
					return uni.showToast({
						title: '没有可领取礼金',
						icon: 'none'
					})
				}
				const submitMeat = () => {
					this.cancelReply()
					this.replyData.content = this.getRandomMeatWord()
					this.replyData.g = '快速回复'
					this.pendingMeatPostId = postId
					this.reply({
						_nativeAction: true,
						skipMeatConfirm: true,
						meatPostId: postId
					})
				}
				if (this.hasMeatRecord(postId)) {
					return uni.showModal({
						title: '已经吃过',
						content: '这个帖子 7 天内已经吃过肉，继续回复吗？',
						confirmText: '继续',
						success: res => {
							if (res.confirm) {
								submitMeat()
							}
						}
					})
				}
				submitMeat()
			},
			shouldConfirmMeatRepeat(options) {
				if (options && options.skipMeatConfirm) {
					return false
				}
				const postId = this.getMeatPostId()
				return !!(postId && this.hasMeatReward && this.hasMeatRecord(postId))
			},
			shouldRecordMeatReply(payload, pendingPostId) {
				const postId = String(payload && payload.id || this.getMeatPostId() || '')
				if (!postId) {
					return false
				}
				return String(pendingPostId || '') === postId
			},
			showToast() {
				uni.showToast({
					title: '开发中',
					icon: 'none'
				})
			},
			toggleUbbPanel() {
				this.ubbPanelShow = !this.ubbPanelShow
				if (this.ubbPanelShow) {
					this.facePanelShow = false
					this.mediaPanelShow = false
				}
			},
			insertReplyText(text) {
				this.replyData.content = appendText(this.replyData.content, text)
				this.isReplyFloor = true
			},
			insertUbb(text) {
				this.insertReplyText(text)
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
				this.replyData.face = ''
				this.facePanelShow = false
			},
			getContentWithSelectedPluginEmoji(content) {
				if (!this.selectedPluginEmoji) {
					return String(content || '')
				}
				return appendText(content, `[img]${this.selectedPluginEmoji}[/img]`)
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
			toggleMediaPanel() {
				this.mediaPanelShow = !this.mediaPanelShow
				if (this.mediaPanelShow) {
					this.facePanelShow = false
					this.ubbPanelShow = false
				}
			},
			selectFace(index) {
				this.faceIndex = index
				const item = this.array[index]
				this.replyData.face = item && item.face ? item.face : ''
				this.selectedPluginEmoji = ''
				this.facePanelShow = false
				this.ubbPanelShow = false
				this.mediaPanelShow = false
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
					this.insertReplyText(isVideo ? `[movie=100%*100%]${url}|[/movie]` : `[img]${url}[/img]`)
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
			chooseLocalUpload() {
				if (this.mediaActionBusy) {
					console.log('[YAOHUO_MEDIA_BUSY_SKIP]', {
						action: 'local',
						current: this.mediaActionName
					})
					return uni.showToast({
						title: '请先完成当前操作',
						icon: 'none'
					})
				}
				this.mediaPanelShow = false
				this.chooseMediaSource(source => {
					const action = 'local'
					if (!this.startMediaAction(action)) {
						return
					}
					this.pickLocalReplySource(source, action)
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
			pickLocalReplySource(source, action) {
				if (source === 'camera') {
					this.pickReplyImage(['camera'], action, file => {
						this.submitYaohuoLocalFile(file, action)
					})
					return
				}
				if (source === 'album') {
					this.chooseReplyAlbumMedia(action, file => {
						this.submitYaohuoLocalFile(file, action)
					})
					return
				}
				chooseYaohuoLocalFile(1).then(files => {
					this.submitYaohuoLocalFile(files[0], action)
				}).catch(err => {
					console.log('[YAOHUO_LOCAL_UPLOAD_PICK_RESULT]', {
						action,
						hasFile: false,
						errMsg: (err && err.message) || String(err || '')
					})
					this.finishMediaAction(action)
					const message = (err && err.message) || ''
					if (/不支持文件选择/.test(message)) {
						this.openLocalUploadFallback()
						return
					}
					uni.showToast({
						title: '未选择文件',
						icon: 'none'
					})
				})
			},
			openLocalUploadFallback() {
				const url = getYaohuoReplyFileUrl(this.postInfo, this.getPostClassId())
				uni.showModal({
					title: '本地上传',
					content: '当前环境暂不支持原生文件选择，可打开妖火官方文件回复页面上传。',
					confirmText: '打开',
					success: res => {
						if (res.confirm && url) {
							this.mediaPanelShow = false
							uni.navigateTo({
								url: `/pages/webview/webview?url=${encodeURIComponent(url)}`
							})
						}
					}
				})
			},
			submitYaohuoLocalFile(file, action) {
				action = action || this.mediaActionName || 'local'
				if (!file || !file.path) {
					this.finishMediaAction(action)
					return uni.showToast({
						title: '未选择文件',
						icon: 'none'
					})
				}
				const content = this.getContentWithSelectedPluginEmoji(this.replyData.content).replace(/\n/g, '\r\n') || '附件'
				const postId = String(this.postInfo && this.postInfo.postId || '')
				const classId = this.getPostClassId()
				const sourceUrl = getYaohuoReplyFileUrl(this.postInfo, classId)
				console.log('[YAOHUO_LOCAL_UPLOAD_START]', {
					action,
					postId,
					classId,
					fileName: file.name || '',
					fileSize: file.size || 0
				})
				uni.showLoading({
					title: '本地上传中'
				})
				uploadYaohuoReplyFile({
					file,
					url: sourceUrl,
					postId,
					classId,
					lpage: this.replyData.lpage || '',
					face: this.replyData.face || '',
					content,
					fileInfo: ''
				}).then(res => {
					const html = String(res.data || '')
					const tip = extractYaohuoUploadTip(html)
					const success = Number(res.statusCode || 0) < 400 && isYaohuoUploadSuccess(html)
					uni.hideLoading()
					this.finishMediaAction(action)
					console.log('[YAOHUO_LOCAL_UPLOAD_END]', {
						action,
						statusCode: res.statusCode,
						success,
						fileName: res.fileName,
						fileSize: res.fileSize,
						formData: res.formData,
						tip,
						text: this.stripHtml(html).slice(0, 800),
						html: html.slice(0, 800)
					})
					if (!success) {
						return uni.showModal({
							title: '本地上传失败',
							content: tip || '服务器没有返回附件回帖成功结果',
							showCancel: false
						})
					}
					this.mediaPanelShow = false
					this.cancelReply()
					this.replyData.content = ''
					uni.showModal({
						title: '附件回帖成功',
						content: this.normalizeReplySuccessFeedback(tip, {
							id: postId,
							classid: classId
						}),
						showCancel: false
					})
					setTimeout(() => {
						this.$emit('fetchReply', {
							afterReply: true,
							order: this.commentOrder
						})
					}, 300)
				}).catch(err => {
					uni.hideLoading()
					this.finishMediaAction(action)
					console.log('[YAOHUO_LOCAL_UPLOAD_END]', {
						action,
						success: false,
						errMsg: (err && err.message) || String(err || '')
					})
					uni.showModal({
						title: '本地上传失败',
						content: (err && err.message) || '妖火附件接口暂时不可用',
						showCancel: false
					})
				})
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
							this.pickReplyImage(['camera'], action, file => {
								this.uploadPickedMedia(file.path, 'image')
							})
							return
						}
						if (source === 'album') {
							this.chooseReplyAlbumMedia(action, (file, mediaType) => {
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
			pickReplyImage(sourceType, action, callback) {
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
			chooseReplyAlbumMedia(action, callback) {
				uni.showActionSheet({
					itemList: ['图片', '视频'],
					success: res => {
						if (res.tapIndex === 1) {
							this.pickReplyVideo(['album'], action, callback)
							return
						}
						this.pickReplyImage(['album'], action, callback)
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
			pickReplyVideo(sourceType, action, callback) {
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
			uploadImageFromAlbum(action) {
				action = action || this.mediaActionName || 'image'
				if (!this.mediaActionBusy && !this.startMediaAction(action)) {
					return
				}
				this.pickReplyImage(['album'], action, file => {
					this.uploadPickedMedia(file.path, 'image')
				})
			},
			uploadVideoFromAlbum(action) {
				action = action || this.mediaActionName || 'video'
				if (!this.mediaActionBusy && !this.startMediaAction(action)) {
					return
				}
				this.pickReplyVideo(['album'], action, file => {
					this.uploadPickedMedia(file.path, 'video')
				})
			},
			linkTap(e) {
				const href = this.normalizeYaohuoUrl(e && e.href)
				if (!href) {
					return
				}
				if (navigateToNativePost(href, {
						classid: this.getPostClassId()
					})) {
					return
				}
				if (navigateToNativeRoute(href)) {
					return
				}
				uni.navigateTo({
					url: `/pages/webview/webview?url=${encodeURIComponent(href)}`
				})
			},
			previewCommentImages(images, index) {
				const urls = (images || []).filter(Boolean)
				if (!urls.length) {
					return
				}
				uni.previewImage({
					current: urls[index] || urls[0],
					urls
				})
			},
			nativeImageError(src, e) {
				console.log('[YAOHUO_NATIVE_IMG_ERROR]', JSON.stringify({
					src,
					errMsg: e && e.detail ? e.detail.errMsg || '' : ''
				}))
			},
			normalizeYaohuoUrl(url) {
				url = String(url || '').replace(/&amp;/g, '&').trim()
				if (!url) {
					return ''
				}
				if (/^https?:\/\//i.test(url)) {
					return url
				}
				if (url.indexOf('//') === 0) {
					return 'https:' + url
				}
				if (url.charAt(0) === '/') {
					return 'https://yaohuo.me' + url
				}
				return 'https://yaohuo.me/' + url.replace(/^\.?\//, '')
			},
			getReplyRequestHeader(extraHeader) {
				return getAuthHeader(Object.assign({
					'Referer': `https://yaohuo.me/bbs-${this.postInfo.postId}.html`
				}, extraHeader || {}))
			},
			cancelReply() {
				this.isReplyFloor = false
				delete this.replyData.reply
				delete this.replyData.touserid
				this.faceIndex = 0
				this.replyData.face = ''
				this.facePanelShow = false
				this.mediaPanelShow = false
				this.ubbPanelShow = false
				this.selectedPluginEmoji = ''
				this.replyData.g = '快速回复'
				this.replyTips = '请勿乱打字回复,以免被加黑。'
			},
			replyToFloor(comment) {
				let floor = comment || {}
				this.replyData.g = '发表回复'
				this.replyData.reply = floor.floor
				const userId = floor.userId || this.getUserId(floor.user)
				if (!userId) {
					return uni.showToast({
						title: '无法获取用户ID',
						icon: 'none'
					})
				}
				this.replyData.touserid = userId
				this.isReplyFloor = true
				this.replyTips = `回复${floor.floor}楼：`
			},
			CommentOption(comment, item){
				switch (item.option) {
					case '删':
						uni.showModal({
							title: '删除操作',
							content: `删除自己回贴扣2倍币和经验！如有附件一并删除。`,
							confirmText: '确定删除',
							success: (res) => {
								if (res.confirm) {
									uni.showLoading({
										mask:true
									})
									this.deleteReply(item.url).then(result => {
										if (this.isDeleteSuccess(result.html, result.tipText)) {
											uni.showToast({
												title: '删除成功',
												icon: 'success'
											})
											this.$emit('fetchReply', {
												refresh: true,
												order: this.commentOrder
											})
										} else {
											uni.showModal({
												title: '删除失败',
												content: result.tipText || '服务器未返回删除结果',
												showCancel: false
											})
										}
									}).catch(() => {
										uni.showToast({
											title: '删除失败',
											icon: 'error'
										})
									}).finally(() => {
										uni.hideLoading()
									})
								}
							}
						})
						break;
					default:
				}
			},
			getDeleteUrl(rawUrl) {
				let url = String(rawUrl || '').replace(/&amp;/g, '&')
				if (/^\/\//.test(url)) {
					url = 'https:' + url
				} else if (!/^https?:\/\//i.test(url)) {
					url = url.charAt(0) === '/' ? 'https://yaohuo.me' + url : 'https://yaohuo.me/bbs/' + url.replace(/^\.?\//, '')
				}
				return url
			},
			deleteReply(rawUrl) {
				const url = this.getDeleteUrl(rawUrl)
				return this.requestDeleteUrl(url).then(first => {
					if (this.isDeleteSuccess(first.html, first.tipText) || this.isFinalDeleteFailure(first.tipText)) {
						return first
					}
					const confirm = this.extractDeleteConfirmRequest(first.html)
					if (!confirm.url) {
						return first
					}
					return this.requestDeleteUrl(confirm.url, confirm)
				})
			},
			requestDeleteUrl(url, options) {
				options = options || {}
				return new Promise((resolve, reject) => {
					uni.request({
						url,
						method: options.method || 'GET',
						header: getAuthHeader({
							'Content-Type': 'application/x-www-form-urlencoded',
							'Referer': `https://yaohuo.me/bbs-${this.postInfo.postId}.html`
						}),
						data: options.data ? this.formEncode(options.data) : undefined,
						success: res => {
							const html = String(res.data || '')
							resolve({
								statusCode: res.statusCode || 0,
								html,
								tipText: this.extractTipText(html) || this.stripHtml(html).slice(0, 160)
							})
						},
						fail: reject
					})
				})
			},
			extractDeleteConfirmRequest(html) {
				const forms = String(html || '').match(/<form\b[\s\S]*?<\/form>/ig) || []
				for (let i = 0; i < forms.length; i++) {
					const form = forms[i]
					const action = this.getFormAction(form)
					if (!/book_re_del\.aspx/i.test(action) && !/name=["']action["'][^>]+value=["']godel["']/i.test(form)) {
						continue
					}
					const data = this.extractFormFields(form)
					if (!data.action) {
						data.action = 'godel'
					}
					return {
						method: 'POST',
						url: action || this.getDeleteUrl('book_re_del.aspx'),
						data
					}
				}
				const reg = /<a\b[^>]*href\s*=\s*(["'])([^"']+)\1[^>]*>([\s\S]*?)<\/a>/ig
				let match
				while ((match = reg.exec(String(html || '')))) {
					const href = this.decodeHtmlText(match[2])
					const text = this.stripHtml(match[3])
					if (/book_re_del\.aspx/i.test(href) && (/action=godel/i.test(href) || /确定|确认|删除|是/.test(text))) {
						return {
							method: 'GET',
							url: this.getDeleteUrl(href)
						}
					}
				}
				return {
					url: ''
				}
			},
			isFinalDeleteFailure(tipText) {
				return /(失败|错误|权限|不能|没有|请先|登录|不存在|审核|安全验证)/.test(String(tipText || ''))
			},
			goToUserArea(comment) {
				comment = comment || {}
				let id = comment.userId || this.getUserId(comment.user)
				if (!id) {
					return uni.showToast({
						title: '无法获取用户ID',
						icon: 'none'
					})
				}
				uni.navigateTo({
					url: `/pages/user/user?id=${id}`
				})
			},
			getUserId(user) {
				const match = String(user || '').match(/\((\d{1,10})\)/)
				return match ? match[1] : ''
			},
			reply(options) {
				options = options || {}
				this.syncReplyData()
				if (!this.replyData.classid) {
					return uni.showToast({
						title: '缺少版块ID',
						icon: 'none'
					})
				}
				if (!this.hasReplyDraft) {
					return uni.showToast({
						title: '评论不得为空',
						icon: 'error'
					})
				}
				if (this.shouldConfirmMeatRepeat(options)) {
					return uni.showModal({
						title: '已经吃过',
						content: '这个帖子 7 天内已经吃过肉，继续回复吗？',
						confirmText: '继续',
						success: res => {
							if (res.confirm) {
								this.reply(Object.assign({}, options, {
									skipMeatConfirm: true
								}))
							}
						}
					})
				}
				const payload = this.buildReplyPayload()
				this.loading = true
				this.prepareReplyRequest(payload).then(request => {
					request.meatPostId = options.meatPostId || this.pendingMeatPostId || ''
					this.submitReply(request)
				}).catch(err => {
					this.submitReply({
						url: this.getReplySubmitUrl('', payload),
						payload,
						meatPostId: options.meatPostId || this.pendingMeatPostId || '',
						meta: {
							prepareError: (err && (err.errMsg || err.message)) || String(err || '')
						}
					})
				})
			},
			submitReply(request) {
				const url = request.url || 'https://yaohuo.me/bbs/book_re.aspx'
				const payload = request.payload || {}
				const meatPostId = String(request.meatPostId || '')
				let replySuccess = false
				uni.request({
					url,
					method: 'POST',
					header: this.getReplyRequestHeader({
						'Content-Type': 'application/x-www-form-urlencoded',
						'Referer': `https://yaohuo.me/bbs-${this.postInfo.postId}.html`
					}),
					data: this.formEncode(payload),
					success: (res) => {
						const html = String(res.data || '')
						const tipText = this.extractTipText(html)
						const feedback = this.extractReplyFeedback(tipText, html)
						const isSuccess = this.isReplySuccess(tipText, html, feedback)
						this.logReplyResponse({
							statusCode: res.statusCode,
							url,
							meta: request.meta || {},
							payload: this.getReplyPayloadForLog(payload),
							encodedPayload: this.formEncode(this.getReplyPayloadForLog(payload)),
							tip: tipText,
							feedback,
							success: isSuccess,
							resourceRewardPatch: this.shouldPatchResourceReward(feedback, payload),
							text: this.stripHtml(html).slice(0, 1200),
							html: html.slice(0, 800)
						})
						if (Number(res.statusCode || 0) >= 400 || this.isFailureTip(tipText)) {
							return uni.showModal({
								title: '评论失败',
								content: tipText || '服务器返回失败',
								showCancel: false
							})
						}
						if (!isSuccess) {
							return uni.showModal({
								title: '评论未发送',
								content: tipText || feedback || '服务器没有返回回复成功结果，请重试或用浏览器打开。',
								showCancel: false
							})
						}
						const refreshDelay = this.showReplySuccess(tipText, html, payload)
						replySuccess = true
						if (this.shouldRecordMeatReply(payload, meatPostId)) {
							this.saveMeatRecord(payload.id || meatPostId)
						}
						this.cancelReply()
						this.replyData.content = ''
						setTimeout(() => {
							this.$emit('fetchReply', {
								afterReply: true,
								order: this.commentOrder
							})
						}, refreshDelay)
					},
					fail: (err) => {
						uni.showToast({
							title: '评论失败',
							icon: 'error'
						})
					},
					complete: () => {
						this.loading = false
						if (meatPostId && this.pendingMeatPostId === meatPostId) {
							this.pendingMeatPostId = ''
						}
						if (replySuccess) {
							this.replyData.content = ''
						}
					}
				})
			},
			prepareReplyRequest(payload) {
				const detailUrl = `https://yaohuo.me/bbs-${this.postInfo.postId}.html`
				return new Promise(resolve => {
					uni.request({
						url: detailUrl,
						header: this.getReplyRequestHeader({
							'Referer': detailUrl
						}),
						success: res => {
							const html = String(res.data || '')
							const form = this.extractReplyForm(html)
							const formPayload = form.html ? this.extractFormFields(form.html) : {}
							const mergedPayload = this.mergeReplyPayload(formPayload, payload)
							resolve({
								url: this.getReplySubmitUrl(form.action, mergedPayload),
								payload: mergedPayload,
								meta: {
									formFound: !!form.html,
									formAction: form.action || '',
									formFields: Object.keys(formPayload)
								}
							})
						},
						fail: err => {
							resolve({
								url: this.getReplySubmitUrl('', payload),
								payload,
								meta: {
									formFetchFailed: (err && (err.errMsg || err.message)) || 'request fail'
								}
							})
						}
					})
				})
			},
			extractReplyForm(html) {
				const forms = String(html || '').match(/<form\b[\s\S]*?<\/form>/ig) || []
				for (let i = 0; i < forms.length; i++) {
					const form = forms[i]
					const action = this.getFormAction(form)
					if (/book_re\.aspx/i.test(action) || (/name=["']content["']/i.test(form) &&
							/name=["']action["'][^>]+value=["']add["']/i.test(form))) {
						return {
							html: form,
							action: action || 'https://yaohuo.me/bbs/book_re.aspx'
						}
					}
				}
				return {
					html: '',
					action: 'https://yaohuo.me/bbs/book_re.aspx'
				}
			},
			getFormAction(formHtml) {
				const formTag = String(formHtml || '').match(/<form\b[^>]*>/i)
				const action = formTag ? this.getTagAttr(formTag[0], 'action') : ''
				return this.normalizeReplyAction(action)
			},
			normalizeReplyAction(action) {
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
				if (action.charAt(0) === '/') {
					return 'https://yaohuo.me' + action
				}
				return 'https://yaohuo.me/bbs/' + action.replace(/^\.?\//, '')
			},
			extractFormFields(formHtml) {
				const fields = {}
				const inputReg = /<input\b[^>]*>/ig
				let inputMatch
				while ((inputMatch = inputReg.exec(String(formHtml || '')))) {
					const tag = inputMatch[0]
					const name = this.getTagAttr(tag, 'name')
					if (!name || this.hasBooleanAttr(tag, 'disabled')) {
						continue
					}
					const type = String(this.getTagAttr(tag, 'type') || 'text').toLowerCase()
					if ((type === 'checkbox' || type === 'radio') && !this.hasBooleanAttr(tag, 'checked')) {
						continue
					}
					fields[name] = this.getTagAttr(tag, 'value') || ''
				}
				const textareaReg = /<textarea\b[^>]*>[\s\S]*?<\/textarea>/ig
				let textareaMatch
				while ((textareaMatch = textareaReg.exec(String(formHtml || '')))) {
					const openTag = textareaMatch[0].match(/<textarea\b[^>]*>/i)
					const tag = openTag ? openTag[0] : ''
					const name = this.getTagAttr(tag, 'name')
					if (!name || this.hasBooleanAttr(tag, 'disabled')) {
						continue
					}
					const body = textareaMatch[0].replace(/^<textarea\b[^>]*>/i, '').replace(/<\/textarea>$/i, '')
					fields[name] = this.decodeHtmlText(body) || this.getTagAttr(tag, 'value') || ''
				}
				const selectReg = /<select\b[^>]*>[\s\S]*?<\/select>/ig
				let selectMatch
				while ((selectMatch = selectReg.exec(String(formHtml || '')))) {
					const openTag = selectMatch[0].match(/<select\b[^>]*>/i)
					const tag = openTag ? openTag[0] : ''
					const name = this.getTagAttr(tag, 'name')
					if (!name || this.hasBooleanAttr(tag, 'disabled')) {
						continue
					}
					const selectedOption = selectMatch[0].match(/<option\b[^>]*(?:\sselected(?:\s|=|>|\/))[^>]*>[\s\S]*?<\/option>/i)
					const firstOption = selectMatch[0].match(/<option\b[^>]*>[\s\S]*?<\/option>/i)
					const option = selectedOption ? selectedOption[0] : firstOption ? firstOption[0] : ''
					const optionTag = option.match(/<option\b[^>]*>/i)
					fields[name] = optionTag && this.getTagAttr(optionTag[0], 'value') ||
						this.decodeHtmlText(this.stripHtml(option)) || ''
				}
				return fields
			},
			mergeReplyPayload(formPayload, payload) {
				const form = formPayload || {}
				const data = {
					content: payload.content || '',
					action: payload.action || form.action || 'add',
					id: payload.id || form.id || this.postInfo.postId,
					siteid: payload.siteid || form.siteid || 1000,
					lpage: payload.lpage || form.lpage || 1,
					classid: payload.classid || form.classid || this.getPostClassId(),
					g: payload.g || form.g || '快速回复'
				}
				;['face', 'reply', 'touserid', 'sendmsg'].forEach(key => {
					const value = payload[key] || form[key]
					if (value !== undefined && value !== null && String(value) !== '') {
						data[key] = value
					}
				})
				return data
			},
			getReplySubmitUrl(action, payload) {
				let url = this.normalizeReplyAction(action) || 'https://yaohuo.me/bbs/book_re.aspx'
				const data = payload || {}
				url = this.setUrlQueryParam(url, 'ajax', 1)
				url = this.setUrlQueryParam(url, 'siteid', data.siteid || 1000)
				url = this.setUrlQueryParam(url, 'classid', data.classid || this.getPostClassId())
				url = this.setUrlQueryParam(url, 'id', data.id || this.postInfo.postId)
				return url
			},
			setUrlQueryParam(url, name, value) {
				const hashParts = String(url || '').split('#')
				const main = hashParts.shift()
				const hash = hashParts.length ? '#' + hashParts.join('#') : ''
				const parts = main.split('?')
				const path = parts.shift()
				const query = parts.join('?')
				const params = query ? query.split('&').filter(Boolean) : []
				const nextParams = params.filter(item => item.split('=')[0].toLowerCase() !== String(name).toLowerCase())
				nextParams.push(name + '=' + encodeURIComponent(value === undefined || value === null ? '' : value))
				return path + '?' + nextParams.join('&') + hash
			},
			shouldNotifyPostOwner() {
				const authorMatch = String(this.postInfo && this.postInfo.authorId || '').match(/\d+/)
				const userMatch = String(uni.getStorageSync('yaohuoUserId') || '').match(/\d+/)
				if (!authorMatch || !userMatch) {
					return true
				}
				return authorMatch[0] !== userMatch[0]
			},
			buildReplyPayload() {
				const content = this.getContentWithSelectedPluginEmoji(this.replyData.content)
				const data = {
					content: String(content || '').replace(/\n/g, '\r\n'),
					action: 'add',
					id: this.postInfo.postId,
					siteid: 1000,
					lpage: this.replyData.lpage || 1,
					classid: this.getPostClassId(),
					g: this.replyData.g || '快速回复'
				}
				if (this.replyData.face) {
					data.face = this.replyData.face
				}
				if (this.replyData.reply) {
					data.reply = this.replyData.reply
				}
				if (this.replyData.touserid) {
					data.touserid = this.replyData.touserid
				}
				if (this.replyData.sendmsg || this.shouldNotifyPostOwner()) {
					data.sendmsg = 1
				}
				return data
			},
			getReplyPayloadForLog(payload) {
				const data = Object.assign({}, payload || {})
				if (data.sid) {
					data.sid = '[redacted]'
				}
				if (data.content) {
					data.contentLength = String(data.content).length
					data.contentPreview = String(data.content).slice(0, 80)
					delete data.content
				}
				return data
			},
			logReplyResponse(data) {
				try {
					console.log('[YAOHUO_REPLY_RESPONSE_JSON] ' + JSON.stringify(data))
				} catch (e) {
					console.log('[YAOHUO_REPLY_RESPONSE_JSON] stringify failed')
				}
			},
			formEncode(data) {
				return Object.keys(data || {}).map(key => {
					const value = data[key] === undefined || data[key] === null ? '' : data[key]
					return encodeURIComponent(key) + '=' + encodeURIComponent(value)
				}).join('&')
			},
			extractTipText(html) {
				const match = String(html || '').match(/<div class=["']tip["'][^>]*>([\s\S]*?)<\/div>/i)
				return match ? this.stripHtml(match[1]) : ''
			},
			isFailureTip(tipText) {
				const text = String(tipText || '')
				return /(失败|错误|验证码|登录|为空|限制|不能|请先|安全验证)/.test(text) ||
					(/加黑/.test(text) && !/(回复|评论).*成功|成功.*(回复|评论)/.test(text))
			},
			isDeleteSuccess(html, tipText) {
				const text = tipText || this.stripHtml(html)
				if (/(删除成功|成功删除|操作成功|已删除)/.test(text)) {
					return true
				}
				if (/(失败|错误|权限|不能|没有|请先|登录|不存在|审核|安全验证)/.test(tipText || '')) {
					return false
				}
				return /<div class=["']tip["'][^>]*>[\s\S]*?(删除成功|成功删除|操作成功|已删除)/i.test(String(html || ''))
			},
			getTagAttr(tag, name) {
				const escaped = String(name || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
				const reg = new RegExp("\\s" + escaped + "\\s*=\\s*([\"'])([\\s\\S]*?)\\1", 'i')
				const match = String(tag || '').match(reg)
				return match ? this.decodeHtmlText(match[2]) : ''
			},
			hasBooleanAttr(tag, name) {
				const escaped = String(name || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
				return new RegExp('(?:^|\\s)' + escaped + '(?:\\s|=|>|/)', 'i').test(String(tag || ''))
			},
			decodeHtmlText(text) {
				return String(text || '')
					.replace(/&amp;/g, '&')
					.replace(/&quot;/g, '"')
					.replace(/&#39;/g, "'")
					.replace(/&lt;/g, '<')
					.replace(/&gt;/g, '>')
					.replace(/&nbsp;/g, ' ')
			},
			stripHtml(html) {
				return String(html || '')
					.replace(/<script\b[\s\S]*?<\/script>/gi, '')
					.replace(/<style\b[\s\S]*?<\/style>/gi, '')
					.replace(/<br\s*\/?>/gi, '\n')
					.replace(/<[^>]+>/g, '')
					.replace(/&nbsp;/g, ' ')
					.replace(/&amp;/g, '&')
					.trim()
			},
			showReplySuccess(tipText, html, payload) {
				const feedback = this.normalizeReplySuccessFeedback(this.extractReplyFeedback(tipText, html), payload)
				uni.showModal({
					title: '回复成功',
					content: feedback,
					showCancel: false
				})
				return 300
			},
			extractReplyFeedback(tipText, html) {
				const sources = [
					tipText,
					this.extractRewardLines(html),
					this.stripHtml(html)
				]
				for (let i = 0; i < sources.length; i++) {
					const feedback = this.cleanReplyFeedback(sources[i])
					if (this.isUsefulReplyFeedback(feedback)) {
						return feedback
					}
				}
				return ''
			},
			isReplySuccess(tipText, html, feedback) {
				const text = this.cleanReplyFeedback([tipText, feedback, this.extractRewardLines(html)].filter(Boolean).join('\n'))
				if (!text) {
					return false
				}
				if (this.isFailureTip(tipText || feedback)) {
					return false
				}
				return /(回复|评论).*成功|成功.*(回复|评论)|获得\s*(妖晶|经验|金币|币)|(妖晶|经验|金币|币)\s*[:：]?\s*[+-]?\d+/i
					.test(text)
			},
			extractRewardLines(html) {
				const text = this.stripHtml(html)
				const lines = text.split(/\n+/).map(item => item.trim()).filter(Boolean)
				const matched = []
				lines.forEach(line => {
					if (/(评论|回复|成功|奖励|获得|增加|妖晶|经验|金币|币|\+\s*\d+)/.test(line) &&
						!/返回主题|返回列表|返回首页|查看回复|跳转中|乱打字|加黑/.test(line)) {
						matched.push(line)
					}
				})
				if (matched.length) {
					return matched.join('\n')
				}
				const compact = text.replace(/\s+/g, ' ')
				const snippets = []
				const reg = /.{0,18}(?:评论|回复|成功|奖励|获得|增加|妖晶|经验|金币|币|\+\s*\d+).{0,36}/g
				let match
				while ((match = reg.exec(compact)) && snippets.length < 3) {
					snippets.push(match[0])
				}
				return snippets.join('\n')
			},
			isUsefulReplyFeedback(feedback) {
				feedback = String(feedback || '').trim()
				if (!feedback || feedback.length < 4) {
					return false
				}
				if (/^(查看回复|返回主题|返回列表|返回首页|跳转中)+$/.test(feedback.replace(/\s+/g, ''))) {
					return false
				}
				if (/(妖晶|经验|金币|币)/.test(feedback)) {
					const numbers = feedback.match(/[+-]?\s*\d+/g) || []
					const hasPositive = numbers.some(item => Number(String(item).replace(/\s+/g, '')) > 0)
					if (hasPositive) {
						return true
					}
					return !/0\s*(妖晶|经验|金币|币)|(妖晶|经验|金币|币)\s*0/.test(feedback)
				}
				return /(评论|回复).*成功|成功.*(评论|回复)|奖励|获得|增加/.test(feedback)
			},
			normalizeReplySuccessFeedback(feedback, payload) {
				feedback = this.cleanReplyFeedback(feedback)
				if (this.shouldPatchResourceReward(feedback, payload)) {
					return feedback.replace(/获得\s*妖晶\s*[:：]\s*[+-]?0\b/, '获得妖晶:30')
				}
				if (/(妖晶|经验|金币|币)/.test(feedback) && /[1-9]\d*/.test(feedback)) {
					return feedback
				}
				if (/(评论|回复).*成功|成功.*(评论|回复)/.test(feedback)) {
					return feedback.replace(/评论/g, '回复').replace(/[，,。.\s]*$/, '')
				}
				return '回复成功'
			},
			shouldPatchResourceReward(feedback, payload) {
				feedback = this.cleanReplyFeedback(feedback)
				return this.isResourceSharePost(payload) &&
					/回复成功|评论成功/.test(feedback) &&
					/获得\s*妖晶\s*[:：]\s*[+-]?0\b/.test(feedback) &&
					/获得\s*经验\s*[:：]\s*[+-]?\d+/.test(feedback)
			},
			isResourceSharePost(payload) {
				const ids = [
					payload && payload.classid,
					this.replyData && this.replyData.classid,
					this.postInfo && this.postInfo.classId
				]
				const hasResourceClass = ids.some(item => {
					const match = String(item || '').match(/\d+/)
					return match && match[0] === '201'
				})
				const postId = String(payload && payload.id || this.postInfo && this.postInfo.postId || '')
				return hasResourceClass || postId === '1543039'
			},
			cleanReplyFeedback(tipText) {
				return String(tipText || '')
					.replace(/跳转中\s*\.*\s*返回/g, '')
					.replace(/返回主题|返回列表|返回管理|返回上级|返回首页/g, '')
					.split(/\n+/)
					.map(item => item.trim())
					.filter(Boolean)
					.join('\n')
					.trim()
			}
		}
	}
</script>

<style scoped>
	/* comment */
	page {
		background-color: #fff;
	}

	.uni-padding-wrap {
		padding: 0 20rpx 200rpx;
	}


	.uni-comment {
		padding: 5rpx 0;
		display: flex;
		flex-grow: 1;
		flex-direction: column;
	}

	.uni-comment-list {
		flex-wrap: nowrap;
		padding: 10rpx 0;
		margin: 10rpx 0;
		width: 100%;
		display: flex;
	}

	.uni-comment-face {
		width: 70rpx;
		height: 70rpx;
		border-radius: 50%;
		margin-right: 15rpx;
		background-color: #1E90FF;
		position: relative;
		flex: 0 0 70rpx;
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: visible;
	}

	.uni-comment-face image {
		width: 100%;
		height: 100%;
		border-radius: 100%;
	}

	.comment-avatar {
		width: 70rpx;
		height: 70rpx;
		display: block;
		background: #f2f2f2;
	}

	.uni-comment-body {
		width: calc(100% - 85rpx);
	}

	.uni-comment-top {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		line-height: 1.5em;
		justify-content: flex-start;
	}

	.uni-comment-top text {
		color: #0A98D5;
		font-size: 15px;
	}

	.comment-reward-chip {
		display: inline-flex;
		align-items: center;
		height: 32rpx;
		line-height: 32rpx;
		margin-left: 10rpx;
		padding: 0 10rpx;
		border-radius: 6rpx;
		background: #fff7e6;
		border: 1px solid #ffd591;
		color: #ad6800 !important;
		font-size: 11px !important;
		box-sizing: border-box;
		vertical-align: 2rpx;
	}

	.comment-medals {
		display: inline-flex;
		align-items: center;
		flex-wrap: wrap;
		margin-left: 8rpx;
		vertical-align: middle;
	}

	.comment-medal {
		width: 32rpx;
		height: 32rpx;
		margin-left: 4rpx;
	}

	.uni-comment-date {
		line-height: 38upx;
		flex-direction: row;
		justify-content: space-between;
		display: flex !important;
		flex-grow: 1;
		color: rgba(0, 0, 0, .3);
		font-size: 12px;
	}

	.uni-comment-date view {
		color: #666666;
		font-size: 12px;
		line-height: 38upx;
	}

	.uni-comment-date .flex {
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-end;
		row-gap: 8rpx;
	}

	.uni-comment-content {
		line-height: 1.6em;
		font-size: 14px;
		padding: 8rpx 0;
	}

	.comment-image-list {
		margin-top: 8rpx;
	}

	.comment-native-image {
		width: 100%;
		max-width: 520rpx;
		display: block;
		margin-top: 8rpx;
		border-radius: 4px;
		background: #f6f6f6;
	}

	.uni-comment-reply-btn {
		background: rgba(247, 247, 247);
		font-size: 12px;
		line-height: 28upx;
		padding: 5rpx 20upx;
		border-radius: 30upx;
		color: #333 !important;
		margin: 0 10upx;
	}
	.uni-comment-reply-btn.danger{
		background: #ff4400;
		color: #fff !important;
	}

	.refresh-comment-icon {
		background: rgba(247, 247, 247);
		padding: 15upx;
		border-radius: 50%;
		color: #333 !important;
	}

	.comment-order-btn {
		height: 52rpx;
		line-height: 52rpx;
		margin: 0 12rpx 0 0;
		padding: 0 18rpx;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		vertical-align: middle;
		border-radius: 26rpx;
		background: #f7f7f7;
		color: #333;
		font-size: 12px;
	}

	.comment-order-btn::after {
		border: none;
	}

	.comment-composer {
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		background-color: #f7f7f7;
	}

	.comment-toolbar {
		height: 92rpx;
		padding: 10rpx 20rpx 0;
		display: flex;
		align-items: center;
		justify-content: space-between;
		box-sizing: border-box;
	}

	.tool-group {
		display: flex;
		align-items: center;
		gap: 18rpx;
		min-width: 0;
	}

	.tool-button {
		width: 74rpx;
		height: 74rpx;
		display: flex;
		align-items: center;
		justify-content: center;
		flex: 0 0 74rpx;
		border-radius: 0;
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

	.tool-text {
		font-weight: 700;
		color: #333;
		font-size: 13px;
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

	.media-panel {
		margin: 8rpx 20rpx 0;
		padding: 16rpx 14rpx;
		background: #fff;
		border: 1px solid #eee;
		border-radius: 8rpx;
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

	.media-circle-btn.disabled {
		opacity: .45;
	}

	.ubb-panel {
		margin: 8rpx 20rpx 0;
		padding: 14rpx;
		background: #fff;
		border: 1px solid #eee;
		border-radius: 8rpx;
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

	.meat-action-btn {
		height: 58rpx;
		line-height: 58rpx;
		margin: 0;
		padding: 0 18rpx;
		border-radius: 29rpx;
		background: #fff7e6;
		color: #ad6800;
		border: 1px solid #ffd591;
		font-size: 12px;
		flex: 0 0 auto;
	}

	.meat-action-btn::after {
		border: none;
	}

	.submit-btn {
		color: #fff;
		height: 70rpx;
		line-height: 70rpx;
		background-color: #07c160;
		margin: 0;
		padding: 0 28rpx;
		flex: 0 0 auto;
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

	.selected-face {
		width: 70rpx;
		height: 70rpx;
	}

	.face-panel {
		margin: 8rpx 20rpx 0;
		background: #fff;
		border: 1px solid #eee;
		border-radius: 8rpx;
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

	.floor {
		width: 70rpx;
		height: 70rpx;
		line-height: 70rpx;
		text-align: center;
		font-size: 11px;
		color: #ffffff;
	}

	.floor-badge {
		position: absolute;
		right: -6rpx;
		bottom: -6rpx;
		width: 32rpx;
		height: 32rpx;
		line-height: 32rpx;
		border-radius: 50%;
		border: 2rpx solid #fff;
		background: #0A98D5;
		font-size: 9px;
		box-sizing: border-box;
	}
</style>
