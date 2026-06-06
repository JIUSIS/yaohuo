<template>
	<view>
		<uni-transition mode-class="fade" :duration="300" :show="true">
			<view class="home-fixed-header">
				<view class="home-topbar" @click="handleTopbarTap">
					<view class="logo">
						<image src="https://yaohuo.me/tupian/yaohuo.png"></image>
					</view>
					<view class="top-actions">
						<view class="top-action" @click.stop="openMine">
							<image src="/static/mine.png" mode="aspectFit"></image>
							<text>我的</text>
						</view>
						<view class="top-action message-action" @click.stop="openMessage">
							<image src="/static/message.png" mode="aspectFit"></image>
							<text>消息</text>
							<view v-if="messageCountMatch" class="message-badge">{{messageCountMatch}}</view>
						</view>
					</view>
				</view>
				<view class="home-search-row">
					<uni-search-bar bgColor="#fff" radius="8" placeholder="善用搜索" clearButton="auto"
						@confirm="search" @cancel="cancelSearch" />
				</view>
			</view>
			<view class="home-header-spacer"></view>
			<view class="content">
				<view class="grid">
					<uni-grid :column="5" :showBorder="false" :square="false" :highlight="true" @change="gridChange">
						<uni-grid-item v-for="(item,index) in idArr" :index="parseInt(item.id)" :key="item.id">
							<view class="grid-item-box">
								<uni-icons :type="item.icon" :size="30" color="#777" />
								<text class="text">{{item.name}}</text>
							</view>
						</uni-grid-item>
					</uni-grid>
				</view>
				<!-- #ifdef APP-PLUS -->
				<view class="grid mt-20">
					<uni-grid :column="2" :showBorder="false" :square="false" :highlight="true" @change="goToWebview">
						<uni-grid-item v-for="(item,index) in actionArr" :index="index" :key="index">
							<view class="grid-item-box" @click.stop="openAction(index)">
								<uni-icons :type="item.icon" :size="30" color="#777" />
								<text class="text">{{item.name}}</text>
							</view>
						</uni-grid-item>
					</uni-grid>
				</view>
				<view class="mt-20 br-8 f-15" style="background-color: #fff;">
					<uni-section titleFontSize="16px" title="最新回复" type="line"></uni-section>
					<uni-row>
						<uni-col :span="12" v-for="(item,index) in newArr" :key="index">
							<view class="new-post-item" @click="goToDetail(item.id)">
								{{index+1}}.{{item.title}}
							</view>
						</uni-col>
					</uni-row>
				</view>
				<!-- #endif -->
				<!-- #ifdef APP-PLUS -->
				<view class="mt-20 br-8 recomment-card f-15">
					<uni-section titleFontSize="16px" title="老C推荐" type="line"></uni-section>
					<uni-row>
						<uni-col :span="12" v-for="(item,index) in recommedArr" :key="index">
							<view class="new-post-item" @click="goToRecommend(item)">
								<image class="img" :src="item.img"></image>
								{{item.title}}
							</view>
						</uni-col>
					</uni-row>
					<view v-if="extraObj && extraObj.url" style="position: absolute;top: 20rpx;right: 20rpx;" class="" @click="goToRecommend(extraObj)">
						<image class="img" :src="extraObj.img"></image>
						{{extraObj.title}}
					</view>
				</view>
				<!-- #endif -->
			</view>
			<post-list style="margin-top: 10rpx;" ref="postList" @login-invalid="goLogin"></post-list>
		</uni-transition>

	</view>
</template>

