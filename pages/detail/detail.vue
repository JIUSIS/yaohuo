<template>
	<view v-if="nodes.length">
		<uni-transition mode-class="fade" :duration="300" :show="true">
			<view class="content">
				<view class="f-18 title">
					{{info.title}}
				</view>
				<view v-if="info.extra && !(info.rewardTags && info.rewardTags.length)" class="f-14"
					style="margin-top: 20rpx;">
					{{info.extra}}
				</view>
				<view v-if="(info.rewardTags && info.rewardTags.length) || info.rewardStatus" class="post-reward-row">
					<text v-for="(item,index) in info.rewardTags" :key="index" class="post-reward-chip"
						:class="item.type ? 'post-reward-chip-' + item.type : ''">{{item.text}}</text>
					<text v-if="info.rewardStatus" class="post-reward-chip post-reward-chip-status">
						{{info.rewardStatus}}
					</text>
				</view>
				<view style="margin-top: 20rpx;">
					<uni-row>
						<uni-col :span="18">
							<view class="f-14">
								{{info.author}}
							</view>
						</uni-col>
						<uni-col :span="6">
							<view class="f-14 text-right">
								{{idObj[info.classId]}}
							</view>
						</uni-col>
					</uni-row>
					<view style="margin-top: 20rpx;" v-if="honorArr.length">
						<image style="width: 40rpx;height: 50rpx;margin-right: 5rpx;" v-for="(item,index) in honorArr"
							:key="index" :src="item"></image>
					</view>
					<view class="post-action-row" v-if="postDeleteUrl">
						<button class="post-delete-btn" size="mini" :loading="deletingPost" :disabled="deletingPost"
							@click="deletePost">删除帖子</button>
					</view>
				</view>
				<view style="border-bottom:  1px dashed #dcdcdc;margin-bottom: 20rpx;margin-top: 15rpx;">
				</view>
				<mp-html :content="nodes" :copyLink="false" selectable domain="https://yaohuo.me"
					containerStyle="line-height:30px;word-break: break-all;font-size:16px" @linktap="linkTap"
					@error="htmlMediaError">
				</mp-html>
				<view v-if="postImages.length" class="post-image-list">
					<image v-for="(img,index) in postImages" :key="img" class="post-native-image" :src="img"
						mode="widthFix" @tap="previewNativeImages(postImages,index)"
						@error="nativeImageError(img,$event)"></image>
				</view>
				<view v-if="postAttachments.length" class="post-attachment-list">
					<view class="post-attachment-title">附件</view>
					<view v-for="(item,index) in postAttachments" :key="item.key || index"
						class="post-attachment-item" @tap="openPostAttachment(item)">
						<view class="post-attachment-info">
							<text class="post-attachment-name">{{item.name}}</text>
							<text v-if="item.meta" class="post-attachment-meta">{{item.meta}}</text>
						</view>
						<text class="post-attachment-action">{{item.actionText}}</text>
					</view>
				</view>
				<view style="margin: 20rpx 0 30rpx;">
					<uni-row>
						<uni-col :span="12">
							<view class="f-13 info">
								浏览{{info.readCount}}次
							</view>
						</uni-col>
						<uni-col :span="12">
							<view class="f-13 text-right info">
								{{info.time}}
							</view>
						</uni-col>
					</uni-row>
				</view>
			</view>
			<view class="tip" v-if="info.status">
				<text class="tip-text">{{info.status}}</text>
			</view>
			<comment id="comment" :comments="comments" :postInfo="info" @fetchReply="fetchReply"
				@open-browser="openCurrentPostInBrowser" :postId="info.postId">
			</comment>
		</uni-transition>
		<view v-if="deletePasswordVisible" class="delete-mask">
			<view class="delete-dialog">
				<view class="delete-title">验证密码</view>
				<view class="delete-desc">删除帖子需要验证当前账号密码。</view>
				<input class="delete-input" password v-model="deletePassword" placeholder="请输入密码" :focus="true" />
				<view class="delete-actions">
					<button class="delete-cancel" size="mini" @click="closeDeletePassword">取消</button>
					<button class="delete-confirm" size="mini" :loading="deletingPost" :disabled="deletingPost"
						@click="confirmDeletePassword">确认删除</button>
				</view>
			</view>
		</view>
	</view>
</template>

