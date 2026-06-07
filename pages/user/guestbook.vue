<template>
	<view class="page">
		<view v-if="tip" class="tip">{{tip}}</view>
		<view class="tabs">
			<view class="tab" :class="{active: sort === '0'}" @click="switchSort('0')">最新留言</view>
			<view class="tab" :class="{active: sort === '1'}" @click="switchSort('1')">最早留言</view>
		</view>
		<view v-if="items.length">
			<view v-for="item in items" :key="item.floor + item.name" class="card" @click="openUser(item)">
				<view class="top">
					<text class="floor">#{{item.floor}}</text>
					<text class="name">{{item.name}}</text>
					<text class="time">{{item.time}}</text>
				</view>
				<mp-html class="content" :content="item.contentHtml || item.content" selectable lazy-load
					domain="https://yaohuo.me" containerStyle="line-height:20px;word-break:break-all;font-size:14px"
					:copyLink="false" @tap.stop @click.stop @linktap="linkTap"></mp-html>
			</view>
		</view>
		<view v-else-if="!loading" class="empty">暂无留言</view>
		<view v-if="items.length && status === 'more' && !loading" class="load-more-btn" @click="loadMore">
			<text>加载更多留言</text>
		</view>
		<uni-load-more v-else-if="page !== 1 || status === 'loading'" :status="status"></uni-load-more>
	</view>
</template>

