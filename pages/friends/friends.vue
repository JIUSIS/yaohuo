<template>
	<view class="page">
		<view class="tabs">
			<view class="tab" :class="{active: friendType === '0'}" @click="switchType('0')">好友</view>
			<view class="tab" :class="{active: friendType === '1'}" @click="switchType('1')">黑名单</view>
		</view>

		<view v-if="friends.length" class="list">
			<view v-for="item in friends" :key="item.id" class="card" @click="openUser(item)">
				<view class="avatar">{{item.name.slice(0, 1)}}</view>
				<view class="body">
					<view class="name-row">
						<text class="name">{{item.name}}</text>
						<text class="id">ID {{item.id}}</text>
					</view>
					<text v-if="item.remark" class="remark">{{item.remark}}</text>
					<text v-if="item.date" class="date">{{item.date}}</text>
				</view>
				<uni-icons type="arrowright" size="18" color="#bbb"></uni-icons>
			</view>
		</view>
		<view v-else-if="!loading" class="empty">{{friendType === '0' ? '暂无好友' : '暂无黑名单'}}</view>
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
		extractNextPageUrl,
		parseFriends,
		parseTitle,
		parseTotalPage
	} from '@/utils/list-pages.js'

	export default {
		data() {
			return {
				friendType: '0',
				friends: [],
				page: 1,
				totalPage: 1,
				nextPageUrl: '',
				status: 'more',
				loading: false
			}
		},
		onLoad(option) {
			option = option || {}
			this.friendType = String(option.type || option.friendtype || '0') === '1' ? '1' : '0'
			console.log('[YAOHUO_FRIENDS_PAGE_LOAD]', {
				friendType: this.friendType
			})
			this.setTitle()
			this.fetchData()
		},
		onReachBottom() {
			this.loadMore()
		},
		onPullDownRefresh() {
			this.refreshData()
		},
		methods: {
			setTitle() {
				uni.setNavigationBarTitle({
					title: this.friendType === '0' ? '我的好友' : '黑名单'
				})
			},
			getBaseUrl() {
				return `https://yaohuo.me/bbs/FriendList.aspx?friendtype=${this.friendType}`
			},
			getRequestUrl() {
				if (this.page > 1 && this.nextPageUrl) {
					return this.nextPageUrl
				}
				return buildPageUrl(this.getBaseUrl(), this.page)
			},
			switchType(type) {
				type = String(type) === '1' ? '1' : '0'
				if (type === this.friendType) {
					return
				}
				this.friendType = type
				this.setTitle()
				this.refreshData()
			},
			refreshData() {
				this.page = 1
				this.totalPage = 1
				this.nextPageUrl = ''
				this.status = 'more'
				this.friends = []
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
								title
							})
						}
						const list = parseFriends(html)
						if (this.page === 1) {
							this.friends = list
						} else {
							const seen = {}
							this.friends.forEach(item => {
								seen[item.id] = true
							})
							this.friends = this.friends.concat(list.filter(item => !seen[item.id]))
						}
						this.nextPageUrl = extractNextPageUrl(html, requestUrl, this.page, /\/bbs\/FriendList\.aspx/i)
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
			openUser(item) {
				if (!item || !item.id) {
					return
				}
				uni.navigateTo({
					url: `/pages/user/user?id=${item.id}`
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

	.card {
		min-height: 132rpx;
		padding: 20rpx;
		margin-bottom: 16rpx;
		background: #fff;
		border-radius: 8px;
		display: flex;
		align-items: center;
		box-sizing: border-box;
	}

	.avatar {
		width: 78rpx;
		height: 78rpx;
		border-radius: 50%;
		background: #e9faf2;
		color: #07a85a;
		font-weight: 700;
		font-size: 18px;
		display: flex;
		align-items: center;
		justify-content: center;
		flex: 0 0 78rpx;
	}

	.body {
		margin-left: 18rpx;
		min-width: 0;
		flex: 1;
	}

	.name-row {
		display: flex;
		align-items: center;
		min-width: 0;
	}

	.name {
		color: #222;
		font-size: 16px;
		font-weight: 700;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.id {
		margin-left: 10rpx;
		padding: 3rpx 10rpx;
		border-radius: 999rpx;
		background: #f5f5f5;
		color: #888;
		font-size: 11px;
		flex: 0 0 auto;
	}

	.remark,
	.date {
		display: block;
		margin-top: 8rpx;
		color: #777;
		font-size: 13px;
		line-height: 1.35;
	}

	.date {
		color: #aaa;
		font-size: 12px;
	}

	.empty {
		margin-top: 120rpx;
		color: #999;
		text-align: center;
		font-size: 14px;
	}
</style>