<script>
	import UniSection from '@/components/uni-section/components/uni-section/uni-section'
	import {
		idArr
	} from '@/utils/yaohuo.js'
	import {
		absoluteYaohuoUrl,
		getAttr,
		stripHtml
	} from '@/utils/html.js'
	import {
		clearAuthCookie,
		getAuthHeader,
		isLoginRequiredHtml,
		verifyAuthCookie
	} from '@/utils/auth.js'
	import {
		navigateToNativePost
	} from '@/utils/route.js'
	export default {
		data() {
			return {
				idArr: idArr,
				actionArr: [{
					icon: 'compose',
					name: '发帖',
					url: 'https://yaohuo.me/wapindex.aspx?classid=206',
					nativeUrl: '/pages/post/post?classid=177'
				}, {
					icon: 'medal',
					name: '游戏',
					url: 'https://yaohuo.me/games/gamesindex.aspx'
				}],
				loading: true,
				isSearch: false,
				searchContent: '',
				newArr: [],
				recommedArr: [],
				extraObj: {},
				messageCountMatch: 0,
				checkingAuth: false,
				redirectingLogin: false,
				hasFetchedHome: false,
				lastTopbarTapAt: 0
			}
		},
		onReachBottom() {
			if (this.$refs.postList) {
				this.$refs.postList.loadMore()
			}
		},
		onPullDownRefresh() {
			this.fetchData()
			if (this.$refs.postList) {
				this.$refs.postList.refreshData()
			}
		},
		onLoad() {
			this.hideNativeNavigationBar()
			this.checkAuthAndFetch()
		},
		onReady() {
			this.hideNativeNavigationBar()
		},
		onShow() {
			this.hideNativeNavigationBar()
			this.checkAuthAndFetch()
		},
		methods: {
			hideNativeNavigationBar() {
				try {
					const applyStyle = () => {
						const currentWebview = this.$scope && this.$scope.$getAppWebview ?
							this.$scope.$getAppWebview() :
							(typeof plus !== 'undefined' && plus.webview ? plus.webview.currentWebview() : null)
						if (currentWebview && currentWebview.setStyle) {
							currentWebview.setStyle({
								titleNView: false
							})
						}
					}
					if (typeof plus !== 'undefined' && plus.webview) {
						applyStyle()
					} else if (typeof document !== 'undefined') {
						document.addEventListener('plusready', applyStyle, false)
					}
				} catch (err) {
					console.log('HIDE_HOME_NATIVE_NAV_FAIL', err)
				}
			},
			checkAuthAndFetch() {
				if (this.redirectingLogin || this.checkingAuth) {
					return
				}
				this.checkingAuth = true
				verifyAuthCookie().then(valid => {
					this.checkingAuth = false
					if (!valid) {
						this.goLogin()
						return
					}
					if (!this.hasFetchedHome) {
						this.hasFetchedHome = true
						this.fetchData()
					}
				})
			},
			goLogin() {
				if (this.redirectingLogin) {
					return
				}
				this.redirectingLogin = true
				clearAuthCookie()
				uni.redirectTo({
					url: '/pages/login/login?clear=1'
				})
			},
			goToDetail(id) {
				uni.navigateTo({
					url: `/pages/detail/detail?id=${id}`
				})
			},
			goToWebview(e) {
				this.openAction(e && e.detail ? e.detail.index : 0)
			},
			openAction(index) {
				const item = this.actionArr[Number(index)]
				if (!item) {
					return
				}
				if (item && item.nativeUrl) {
					uni.navigateTo({
						url: item.nativeUrl,
						fail: err => {
							uni.showToast({
								title: '发帖页打不开',
								icon: 'none'
							})
							console.log('OPEN_NATIVE_ACTION_FAIL', err)
						}
					})
					return
				}
				uni.navigateTo({
					url: `/pages/webview/webview?url=${encodeURIComponent(item.url)}`,
					fail: err => {
						uni.showToast({
							title: '页面打不开',
							icon: 'none'
						})
						console.log('OPEN_WEB_ACTION_FAIL', err)
					}
				})
			},
			goToRecommend(item) {
				if (!item || !item.url) {
					return
				}
				const url = absoluteYaohuoUrl(item.url)
				if (navigateToNativePost(url)) {
					return
				}
				uni.navigateTo({
					url: `/pages/webview/webview?url=${encodeURIComponent(url)}`
				})
			},
			parseHomeAds(html) {
				const block = this.extractHomeAdBlock(html)
				if (!block) {
					return []
				}
				const result = []
				const seen = {}
				const divReg = /<div\b[^>]*>[\s\S]*?<\/div>/ig
				let divMatch
				while ((divMatch = divReg.exec(block)) && result.length < 6) {
					const itemHtml = divMatch[0]
					const linkTagMatch = itemHtml.match(/<a\b[^>]*href\s*=\s*(["'])[\s\S]*?\1[^>]*>/i)
					const imgTagMatch = itemHtml.match(/<img\b[^>]*>/i)
					if (!linkTagMatch || !imgTagMatch) {
						continue
					}
					const url = absoluteYaohuoUrl(getAttr(linkTagMatch[0], 'href'))
					const img = absoluteYaohuoUrl(getAttr(imgTagMatch[0], 'src'))
					const title = stripHtml(itemHtml).replace(/\s+/g, ' ').trim()
					if (!url || !title || seen[url]) {
						continue
					}
					seen[url] = true
					result.push({
						title,
						url,
						img
					})
				}
				return result
			},
			extractHomeAdBlock(html) {
				html = String(html || '')
				const welcomeMatch = html.match(/<div\b[^>]*class\s*=\s*(["'])[^"']*\bwelcome\b[^"']*\1[^>]*>[\s\S]*?<\/div>/i)
				const start = welcomeMatch ? welcomeMatch.index + welcomeMatch[0].length : 0
				const rest = html.slice(start)
				const titleMatch = rest.match(/<div\b[^>]*class\s*=\s*(["'])[^"']*\btitle\b[^"']*\1[^>]*>/i)
				const end = titleMatch ? start + titleMatch.index : Math.min(html.length, start + 5000)
				return html.slice(start, end)
			},
			fetchData() {
				this.loading = true
				uni.request({
					url: 'https://yaohuo.me/',
					header: getAuthHeader(),
					success: (res) => {
						try {
							const html = String(res.data || '')
							if (isLoginRequiredHtml(html)) {
								this.goLogin()
								return
							}
							let messageCountMatch = html.match(/收到(.*?)封飞鸽传书/)
							this.messageCountMatch = 0
							if (messageCountMatch) {
								uni.setNavigationBarTitle({
									title: `妖火网（${messageCountMatch[1]}条新消息）`
								})
								this.messageCountMatch = messageCountMatch[1]
							} else {
								uni.setNavigationBarTitle({
									title: '妖火网'
								})
							}
							let newArr = []
							const listMatch = html.match(/<div class=["']list["']>([\s\S]*?)<\/div>/i)
							if (listMatch) {
								const linkReg = /<a[^>]+href=["']([^"']*bbs-(\d+)\.html[^"']*)["'][^>]*>([\s\S]*?)<\/a>/ig
								let linkMatch
								while ((linkMatch = linkReg.exec(listMatch[1])) && newArr.length < 8) {
									newArr.push({
										id: linkMatch[2],
										title: linkMatch[3].replace(/<[^>]+>/g, '')
									})
								}
							}
							this.newArr = newArr
							this.recommedArr = this.parseHomeAds(html)
							this.extraObj = {}
						} catch (e) {}
					},
					fail: () => {
						uni.showToast({
							title: '首页加载失败',
							icon: 'none'
						})
					},
					complete: () => {
						this.loading = false
						uni.stopPullDownRefresh()
					}
				})
			},
			gridChange(e) {
				let url = `https://yaohuo.me/bbs/list.aspx?classid=${e.detail.index}`
				uni.navigateTo({
					url: `/pages/bbsList/bbsList?url=${encodeURIComponent(JSON.stringify({url}))}`
				})
			},

			search(e) {
				this.page = 1
				this.searchContent = e.value
				let url = `https://yaohuo.me/bbs/book_list_search.aspx?key=${encodeURIComponent(this.searchContent || '')}&type=title&classid=0&action=search`
				uni.navigateTo({
					url: `/pages/bbsList/bbsList?url=${encodeURIComponent(JSON.stringify({url}))}`
				})
			},

			cancelSearch() {
				this.isSearch = false
				this.searchContent = ''
				this.page = 1
				this.fetchData()
			},
			handleTopbarTap() {
				const now = Date.now()
				if (now - this.lastTopbarTapAt < 350) {
					this.lastTopbarTapAt = 0
					uni.pageScrollTo({
						scrollTop: 0,
						duration: 250
					})
					return
				}
				this.lastTopbarTapAt = now
			},
			openMine() {
				uni.navigateTo({
					url: '/pages/mine/mine'
				})
			},
			openMessage() {
				uni.navigateTo({
					url: '/pages/message/message'
				})
			}
		}
	}
</script>
<style>
	page {
		background-color: #F3F3F3;
	}
</style>
<style lang="scss" scoped>
	.home-fixed-header {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		z-index: 99;
		background-color: #F3F3F3;
		padding-top: var(--status-bar-height);
		padding-bottom: 10rpx;
		box-sizing: border-box;
	}

	.home-topbar {
		height: 92rpx;
		padding: 0 20rpx;
		display: flex;
		align-items: center;
		justify-content: space-between;
		box-sizing: border-box;
	}

	.home-search-row {
		padding: 0 8rpx;
	}

	.home-header-spacer {
		height: calc(var(--status-bar-height) + 188rpx);
	}

	.logo {
		height: 70rpx;
		display: flex;
		align-items: center;

		image {
			width: 150px;
			height: 51px;
			display: block;
		}
	}

	.top-actions {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 18rpx;
		flex: 0 0 auto;
		margin-left: 12rpx;
	}

	.top-action {
		position: relative;
		height: 56rpx;
		padding: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		box-sizing: border-box;

		image {
			width: 36rpx;
			height: 36rpx;
			margin-right: 6rpx;
			display: block;
		}

		text {
			color: #333;
			font-size: 13px;
			line-height: 1;
			white-space: nowrap;
		}
	}

	.message-badge {
		position: absolute;
		top: -10rpx;
		right: -14rpx;
		min-width: 30rpx;
		height: 30rpx;
		padding: 0 8rpx;
		border-radius: 15rpx;
		background: #ff4d4f;
		color: #fff;
		font-size: 10px;
		line-height: 30rpx;
		text-align: center;
		box-sizing: border-box;
		max-width: 72rpx;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.content {
		padding: 16rpx 20rpx 0;


		.recomment-card {
			background-color: #fff;
			position: relative;

		}

		.new-post-item {
			padding: 0 20rpx 20rpx;
			white-space: nowrap;
			text-overflow: ellipsis;
			overflow: hidden;
		}

		.img {
			width: 30rpx;
			height: 30rpx;
			margin-right: 10rpx;
			vertical-align: -3px;
		}


	}

	::v-deep .uni-section {
		border-radius: 8px;
	}

	::v-deep .grid .uni-grid-wrap,
	::v-deep .grid .uni-grid {
		border-radius: 8px;
		overflow: hidden;
		background-color: #fff;
	}

	::v-deep .grid .uni-grid-item__box {
		background-color: #fff;
	}

	.grid {
		background-color: #fff;
		border-radius: 8px;
		overflow: hidden;
		box-sizing: border-box;

		.image {
			width: 25px;
			height: 25px;
		}

		.text {
			font-size: 14px;
			margin-top: 5px;
		}

		.example-body {
			/* #ifndef APP-NVUE */
			// display: block;
			/* #endif */
		}

		.grid-dynamic-box {
			margin-bottom: 15px;
		}

		.grid-item-box {
			flex: 1;
			// position: relative;
			/* #ifndef APP-NVUE */
			display: flex;
			/* #endif */
			flex-direction: column;
			align-items: center;
			justify-content: center;
			padding: 15px 0;
		}

		.grid-item-box-row {
			flex: 1;
			// position: relative;
			/* #ifndef APP-NVUE */
			display: flex;
			/* #endif */
			flex-direction: row;
			align-items: center;
			justify-content: center;
			padding: 15px 0;
		}

		.grid-dot {
			position: absolute;
			top: 5px;
			right: 15px;
		}

		.swiper {
			height: 420px;
		}

		/* #ifdef H5 */
		@media screen and (min-width: 768px) and (max-width: 1425px) {
			.swiper {
				height: 630px;
			}
		}

		@media screen and (min-width: 1425px) {
			.swiper {
				height: 830px;
			}
		}

		/* #endif */
	}
</style>
