<template>
	<view class="page">
		<view class="tabs">
			<view class="tab" :class="{active: sort === '0'}" @click="switchSort('0')">最新回复</view>
			<view class="tab" :class="{active: sort === '1'}" @click="switchSort('1')">最早回复</view>
		</view>

		<view v-if="replies.length" class="reply-list">
			<view v-for="(item,index) in replies" :key="item.postId + item.floor + index" class="reply-card" @click="openReply(item)">
				<view class="reply-top">
					<text class="floor">{{item.floor || '#' + (index + 1)}}</text>
					<text class="date">{{item.date}}</text>
				</view>
				<text class="content">{{item.content || '无内容'}}</text>
				<view class="reply-bottom">
					<text class="author">{{item.author}}</text>
					<view class="view-link">
						<text>查看</text>
						<uni-icons type="arrowright" size="15" color="#07a85a"></uni-icons>
					</view>
				</view>
			</view>
		</view>
		<view v-else-if="!loading" class="empty">暂无回复</view>
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
		navigateToNativePost
	} from '@/utils/route.js'
	import {
		buildPageUrl,
		extractNextPageUrl,
		parseMyReplies,
		parseTitle,
		parseTotalPage
	} from '@/utils/list-pages.js'

	export default {
		data() {
			return {
				userId: '',
				sort: '',
				replies: [],
				page: 1,
				totalPage: 1,
				nextPageUrl: '',
				status: 'more',
				loading: false
			}
		},
		onLoad(option) {
			option = option || {}
			this.userId = String(option.userId || option.touserid || uni.getStorageSync('yaohuoUserId') || '')
			this.sort = option.ot === '1' ? '1' : '0'
			console.log('[YAOHUO_REPLIES_PAGE_LOAD]', {
				userId: this.userId,
				sort: this.sort
			})
			uni.setNavigationBarTitle({
				title: '我的回复'
			})
			this.fetchData()
		},
		onReachBottom() {
			this.loadMore()
		},
		onPullDownRefresh() {
			this.refreshData()
		},
		methods: {
			getBaseUrl() {
				const params = [
					'action=class',
					'siteid=1000',
					'classid=0',
					'touserid=' + encodeURIComponent(this.userId || ''),
					'lpage=',
					'ot=' + encodeURIComponent(this.sort || '')
				]
				return 'https://yaohuo.me/bbs/book_re_my.aspx?' + params.join('&')
			},
			getRequestUrl() {
				if (this.page > 1 && this.nextPageUrl) {
					return this.nextPageUrl
				}
				return buildPageUrl(this.getBaseUrl(), this.page)
			},
			switchSort(sort) {
				sort = String(sort) === '1' ? '1' : '0'
				if (sort === this.sort) {
					return
				}
				this.sort = sort
				this.refreshData()
			},
			refreshData() {
				this.page = 1
				this.totalPage = 1
				this.nextPageUrl = ''
				this.status = 'more'
				this.replies = []
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
				const requestUrl = this.getRequestUrl()
				this.loading = true
				uni.showLoading({
					title: '加载中'
				})
				uni.request({
					url: requestUrl,
					header: getAuthHeader(),
					success: res => {
						const html = String(res.data || '')
						if (isLoginRequiredHtml(html)) {
							return this.goLogin()
						}
						const title = parseTitle(html, '')
						if (title) {
							uni.setNavigationBarTitle({
								title: title.replace(/^查看/, '').replace(/的回复$/, '的回复')
							})
						}
						const list = parseMyReplies(html)
						if (this.page === 1) {
							this.replies = list
						} else {
							const seen = {}
							this.replies.forEach(item => {
								seen[item.postId + item.floor] = true
							})
							this.replies = this.replies.concat(list.filter(item => !seen[item.postId + item.floor]))
						}
						this.nextPageUrl = extractNextPageUrl(html, requestUrl, this.page, /\/bbs\/book_re_my\.aspx/i)
						this.totalPage = parseTotalPage(html, 15) || (this.nextPageUrl ? this.page + 1 : this.page)
						this.status = this.page < this.totalPage ? 'more' : 'noMore'
					},
					fail: () => {
						if (this.page > 1) {
							this.page--
						}
						this.status = 'more'
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
			openReply(item) {
				if (!item || !item.url) {
					return
				}
				navigateToNativePost(item.url)
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

	.tabs {
		height: 72rpx;
		padding: 6rpx;
		background: #fff;
		border-radius: 8px;
		display: flex;
		box-sizing: border-box;
		margin-bottom: 18rpx;
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

	.reply-card {
		padding: 20rpx 22rpx;
		margin-bottom: 16rpx;
		background: #fff;
		border-radius: 8px;
		box-sizing: border-box;
	}

	.reply-top,
	.reply-bottom {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.floor {
		padding: 4rpx 12rpx;
		border-radius: 999rpx;
		background: #e9faf2;
		color: #07a85a;
		font-size: 12px;
		font-weight: 700;
	}

	.date,
	.author {
		color: #999;
		font-size: 12px;
	}

	.content {
		display: block;
		margin: 18rpx 0;
		color: #222;
		font-size: 15px;
		line-height: 1.55;
		white-space: pre-wrap;
		word-break: break-word;
	}

	.view-link {
		display: flex;
		align-items: center;
		color: #07a85a;
		font-size: 13px;
	}

	.empty {
		margin-top: 120rpx;
		color: #999;
		text-align: center;
		font-size: 14px;
	}
</style>