<script>
	import {
		cheerio
	} from '@/utils/cheerio.js'
	import {
		idObj
	} from '@/utils/yaohuo.js'
	import HTMLParser from '@/utils/html-parser.js'
	import {
		getAuthHeader
	} from '@/utils/auth.js'
	import {
		openInBrowser
	} from '@/utils/browser.js'
	import {
		absoluteYaohuoUrl,
		getAttr,
		normalizeHtmlUrls
	} from '@/utils/html.js'
	import {
		navigateToNativePost
	} from '@/utils/route.js'
	export default {
		data() {
			return {
				id: '',
				nodes: '',
				comments: [],
				info: {},
				page: 1,
				totalPage: 0,
				status: 'more',
				replyPageBaseUrl: '',
				replyGo: '',
				idObj: idObj,
				honorArr: [],
				postDeleteUrl: '',
				currentUserId: '',
				deletingPost: false,
				deletePasswordVisible: false,
				deletePassword: '',
				postImages: [],
				postAttachments: [],
				imageCache: {},
				avatarCache: {},
				avatarLoading: {},
				detailPageAlive: false
			}
		},
		onLoad(option) {
			this.detailPageAlive = true
			this.info.postId = option.id
			this.info.classId = option.classid || option.classId || ''
			this.fetchDetail()
		},
		onUnload() {
			this.detailPageAlive = false
		},
		onPullDownRefresh() {
			this.fetchDetail()
		},
		onReachBottom() {
			if (this.page < this.totalPage) {
				uni.showNavigationBarLoading()
				this.status = 'loading'
				this.page++
				this.fetchReply()
			}
		},
		methods: {
			deletePost() {
				if (!this.postDeleteUrl) {
					return uni.showToast({
						title: '没有删帖权限',
						icon: 'none'
					})
				}
				uni.showModal({
					title: '删除帖子',
					content: '删除后无法恢复，确认删除吗？',
					confirmText: '确定删除',
					confirmColor: '#dd524d',
					success: res => {
						if (res.confirm) {
							this.openDeletePassword()
						}
					}
				})
			},
			openDeletePassword() {
				this.deletePassword = ''
				this.deletePasswordVisible = true
			},
			closeDeletePassword() {
				if (this.deletingPost) {
					return
				}
				this.deletePasswordVisible = false
				this.deletePassword = ''
			},
			confirmDeletePassword() {
				if (!this.deletePassword) {
					return uni.showToast({
						title: '请输入密码',
						icon: 'none'
					})
				}
				this.requestDeletePost(this.deletePassword)
			},
			requestDeletePost(password) {
				this.deletingPost = true
				uni.showLoading({
					title: '删除中'
				})
				uni.request({
					url: this.postDeleteUrl,
					method: 'POST',
					header: getAuthHeader({
						'Content-Type': 'application/x-www-form-urlencoded',
						'Referer': this.postDeleteUrl
					}),
					data: this.formEncode({
						needpassword: password
					}),
					success: res => {
						this.handlePostDeleteResponse(res, this.postDeleteUrl, true)
					},
					fail: () => {
						this.showPostDeleteFailure('删除失败')
					}
				})
			},
			requestPostDeleteConfirm(confirmRequest, refererUrl) {
				const request = typeof confirmRequest === 'string' ? {
					url: confirmRequest,
					method: 'POST',
					data: {}
				} : confirmRequest
				uni.request({
					url: request.url,
					method: request.method || 'POST',
					header: getAuthHeader({
						'Content-Type': 'application/x-www-form-urlencoded',
						'Referer': refererUrl || this.postDeleteUrl
					}),
					data: this.formEncode(request.data || {}),
					success: res => {
						this.handlePostDeleteResponse(res, request.url, false)
					},
					fail: () => {
						this.showPostDeleteFailure('最终删除请求失败')
					}
				})
			},
			handlePostDeleteResponse(res, requestUrl, allowConfirm) {
				const html = String(res.data || '')
				const tipText = this.extractTipText(html) || this.extractDeleteResultText(html)
				console.log('[YAOHUO_POST_DELETE_RESPONSE]', {
					statusCode: res.statusCode,
					url: requestUrl,
					tip: tipText,
					text: this.stripHtml(html).slice(0, 500),
					html: html.slice(0, 800)
				})
				if (this.isPostDeleteSuccess(html, tipText)) {
					this.finishPostDelete()
					return
				}
				if (allowConfirm) {
					const confirmRequest = this.extractPostDeleteConfirmRequest(html)
					if (confirmRequest.url) {
						this.requestPostDeleteConfirm(confirmRequest, requestUrl)
						return
					}
				}
				this.showPostDeleteFailure(tipText || '服务器仍返回验证密码页，请检查密码或重新登录后再试')
			},
			finishPostDelete() {
				this.postDeleteUrl = ''
				this.deletePasswordVisible = false
				this.deletePassword = ''
				this.deletingPost = false
				uni.hideLoading()
				uni.showToast({
					title: '删除成功',
					icon: 'success'
				})
				setTimeout(() => {
					uni.navigateBack({
						delta: 1
					})
				}, 700)
			},
			showPostDeleteFailure(message) {
				this.deletingPost = false
				uni.hideLoading()
				uni.showModal({
					title: '删除失败',
					content: message || '删除失败',
					showCancel: false
				})
			},
			isPostDeleteSuccess(html, tipText) {
				const text = tipText || this.stripHtml(html)
				if (/(删除成功|成功删除|操作成功|已删除)/.test(text)) {
					return true
				}
				if (/(失败|错误|权限|不能|没有|请先|登录|不存在|审核)/.test(text)) {
					return false
				}
				return /<div class=["']tip["'][^>]*>[\s\S]*?(删除成功|成功删除|操作成功|已删除)/i.test(String(html || ''))
			},
			extractTipText(html) {
				const match = String(html || '').match(/<div class=["']tip["'][^>]*>([\s\S]*?)<\/div>/i)
				return match ? this.stripHtml(match[1]) : ''
			},
			extractPostDeleteConfirmRequest(html) {
				if (!this.isPostDeleteConfirmPage(html)) {
					return {
						url: ''
					}
				}
				const formRequest = this.extractPostDeleteConfirmForm(html)
				if (formRequest.url) {
					return formRequest
				}
				const reg = /<a\b[^>]*href\s*=\s*(["'])([^"']+)\1[^>]*>([\s\S]*?)<\/a>/ig
				let match
				while ((match = reg.exec(String(html || '')))) {
					const href = this.decodeReplyAttr(match[2])
					const text = this.stripHtml(match[3])
					if (/book_view_del\.aspx/i.test(href) && (/action=godel/i.test(href) || /删除帖子|确定|确认/.test(text))) {
						return {
							url: this.normalizeYaohuoUrl(href),
							method: 'POST',
							data: {}
						}
					}
				}
				return {
					url: /book_view_del\.aspx/i.test(this.postDeleteUrl) ?
						this.setQueryParam(this.postDeleteUrl, 'action', 'godel') : '',
					method: 'POST',
					data: {}
				}
			},
			extractPostDeleteConfirmForm(html) {
				const forms = this.extractForms(html)
				const formHtml = forms.find(form => /book_view_del\.aspx/i.test(form) || /删除自己帖子|删除帖子/.test(this.stripHtml(form)))
				if (!formHtml) {
					return {
						url: ''
					}
				}
				const formTag = formHtml.match(/<form\b[^>]*>/i)
				let action = formTag && getAttr(formTag[0], 'action') ? getAttr(formTag[0], 'action') : this.postDeleteUrl
				action = this.normalizeYaohuoUrl(action)
				if (/book_view_del\.aspx/i.test(action) && !/[?&]action=godel/i.test(action)) {
					action = this.setQueryParam(action, 'action', 'godel')
				}
				return {
					url: action,
					method: formTag && /method\s*=\s*["']get["']/i.test(formTag[0]) ? 'GET' : 'POST',
					data: this.extractFormFields(formHtml)
				}
			},
			extractForms(html) {
				const forms = []
				const reg = /<form\b[\s\S]*?<\/form>/ig
				let match
				while ((match = reg.exec(String(html || '')))) {
					forms.push(match[0])
				}
				return forms
			},
			extractFormFields(formHtml) {
				const fields = {}
				const inputReg = /<input\b[^>]*>/ig
				let inputMatch
				while ((inputMatch = inputReg.exec(String(formHtml || '')))) {
					const tag = inputMatch[0]
					const name = getAttr(tag, 'name')
					if (!name || /disabled/i.test(tag)) {
						continue
					}
					const type = (getAttr(tag, 'type') || 'text').toLowerCase()
					if ((type === 'checkbox' || type === 'radio') && !/\schecked(?:\s|=|>)/i.test(tag)) {
						continue
					}
					fields[name] = getAttr(tag, 'value')
				}
				const buttonReg = /<button\b[^>]*>[\s\S]*?<\/button>/ig
				let buttonMatch
				while ((buttonMatch = buttonReg.exec(String(formHtml || '')))) {
					const tag = buttonMatch[0].match(/<button\b[^>]*>/i)
					const name = tag ? getAttr(tag[0], 'name') : ''
					if (name) {
						fields[name] = tag ? getAttr(tag[0], 'value') : ''
					}
				}
				return fields
			},
			updatePostDeleteUrl(html) {
				const deleteUrl = this.extractPostDeleteUrl(html)
				const authorId = this.extractPostAuthorId(html)
				const postId = this.info.postId
				this.info.authorId = authorId
				this.postDeleteUrl = ''
				if (!deleteUrl || !authorId) {
					return
				}
				this.getCurrentUserId().then(userId => {
					if (!this.detailPageAlive || postId !== this.info.postId) {
						return
					}
					this.currentUserId = userId
					this.postDeleteUrl = userId && String(userId) === String(authorId) ? deleteUrl : ''
				})
			},
			getCurrentUserId() {
				if (this.currentUserId) {
					return Promise.resolve(String(this.currentUserId))
				}
				const cached = uni.getStorageSync('yaohuoUserId')
				if (cached) {
					this.currentUserId = String(cached)
					return Promise.resolve(this.currentUserId)
				}
				return new Promise(resolve => {
					uni.request({
						url: 'https://yaohuo.me/myfile.aspx',
						header: getAuthHeader(),
						success: res => {
							const userId = this.extractCurrentUserId(res.data)
							if (userId) {
								this.currentUserId = userId
								uni.setStorageSync('yaohuoUserId', userId)
							}
							resolve(userId)
						},
						fail: () => {
							resolve('')
						}
					})
				})
			},
			extractCurrentUserId(html) {
				html = this.decodeReplyAttr(String(html || ''))
				const patterns = [
					/userinfo\.aspx\?touserid=(\d+)/i,
					/\bID\s*[:：]\s*(\d+)/i,
					/book_list\.aspx[^"']*[?&]key=(\d+)[^"']*[?&]type=pub/i,
					/book_re_my\.aspx[^"']*[?&]touserid=(\d+)/i
				]
				for (let i = 0; i < patterns.length; i++) {
					const match = html.match(patterns[i])
					if (match) {
						return match[1]
					}
				}
				return ''
			},
			extractPostAuthorId(html) {
				html = this.decodeReplyAttr(String(html || ''))
				const rewardMatch = html.match(/SendMoney_freeMain\.aspx[^"']*[?&]touserid=(\d+)/i)
				if (rewardMatch) {
					return rewardMatch[1]
				}
				const ownerMatch = html.match(/\[楼主\][\s\S]{0,600}?userinfo\.aspx\?touserid=(\d+)/i)
				if (ownerMatch) {
					return ownerMatch[1]
				}
				const editMatch = html.match(/\(ID\s*(\d+)\)[^{}]*修改此帖/i)
				if (editMatch) {
					return editMatch[1]
				}
				const firstUserMatch = html.match(/userinfo\.aspx\?touserid=(\d+)/i)
				return firstUserMatch ? firstUserMatch[1] : ''
			},
			extractPostAuthorName(html, authorId) {
				html = this.decodeReplyAttr(String(html || ''))
				if (authorId) {
					const linkReg = new RegExp(`<a\\b[^>]*href\\s*=\\s*(["'])[^"']*userinfo\\.aspx\\?touserid=${authorId}(?:&[^"']*)?\\1[^>]*>([\\s\\S]*?)<\\/a>`, 'i')
					const linkMatch = html.match(linkReg)
					if (linkMatch) {
						const name = this.stripHtml(linkMatch[2])
						if (name && !/^\(?\d+\)?$/.test(name)) {
							return name
						}
					}
				}
				const ownerTextMatch = this.stripHtml(html).match(/\[楼主\]\s*([^\n(（]+)/)
				return ownerTextMatch ? ownerTextMatch[1].trim() : ''
			},
			formatUserName(name, userId) {
				name = String(name || '').trim()
				userId = String(userId || '').trim()
				if (!name && !userId) {
					return ''
				}
				if (!name) {
					return userId
				}
				if (!userId || name.indexOf(userId) > -1) {
					return name
				}
				return `${name}(${userId})`
			},
			isPostDeleteConfirmPage(html) {
				const text = this.stripHtml(html)
				return /删除自己帖子/.test(text) && /扣.*币.*经验/.test(text)
			},
			extractDeleteResultText(html) {
				const text = this.stripHtml(html)
				if (/此操作需验证密码/.test(text)) {
					return ''
				}
				const lines = text.split(/\n+/).map(item => item.trim()).filter(Boolean)
				return lines.slice(0, 4).join('\n').slice(0, 180)
			},
			formEncode(data) {
				return Object.keys(data || {}).map(key => {
					const value = data[key] === undefined || data[key] === null ? '' : data[key]
					return encodeURIComponent(key) + '=' + encodeURIComponent(value)
				}).join('&')
			},
			extractPostDeleteUrl(html) {
				const reg = /<a\b[^>]*href\s*=\s*(["'])([^"']+)\1[^>]*>([\s\S]*?)<\/a>/ig
				let adminUrl = ''
				let match
				while ((match = reg.exec(String(html || '')))) {
					const href = this.decodeReplyAttr(match[2])
					const text = this.stripHtml(match[3])
					if (!href || /book_re_del\.aspx/i.test(href)) {
						continue
					}
					const isPostDelete = /book_(?:view_)?del\.aspx/i.test(href) ||
						(/(?:删帖|删贴|删除帖子|删除)/.test(text) && /(?:book_view|book).*del\.aspx/i.test(href))
					if (isPostDelete) {
						return this.getPostDeleteUrl(href)
					}
					if (!adminUrl && /Book_View_admin\.aspx/i.test(href) && /管理/.test(text)) {
						adminUrl = this.normalizeYaohuoUrl(href)
					}
				}
				return adminUrl ? this.getPostDeleteUrlFromAdmin(adminUrl) : ''
			},
			getPostDeleteUrlFromAdmin(adminUrl) {
				let url = String(adminUrl || '')
				if (!url) {
					return ''
				}
				url = url.replace(/\/bbs\/Book_View_admin\.aspx/i, '/bbs/book_view_del.aspx')
				url = this.setQueryParam(url, 'action', 'go')
				url = this.setQueryParam(url, 'id', this.info.postId)
				url = this.setQueryParam(url, 'siteid', 1000)
				if (this.cleanClassId(this.info.classId)) {
					url = this.setQueryParam(url, 'classid', this.cleanClassId(this.info.classId))
				}
				return url
			},
			getPostDeleteUrl(rawUrl) {
				let url = this.normalizeYaohuoUrl(rawUrl)
				if (!url) {
					return ''
				}
				url = this.setQueryParam(url, 'id', this.info.postId)
				url = this.setQueryParam(url, 'siteid', 1000)
				if (this.cleanClassId(this.info.classId)) {
					url = this.setQueryParam(url, 'classid', this.cleanClassId(this.info.classId))
				}
				url = this.setQueryParam(url, 'action', 'go')
				return url
			},
			normalizeYaohuoUrl(url) {
				url = this.decodeReplyAttr(String(url || '')).trim()
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
			openCurrentPostInBrowser() {
				openInBrowser(`https://yaohuo.me/bbs-${this.info.postId}.html`)
			},
			openPostAttachment(item) {
				if (!item) {
					return
				}
				const imageUrl = item.imageUrl ? this.normalizeMediaUrl(item.imageUrl) : ''
				if (imageUrl) {
					this.resolveDisplayImage(imageUrl).then(displayUrl => {
						uni.previewImage({
							current: displayUrl || imageUrl,
							urls: this.mergeImageList(this.postImages, [displayUrl || imageUrl])
						})
					})
					return
				}
				const url = this.normalizeYaohuoUrl(item.url)
				if (!url) {
					return uni.showToast({
						title: '没有附件链接',
						icon: 'none'
					})
				}
				uni.navigateTo({
					url: `/pages/webview/webview?url=${encodeURIComponent(url)}`
				})
			},
			linkTap(e) {
				const href = this.normalizeYaohuoUrl(e && e.href)
				if (!href) {
					return
				}
				const imageUrl = this.getImageUrlFromLink(href)
				if (imageUrl) {
					uni.previewImage({
						current: imageUrl,
						urls: [imageUrl]
					})
				} else {
					if (navigateToNativePost(href, {
							classid: this.info.classId
						})) {
						return
					}
					uni.navigateTo({
						url: `/pages/webview/webview?url=${encodeURIComponent(href)}`
					})
				}
			},
			htmlMediaError(e) {
				if (e && e.source === 'img') {
					const attrs = e.attrs || {}
					console.log('[YAOHUO_IMG_ERROR]', JSON.stringify({
						src: attrs.src || attrs['data-src'] || '',
						errMsg: e.errMsg || ''
					}))
				}
			},
			nativeImageError(src, e) {
				console.log('[YAOHUO_NATIVE_IMG_ERROR]', JSON.stringify({
					src,
					errMsg: e && e.detail ? e.detail.errMsg || '' : ''
				}))
			},
			previewNativeImages(images, index) {
				const urls = (images || []).filter(Boolean)
				if (!urls.length) {
					return
				}
				uni.previewImage({
					current: urls[index] || urls[0],
					urls
				})
			},
			fetchReply(flag, auto) {
				const requestPostId = this.info.postId
				const afterReply = flag && typeof flag === 'object' && flag.afterReply
				if (flag) {
					if (afterReply) {
						const nextReplyCount = Number(this.info.replyCount || 0) + 1
						this.info.replyCount = nextReplyCount
						this.totalPage = Math.max(1, Math.ceil(nextReplyCount / 15))
						this.page = this.totalPage
					} else {
						this.page = 1
					}
					this.replyPageBaseUrl = ''
					this.replyGo = String(Date.now()).slice(-5)
					uni.showLoading({
						title: '刷新评论中'
					})
				}
				if (!this.page) {
					this.page = 1
				}
				const url = this.getReplyUrl()
				uni.request({
					url,
					header: getAuthHeader(),
					success: (res) => {
						if (!this.detailPageAlive || requestPostId !== this.info.postId) {
							return
						}
						const replyHtml = String(res.data || '')
						this.updateReplyPaging(replyHtml)
						let comments = this.parseReplies(replyHtml)
						if (flag) {
							this.comments = comments
							this.hydrateReplyMedia(this.comments)
							this.hydrateReplyAvatars(this.comments)
							if (!afterReply) {
								uni.showToast({
									title: '刷新成功'
								})
							}
						} else {
							this.comments = this.sortComments(this.mergeComments(this.comments, comments))
							this.hydrateReplyMedia(this.comments)
							this.hydrateReplyAvatars(this.comments)
						}
						if (!comments.length || this.page >= this.totalPage) {
							this.status = 'noMore'
						} else {
							this.status = 'more'
						}
					},
					fail: () => {
						if (this.detailPageAlive && requestPostId === this.info.postId) {
							uni.hideLoading()
						}
					},
					complete: () => {
						if (!auto && this.detailPageAlive && requestPostId === this.info.postId) {
							uni.hideLoading()
							uni.hideNavigationBarLoading()
						}
					}
				})
			},
			getReplyUrl() {
				const classId = this.cleanClassId(this.info.classId)
				const baseUrl = this.replyPageBaseUrl ||
					`https://yaohuo.me/bbs/book_re.aspx?action=class&id=${this.info.postId}&siteid=1000&classid=${classId}&lpage=&ot=1&go=${this.replyGo || Date.now()}`
				return this.setQueryParam(this.cleanReplyListUrl(baseUrl), 'page', this.page || 1)
			},
			updateReplyPaging(html) {
				const moreUrl = this.extractReplyMoreUrl(html)
				if (moreUrl) {
					this.replyPageBaseUrl = this.cleanReplyListUrl(this.removeQueryParam(moreUrl, 'page'))
				}
				const totalMatch = String(html || '').match(/getTotal=(\d+)/i)
				if (totalMatch) {
					this.totalPage = Math.ceil(Number(totalMatch[1]) / 15)
				}
				if (!this.totalPage && this.info.replyCount) {
					this.totalPage = Math.ceil(Number(this.info.replyCount) / 15)
				}
				if (!this.totalPage) {
					this.totalPage = 1
				}
			},
			extractReplyMoreUrl(html) {
				html = String(html || '')
				const moreBlock = html.match(/<div[^>]+class=["'][^"']*more[^"']*["'][^>]*>[\s\S]*?<\/div>/i)
				if (!moreBlock) {
					return ''
				}
				const hrefMatch = moreBlock[0].match(/<a[^>]+href=["']([^"']*(?:book_re\.aspx|getTotal=)[^"']*)["']/i)
				if (!hrefMatch || hrefMatch[1].indexOf('page=') < 0) {
					return ''
				}
				return this.normalizeReplyUrl(hrefMatch[1])
			},
			normalizeReplyUrl(url) {
				url = String(url || '').replace(/&amp;/g, '&')
				if (url.indexOf('//') === 0) {
					return 'https:' + url
				}
				if (url.indexOf('http') === 0) {
					return url
				}
				if (url.charAt(0) === '/') {
					return 'https://yaohuo.me' + url
				}
				return 'https://yaohuo.me/' + url
			},
			setQueryParam(url, name, value) {
				const hashParts = String(url || '').split('#')
				const main = hashParts.shift()
				const hash = hashParts.length ? '#' + hashParts.join('#') : ''
				const parts = main.split('?')
				const path = parts.shift()
				const query = parts.join('?')
				const params = query ? query.split('&').filter(Boolean) : []
				const nextParams = params.filter(item => item.split('=')[0].toLowerCase() !== name.toLowerCase())
				nextParams.push(name + '=' + encodeURIComponent(value))
				return path + '?' + nextParams.join('&') + hash
			},
			removeQueryParam(url, name) {
				const hashParts = String(url || '').split('#')
				const main = hashParts.shift()
				const hash = hashParts.length ? '#' + hashParts.join('#') : ''
				const parts = main.split('?')
				const path = parts.shift()
				const query = parts.join('?')
				const params = query ? query.split('&').filter(Boolean) : []
				const nextParams = params.filter(item => item.split('=')[0].toLowerCase() !== name.toLowerCase())
				return path + (nextParams.length ? '?' + nextParams.join('&') : '') + hash
			},
			cleanReplyListUrl(url) {
				url = this.setQueryParam(url, 'id', this.info.postId)
				url = this.setQueryParam(url, 'siteid', 1000)
				url = this.setQueryParam(url, 'classid', this.cleanClassId(this.info.classId))
				;['mainuserid', 'reply', 'touserid', 'tofloor'].forEach(name => {
					url = this.removeQueryParam(url, name)
				})
				return url
			},
			cleanClassId(classId) {
				const match = String(classId || '').match(/\d+/)
				return match ? match[0] : ''
			},
			decodeHtmlText(text) {
				return String(text || '')
					.replace(/&amp;/g, '&')
					.replace(/&quot;/g, '"')
					.replace(/&#39;/g, "'")
			},
			decodeUrlText(text) {
				try {
					return decodeURIComponent(String(text || ''))
				} catch (e) {
					return String(text || '')
				}
			},
			extractClassId(html) {
				const raw = String(html || '')
				const htmlDecoded = this.decodeHtmlText(raw)
				const urlDecoded = this.decodeUrlText(htmlDecoded)
				const sources = [raw, htmlDecoded, urlDecoded]
				const patterns = [
					/name=["']classid["'][^>]*value=["']?(\d+)/i,
					/(?:[?&])classid=(\d+)/i,
					/classid=(\d+)/i,
					/classid%3d(\d+)/i
				]
				for (let i = 0; i < sources.length; i++) {
					for (let j = 0; j < patterns.length; j++) {
						const match = sources[i].match(patterns[j])
						if (match) {
							return match[1]
						}
					}
				}
				return ''
			},
			fetchDetail() {
				const requestPostId = this.info.postId
				uni.showLoading({
					title: '拼命加载中'
				})
				uni.request({
					url: `https://yaohuo.me/bbs-${this.info.postId}.html`,
					header: getAuthHeader(),
					success: (res) => {
						if (!this.detailPageAlive || requestPostId !== this.info.postId) {
							return
						}
						const html = String(res.data || '')
						let tip = html.match(/<div class=\"tip\">(.*?)<\/div>/)
						this.info.isEnd = false
						if (tip) {
							if (tip[1].indexOf('结束原因') > -1) {
								this.info.status = '已结帖'
								this.info.isEnd = true
							}
							if (tip[1].indexOf('锁定原因') > -1) {
								this.info.status = '已锁定'
							}
							if (tip[1].indexOf('审核') > -1) {
								setTimeout(() => {
									uni.navigateBack({
										delta: 1
									})
								}, 1000)
								return uni.showToast({
									title: '帖子已被删除',
									icon: 'error'
								})
							}
						}
						let replyCountMatch = html.match(/全部回帖\((.*?)\)/)
						this.info.replyCount = replyCountMatch ? replyCountMatch[1] : 0
						this.totalPage = Math.ceil(this.info.replyCount / 15)
						this.info.classId = this.cleanClassId(this.extractClassId(html) || this.info.classId)
						this.updatePostDeleteUrl(html)
						let content = html.match(/<!--listS-->([\s\S]*?)<!--listE-->/)
						this.nodes = content ? content[1].replace(
							/height=\"100%px\"/, '').replace(/width=\"100%px\"/, 'width="100%"').replace(
							/height=\"100%\"/, '').replace(/width=\"100%\"/, 'width="100%"') : ' '
						let fileList = html.match(/<div class=\"line\">([\s\S]*?)<\/div>/g)
						if (fileList) {
							fileList.forEach(r => {
								this.nodes += r.replace(/\/bbs\/download.aspx/,
									'https://yaohuo.me/bbs/download.aspx')
							})
						}
						const postAttachmentHtml = this.extractPostAttachmentHtml(html)
						this.postAttachments = this.safeExtractPostAttachments(postAttachmentHtml)
						console.log('[YAOHUO_POST_ATTACHMENT_BLOCK]', JSON.stringify({
							postId: this.info.postId,
							statusCode: res.statusCode || 0,
							hasSid: /sidyaohuo=/.test(String(getAuthHeader().Cookie || '')),
							htmlLength: html.length,
							rawHasAttachment: /class=["'][^"']*attachment/i.test(html),
							rawHasAttachmentInfo: /class=["'][^"']*attachmentinfo/i.test(html),
							rawHasDownload: /download\.aspx/i.test(html),
							length: postAttachmentHtml.length,
							hasDownload: /download\.aspx/i.test(postAttachmentHtml),
							count: this.postAttachments.length
						}))
						this.nodes = this.formatContentHtml(this.nodes)
						this.preparePostNativeImages(this.nodes, postAttachmentHtml)
						this.honorArr = []
						this.getPostInfoFromHtml(html)
						this.comments = []
						this.page = 1
						this.replyPageBaseUrl = ''
						this.replyGo = String(Date.now()).slice(-5)
						this.fetchReply()
					},
					fail: () => {
						if (!this.detailPageAlive || requestPostId !== this.info.postId) {
							return
						}
						uni.showToast({
							title: '加载失败',
							icon: 'none'
						})
					},
					complete: () => {
						if (this.detailPageAlive && requestPostId === this.info.postId) {
							uni.hideLoading()
							uni.stopPullDownRefresh()
						}
					}
				})
			},
			stripHtml(html) {
				return String(html || '')
					.replace(/<script\b[\s\S]*?<\/script>/gi, '')
					.replace(/<style\b[\s\S]*?<\/style>/gi, '')
					.replace(/<br\s*\/?>/gi, '\n')
					.replace(/<[^>]+>/g, '')
					.replace(/&nbsp;/g, ' ')
					.trim()
			},
			decodeReplyAttr(text) {
				return String(text || '')
					.replace(/&amp;/g, '&')
					.replace(/&quot;/g, '"')
					.replace(/&#39;/g, "'")
			},
			escapeHtml(text) {
				return String(text || '')
					.replace(/&/g, '&amp;')
					.replace(/</g, '&lt;')
					.replace(/>/g, '&gt;')
					.replace(/"/g, '&quot;')
					.replace(/'/g, '&#39;')
			},
			escapeHtmlAttr(text) {
				return this.escapeHtml(text)
			},
			autoLinkPlainUrls(html) {
				const parts = String(html || '').split(/(<[^>]+>)/g)
				let inAnchor = false
				let inSkipTag = false
				return parts.map(part => {
					if (!part) {
						return part
					}
					if (part.charAt(0) === '<') {
						if (/^<a\b/i.test(part)) {
							inAnchor = true
						} else if (/^<\/a\b/i.test(part)) {
							inAnchor = false
						}
						if (/^<(script|style|textarea|pre)\b/i.test(part)) {
							inSkipTag = true
						} else if (/^<\/(script|style|textarea|pre)\b/i.test(part)) {
							inSkipTag = false
						}
						return part
					}
					if (inAnchor || inSkipTag) {
						return part
					}
					return this.autoLinkText(part)
				}).join('')
			},
			formatContentHtml(html) {
				return this.autoLinkPlainUrls(this.normalizeYaohuoImageLinks(normalizeHtmlUrls(this.normalizeImageBbcode(
					html))))
			},
			normalizeImageBbcode(html) {
				return String(html || '').replace(/\[img\]([\s\S]*?)\[\/img\]/ig, (all, rawUrl) => {
					const url = this.normalizeMediaUrl(rawUrl)
					if (!url) {
						return ''
					}
					return `<img style="max-width:100%;" src="${this.escapeHtmlAttr(url)}">`
				})
			},
			normalizeMediaUrl(url) {
				url = this.decodeReplyAttr(String(url || '')).trim()
				if (!url) {
					return ''
				}
				return absoluteYaohuoUrl(url)
			},
			decodeUrlPart(text) {
				text = this.decodeReplyAttr(String(text || '').trim())
				try {
					return decodeURIComponent(text.replace(/\+/g, '%20'))
				} catch (e) {
					return text
				}
			},
			getQueryValue(url, name) {
				const reg = new RegExp(`[?&]${name}=([^&#"'<>\\s]*)`, 'i')
				const match = String(url || '').match(reg)
				return match ? this.decodeUrlPart(match[1]) : ''
			},
			getPicDiyImageUrl(url) {
				if (!/picDIY\.aspx/i.test(String(url || ''))) {
					return ''
				}
				const picPath = this.getQueryValue(url, 'path')
				return picPath ? this.normalizeMediaUrl(picPath) : ''
			},
			normalizeYaohuoImageLinks(html) {
				return String(html || '').replace(
					/<img\b[^>]*(?:src|data-src)\s*=\s*(["'])([^"']*picDIY\.aspx[^"']*)\1[^>]*>/ig,
					(all, quote, src) => {
						const imageUrl = this.getPicDiyImageUrl(src)
						const style = getAttr(all, 'style') || 'max-width:100%;'
						return imageUrl ? `<img style="${this.escapeHtmlAttr(style)}" src="${this.escapeHtmlAttr(imageUrl)}">` : all
					}).replace(
					/<a\b([^>]*\bhref\s*=\s*(["'])([^"']*picDIY\.aspx[^"']*)\2[^>]*)>([\s\S]*?)<\/a>/ig,
					(all, attrs, quote, href, body) => {
						const imageUrl = this.getPicDiyImageUrl(href)
						if (!imageUrl) {
							return all
						}
						const innerImage = String(body || '').match(/<img\b[^>]*>/i)
						if (innerImage) {
							const style = getAttr(innerImage[0], 'style') || 'max-width:100%;'
							return `<img style="${this.escapeHtmlAttr(style)}" src="${this.escapeHtmlAttr(imageUrl)}">`
						}
						return `<img style="max-width:100%;" src="${this.escapeHtmlAttr(imageUrl)}">`
					})
			},
			autoLinkText(text) {
				return String(text || '').replace(/((?:https?:\/\/|www\.)[^\s<>"']+)/ig, rawUrl => {
					let url = rawUrl
					let suffix = ''
					while (/[.,!?;:，。！？；：、)\]}>）】》]$/.test(url)) {
						suffix = url.slice(-1) + suffix
						url = url.slice(0, -1)
					}
					if (!url) {
						return rawUrl
					}
					const visibleUrl = this.decodeReplyAttr(url)
					const href = /^www\./i.test(visibleUrl) ? `https://${visibleUrl}` : visibleUrl
					const imageUrl = this.getImageUrlFromLink(href)
					if (imageUrl) {
						return `<img style="max-width:100%;" src="${this.escapeHtmlAttr(imageUrl)}">${suffix}`
					}
					return `<a href="${this.escapeHtmlAttr(href)}" style="color:#0A98D5;text-decoration:underline;">${this.escapeHtml(visibleUrl)}</a>${suffix}`
				})
			},
			getImageUrlFromLink(url) {
				url = this.normalizeMediaUrl(url)
				if (!url) {
					return ''
				}
				const picDiyUrl = this.getPicDiyImageUrl(url)
				if (picDiyUrl) {
					return picDiyUrl
				}
				if (/\.(?:png|jpe?g|gif|webp|bmp)(?:[?#].*)?$/i.test(url)) {
					return url
				}
				if (/[?&](?:wx_fmt|format|type|mime)=((?:png|jpe?g|gif|webp|bmp))/i.test(url)) {
					return url
				}
				if (/(?:\/|_)(?:mmbiz|mmbiz_png|image|img|photo|pic)(?:\/|_|-)/i.test(url)) {
					return url
				}
				return ''
			},
			isNativeImageUrl(url) {
				return /(?:^https?:\/\/yaohuo\.me)?\/bbs\/upload\//i.test(String(url || ''))
			},
			collectNativeImageUrls(html) {
				const urls = []
				const seen = {}
				const addImage = src => {
					const imageUrl = this.getImageUrlFromLink(src)
					const url = imageUrl || this.normalizeMediaUrl(src)
					if (!url || !this.isNativeImageUrl(url) || seen[url]) {
						return
					}
					seen[url] = true
					urls.push(url)
				}
				const imgReg = /<img\b[^>]*>/ig
				let imgMatch
				while ((imgMatch = imgReg.exec(String(html || '')))) {
					addImage(getAttr(imgMatch[0], 'src') || getAttr(imgMatch[0], 'data-src'))
				}
				const linkReg = /<a\b[^>]*href\s*=\s*(["'])([^"']*(?:picDIY\.aspx|\/bbs\/upload\/)[^"']*)\1[^>]*>/ig
				let linkMatch
				while ((linkMatch = linkReg.exec(String(html || '')))) {
					addImage(linkMatch[2])
				}
				const textReg = /((?:https?:\/\/yaohuo\.me)?\/bbs\/upload\/[^\s<>"']+\.(?:png|jpe?g|gif|webp|bmp)(?:[?#][^\s<>"']*)?)/ig
				let textMatch
				while ((textMatch = textReg.exec(String(html || '')))) {
					addImage(textMatch[1])
				}
				return urls
			},
			removeNativeImageHtml(html) {
				return String(html || '').replace(/(?:<br\s*\/?>\s*)?<img\b[^>]*(?:src|data-src)\s*=\s*(["'])([^"']+)\1[^>]*>/ig,
					(all, quote, src) => {
						const url = this.getImageUrlFromLink(src) || this.normalizeMediaUrl(src)
						return this.isNativeImageUrl(url) ? '' : all
					})
			},
			extractPostAttachmentHtml(html) {
				html = String(html || '')
				const directBlock = this.extractAttachmentBlocksByHtml(html) || this.extractAttachmentBlockByRegex(html)
				if (directBlock) {
					return directBlock
				}
				const listEnd = html.indexOf('<!--listE-->')
				if (listEnd < 0) {
					return ''
				}
				const start = listEnd + '<!--listE-->'.length
				const rest = html.slice(start)
				const stopMarkers = [
					'<div class="title">全部回帖',
					'<div class="line1">',
					'<div class="line"',
					'<div class="list-reply"',
					'class="list-reply"',
					'<!--reply'
				]
				let end = rest.length
				stopMarkers.forEach(marker => {
					const index = rest.indexOf(marker)
					if (index >= 0 && index < end) {
						end = index
					}
				})
				const block = rest.slice(0, end)
				return /class=["'][^"']*attachment|attachmentimage|\/bbs\/upload\//i.test(block) ? block : ''
			},
			extractAttachmentBlocksByHtml(html) {
				const blocks = this.extractClassBlocksByToken(html, 'attachment')
				if (blocks.length) {
					return blocks.join('')
				}
				return this.extractClassBlocksByToken(html, 'attachmentinfo').join('')
			},
			extractAttachmentBlocksByCheerio(html) {
				try {
					const $ = cheerio.load(String(html || ''), {
						decodeEntities: false
					})
					const blocks = []
					const seen = {}
					$('.attachment').each((index, el) => {
						const block = $.html(el)
						if (block && !seen[block]) {
							seen[block] = true
							blocks.push(block)
						}
					})
					if (!blocks.length) {
						$('.attachmentinfo').each((index, el) => {
							const block = $.html(el)
							if (block && !seen[block]) {
								seen[block] = true
								blocks.push(block)
							}
						})
					}
					return blocks.join('')
				} catch (e) {
					return ''
				}
			},
			extractAttachmentBlockByRegex(html) {
				const source = String(html || '')
				const classMatch = source.match(/<[^>]+class=["'][^"']*(?:attachment|attachmentinfo)[^"']*["'][^>]*>/i)
				if (!classMatch) {
					return ''
				}
				const start = classMatch.index
				const rest = source.slice(start)
				const stopMarkers = [
					'<div class="title">全部回帖',
					'<div class="list-reply"',
					'class="list-reply"',
					'<!--reply'
				]
				let end = rest.length
				stopMarkers.forEach(marker => {
					const index = rest.indexOf(marker)
					if (index > 0 && index < end) {
						end = index
					}
				})
				const block = rest.slice(0, end)
				return /download\.aspx|attachmentinfo|attachmentimage|\/bbs\/upload\//i.test(block) ? block : ''
			},
			findHtmlTagEnd(html, tag, fromIndex) {
				const tagReg = new RegExp('</?' + String(tag || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b[^>]*>',
					'ig')
				tagReg.lastIndex = fromIndex
				let depth = 1
				let match
				while ((match = tagReg.exec(String(html || '')))) {
					if (match[0].charAt(1) === '/') {
						depth--
						if (depth === 0) {
							return tagReg.lastIndex
						}
					} else if (!/\/\s*>$/.test(match[0])) {
						depth++
					}
				}
				return String(html || '').length
			},
			extractClassBlocksByToken(html, className) {
				const source = String(html || '')
				const target = String(className || '').toLowerCase()
				const blocks = []
				if (!target) {
					return blocks
				}
				const reg = /<([a-z0-9]+)\b[^>]*class\s*=\s*(["'])([\s\S]*?)\2[^>]*>/ig
				let match
				while ((match = reg.exec(source))) {
					const classes = this.decodeReplyAttr(match[3]).split(/\s+/).map(item => item.toLowerCase())
					if (classes.indexOf(target) < 0) {
						continue
					}
					const end = this.findHtmlTagEnd(source, match[1], reg.lastIndex)
					blocks.push(source.slice(match.index, end))
				}
				return blocks
			},
			extractClassText(html, className) {
				return this.extractClassBlocksByToken(html, className).map(block => this.stripHtml(block)).join(' ')
			},
			extractClassTextAny(html, classNames) {
				const parts = []
				;(classNames || []).forEach(className => {
					const text = this.cleanAttachmentText(this.extractClassText(html, className))
					if (text && parts.indexOf(text) < 0) {
						parts.push(text)
					}
				})
				return parts.join(' ')
			},
			extractHtmlLinks(html) {
				const links = []
				const reg = /<a\b[^>]*>[\s\S]*?<\/a>/ig
				let match
				while ((match = reg.exec(String(html || '')))) {
					const tagMatch = match[0].match(/<a\b[^>]*>/i)
					const tag = tagMatch ? tagMatch[0] : ''
					links.push({
						tag,
						href: getAttr(tag, 'href'),
						text: this.stripHtml(match[0])
					})
				}
				return links
			},
			extractHtmlImages(html) {
				const images = []
				const reg = /<img\b[^>]*>/ig
				let match
				while ((match = reg.exec(String(html || '')))) {
					const src = getAttr(match[0], 'src') || getAttr(match[0], 'data-src')
					if (src) {
						images.push(src)
					}
				}
				return images
			},
			cleanAttachmentText(text) {
				return this.decodeReplyAttr(String(text || ''))
					.replace(/&nbsp;/ig, ' ')
					.replace(/\r/g, '')
					.replace(/\s+/g, ' ')
					.replace(/^[\s(（]+|[\s)）]+$/g, '')
					.trim()
			},
			safeExtractPostAttachments(html) {
				try {
					return this.extractPostAttachments(html)
				} catch (e) {
					console.log('[YAOHUO_POST_ATTACHMENT_PARSE_FAIL]', JSON.stringify({
						postId: this.info.postId,
						errMsg: e && (e.message || e.errMsg) || ''
					}))
					return []
				}
			},
			extractPostAttachments(html) {
				html = String(html || '')
				if (!html || !/attachment|download\.aspx|\/bbs\/upload\//i.test(html)) {
					return []
				}
				const charge = this.cleanAttachmentText(this.extractClassText(html, 'attachmentCharge'))
				const result = []
				const seen = {}
				const addMeta = (parts, text) => {
					text = this.cleanAttachmentText(text)
					if (text && parts.indexOf(text) < 0) {
						parts.push(text)
					}
				}
				const addItem = item => {
					if (!item) {
						return
					}
					item.url = item.url ? this.normalizeYaohuoUrl(item.url) : ''
					item.imageUrl = item.imageUrl ? this.normalizeMediaUrl(item.imageUrl) : ''
					item.name = this.cleanAttachmentText(item.name) || (item.imageUrl ? '图片附件' : '附件')
					const key = item.url || item.imageUrl || item.name
					if (!key || seen[key]) {
						return
					}
					seen[key] = true
					item.key = key
					result.push(item)
				}
				const infoBlocks = this.extractClassBlocksByToken(html, 'attachmentinfo')
				const itemBlocks = infoBlocks.length ? infoBlocks : this.extractClassBlocksByToken(html, 'attachment')
				itemBlocks.forEach(block => {
					const downloadBlock = this.extractClassBlocksByToken(block, 'downloadurl').join('')
					const links = this.extractHtmlLinks(block)
					const downloadLinks = this.extractHtmlLinks(downloadBlock)
					const rawUrl = (downloadLinks[0] && downloadLinks[0].href) || (links[0] && links[0].href) || ''
					const url = rawUrl ? this.normalizeYaohuoUrl(rawUrl) : ''
					const imageBlock = this.extractClassBlocksByToken(block, 'attachmentimage').join('')
					const imageLinks = this.extractHtmlLinks(imageBlock)
					const imageSrc = (this.extractHtmlImages(imageBlock)[0] || this.extractHtmlImages(block)[0] ||
						(imageLinks[0] && imageLinks[0].href) || '')
					const imageUrl = this.getImageUrlFromLink(imageSrc || url)
					const name = this.cleanAttachmentText(this.extractClassText(block, 'attachmentitle')) ||
						this.cleanAttachmentText(this.extractClassText(block, 'attachmentname')) ||
						this.decodeUrlPart(this.getQueryValue(url, 'n')) ||
						this.cleanAttachmentText(links.map(link => link.text).join(' ')) ||
						(imageUrl ? '图片附件' : '附件')
					const metaParts = []
					addMeta(metaParts, charge)
					addMeta(metaParts, this.extractClassTextAny(block, ['attachmentsize', 'filesize']))
					addMeta(metaParts, this.extractClassText(block, 'downloadcount'))
					addMeta(metaParts, this.extractClassText(block, 'attachmentNote'))
					const isPaid = !!charge || /\u6263|\u5996\u6676|\u4ed8\u8d39|\u8d2d\u4e70/.test(this.stripHtml(block))
					addItem({
						name,
						url,
						imageUrl,
						isPaid,
						meta: metaParts.join(' | '),
						actionText: imageUrl ? '查看' : (isPaid ? '付费下载' : '下载')
					})
				})
				this.extractClassBlocksByToken(html, 'attachmentimage').forEach(block => {
					const links = this.extractHtmlLinks(block)
					const imageSrc = this.extractHtmlImages(block)[0] || (links[0] && links[0].href) || ''
					const imageUrl = this.getImageUrlFromLink(imageSrc)
					if (!imageUrl) {
						return
					}
					addItem({
						name: '图片附件',
						url: (links[0] && links[0].href) || imageUrl,
						imageUrl,
						isPaid: !!charge,
						meta: charge,
						actionText: '查看'
					})
				})
				if (!result.length) {
					this.extractHtmlLinks(html).forEach(link => {
						if (!/download\.aspx/i.test(link.href) && !/(^|\s)urlbtn(\s|$)/i.test(getAttr(link.tag, 'class'))) {
							return
						}
						const url = this.normalizeYaohuoUrl(link.href || '')
						if (!url) {
							return
						}
						const imageUrl = this.getImageUrlFromLink(url)
						const metaParts = []
						addMeta(metaParts, charge)
						addItem({
							name: this.decodeUrlPart(this.getQueryValue(url, 'n')) || this.cleanAttachmentText(link.text) ||
								(imageUrl ? '图片附件' : '附件'),
							url,
							imageUrl,
							isPaid: !!charge,
							meta: metaParts.join(' | '),
							actionText: imageUrl ? '查看' : (charge ? '付费下载' : '下载')
						})
					})
				}
				console.log('[YAOHUO_POST_ATTACHMENTS]', JSON.stringify({
					postId: this.info.postId,
					count: result.length,
					names: result.map(item => item.name)
				}))
				return result
			},
			preparePostNativeImages(html, attachmentHtml) {
				const urls = this.mergeImageList(this.collectNativeImageUrls(html), this.collectNativeImageUrls(
					attachmentHtml))
				this.nodes = this.removeNativeImageHtml(html)
				this.postImages = []
				if (!urls.length) {
					return
				}
				const postId = this.info.postId
				this.resolveDisplayImages(urls).then(images => {
					if (this.detailPageAlive && postId === this.info.postId) {
						this.postImages = images
					}
				})
			},
			resolveDisplayImages(urls) {
				const seen = {}
				const list = (urls || []).filter(url => {
					if (!url || seen[url]) {
						return false
					}
					seen[url] = true
					return true
				})
				return Promise.all(list.map(url => this.resolveDisplayImage(url))).then(images => {
					const imageSeen = {}
					return images.filter(img => {
						if (!img || imageSeen[img]) {
							return false
						}
						imageSeen[img] = true
						return true
					})
				})
			},
			resolveDisplayImage(url) {
				url = this.normalizeMediaUrl(url)
				if (!url || !this.isNativeImageUrl(url)) {
					return Promise.resolve(url)
				}
				if (this.imageCache[url]) {
					return Promise.resolve(this.imageCache[url])
				}
				return new Promise(resolve => {
					uni.downloadFile({
						url,
						header: getAuthHeader({
							'Referer': 'https://yaohuo.me/'
						}),
						success: res => {
							const localPath = res.statusCode === 200 && res.tempFilePath ? res.tempFilePath : url
							if (this.detailPageAlive) {
								this.imageCache[url] = localPath
							}
							console.log('[YAOHUO_UPLOAD_IMAGE_READY]', JSON.stringify({
								url,
								statusCode: res.statusCode || 0,
								local: localPath !== url
							}))
							resolve(localPath)
						},
						fail: err => {
							console.log('[YAOHUO_UPLOAD_IMAGE_FAIL]', JSON.stringify({
								url,
								errMsg: err && (err.errMsg || err.message) || ''
							}))
							resolve(url)
						}
					})
				})
			},
			mergeImageList(oldImages, newImages) {
				const seen = {}
				const result = []
				;(oldImages || []).concat(newImages || []).forEach(url => {
					if (url && !seen[url]) {
						seen[url] = true
						result.push(url)
					}
				})
				return result
			},
			extractReplyTarget(block) {
				const targetMatch = String(block || '').match(/class=["'][^"']*reother[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)
				if (!targetMatch) {
					return ''
				}
				const target = this.stripHtml(targetMatch[1])
				if (!target) {
					return ''
				}
				const colonMatch = String(block || '').match(/class=["'][^"']*recolon[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)
				const colon = colonMatch ? this.stripHtml(colonMatch[1]) : '：'
				const separator = colon || '：'
				return `<span style="color:#777;">${this.escapeHtml(target)}${this.escapeHtml(separator)}</span>`
			},
			extractReplyRewardText(block) {
				const source = this.decodeReplyAttr(String(block || ''))
				const blocks = this.extractClassBlocksByToken(source, 'remoney').concat(this.extractClassBlocksByToken(source,
					'replyother-offset'))
				for (let i = 0; i < blocks.length; i++) {
					const item = blocks[i]
					const text = this.cleanPostMetaText(this.stripHtml(item))
					if (!/(得金|礼金|获赏|赏|奖励|[+＋]\s*\d+)/.test(text)) {
						continue
					}
					const classNumber = this.extractRewardClassNumber(item, ['rewardnumber'])
					const match = text.replace(/,/g, '').match(/(?:得金|礼金|获赏|赏金|奖励|[+＋])\s*([+-]?\d+)/)
					const number = classNumber || this.normalizeRewardNumber(match && match[1] || '')
					if (!number) {
						continue
					}
					let label = '奖励'
					if (/得金/.test(text)) {
						label = '得金'
					} else if (/礼金/.test(text)) {
						label = '礼金'
					} else if (/获赏/.test(text)) {
						label = '获赏'
					} else if (/[+＋]\s*\d+/.test(text)) {
						label = ''
					}
					const displayNumber = /[+＋]\s*\d+/.test(text) && number.charAt(0) !== '-' ?
						`+${number.replace(/^\+/, '')}` : number
					return label ? `${label} ${displayNumber}` : displayNumber
				}
				return ''
			},
			extractReplyActions(block) {
				const actions = []
				const seen = {}
				const reg = /<a\b[^>]*href\s*=\s*(["'])([^"']+)\1[^>]*>([\s\S]*?)<\/a>/ig
				let match
				while ((match = reg.exec(String(block || '')))) {
					const href = this.decodeReplyAttr(match[2])
					const text = this.stripHtml(match[3])
					const isDelete = /book_re_del\.aspx/i.test(href) ||
						/(^|[-_\s])(?:del|delete)(?:[-_\s]|$)/i.test(match[0]) ||
						text === '删' || text === '删除'
					if (!isDelete || seen[href]) {
						continue
					}
					seen[href] = true
					actions.push({
						url: href,
						option: '删'
					})
				}
				return actions
			},
			extractReplyMediaHtml(block, currentText) {
				const parts = []
				const seen = {}
				const addImage = src => {
					const imageUrl = this.getImageUrlFromLink(src)
					const url = imageUrl || this.normalizeMediaUrl(src)
					if (!url || this.isNativeImageUrl(url) || seen[url] || String(currentText || '').indexOf(url) > -1) {
						return
					}
					seen[url] = true
					const isFace = /\/face\//i.test(url)
					parts.push(`<br><img style="max-width:${isFace ? '32px' : '100%'};" src="${this.escapeHtmlAttr(url)}">`)
				}
				const addLink = (href, text) => {
					const url = this.normalizeMediaUrl(href)
					if (!url || this.isNativeImageUrl(url) || seen[url] || String(currentText || '').indexOf(url) > -1) {
						return
					}
					seen[url] = true
					parts.push(`<br><a href="${this.escapeHtmlAttr(url)}">${this.escapeHtml(text || '查看附件')}</a>`)
				}
				const imgReg = /<img\b[^>]*>/ig
				let imgMatch
				while ((imgMatch = imgReg.exec(String(block || '')))) {
					addImage(getAttr(imgMatch[0], 'src') || getAttr(imgMatch[0], 'data-src'))
				}
				const linkReg = /<a\b[^>]*href\s*=\s*(["'])([^"']+)\1[^>]*>([\s\S]*?)<\/a>/ig
				let linkMatch
				while ((linkMatch = linkReg.exec(String(block || '')))) {
					const href = this.decodeReplyAttr(linkMatch[2])
					if (!/(picDIY\.aspx|download\.aspx|book_re_addfileshow)/i.test(href)) {
						continue
					}
					const text = this.stripHtml(linkMatch[3])
					const picDiyUrl = this.getPicDiyImageUrl(href)
					if (picDiyUrl) {
						addImage(picDiyUrl)
					} else if (/\.(?:png|jpe?g|gif|webp|bmp)(?:[?#].*)?$/i.test(href)) {
						addImage(href)
					} else {
						addLink(href, text)
					}
				}
				return parts.join('')
			},
			collectReplyAttachmentLinks(block) {
				const links = []
				const seen = {}
				const reg = /<a\b[^>]*href\s*=\s*(["'])([^"']+)\1[^>]*>([\s\S]*?)<\/a>/ig
				let match
				while ((match = reg.exec(String(block || '')))) {
					const href = this.decodeReplyAttr(match[2])
					if (!href || !/book_re_addfileshow/i.test(href)) {
						continue
					}
					const url = this.normalizeMediaUrl(href)
					if (url && !seen[url]) {
						seen[url] = true
						links.push(url)
					}
				}
				return links
			},
			fetchHtml(url) {
				return new Promise((resolve, reject) => {
					uni.request({
						url,
						header: getAuthHeader(),
						success: res => resolve(String(res.data || '')),
						fail: reject
					})
				})
			},
			collectAttachmentImageHtml(html, currentText) {
				const parts = []
				const seen = {}
				const addImage = src => {
					const imageUrl = this.getImageUrlFromLink(src)
					const url = imageUrl || this.normalizeMediaUrl(src)
					if (!url || this.isNativeImageUrl(url) || seen[url] || String(currentText || '').indexOf(url) > -1) {
						return
					}
					seen[url] = true
					parts.push(`<br><img style="max-width:100%;" src="${this.escapeHtmlAttr(url)}">`)
				}
				const imgReg = /<img\b[^>]*>/ig
				const imgTags = []
				let imgMatch
				while ((imgMatch = imgReg.exec(String(html || '')))) {
					imgTags.push(imgMatch[0])
				}
				const attachmentTags = imgTags.filter(tag => /(?:^|\s)repic(?:\s|$)/i.test(getAttr(tag, 'class')))
				;(attachmentTags.length ? attachmentTags : imgTags).forEach(tag => {
					addImage(getAttr(tag, 'src') || getAttr(tag, 'data-src'))
				})
				const linkReg = /<a\b[^>]*href\s*=\s*(["'])([^"']*picDIY\.aspx[^"']*)\1[^>]*>/ig
				let linkMatch
				while ((linkMatch = linkReg.exec(String(html || '')))) {
					addImage(linkMatch[2])
				}
				return parts.join('')
			},
			collectAttachmentFileHtml(html, currentText) {
				const parts = []
				const seen = {}
				const reg = /<a\b[^>]*href\s*=\s*(["'])([^"']*download\.aspx[^"']*)\1[^>]*>([\s\S]*?)<\/a>/ig
				let match
				while ((match = reg.exec(String(html || '')))) {
					const fileUrl = this.normalizeMediaUrl(match[2])
					if (!fileUrl || seen[fileUrl] || String(currentText || '').indexOf(fileUrl) > -1) {
						continue
					}
					seen[fileUrl] = true
					const text = this.stripHtml(match[3]) || '查看附件'
					parts.push(`<br><a href="${this.escapeHtmlAttr(fileUrl)}">${this.escapeHtml(text)}</a>`)
				}
				return parts.join('')
			},
			resolveReplyAttachmentLink(url, currentText) {
				return this.fetchHtml(url).then(html => ({
					html: this.collectAttachmentImageHtml(html, currentText) || this.collectAttachmentFileHtml(html,
						currentText),
					imageUrls: this.collectNativeImageUrls(html)
				})).catch(() => ({
					html: '',
					imageUrls: []
				}))
				return this.fetchHtml(url).then(html => {
					return this.collectAttachmentImageHtml(html, currentText) || this.collectAttachmentFileHtml(html,
						currentText)
					const picDiyUrl = this.getPicDiyImageUrl(html)
					if (picDiyUrl && String(currentText || '').indexOf(picDiyUrl) < 0) {
						return `<br><img style="max-width:100%;" src="${this.escapeHtmlAttr(picDiyUrl)}">`
					}
					const imgMatch = String(html || '').match(/<img\b[^>]*(?:src|data-src)\s*=\s*(["'])([^"']+)\1[^>]*>/i)
					if (imgMatch) {
						const imgUrl = this.getImageUrlFromLink(imgMatch[2]) || this.normalizeMediaUrl(imgMatch[2])
						if (imgUrl && String(currentText || '').indexOf(imgUrl) < 0) {
							return `<br><img style="max-width:100%;" src="${this.escapeHtmlAttr(imgUrl)}">`
						}
					}
					const fileMatch = String(html || '').match(/<a\b[^>]*href\s*=\s*(["'])([^"']*download\.aspx[^"']*)\1[^>]*>([\s\S]*?)<\/a>/i)
					if (fileMatch) {
						const fileUrl = this.normalizeMediaUrl(fileMatch[2])
						const text = this.stripHtml(fileMatch[3]) || '查看附件'
						if (fileUrl && String(currentText || '').indexOf(fileUrl) < 0) {
							return `<br><a href="${this.escapeHtmlAttr(fileUrl)}">${this.escapeHtml(text)}</a>`
						}
					}
					return ''
				}).catch(() => '')
			},
			hydrateReplyMedia(comments) {
				const requestPostId = this.info.postId
				;(comments || []).forEach((comment, index) => {
					const links = comment && comment._attachmentLinks ? comment._attachmentLinks : []
					const imageUrls = comment && comment._imageUrls ? comment._imageUrls : []
					if ((!links.length && !imageUrls.length) || comment._mediaHydrated) {
						return
					}
					comment._mediaHydrated = true
					Promise.all(links.map(url => this.resolveReplyAttachmentLink(url, comment.text))).then(parts => {
						const extra = parts.map(item => item && item.html || '').filter(Boolean).join('')
						const linkedImages = [].concat.apply([], parts.map(item => item && item.imageUrls || []))
						return this.resolveDisplayImages(this.mergeImageList(imageUrls, linkedImages)).then(images => ({
							extra,
							images
						}))
					}).then(result => {
						if (!this.detailPageAlive || requestPostId !== this.info.postId) {
							return
						}
						if (!this.comments[index]) {
							return
						}
						const current = this.comments[index]
						const text = result.extra && String(current.text || '').indexOf(result.extra) < 0 ?
							current.text + result.extra : current.text
						const images = this.mergeImageList(current.images, result.images)
						if (text === current.text && images.length === (current.images || []).length) {
							return
						}
						this.$set(this.comments, index, Object.assign({}, current, {
							text,
							images,
							_mediaHydrated: true
						}))
					})
				})
			},
			hydrateReplyAvatars(comments) {
				const requestPostId = this.info.postId
				const users = []
				const seen = {}
				;(comments || []).forEach((comment, index) => {
					const userId = comment && comment.userId ? String(comment.userId) : ''
					if (!userId) {
						return
					}
					const cached = this.getCachedReplyAvatar(userId)
					if (cached && !comment.avatar) {
						this.$set(this.comments, index, Object.assign({}, comment, {
							avatar: cached
						}))
						return
					}
					if (!cached && !comment.avatar && !seen[userId]) {
						seen[userId] = true
						users.push(userId)
					}
				})
				users.slice(0, 20).forEach(userId => {
					this.fetchReplyAvatar(userId).then(avatar => {
						if (!avatar || !this.detailPageAlive || requestPostId !== this.info.postId) {
							return
						}
						;(this.comments || []).forEach((comment, index) => {
							if (comment && String(comment.userId || '') === userId && !comment.avatar) {
								this.$set(this.comments, index, Object.assign({}, comment, {
									avatar
								}))
							}
						})
					})
				})
			},
			getCachedReplyAvatar(userId) {
				userId = String(userId || '')
				return userId && this.avatarCache[userId] ? this.avatarCache[userId] : ''
			},
			fetchReplyAvatar(userId) {
				userId = String(userId || '')
				if (!userId) {
					return Promise.resolve('')
				}
				if (this.avatarCache[userId]) {
					return Promise.resolve(this.avatarCache[userId])
				}
				if (this.avatarLoading[userId]) {
					return this.avatarLoading[userId]
				}
				const url = `https://yaohuo.me/bbs/userinfo.aspx?touserid=${userId}`
				this.avatarLoading[userId] = new Promise(resolve => {
					uni.request({
						url,
						header: getAuthHeader({
							'Referer': `https://yaohuo.me/bbs-${this.info.postId}.html`
						}),
						success: res => {
							const avatar = this.extractUserAvatar(res.data)
							if (avatar && this.detailPageAlive) {
								this.avatarCache[userId] = avatar
							}
							resolve(avatar)
						},
						fail: () => resolve('')
					})
				}).then(avatar => {
					delete this.avatarLoading[userId]
					return avatar
				})
				return this.avatarLoading[userId]
			},
			extractUserAvatar(html) {
				const source = this.decodeReplyAttr(String(html || ''))
				const images = []
				const reg = /<img\b[^>]*>/ig
				let match
				while ((match = reg.exec(source))) {
					const tag = match[0]
					const src = getAttr(tag, 'src') || getAttr(tag, 'data-src')
					if (!src) {
						continue
					}
					const before = source.slice(Math.max(0, match.index - 160), match.index)
					const after = source.slice(match.index, match.index + 160)
					images.push({
						src,
						tag,
						context: before + after
					})
				}
				const scoreImage = item => {
					const raw = String(item.src || '')
					const text = (item.tag + ' ' + item.context).toLowerCase()
					if (!raw || /\/face\/|favicon|logo|netcss\/img\/icon|honor|medal|level|badge|emoji|emotion|online|rongyu/i
						.test(raw + ' ' + text)) {
						return -1
					}
					let score = 0
					if (/头像|头象|头像|avatar|userface|head|portrait|photo|faceimg|tx|touxiang/i.test(item.context + ' ' +
							item.tag + ' ' + raw)) {
						score += 8
					}
					if (/userinfo|user|space|myfile/i.test(text)) {
						score += 2
					}
					if (/\/bbs\/upload\/|\/upload\/|userface|avatar|head|portrait|photo/i.test(raw)) {
						score += 3
					}
					if (/\.(?:png|jpe?g|gif|webp|bmp)(?:[?#].*)?$/i.test(raw)) {
						score += 1
					}
					return score
				}
				const best = images
					.map(item => Object.assign({}, item, {
						score: scoreImage(item)
					}))
					.filter(item => item.score >= 0)
					.sort((a, b) => b.score - a.score)[0]
				return best ? this.normalizeMediaUrl(best.src) : ''
			},
			extractReplyUser(block) {
				const html = this.decodeReplyAttr(String(block || ''))
				const userLinkReg = /<a\b[^>]*href\s*=\s*(["'])([^"']*userinfo\.aspx\?touserid=(\d+)[^"']*)\1[^>]*>([\s\S]*?)<\/a>/ig
				let linkMatch
				while ((linkMatch = userLinkReg.exec(html))) {
					const name = this.stripHtml(linkMatch[4])
					if (name && !/^\(?\d+\)?$/.test(name)) {
						return {
							id: linkMatch[3],
							name,
							display: this.formatUserName(name, linkMatch[3])
						}
					}
				}
				const classMatch = html.match(/class=["'][^"']*(?:renick|user-name)[^"']*["'][\s\S]*?<a[^>]*>([\s\S]*?)<\/a>|class=["'][^"']*(?:renick|user-name)[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/i)
				const userIdMatch = html.match(/touserid=(\d+)/i) || html.match(/mainuserid=(\d+)/i) || html.match(/class=["']renickid["'][^>]*>(\d+)<\/span>/i)
				const name = classMatch ? this.stripHtml(classMatch[1] || classMatch[2]) : ''
				const id = userIdMatch ? userIdMatch[1] : ''
				return {
					id,
					name,
					display: this.formatUserName(name, id)
				}
			},
			parseReplies(html) {
				let comments = []
				html = String(html || '')
				const blocks = this.splitReplyBlocks(html)
				blocks.forEach((block, index) => {
					const floorMatch = block.match(/data-floor=["']([^"']+)["']/i) || block.match(/class=["'][^"']*(?:floornumber|floor-number|floor-info)[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/i) || block.match(/\[(?:<[^>]+>)*([^<\]]+)(?:<[^>]+>)*楼(?:<[^>]+>)*\]/)
					const replyUser = this.extractReplyUser(block)
					const timeMatch = block.match(/class=["'][^"']*(?:retime|redate|post-date)[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/i)
					const textMatch = block.match(/class=["'][^"']*(?:retext|post-content)[^"']*["'][^>]*>([\s\S]*?)<\/(?:span|div)>/i)
					let floor = floorMatch ? this.stripHtml(floorMatch[1]).replace('楼', '') : String(index + 1)
					if (floor === '沙发') {
						floor = '1'
					} else if (floor === '椅子') {
						floor = '2'
					} else if (floor === '板凳') {
						floor = '3'
					}
					const replyTarget = this.extractReplyTarget(block)
					const replyTextHtml = textMatch ? this.formatContentHtml(textMatch[1]) : ''
					const replyText = this.removeNativeImageHtml(replyTextHtml)
					const replyMedia = this.extractReplyMediaHtml(block, replyText)
					const nativeImages = this.collectNativeImageUrls(block)
					const comment = {
						floor,
						user: replyUser.display,
						userId: replyUser.id,
						avatar: this.getCachedReplyAvatar(replyUser.id),
						time: timeMatch ? this.stripHtml(timeMatch[1]) : '',
						text: replyTarget + replyText + replyMedia,
						rewardText: this.extractReplyRewardText(block),
						images: [],
						remanage: this.extractReplyActions(block),
						_imageUrls: nativeImages,
						_attachmentLinks: this.collectReplyAttachmentLinks(block)
					}
					if (comment.text || comment.user || comment.time) {
						comments.push(comment)
					}
				})
				return comments
			},
			splitReplyBlocks(html) {
				const makeBlocks = (starts) => {
					const listEnd = html.indexOf('<!--listE-->')
					return starts.map((start, index) => {
						const next = starts[index + 1]
						const end = next || (listEnd > start ? listEnd : html.length)
						return html.slice(start, end > start ? end : html.length)
					})
				}
				const collectStarts = (reg) => {
					const starts = []
					let match
					while ((match = reg.exec(html))) {
						starts.push(match.index)
					}
					return starts
				}
				const replyStarts = collectStarts(/<[^>]+class=["'][^"']*list-reply[^"']*["'][^>]*>/ig)
				if (replyStarts.length) {
					return makeBlocks(replyStarts)
				}
				const postStarts = collectStarts(/<[^>]+class=["'][^"']*forum-post[^"']*["'][^>]*>/ig)
				if (postStarts.length > 1) {
					return makeBlocks(postStarts)
				}
				const numberStarts = collectStarts(/<[^>]+class=["'][^"']*(?:number|floor-number|floor-info)[^"']*["'][^>]*>/ig)
				if (numberStarts.length > 1) {
					return makeBlocks(numberStarts)
				}
				const lineStarts = collectStarts(/<[^>]+class=["'][^"']*reline[^"']*["'][^>]*>/ig)
				if (lineStarts.length > 1) {
					return makeBlocks(lineStarts)
				}
				const floorStarts = collectStarts(/\[(?:\d+|沙发|椅子|板凳|顶楼)楼?\]/g)
				if (floorStarts.length > 1) {
					return makeBlocks(floorStarts)
				}
				const userStarts = collectStarts(/<span[^>]+class=["']renick["'][^>]*>/ig)
				if (userStarts.length > 1) {
					return makeBlocks(userStarts)
				}
				return makeBlocks(replyStarts.length ? replyStarts : floorStarts)
			},
			commentKey(comment) {
				return [
					comment.floor || '',
					comment.userId || '',
					comment.user || '',
					comment.time || '',
					this.stripHtml(comment.text || '').slice(0, 80)
				].join('|')
			},
			mergeComments(oldComments, newComments) {
				const seen = {}
				const result = []
				;(oldComments || []).concat(newComments || []).forEach(comment => {
					const key = this.commentKey(comment)
					if (!seen[key]) {
						seen[key] = true
						result.push(comment)
					}
				})
				return result
			},
			sortComments(comments) {
				return (comments || []).slice().sort((a, b) => {
					const af = Number(a.floor)
					const bf = Number(b.floor)
					if (!isNaN(af) && !isNaN(bf)) {
						return af - bf
					}
					return 0
				})
			},
			extractPostHeaderHtml(html) {
				const source = String(html || '')
				const markers = [
					'<!--listS-->',
					'<div class="title">全部回帖',
					'<div class="recontent"',
					'<form name="f"',
					'id="replyFormContainer"'
				]
				let end = source.length
				markers.forEach(marker => {
					const index = source.indexOf(marker)
					if (index > 0 && index < end) {
						end = index
					}
				})
				return source.slice(0, end)
			},
			cleanPostMetaText(text) {
				return this.decodeReplyAttr(String(text || ''))
					.replace(/\r/g, '')
					.replace(/&nbsp;/ig, ' ')
					.replace(/\s+/g, ' ')
					.replace(/^[\s:：,，.。;；|\-—_\[\]【】()（）]+|[\s:：,，.。;；|\-—_\[\]【】()（）]+$/g, '')
					.trim()
			},
			normalizeRewardNumber(text) {
				const match = String(text || '').replace(/,/g, '').match(/[+-]?\d+/)
				if (!match) {
					return ''
				}
				return match[0].replace(/^0+(?=\d)/, '')
			},
			extractRewardClassNumber(html, classNames) {
				for (let i = 0; i < classNames.length; i++) {
					const number = this.normalizeRewardNumber(this.extractClassText(html, classNames[i]))
					if (number) {
						return number
					}
				}
				return ''
			},
			extractRewardStatusText(text) {
				const match = String(text || '').match(/(已结束|已关闭|已解决|未解决|待解决|已采纳|未采纳|悬赏中|进行中|已结帖|未结帖)/)
				if (!match) {
					return ''
				}
				if (match[1] === '已结帖') {
					return '已结束'
				}
				if (match[1] === '未结帖') {
					return '进行中'
				}
				return match[1]
			},
			getRewardStatus(type, total, used, remain, text) {
				if (type === 'gift' && remain !== '') {
					return Number(remain) <= 0 ? '已结束' : '进行中'
				}
				if (type === 'bounty' && total !== '' && used !== '') {
					return Number(used) >= Number(total) ? '已结束' : '进行中'
				}
				const textStatus = this.extractRewardStatusText(text)
				if (textStatus) {
					return textStatus
				}
				return ''
			},
			extractGiftTotalNumber(block, each, remain) {
				const direct = this.extractRewardClassNumber(block, [
					'paibishuzi',
					'paibishuliang',
					'lijinshuzi',
					'giftshuzi',
					'zongshuzi',
					'zongjine'
				])
				if (direct) {
					return direct
				}
				const numbers = this.cleanPostMetaText(this.stripHtml(block)).replace(/,/g, '').match(/[+-]?\d+/g) || []
				const skipped = {}
				if (each !== '') {
					skipped[each] = true
				}
				if (remain !== '') {
					skipped[remain] = true
				}
				for (let i = 0; i < numbers.length; i++) {
					const number = this.normalizeRewardNumber(numbers[i])
					if (number && !skipped[number]) {
						return number
					}
				}
				return ''
			},
			extractPostRewardInfo(html) {
				const source = this.decodeReplyAttr(String(html || ''))
				const header = this.extractPostHeaderHtml(source)
				const tags = []
				const seen = {}
				const addTag = (text, type) => {
					text = this.cleanPostMetaText(text)
					if (!text || text.length > 48 || seen[text]) {
						return
					}
					if (/^(首页|论坛|返回|发帖|搜索|全部回帖|楼主|标题|浏览|时间|获赏)/.test(text)) {
						return
					}
					if (/悬赏问答/.test(text) && !/(礼金|获赏|妖晶|金币|币|\d+|解决|采纳|结帖|结束|关闭|状态)/.test(text)) {
						return
					}
					seen[text] = true
					tags.push({
						text,
						type: type || (/礼金/.test(text) ? 'gift' : /获赏|赏/.test(text) ? 'bounty' : 'reward')
					})
				}
				const notificationText = this.cleanPostMetaText(this.extractClassText(header, 'notification-text'))
				let status = ''
				this.extractClassBlocksByToken(header, 'xuanshang').forEach(block => {
					const blockText = this.cleanPostMetaText(this.stripHtml(block))
					const total = this.extractRewardClassNumber(block, ['xuanshangshuzi']) ||
						this.normalizeRewardNumber((blockText.match(/悬赏\s*([+-]?\d+)/) || [])[1])
					const used = this.extractRewardClassNumber(block, ['yishangshuzi'])
					if (total) {
						addTag(`悬赏 ${total}`, 'reward')
					}
					if (used) {
						addTag(`已赏 ${used}`, 'bounty')
					}
					status = status || this.getRewardStatus('bounty', total, used, '', blockText)
				})
				this.extractClassBlocksByToken(header, 'paibi').forEach(block => {
					const blockText = this.cleanPostMetaText(this.stripHtml(block))
					const each = this.extractRewardClassNumber(block, ['meirenshuzi'])
					const remain = this.extractRewardClassNumber(block, ['yushuzi'])
					const total = this.extractGiftTotalNumber(block, each, remain)
					if (total) {
						addTag(`礼金 ${total}`, 'gift')
					}
					if (each) {
						addTag(`每人 ${each}`, 'gift')
					}
					if (remain) {
						addTag(`余 ${remain}`, 'gift')
					}
					status = status || this.getRewardStatus('gift', total, '', remain, blockText)
				})
				if (!tags.length && notificationText) {
					let match = notificationText.match(/悬赏\s*([+-]?\d+)/)
					if (match) {
						addTag(`悬赏 ${this.normalizeRewardNumber(match[1])}`, 'reward')
						status = status || this.getRewardStatus('bounty', this.normalizeRewardNumber(match[1]), '', '',
							notificationText)
					}
					match = notificationText.match(/礼金\s*([+-]?\d+)(?:\s*每人\s*([+-]?\d+))?(?:\s*[（(]?\s*余\s*([+-]?\d+)\s*[)）]?)?/)
					if (match) {
						addTag(`礼金 ${this.normalizeRewardNumber(match[1])}`, 'gift')
						if (match[2]) {
							addTag(`每人 ${this.normalizeRewardNumber(match[2])}`, 'gift')
						}
						if (match[3]) {
							addTag(`余 ${this.normalizeRewardNumber(match[3])}`, 'gift')
						}
						status = status || this.getRewardStatus('gift', this.normalizeRewardNumber(match[1]), '',
							this.normalizeRewardNumber(match[3] || ''), notificationText)
					}
				}
				if (!status && !tags.length) {
					status = this.extractRewardStatusText(notificationText)
				}
				const extra = tags.map(item => item.text).join(' | ')
				return {
					tags,
					status,
					extra
				}
			},
			logPostRewardMeta(html, rewardInfo) {
				const hasRewardWords = /(悬赏|礼金|已赏|得金|xuanshang|paibi|remoney|rewardnumber|已解决|未解决|已采纳|悬赏中)/i.test(String(html ||
					''))
				if (!hasRewardWords && String(this.info.postId || '') !== '1543161') {
					return
				}
				const headerText = this.cleanPostMetaText(this.stripHtml(this.extractPostHeaderHtml(html))).slice(0, 500)
				console.log('[YAOHUO_POST_REWARD_META]', JSON.stringify({
					postId: this.info.postId,
					tags: rewardInfo && rewardInfo.tags ? rewardInfo.tags.map(item => item.text) : [],
					status: rewardInfo && rewardInfo.status || '',
					hasRewardWords,
					headText: headerText
				}))
			},
			getPostInfoFromHtml(html) {
				const titleMatch = String(html || '').match(/<title>(.*?)<\/title>/i)
				if (!this.info.title && titleMatch) {
					this.info.title = titleMatch[1].replace(/\s*-\s*妖火网.*/, '').trim()
				}
				const authorId = this.info.authorId || this.extractPostAuthorId(html)
				const authorName = this.extractPostAuthorName(html, authorId)
				if (authorName || authorId) {
					this.info.authorId = authorId
					this.info.author = `楼主：${this.formatUserName(authorName, authorId)}`
				}
				const readMatch = String(html || '').match(/浏览(?:次数)?[^\d]*(\d+)/)
				this.info.readCount = readMatch ? readMatch[1] : this.info.readCount || ''
				const timeMatch = String(html || '').match(/(\d{4}-\d{1,2}-\d{1,2}[\s\S]{0,20})/)
				this.info.time = timeMatch ? this.stripHtml(timeMatch[1]) : this.info.time || ''
				const rewardInfo = this.extractPostRewardInfo(html)
				this.$set(this.info, 'rewardTags', rewardInfo.tags)
				this.$set(this.info, 'rewardStatus', rewardInfo.status)
				this.$set(this.info, 'extra', rewardInfo.extra)
				this.logPostRewardMeta(html, rewardInfo)
			},
			getReply(reply, comments) {
				if (!reply || reply.data == 'listE') {
					return
				}
				let replyObj = {}
				let first = reply.children[0]
				replyObj.floor = first.data.match(/\[(.*?)\]/)[1]
				if (replyObj.floor == '沙发') {
					replyObj.floor = '1'
				} else if (replyObj.floor == '椅子') {
					replyObj.floor = '2'
				} else if (replyObj.floor == '板凳') {
					replyObj.floor = '3'
				} else if (replyObj.floor == '顶楼') {
					replyObj.floor = '顶楼'
				} else {
					replyObj.floor = replyObj.floor.replace('楼', '')
				}
				replyObj.text = ''
				first = first.next
				while (first) {
					if (first.type && first.type === 'tag' && first.name === 'span') {
						if (first.attribs.class == 'renick') {
							replyObj.user = ''
							first.children[0].children.forEach(username => {
								if (username.type == 'tag' && username.name == 'font') {
									replyObj.user += username.children[0].data
								}
								if (username.type == 'text') {
									replyObj.user += username.data
								}
							})
						}
						if (first.attribs.class == 'retime') { // 时间
							replyObj.time = first.children[0].data
						}
						if (first.attribs.class == 'reother') {
							replyObj.text += `[<b>${first.children[0].data}</b>]`
						}
						if (first.attribs.class == 'remanage') {
							replyObj.remanage = [];
							first.children.forEach(remanageBox => {
								if (remanageBox.type === 'tag' && remanageBox.name === 'a') {
									replyObj.remanage.push({
										url: remanageBox.attribs.href,
										option: remanageBox.children[0].data
									})
								}
							})
						}
						if (first.attribs.class == 'retext') {
							replyObj.text += ''
							first.children.forEach(ContentBox => {
								if (ContentBox.type === 'tag') {
									if (ContentBox.name === 'video') {
										replyObj.text +=
											`<video src="${ContentBox.attribs.src}" poster="${ContentBox.attribs.poster}"></video>`
									}
									if (ContentBox.name === 'br') {
										replyObj.text += '<br>'
									}
									if (ContentBox.name === 'img') {
										if (ContentBox.attribs.src.indexOf('face/') > -1) {
											replyObj.text += `<img src="${ContentBox.attribs.src}">`
										} else {
											replyObj.text += (replyObj.text ? '<br />' : '') + `<img style="max-width:80%" src="${ContentBox.attribs.src}">`
										}
									}
									if (ContentBox.name === 'span') {
										replyObj.text += `${ContentBox.children[0].data}`
									}
									if (ContentBox.name === 'a' && ContentBox.attribs.href) {
										if (ContentBox.attribs.href.indexOf('book_re_addfileshow') > -1) {
											uni.request({
												url: `https://yaohuo.me${ContentBox.attribs.href}`,
												header: getAuthHeader(),
												success: (res) => {
													let imgUrl = res.data.match(/img src=\"(.*?)\"/)
													if (imgUrl) {
														replyObj.text += `<img style="max-width:80%" src="https://yaohuo.me${imgUrl[1]}">`
													} else {
														let fileUrl = res.data.match(
															/\"(\/bbs\/download.*?)\"/)
														if (fileUrl) {
															replyObj.text +=
																`<a href="https://yaohuo.me${fileUrl[1]}">点击复制附件链接</a>`
														}
													}
												}
											})
										}
										if (ContentBox.attribs.href.indexOf('bbs-') < 0 && ContentBox.attribs.href.indexOf('bbs/Book_re.aspx') < 0 && ContentBox.attribs.href.indexOf('bbs/Book_re_del.aspx') < 0 && ContentBox.attribs.href.indexOf('book_re_addfileshow') < 0) {
											replyObj.text += `<a href="${ContentBox.attribs.href}">${ContentBox.children[0].data}</a>`
										}
										if (ContentBox.attribs.href.indexOf('bbs-') > -1) {
											let url = ContentBox.attribs.href
											replyObj.text += `<a href="${url}">${ContentBox.children[0].data}</a>`
										}
									}
								}
								if (ContentBox.type === 'text') {
									replyObj.text += ContentBox.data
								}
							})
						}
					}
					first = first.next
				}
				replyObj.text = replyObj.text.replace('{}', '').replace('[]', '')
				comments.push(replyObj)
				reply = reply.next
				this.getReply(reply, comments)
				return comments
			},
			getPostInfo($) {
				// this.info.postId = this.url.split('-')[1].split('.')[0]
				let data = $('.content')[0]
				let children = data.children
				if (children[0].data.indexOf('标题') > -1) {
					this.info.title = children[0].data.match(/](.*?)\(阅/)[1].trim()
					this.info.readCount = children[0].data.match(/\(阅(.*?)\)/)[1].trim()
					this.info.time = children[2].data.match(/\](.*)/)[1].trim()
				} else if (children[0].data.indexOf('悬赏') > -1) {
					this.info.title = children[2].data.match(/](.*?)\(阅/)[1].trim()
					this.info.readCount = children[2].data.match(/\(阅(.*?)\)/)[1].trim()
					this.info.time = children[4].data.match(/\](.*)/)[1].trim()
					this.info.extra = children[0].data
				} else if (children[0].data.indexOf('礼金') > -1) {
					this.info.title = children[4].data.match(/](.*?)\(阅/)[1].trim()
					this.info.readCount = children[4].data.match(/\(阅(.*?)\)/)[1].trim()
					this.info.time = children[6].data.match(/\](.*)/)[1].trim()
					this.info.extra = children[0].data
				}
				let authorData = $('.subtitle')[0]
				let authorChildren = authorData.children[1].children
				if (authorChildren.length === 1) {
					this.info.author = authorChildren[0].data
				} else {
					let first = authorChildren[0]
					this.info.author = ''
					while (first) {
						if (first.type === 'text' && first.data !== ' ') {
							this.info.author += first.data
						}
						if (first.type === 'tag' && first.name === 'font') {
							this.info.author += first.children[0].data
						}
						first = first.next
					}
				}
			}
		}
	}
</script>
<style>
	page {
		background: #fff;
	}
</style>
<style scoped>
	.content {
		padding: 20rpx 20rpx 0;
	}

	.title {
		color: 999;
	}

	.info {
		color: rgba(0, 0, 0, .3);
	}

	.post-reward-row {
		margin-top: 16rpx;
		display: flex;
		flex-wrap: wrap;
		gap: 10rpx;
	}

	.post-reward-chip {
		display: inline-flex;
		align-items: center;
		height: 44rpx;
		line-height: 44rpx;
		padding: 0 16rpx;
		border-radius: 6rpx;
		background: #fff7e6;
		border: 1px solid #ffd591;
		color: #ad6800;
		font-size: 12px;
		box-sizing: border-box;
	}

	.post-reward-chip-gift {
		background: #fff1f0;
		border-color: #ffa39e;
		color: #cf1322;
	}

	.post-reward-chip-bounty {
		background: #f6ffed;
		border-color: #b7eb8f;
		color: #389e0d;
	}

	.post-reward-chip-status {
		background: #e6f7ff;
		border-color: #91d5ff;
		color: #096dd9;
	}

	.post-image-list {
		margin-top: 16rpx;
	}

	.post-native-image {
		width: 100%;
		display: block;
		margin-top: 12rpx;
		border-radius: 4px;
		background: #f6f6f6;
	}

	.post-attachment-list {
		margin-top: 18rpx;
		border-top: 1px solid #eeeeee;
		border-bottom: 1px solid #eeeeee;
	}

	.post-attachment-title {
		padding-top: 14rpx;
		font-size: 14px;
		line-height: 1.4;
		color: #666666;
	}

	.post-attachment-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 16rpx 0;
		border-top: 1px solid #f3f3f3;
	}

	.post-attachment-info {
		min-width: 0;
		flex: 1;
		display: flex;
		flex-direction: column;
	}

	.post-attachment-name {
		font-size: 15px;
		line-height: 1.45;
		color: #222222;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.post-attachment-meta {
		margin-top: 5rpx;
		font-size: 12px;
		line-height: 1.35;
		color: #888888;
	}

	.post-attachment-action {
		flex: 0 0 auto;
		margin-left: 20rpx;
		font-size: 13px;
		line-height: 1.4;
		color: #0A98D5;
	}

	.tip {
		text-align: center;
	}

	.tip-text {
		background: rgba(247, 247, 247);
		font-size: 14px;
		line-height: 28upx;
		padding: 0 30upx;
		border-radius: 30upx;
		color: #333 !important;
		display: inline-block;
	}

	.post-action-row {
		margin-top: 18rpx;
		display: flex;
		justify-content: flex-end;
	}

	.post-delete-btn {
		margin: 0;
		height: 58rpx;
		line-height: 58rpx;
		padding: 0 24rpx;
		background: #dd524d;
		color: #fff;
		font-size: 13px;
	}

	.delete-mask {
		position: fixed;
		left: 0;
		right: 0;
		top: 0;
		bottom: 0;
		z-index: 99;
		background: rgba(0, 0, 0, .42);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 40rpx;
		box-sizing: border-box;
	}

	.delete-dialog {
		width: 100%;
		max-width: 620rpx;
		background: #fff;
		border-radius: 8px;
		padding: 34rpx 30rpx 26rpx;
		box-sizing: border-box;
	}

	.delete-title {
		font-size: 17px;
		color: #222;
		font-weight: 600;
		text-align: center;
	}

	.delete-desc {
		margin-top: 16rpx;
		font-size: 13px;
		color: #777;
		text-align: center;
	}

	.delete-input {
		margin-top: 28rpx;
		height: 78rpx;
		line-height: 78rpx;
		padding: 0 20rpx;
		border: 1px solid #e5e5e5;
		border-radius: 8rpx;
		font-size: 15px;
		box-sizing: border-box;
	}

	.delete-actions {
		margin-top: 28rpx;
		display: flex;
		gap: 20rpx;
	}

	.delete-cancel,
	.delete-confirm {
		flex: 1;
		margin: 0;
		height: 70rpx;
		line-height: 70rpx;
		font-size: 14px;
	}

	.delete-confirm {
		background: #dd524d;
		color: #fff;
	}
</style>
