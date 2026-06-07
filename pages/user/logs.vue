<template>
	<view class="page">
		<view v-if="logs.length">
			<view v-for="(item,index) in logs" :key="index" class="card" :class="{clickable: item.url}"
				@click="openLog(item)">
				<text class="content">{{item.content}}</text>
				<view class="meta-row">
					<text class="time">{{item.time}}</text>
					<uni-icons v-if="item.url" type="arrowright" size="16" color="#9ca3af"></uni-icons>
				</view>
			</view>
		</view>
		<view v-else-if="!loading" class="empty">暂无动态</view>
		<uni-load-more v-show="page !== 1 || status === 'loading'" :status="status"></uni-load-more>
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
		parseUserLogs
	} from '@/utils/list-pages.js'
	import {
		navigateToNativeRoute
	} from '@/utils/route.js'

	export default {
		data() {
			return {
				userId: '',
				baseUrl: '',
				nextPageUrl: '',
				logs: [],
				page: 1,
				totalPage: 1,
				status: 'more',
				loading: false
			}
		},
		onLoad(option) {
			option = option || {}
			this.userId = String(option.id || option.touserid || '').replace(/[^\d]/g, '')
			this.baseUrl = option.url ? decodeURIComponent(option.url) :
				`https://yaohuo.me/bbs/book_list_log.aspx?action=my&touserid=${this.userId}`
			this.fetchData()
		},
		onReachBottom() {
			this.loadMore()
		},
		onPullDownRefresh() {
			this.refreshData()
		},
		methods: {
			getRequestUrl() {
				return this.page > 1 && this.nextPageUrl ? this.nextPageUrl : buildPageUrl(this.baseUrl, this.page)
			},
			refreshData() {
				this.page = 1
				this.totalPage = 1
				this.nextPageUrl = ''
				this.status = 'more'
				this.logs = []
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
					return
				}
				const url = this.getRequestUrl()
				this.loading = true
				uni.request({
					url,
					header: getAuthHeader(),
					success: res => {
						const html = String(res.data || '')
						if (isLoginRequiredHtml(html)) {
							return this.goLogin()
						}
						const data = parseUserLogs(html, url, this.page)
						uni.setNavigationBarTitle({
							title: data.title || '最近动态'
						})
						this.logs = this.page === 1 ? data.logs : this.logs.concat(data.logs)
						this.nextPageUrl = data.nextPageUrl
						this.totalPage = data.totalPage || (this.nextPageUrl ? this.page + 1 : this.page)
						this.status = this.page < this.totalPage ? 'more' : 'noMore'
					},
					fail: () => {
						if (this.page > 1) this.page--
						this.status = 'more'
					},
					complete: () => {
						this.loading = false
						uni.stopPullDownRefresh()
					}
				})
			},
			openLog(item) {
				if (!item || !item.url) {
					return
				}
				if (navigateToNativeRoute(item.url)) {
					return
				}
				uni.navigateTo({
					url: `/pages/webview/webview?url=${encodeURIComponent(item.url)}`
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

	.card {
		padding: 20rpx;
		margin-bottom: 14rpx;
		background: #fff;
		border-radius: 8px;
	}

	.clickable {
		border: 1px solid #edf2f2;
	}

	.content {
		display: block;
		color: #111827;
		font-size: 15px;
		line-height: 1.45;
	}

	.meta-row {
		margin-top: 8rpx;
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.time {
		display: block;
		color: #8b9aad;
		font-size: 12px;
	}

	.empty {
		padding: 120rpx 0;
		text-align: center;
		color: #999;
	}
</style>
