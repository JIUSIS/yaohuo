<template>
	<view class="page">
		<view class="hero">
			<view>
				<text class="eyebrow">Yaohuo Game</text>
				<text class="hero-title">疯狂吹牛</text>
			</view>
			<button class="hero-btn" size="mini" @click="openGameUrl('/games/chuiniu/add.aspx')">发起挑战</button>
		</view>

		<view class="segmented">
			<view class="segment" :class="{active: mode === 'home'}" @click="switchMode('home')">首页</view>
			<view class="segment" :class="{active: mode === 'records0'}" @click="switchMode('records0')">我的大话</view>
			<view class="segment" :class="{active: mode === 'records1'}" @click="switchMode('records1')">我的抢话</view>
			<view class="segment" :class="{active: mode === 'rank'}" @click="switchMode('rank')">月榜</view>
		</view>

		<view v-if="mode === 'home'">
			<view class="stat-grid">
				<view v-for="item in home.stats" :key="item.label" class="stat-card">
					<text class="stat-value">{{item.value || '--'}}</text>
					<text class="stat-label">{{item.label}}</text>
				</view>
			</view>

			<view class="card">
				<view class="section-title">最新吹牛</view>
				<view v-if="home.challenges.length">
					<view v-for="(item,index) in home.challenges" :key="item.url || index" class="challenge-row"
						@click="openGameUrl(item.url)">
						<text class="challenge-index">{{index + 1}}</text>
						<view class="challenge-body">
							<text class="challenge-title">{{item.title}}</text>
							<text v-if="item.amount" class="challenge-amount">{{item.amount}}</text>
						</view>
						<uni-icons type="arrowright" size="17" color="#bbb"></uni-icons>
					</view>
				</view>
				<view v-else class="empty-line">暂无挑战</view>
			</view>

			<view class="card">
				<view class="section-title">聊天交流</view>
				<view class="chat-compose">
					<textarea v-model="chatDraft" class="chat-input" maxlength="200" auto-height placeholder="随便聊聊..."></textarea>
					<button class="chat-send" size="mini" :loading="chat.sending" :disabled="chat.sending" @click="submitChat">发言</button>
				</view>
				<view v-if="chatItems.length">
					<view v-for="(item,index) in chatItems" :key="item.id || index" class="chat-row">
						<text class="chat-user" @click.stop="openGameUrl(item.userUrl)">{{item.user}}</text>
						<text class="chat-text">{{item.text}}</text>
						<text class="chat-time">{{item.time}}</text>
					</view>
				</view>
				<view v-else class="empty-line">暂无聊天</view>
				<view v-if="chat.loading" class="card-action">加载中...</view>
				<view v-else-if="chatCanLoadMore" class="card-action" @click="loadMoreChat">{{chat.expanded ? '加载更多' : '查看更多'}}</view>
				<view v-else-if="chat.expanded" class="card-action muted">没有更多了</view>
			</view>
		</view>

		<view v-else-if="mode === 'records0' || mode === 'records1'">
			<view class="summary-card">
				<view class="summary-item">
					<text class="summary-value">{{records.summary.winRate || '--'}}</text>
					<text class="summary-label">胜率</text>
				</view>
				<view class="summary-item">
					<text class="summary-value">{{records.summary.win || '0'}}/{{records.summary.lose || '0'}}</text>
					<text class="summary-label">胜/负</text>
				</view>
				<view class="summary-item">
					<text class="summary-value profit">{{records.summary.profit || '--'}}</text>
					<text class="summary-label">净收益</text>
				</view>
			</view>
			<view class="card">
				<view v-if="records.records.length">
					<view v-for="item in records.records" :key="item.id" class="record-row" @click="openGameUrl(item.url)">
						<text class="record-id">#{{item.id}}</text>
						<view class="record-body">
							<text class="record-status">{{item.status}}</text>
							<text :class="['record-result', item.isWin ? 'win' : 'lose']">{{item.isWin ? '赢' : '输'}}</text>
						</view>
					</view>
				</view>
				<view v-else class="empty-line">暂无吹牛记录</view>
			</view>
		</view>

		<view v-else>
			<view v-for="group in ranks" :key="group.title" class="card">
				<view class="section-title">{{group.title}}</view>
				<view v-for="item in group.items" :key="group.title + item.rank" class="rank-row" @click="openGameUrl(item.url)">
					<text class="rank">{{item.rank}}</text>
					<text class="rank-name">{{item.name}}</text>
					<uni-icons type="arrowright" size="16" color="#bbb"></uni-icons>
				</view>
			</view>
		</view>

		<uni-load-more v-if="loading" status="loading"></uni-load-more>
	</view>
