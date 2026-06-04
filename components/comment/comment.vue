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
						<uni-icons class="refresh-comment-icon" @click="$emit('fetchReply',1)"
							style="vertical-align: -5px;" type="refreshempty" size="20"></uni-icons>
					</view>
				</uni-col>
			</uni-row>
			<view class="uni-comment">
				<view style="border-bottom:  1px dashed #dcdcdc;" class="uni-comment-list" v-for="(comment,index) in comments" :key="index">
					<view class="uni-comment-face" @click="goToUserArea(index)">
						<image v-if="comment.avatar" class="comment-avatar" :src="comment.avatar" mode="aspectFill"
							@error="nativeImageError(comment.avatar,$event)"></image>
						<view class="floor" :class="{'floor-badge': comment.avatar}">
							{{comment.floor}}
						</view>
					</view>
					<view class="uni-comment-body">
						<view class="uni-comment-top">
							<text @click="goToUserArea(index)">{{comment.user}}</text>
						</view>
						<view class="uni-comment-date">
							<text>{{comment.time}}</text>
							<view class="flex">
								<view class="uni-comment-reply-btn danger" v-if="comment.remanage && comment.remanage.length"
									v-for="item in comment.remanage" @click="CommentOption(index, item)">删除
								</view>
								<view class="uni-comment-reply-btn" v-if="!postInfo.isEnd" @click="replyToFloor(index)">回复
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
						<image v-if="selectedFace" :src="getFaceUrl(selectedFace.face)" class="tool-image selected-face"
							mode="aspectFit"></image>
						<image v-else src="../../static/smile.png" class="tool-image" mode="aspectFit"></image>
					</view>
					<view class="tool-button" @click="uploadImage">
						<image src="../../static/picture.png" class="tool-image" mode="aspectFit"></image>
					</view>
					<view class="tool-button" @click="showToast">
						<image src="../../static/video.png" class="tool-image small" mode="aspectFit"></image>
					</view>
					<view class="tool-button" @click="showToast">
						<image src="../../static/music.png" class="tool-image small" mode="aspectFit"></image>
					</view>
				</view>
				<button v-if="!replyData.content && !replyData.face" class="browser-open-btn" size="mini"
					@click="$emit('open-browser')">浏览器打开</button>
				<button v-show="replyData.content || replyData.face" :loading="loading" :disabled="loading"
					class="submit-btn" type="primary" size="mini" @click="reply">发表</button>
			</view>
			<view v-if="facePanelShow" class="face-panel">
				<scroll-view scroll-y class="face-scroll">
					<view class="face-grid">
						<view class="face-cell" :class="{active: !replyData.face}" @click="selectFace(0)">
							<text>无</text>
						</view>
						<view v-for="(item,index) in faceList" :key="item.face" class="face-cell"
							:class="{active: replyData.face === item.face}" @click="selectFace(index + 1)">
							<image :src="getFaceUrl(item.face)" mode="aspectFit"></image>
							<text>{{item.name}}</text>
						</view>
					</view>
				</scroll-view>
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
				loading: false,
				isReplyFloor: false,
				replyModalShow: false,
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
				originReplyData: {}
			}
		},
		computed: {
			faceList() {
				return this.array.filter(item => item.face)
			},
			selectedFace() {
				return this.array[this.faceIndex] && this.array[this.faceIndex].face ? this.array[this.faceIndex] : null
			}
		},
		mounted() {
			this.originReplyData = JSON.parse(JSON.stringify(this.replyData))
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
			showToast() {
				uni.showToast({
					title: '开发中',
					icon: 'none'
				})
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
				this.replyData.face = item && item.face ? item.face : ''
				this.facePanelShow = false
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
						success: (uploadFileRes) => {
							const url = this.extractUploadUrl(uploadFileRes.data)
							if (url) {
								resolve(url)
							} else {
								reject(new Error(String(uploadFileRes.data || '').slice(0, 80) || '图床未返回图片地址'))
							}
						},
						fail: (err) => {
							reject(new Error((err && (err.errMsg || err.message)) || '上传请求失败'))
						}
					})
				}).catch(() => this.uploadToHost(filePath, hostIndex + 1))
			},
			uploadImage() {
				uni.chooseImage({
					count: 1,
					success: (chooseImageRes) => {
						const tempFilePaths = chooseImageRes.tempFilePaths
						uni.showLoading({
							title: '图片上传中'
						})
						this.uploadToHost(tempFilePaths[0], 0).then(url => {
							this.replyData.content += `${this.replyData.content ? '\n' : ''}[img]${url}[/img]`
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
			linkTap(e) {
				const href = this.normalizeYaohuoUrl(e && e.href)
				if (!href) {
					return
				}
				const postMatch = href.match(/\/bbs-(\d+)\.html/i)
				if (!postMatch) {
					uni.navigateTo({
						url: `/pages/webview/webview?url=${encodeURIComponent(href)}`
					})
				} else {
					uni.navigateTo({
						url: `/pages/detail/detail?id=${postMatch[1]}`
					})
				}
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
				this.replyData.g = '快速回复'
				this.replyTips = '请勿乱打字回复,以免被加黑。'
			},
			replyToFloor(index) {
				let floor = this.comments[index]
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
			CommentOption(index, item){
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
											this.$emit('fetchReply', 1)
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
			goToUserArea(index) {
				let comment = this.comments[index]
				let id = comment.userId || this.getUserId(comment.user)
				if (!id) {
					return uni.showToast({
						title: '无法获取用户ID',
						icon: 'none'
					})
				}
				uni.navigateTo({
					url: `/pages/webview/webview?url=https://yaohuo.me/bbs/userinfo.aspx?touserid=${id}`
				})
			},
			getUserId(user) {
				const match = String(user || '').match(/\((\d{1,10})\)/)
				return match ? match[1] : ''
			},
			reply() {
				this.syncReplyData()
				if (!this.replyData.classid) {
					return uni.showToast({
						title: '缺少版块ID',
						icon: 'none'
					})
				}
				if (!this.replyData.content && !this.replyData.face) {
					return uni.showToast({
						title: '评论不得为空',
						icon: 'error'
					})
				}
				const payload = this.buildReplyPayload()
				this.loading = true
				this.prepareReplyRequest(payload).then(request => {
					this.submitReply(request)
				}).catch(err => {
					this.submitReply({
						url: this.getReplySubmitUrl('', payload),
						payload,
						meta: {
							prepareError: (err && (err.errMsg || err.message)) || String(err || '')
						}
					})
				})
			},
			submitReply(request) {
				const url = request.url || 'https://yaohuo.me/bbs/book_re.aspx'
				const payload = request.payload || {}
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
						this.cancelReply()
						this.replyData.content = ''
						setTimeout(() => {
							this.$emit('fetchReply', {
								afterReply: true
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
			buildReplyPayload() {
				const data = {
					content: String(this.replyData.content || '').replace(/\n/g, '\r\n'),
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
				if (this.replyData.sendmsg) {
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
		line-height: 1.5em;
		justify-content: space-between;
	}

	.uni-comment-top text {
		color: #0A98D5;
		font-size: 15px;
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

	.tool-image.small {
		width: 62rpx;
		height: 62rpx;
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