<script>
	import {
		clearAuthCookie,
		getAuthHeader,
		isLoginRequiredHtml
	} from '@/utils/auth.js'
	import {
		buildPageUrl,
		parseGuestbookPage
	} from '@/utils/list-pages.js'
	import {
		absoluteYaohuoUrl
	} from '@/utils/html.js'
	import {
		navigateToNativePost,
		navigateToNativeRoute
	} from '@/utils/route.js'

	export default {
		data() {
			return {
				userId: '',
				baseUrl: '',
				nextPageUrl: '',
				currentUrl: '',
				sortUrls: {
					'0': '',
					'1': ''
				},
				items: [],
				tip: '',
				sort: '0',
				page: 1,
				totalPage: 1,
				status: 'more',
				loading: false,
				pendingRefresh: false,
				entryFetched: false,
				keepItemsOnEmptyOnce: false
			}
		},
		onLoad(option) {
			option = option || {}
			this.userId = String(option.id || option.touserid || '').replace(/[^\d]/g, '')
			this.baseUrl = option.url ? decodeURIComponent(option.url) :
				`https://yaohuo.me/bbs/userguessbook.aspx?touserid=${this.userId}`
			this.sort = option.ot === '1' || /[?&]ot=1(?:&|$)/i.test(this.baseUrl) ? '1' : '0'
			this.fetchData()
		},
		onReachBottom() {
			this.loadMore()
		},
		onPullDownRefresh() {
			this.refreshData()
		},
		methods: {
			getEntryUrl() {
				let url = absoluteYaohuoUrl(this.baseUrl || '')
				if (!/\/bbs\/userguessbook\.aspx/i.test(url)) {
					url = `https://yaohuo.me/bbs/userguessbook.aspx?touserid=${this.userId}`
				}
				const targetId = this.userId || this.getQueryParam(url, 'touserid')
				if (targetId && !this.getQueryParam(url, 'touserid')) {
					url = this.setQueryParam(url, 'touserid', targetId)
				}
				return url
			},
			getSortedUrl() {
				if (this.sortUrls && this.sortUrls[this.sort]) {
					return buildPageUrl(this.sortUrls[this.sort], 1)
				}
				if (this.sort === '0') {
					return this.getEntryUrl()
				}
				return this.buildOfficialSortUrl(this.sort)
			},
			buildOfficialSortUrl(sort) {
				const targetId = this.userId || this.getQueryParam(this.getEntryUrl(), 'touserid')
				const go = String(Math.floor(Math.random() * 90000) + 10000)
				return `https://yaohuo.me/bbs/userguessbook.aspx?action=class&siteid=1000&classid=0&page=1&touserid=${targetId}&ot=${sort}&go=${go}`
			},
			getProfileRefererUrl() {
				return `https://yaohuo.me/bbs/userinfo.aspx?siteid=1000&classid=0&touserid=${this.userId}`
			},
			getRefererUrl(url) {
				if (this.isEntryRequestUrl(url)) {
					return this.getProfileRefererUrl()
				}
				return this.currentUrl || `https://yaohuo.me/bbs/userinfo.aspx?siteid=1000&classid=0&touserid=${this.userId}`
			},
			isEntryRequestUrl(url) {
				url = String(url || '')
				return /\/bbs\/userguessbook\.aspx/i.test(url) && !/[?&]action=/i.test(url) && !/[?&]ot=/i.test(url)
			},
			decodeResponseHtml(data) {
				let html = String(data || '')
				if (!/<(?:!doctype|html|head|body|div|title)\b/i.test(html) && /^[A-Za-z0-9+/=\r\n]+$/.test(html) && html.length > 200) {
					try {
						const buffer = uni.base64ToArrayBuffer(html)
						html = decodeURIComponent(Array.prototype.map.call(new Uint8Array(buffer), item => {
							return '%' + ('00' + item.toString(16)).slice(-2)
						}).join(''))
					} catch (e) {}
				}
				return html
			},
			logResponse(url, res, html, data, requestSort, requestPage) {
				console.log('[YAOHUO_GUESTBOOK_PAGE]', JSON.stringify({
					url,
					requestPage,
					currentPage: this.page,
					requestSort,
					currentSort: this.sort,
					statusCode: res && res.statusCode,
					htmlLength: html.length,
					title: data.title,
					count: data.items.length,
					totalPage: data.totalPage,
					nextPageUrl: data.nextPageUrl,
					sortUrls: data.sortUrls || {},
					hasLine: /class=["'][^"']*line[12]/i.test(html),
					hasLogin: isLoginRequiredHtml(html)
				}))
			},
			mergeSortUrls(sortUrls) {
				sortUrls = sortUrls || {}
				this.sortUrls = {
					'0': sortUrls['0'] || this.sortUrls['0'] || '',
					'1': sortUrls['1'] || this.sortUrls['1'] || ''
				}
			},
			resetPaging(clearItems) {
				this.page = 1
				if (clearItems) {
					this.totalPage = 1
					this.nextPageUrl = ''
					this.status = 'more'
					this.items = []
				}
			},
			resetSortUrls() {
				this.sortUrls = {
					'0': '',
					'1': ''
				}
			},
			normalizeGuestbookUrl(url) {
				url = absoluteYaohuoUrl(url || '')
				return url
			},
			getRequestUrl() {
				return this.page > 1 && this.nextPageUrl ? this.nextPageUrl : this.getSortedUrl()
			},
			getQueryParam(url, key) {
				const match = String(url || '').match(new RegExp(`[?&]${key}=([^&#]*)`, 'i'))
				if (!match) {
					return ''
				}
				try {
					return decodeURIComponent(match[1])
				} catch (e) {
					return match[1]
				}
			},
			setQueryParam(url, key, value) {
				url = String(url || '')
				const encoded = encodeURIComponent(value)
				const reg = new RegExp(`([?&])${key}=[^&#]*`, 'i')
				if (reg.test(url)) {
					return url.replace(reg, `$1${key}=${encoded}`)
				}
				return `${url}${url.indexOf('?') > -1 ? '&' : '?'}${key}=${encoded}`
			},
			switchSort(sort) {
				sort = String(sort) === '1' ? '1' : '0'
				if (sort === this.sort) {
					if (!this.items.length && !this.loading) {
						this.refreshData()
					}
					return
				}
				this.sort = sort
				this.resetPaging(true)
				this.fetchData()
			},
			refreshData() {
				this.keepItemsOnEmptyOnce = true
				this.resetPaging(false)
				this.fetchData()
			},
			loadMore() {
				if (this.loading || this.status === 'noMore' || this.page >= this.totalPage) {
					return
				}
				this.page++
				this.status = 'loading'
				this.fetchData()
			},
			fetchData() {
				if (this.loading) {
					this.pendingRefresh = true
					return
				}
				const url = this.getRequestUrl()
				const requestSort = this.sort
				const requestPage = this.page
				this.loading = true
				uni.request({
					url,
					header: getAuthHeader({
						Referer: this.getRefererUrl(url),
						Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
					}),
					success: res => {
						const html = this.decodeResponseHtml(res.data)
						if (isLoginRequiredHtml(html)) {
							return this.goLogin()
						}
						const data = parseGuestbookPage(html, url, requestPage)
						this.logResponse(url, res, html, data, requestSort, requestPage)
						if (requestPage === 1) {
							this.mergeSortUrls(data.sortUrls)
							if (data.items.length || data.sortUrls && (data.sortUrls['0'] || data.sortUrls['1'])) {
								this.entryFetched = true
							}
						}
						if (requestSort !== this.sort || requestPage !== this.page) {
							console.log('[YAOHUO_GUESTBOOK_STALE]', JSON.stringify({
								url,
								requestSort,
								currentSort: this.sort,
								requestPage,
								currentPage: this.page,
								count: data.items.length
							}))
							return
						}
						uni.setNavigationBarTitle({
							title: data.title || '留言板'
						})
						this.tip = data.tip || ''
						if (this.page === 1 && this.keepItemsOnEmptyOnce && !data.items.length && this.items.length) {
							console.log('[YAOHUO_GUESTBOOK_KEEP_OLD]', JSON.stringify({
								url,
								requestSort,
								requestPage,
								oldCount: this.items.length,
								htmlLength: html.length,
								totalPage: data.totalPage,
								nextPageUrl: data.nextPageUrl
							}))
							this.status = this.items.length && this.page < (this.totalPage || 1) ? 'more' : 'noMore'
						} else {
							this.keepItemsOnEmptyOnce = false
							this.items = this.page === 1 ? data.items : this.items.concat(data.items)
							this.nextPageUrl = data.nextPageUrl
							this.totalPage = data.totalPage || (this.nextPageUrl ? this.page + 1 : this.page)
							this.status = this.page < this.totalPage ? 'more' : 'noMore'
						}
						if (data.items.length || data.nextPageUrl || data.sortUrls && (data.sortUrls['0'] || data.sortUrls['1'])) {
							this.currentUrl = url
						}
					},
					fail: () => {
						if (this.page > 1) this.page--
						this.status = 'more'
					},
					complete: () => {
						this.loading = false
						uni.stopPullDownRefresh()
						if (this.pendingRefresh) {
							this.pendingRefresh = false
							this.fetchData()
						}
					}
				})
			},
			openUser(item) {
				if (item && item.id) {
					uni.navigateTo({
						url: `/pages/user/user?id=${item.id}`
					})
				}
			},
			linkTap(e) {
				const href = absoluteYaohuoUrl(e && e.href)
				if (!href) {
					return
				}
				if (navigateToNativePost(href)) {
					return
				}
				if (navigateToNativeRoute(href)) {
					return
				}
				uni.navigateTo({
					url: `/pages/webview/webview?url=${encodeURIComponent(href)}`
				})
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
	}

	.tip {
		margin-bottom: 14rpx;
		padding: 16rpx;
		border-radius: 8px;
		background: #e9faf2;
		color: #087f77;
		font-size: 14px;
	}

	.tabs {
		height: 72rpx;
		padding: 6rpx;
		margin-bottom: 14rpx;
		background: #fff;
		border-radius: 8px;
		display: flex;
		box-sizing: border-box;
	}

	.tab {
		flex: 1;
		border-radius: 7px;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #666;
		font-size: 14px;
	}

	.tab.active {
		background: #e9faf2;
		color: #07a85a;
		font-weight: 700;
	}

	.card {
		padding: 20rpx;
		margin-bottom: 14rpx;
		background: #fff;
		border-radius: 8px;
	}

	.top {
		display: flex;
		align-items: center;
		margin-bottom: 10rpx;
	}

	.floor {
		color: #8b9aad;
		font-size: 12px;
	}

	.name {
		margin-left: 12rpx;
		color: #087f77;
		font-size: 14px;
		font-weight: 700;
	}

	.time {
		margin-left: auto;
		color: #8b9aad;
		font-size: 12px;
	}

	.content {
		display: block;
		color: #111827;
		font-size: 14px;
		line-height: 1.45;
		white-space: pre-wrap;
	}

	.load-more-btn {
		height: 72rpx;
		margin: 8rpx 0 24rpx;
		border-radius: 8px;
		background: #fff;
		color: #087f77;
		font-size: 14px;
		font-weight: 700;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	::v-deep .content img {
		max-width: 100%;
		vertical-align: middle;
	}

	::v-deep .content .ubbimg {
		width: 42rpx;
		height: 42rpx;
	}

	.empty {
		padding: 120rpx 0;
		text-align: center;
		color: #999;
	}
</style>