</template>

<script>
	import {
		clearAuthCookie,
		getAuthHeader,
		isLoginRequiredHtml
	} from '@/utils/auth.js'
	import {
		absoluteYaohuoUrl
	} from '@/utils/html.js'
	import {
		openInBrowser
	} from '@/utils/browser.js'
	import {
		navigateToNativeRoute
	} from '@/utils/route.js'
	import {
		buildPageUrl,
		extractFormFields,
		extractFormAction,
		parseGameHome,
		parseGameChat,
		parseGameMonthly,
		parseGameRecords
	} from '@/utils/list-pages.js'

	export default {
		data() {
			return {
				mode: 'home',
				openChatOnLoad: false,
				loading: false,
				home: {
					stats: [],
					challenges: [],
					chats: []
				},
				chat: {
					expanded: false,
					chats: [],
					page: 1,
					totalPage: 1,
					nextPageUrl: '',
					loading: false,
					sending: false,
					formAction: 'https://yaohuo.me/games/chat/book_re.aspx',
					formFields: {}
				},
				chatDraft: '',
				records: {
					summary: {},
					records: []
				},
				ranks: [],
				cache: {}
			}
		},
		computed: {
			chatItems() {
				return this.chat.expanded ? this.chat.chats : this.home.chats
			},
			chatCanLoadMore() {
				if (!this.chat.expanded) {
					return true
				}
				return this.chat.page < this.chat.totalPage || !!this.chat.nextPageUrl
			}
		},
		onLoad(option) {
			option = option || {}
			this.mode = option.mode || 'home'
			this.openChatOnLoad = option.chat === '1'
			this.didShowOnce = false
			console.log('[YAOHUO_GAME_PAGE_LOAD]', {
				mode: this.mode,
				chat: option.chat || ''
			})
			uni.setNavigationBarTitle({
				title: '疯狂吹牛'
			})
			this.fetchData()
		},
		onShow() {
			if (!this.didShowOnce) {
				this.didShowOnce = true
				return
			}
			if (uni.getStorageSync('yaohuoGameNeedsRefresh')) {
				uni.removeStorageSync('yaohuoGameNeedsRefresh')
				this.refreshCurrentMode()
			}
		},
		onPullDownRefresh() {
			this.refreshCurrentMode()
		},
		methods: {
			refreshCurrentMode() {
				delete this.cache[this.mode]
				if (this.mode === 'home') {
					this.chat.expanded = false
					this.chat.chats = []
					this.chat.page = 1
					this.chat.totalPage = 1
					this.chat.nextPageUrl = ''
				}
				this.fetchData()
			},
			getUserId() {
				return uni.getStorageSync('yaohuoUserId') || ''
			},
			getModeUrl(mode) {
				const userId = this.getUserId()
				if (mode === 'records0') {
					return `https://yaohuo.me/games/chuiniu/book_list.aspx?type=0&touserid=${encodeURIComponent(userId)}`
				}
				if (mode === 'records1') {
					return `https://yaohuo.me/games/chuiniu/book_list.aspx?type=1&touserid=${encodeURIComponent(userId)}`
				}
				if (mode === 'rank') {
					return 'https://yaohuo.me/games/chuiniu/monthly.aspx'
				}
				return 'https://yaohuo.me/games/chuiniu/'
			},
			switchMode(mode) {
				if (mode === this.mode) {
					return
				}
				this.mode = mode
				this.fetchData()
			},
			fetchData() {
				if (this.loading) {
					return
				}
				const mode = this.mode
				if (this.cache[mode]) {
					this.applyData(mode, this.cache[mode])
					return
				}
				this.loading = true
				uni.showLoading({
					title: '加载中'
				})
				uni.request({
					url: this.getModeUrl(mode),
					header: getAuthHeader(),
					success: res => {
						const html = String(res.data || '')
						if (isLoginRequiredHtml(html)) {
							return this.goLogin()
						}
						this.cache[mode] = html
						this.applyData(mode, html)
					},
					fail: () => {
						uni.showToast({
							title: '加载失败',
							icon: 'none'
						})
					},
					complete: () => {
						this.loading = false
						uni.hideLoading()
						uni.stopPullDownRefresh()
					}
				})
			},
			applyData(mode, html) {
				if (mode === 'rank') {
					this.ranks = parseGameMonthly(html)
					return
				}
				if (mode === 'records0' || mode === 'records1') {
					this.records = parseGameRecords(html)
					return
				}
				this.home = parseGameHome(html)
				this.syncChatForm(html)
				if (this.openChatOnLoad) {
					this.openChatOnLoad = false
					this.loadMoreChat()
				}
			},
			syncChatForm(html) {
				const form = (String(html || '').match(/<form\b[\s\S]*?<\/form>/ig) || []).find(item => /games\/chat\/book_re\.aspx|id=["']chat-form["']/i
					.test(item))
				if (!form) {
					return
				}
				this.chat.formAction = extractFormAction(form, 'https://yaohuo.me/games/chuiniu/') ||
					'https://yaohuo.me/games/chat/book_re.aspx'
				this.chat.formFields = extractFormFields(form)
			},
			getChatBaseUrl() {
				return 'https://yaohuo.me/games/chat/book_re.aspx?action=class&siteid=1000&classid=0&nid=chuiniu&lpage='
			},
			getChatRequestUrl() {
				if (this.chat.page > 1 && this.chat.nextPageUrl) {
					return this.chat.nextPageUrl
				}
				return buildPageUrl(this.getChatBaseUrl(), this.chat.page)
			},
			loadMoreChat() {
				if (this.chat.loading || (this.chat.expanded && !this.chatCanLoadMore)) {
					return
				}
				if (!this.chat.expanded) {
					this.chat.expanded = true
					this.chat.page = 1
					this.chat.totalPage = 1
					this.chat.nextPageUrl = ''
					this.chat.chats = []
				} else {
					this.chat.page++
				}
				this.fetchChatPage()
			},
			refreshChat() {
				this.chat.expanded = true
				this.chat.page = 1
				this.chat.totalPage = 1
				this.chat.nextPageUrl = ''
				this.chat.chats = []
				this.fetchChatPage()
			},
			fetchChatPage() {
				if (this.chat.loading) {
					return
				}
				const requestUrl = this.getChatRequestUrl()
				const requestedPage = this.chat.page
				this.chat.loading = true
				uni.request({
					url: requestUrl,
					header: getAuthHeader(),
					success: res => {
						const html = String(res.data || '')
						if (isLoginRequiredHtml(html)) {
							return this.goLogin()
						}
						this.applyChatPage(html, requestUrl, requestedPage)
						console.log('[YAOHUO_GAME_CHAT_PAGE]', {
							page: this.chat.page,
							totalPage: this.chat.totalPage,
							count: this.chat.chats.length,
							nextPageUrl: this.chat.nextPageUrl
						})
					},
					fail: () => {
						if (requestedPage > 1) {
							this.chat.page = requestedPage - 1
						}
						uni.showToast({
							title: '聊天加载失败',
							icon: 'none'
						})
					},
					complete: () => {
						this.chat.loading = false
					}
				})
			},
			applyChatPage(html, requestUrl, page) {
				const data = parseGameChat(html, requestUrl, page)
				if (page === 1) {
					this.chat.chats = data.chats
				} else {
					const seen = {}
					this.chat.chats.forEach(item => {
						seen[item.id || `${item.userId}|${item.time}|${item.text}`] = true
					})
					this.chat.chats = this.chat.chats.concat(data.chats.filter(item => {
						const key = item.id || `${item.userId}|${item.time}|${item.text}`
						if (seen[key]) {
							return false
						}
						seen[key] = true
						return true
					}))
				}
				this.chat.page = data.page || page
				this.chat.totalPage = data.totalPage || (data.nextPageUrl ? this.chat.page + 1 : this.chat.page)
				this.chat.nextPageUrl = data.nextPageUrl || ''
			},
			submitChat() {
				const content = String(this.chatDraft || '').trim()
				if (!content) {
					return uni.showToast({
						title: '先写点内容',
						icon: 'none'
					})
				}
				if (this.chat.sending) {
					return
				}
				const payload = Object.assign({}, this.chat.formFields || {}, {
					content: content.replace(/\n/g, '\r\n'),
					action: 'add',
					classid: '0',
					siteid: '1000',
					nid: 'chuiniu'
				})
				delete payload.g
				delete payload.go
				this.chat.sending = true
				console.log('[YAOHUO_GAME_CHAT_SEND]', {
					contentLength: content.length
				})
				uni.request({
					url: this.chat.formAction || 'https://yaohuo.me/games/chat/book_re.aspx',
					method: 'POST',
					header: getAuthHeader({
						'Content-Type': 'application/x-www-form-urlencoded',
						'Referer': 'https://yaohuo.me/games/chuiniu/'
					}),
					data: this.formEncode(payload),
					success: res => {
						const html = String(res.data || '')
						if (isLoginRequiredHtml(html)) {
							return this.goLogin()
						}
						const data = parseGameChat(html, this.chat.formAction, 1)
						console.log('[YAOHUO_GAME_CHAT_SEND_RESPONSE]', {
							statusCode: res.statusCode,
							tip: data.tip,
							count: data.chats.length
						})
						if (Number(res.statusCode || 0) >= 400 || /失败|错误|登录|为空|限制|不能|请先/.test(data.tip || '')) {
							return uni.showModal({
								title: '发言失败',
								content: data.tip || '服务器返回失败',
								showCancel: false
							})
						}
						if (!/发表成功|成功/.test(data.tip || '') && !data.chats.length) {
							return uni.showModal({
								title: '发言未确认',
								content: data.tip || '服务器没有返回发言结果',
								showCancel: false
							})
						}
						this.chatDraft = ''
						this.chat.expanded = true
						this.applyChatPage(html, this.chat.formAction, 1)
						uni.showToast({
							title: data.tip || '发表成功',
							icon: 'success'
						})
					},
					fail: () => {
						uni.showToast({
							title: '发言失败',
							icon: 'none'
						})
					},
					complete: () => {
						this.chat.sending = false
					}
				})
			},
			formEncode(data) {
				return Object.keys(data || {}).map(key => {
					const value = data[key] === undefined || data[key] === null ? '' : data[key]
					return encodeURIComponent(key) + '=' + encodeURIComponent(value)
				}).join('&')
			},
			openWeb(url) {
				if (!url) {
					return
				}
				openInBrowser(absoluteYaohuoUrl(url))
			},
			openGameUrl(url) {
				if (!url) {
					return
				}
				const targetUrl = absoluteYaohuoUrl(url)
				if (navigateToNativeRoute(targetUrl)) {
					return
				}
				openInBrowser(targetUrl)
			},
			goLogin() {
				clearAuthCookie()
				uni.redirectTo({
					url: '/pages/login/login?clear=1'
				})
			}
		}
	}
</script>

<style scoped>
	page {
		background: #f3f3f3;
	}

	.page {
		padding: 20rpx;
		box-sizing: border-box;
	}

	.hero {
		height: 150rpx;
		padding: 24rpx;
		border-radius: 8px;
		background: #fff;
		display: flex;
		align-items: center;
		justify-content: space-between;
		box-sizing: border-box;
	}

	.eyebrow {
		display: block;
		color: #07a85a;
		font-size: 12px;
		font-weight: 700;
	}

	.hero-title {
		display: block;
		margin-top: 8rpx;
		color: #222;
		font-size: 23px;
		font-weight: 800;
	}

	.hero-btn {
		margin: 0;
		border-radius: 999rpx;
		background: #07c160;
		color: #fff;
	}

	.segmented {
		margin: 18rpx 0;
		height: 74rpx;
		padding: 6rpx;
		background: #fff;
		border-radius: 8px;
		display: flex;
		box-sizing: border-box;
	}

	.segment {
		flex: 1;
		border-radius: 7px;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #666;
		font-size: 13px;
	}

	.segment.active {
		background: #e9faf2;
		color: #07a85a;
		font-weight: 700;
	}

	.stat-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 14rpx;
		margin-bottom: 18rpx;
	}

	.stat-card,
	.summary-card,
	.card {
		background: #fff;
		border-radius: 8px;
		box-sizing: border-box;
	}

	.stat-card {
		min-height: 112rpx;
		padding: 18rpx 10rpx;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
	}

	.stat-value {
		color: #222;
		font-size: 18px;
		font-weight: 800;
		line-height: 1.2;
	}

	.stat-label {
		margin-top: 8rpx;
		color: #777;
		font-size: 12px;
		text-align: center;
	}

	.card {
		margin-bottom: 18rpx;
		padding: 0 20rpx;
	}

	.section-title {
		height: 78rpx;
		display: flex;
		align-items: center;
		color: #07a85a;
		font-size: 16px;
		font-weight: 700;
		border-bottom: 1px solid #eee;
	}

	.challenge-row,
	.rank-row,
	.record-row {
		min-height: 92rpx;
		display: flex;
		align-items: center;
		border-bottom: 1px dashed #eee;
	}

	.challenge-row:last-child,
	.rank-row:last-child,
	.record-row:last-child {
		border-bottom: 0;
	}

	.challenge-index,
	.rank {
		width: 44rpx;
		height: 44rpx;
		border-radius: 50%;
		background: #e9faf2;
		color: #07a85a;
		font-weight: 700;
		font-size: 13px;
		display: flex;
		align-items: center;
		justify-content: center;
		flex: 0 0 44rpx;
	}

	.challenge-body,
	.record-body {
		margin-left: 16rpx;
		min-width: 0;
		flex: 1;
	}

	.challenge-title,
	.record-status,
	.rank-name {
		color: #222;
		font-size: 15px;
		line-height: 1.4;
	}

	.challenge-title,
	.rank-name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.challenge-amount {
		display: block;
		margin-top: 4rpx;
		color: #ad6800;
		font-size: 12px;
	}

	.chat-compose {
		padding: 18rpx 0;
		display: flex;
		align-items: flex-end;
		gap: 14rpx;
		border-bottom: 1px dashed #eee;
	}

	.chat-input {
		min-height: 74rpx;
		max-height: 180rpx;
		padding: 16rpx 18rpx;
		border-radius: 8px;
		background: #f7f7f7;
		color: #222;
		font-size: 14px;
		line-height: 1.45;
		box-sizing: border-box;
		flex: 1;
	}

	.chat-send {
		margin: 0;
		border-radius: 999rpx;
		background: #07c160;
		color: #fff;
		flex: 0 0 128rpx;
	}

	.chat-row {
		padding: 18rpx 0;
		border-bottom: 1px dashed #eee;
	}

	.chat-user {
		color: #07a85a;
		font-weight: 700;
		font-size: 14px;
	}

	.chat-text {
		display: block;
		margin-top: 6rpx;
		color: #333;
		font-size: 14px;
		line-height: 1.45;
	}

	.chat-time {
		display: block;
		margin-top: 6rpx;
		color: #aaa;
		font-size: 12px;
	}

	.card-action {
		height: 72rpx;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #07a85a;
		font-size: 14px;
		font-weight: 700;
	}

	.card-action.muted {
		color: #999;
		font-weight: 400;
	}

	.summary-card {
		margin-bottom: 18rpx;
		padding: 18rpx 0;
		display: grid;
		grid-template-columns: repeat(3, 1fr);
	}

	.summary-item {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
	}

	.summary-value {
		color: #222;
		font-size: 17px;
		font-weight: 800;
	}

	.summary-value.profit {
		color: #07a85a;
	}

	.summary-label {
		margin-top: 8rpx;
		color: #777;
		font-size: 12px;
	}

	.record-id {
		width: 110rpx;
		color: #999;
		font-size: 13px;
		flex: 0 0 110rpx;
	}

	.record-result {
		margin-top: 4rpx;
		font-size: 12px;
		font-weight: 700;
	}

	.record-result.win {
		color: #07a85a;
	}

	.record-result.lose {
		color: #f5222d;
	}

	.empty-line {
		height: 98rpx;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #999;
		font-size: 14px;
	}
</style>
