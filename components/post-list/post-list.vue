<template>
	<view class="content">
		<view v-for="(post,index) in posts" :key="post.id || post.url || index" class="post-card" @click="goToDetail(post.url)">
			<view class="title f-16">
				{{index+1}}.{{post.title}}
			</view>
			<view class="info">
				<uni-row>
					<uni-col :span="12">
						<view class="f-13">
							{{post.author}}
						</view>
					</uni-col>
					<uni-col :span="12">
						<view class="f-13 text-right">
							<uni-icons type="eye" class="icon"></uni-icons>{{post.readCount}}
							<uni-icons type="chatboxes" class="icon"></uni-icons>{{post.replyCount}}
						</view>
					</uni-col>
				</uni-row>
			</view>
			<view class="tags">
				<uni-tag class="tag" v-for="(tag,tagIndex) in post.tags" :key="tagIndex" :circle="true"
					:type="typeObj[tag] || 'default'" :text="tag"></uni-tag><strong></strong>
			</view>
		</view>
		<uni-load-more style="height: 50rpx;" v-show="page!==1 || status === 'loading'" :status="status"></uni-load-more>
	</view>
</template>

<script>
	import {
		getAuthHeader,
		isLoginRequiredHtml
	} from '@/utils/auth.js'
	import {
		decodeHtml,
		stripHtml
	} from '@/utils/html.js'

	const DEFAULT_URL = 'https://yaohuo.me/bbs/book_list.aspx?gettotal=2022&action=new'
	const PAGE_SIZE = 15

	export default {
		props: {
			url: {
				type: String,
				default: DEFAULT_URL
			}
		},
		data() {
			return {
				posts: [],
				page: 1,
				totalPage: 1,
				status: 'more',
				canFresh: true,
				isLoading: false,
				typeObj: {
					'附': 'success',
					'赏': 'primary',
					'肉': 'warning',
					'精': 'error',
					'结': 'default'
				}
			}
		},
		watch: {
			url(newUrl, oldUrl) {
				if (newUrl && newUrl !== oldUrl) {
					this.refreshData()
				}
			}
		},
		mounted() {
			if (this.url !== '') {
				this.fetchData()
			}
		},
		methods: {
			getBaseUrl() {
				return this.url || DEFAULT_URL
			},
			buildPageUrl(url, page) {
				const base = String(url || '')
				if (!base) {
					return ''
				}
				const replaced = base.replace(/([?&])page=[^&#]*/i, `$1page=${page}`)
				return replaced === base ? `${base}${base.indexOf('?') > -1 ? '&' : '?'}page=${page}` : replaced
			},
			loadMore() {
				if (this.isLoading || this.status === 'noMore' || this.page >= this.totalPage) {
					return
				}
				this.page++
				this.status = 'loading'
				this.fetchData()
			},
			refreshData() {
				this.canFresh = false
				this.page = 1
				this.totalPage = 1
				this.status = 'more'
				this.posts = []
				setTimeout(() => {
					this.canFresh = true
				}, 1000 * 20)
				this.fetchData()
			},
			fetchData() {
				if (this.isLoading) {
					return
				}
				const requestedPage = this.page || 1
				const requestUrl = this.buildPageUrl(this.getBaseUrl(), requestedPage)
				if (!requestUrl) {
					return
				}
				this.isLoading = true
				if (this.canFresh && this.status !== 'loading') {
					uni.showLoading({
						title: '拉取数据中'
					})
				}
				uni.request({
					url: requestUrl,
					header: getAuthHeader(),
					success: (res) => {
						const html = String(res.data || '')
						if (isLoginRequiredHtml(html)) {
							this.$emit('login-invalid')
							return
						}
						this.updateNavigationTitle(html)
						const tip = html.match(/<div class=["']tip["']>([\s\S]*?)<\/div>/i)
						if (tip && stripHtml(tip[1]).indexOf('失效') > -1) {
							this.$emit('login-invalid')
							return uni.showToast({
								title: '请重新登录',
								icon: 'error'
							})
						}
						this.handleSimpleData(html)
					},
					fail: () => {
						if (requestedPage > 1) {
							this.page = requestedPage - 1
						}
						this.status = 'more'
					},
					complete: () => {
						this.isLoading = false
						uni.hideLoading()
						uni.stopPullDownRefresh()
					}
				})
			},
			updateNavigationTitle(html) {
				const messageCountMatch = stripHtml(html).match(/收到\s*(.*?)\s*封飞鸽传书/)
				if (messageCountMatch) {
					uni.setNavigationBarTitle({
						title: `妖火网（${messageCountMatch[1]}条新消息）`
					})
				} else {
					uni.setNavigationBarTitle({
						title: '妖火网'
					})
				}
			},
			getListClassId() {
				const match = String(this.getBaseUrl()).match(/classid=(\d+)/i)
				return match ? match[1] : ''
			},
			goToDetail(url) {
				if (uni.getStorageSync('cookie')) {
					const idMatch = String(url || '').match(/bbs-(\d+)\.html/i)
					if (!idMatch) {
						return
					}
					const classId = this.getListClassId()
					uni.navigateTo({
						url: `/pages/detail/detail?id=${idMatch[1]}${classId ? '&classid=' + classId : ''}`
					})
				} else {
					uni.showModal({
						content: '请先登录',
						success: (res) => {
							if (res.confirm) {
								uni.navigateTo({
									url: '/pages/login/login'
								})
							}
						}
					})
				}
			},
			isNoiseTitle(title) {
				title = String(title || '').trim()
				return !title || /^\d+$/.test(title) || /返回|上一页|下一页|首页|尾页/.test(title)
			},
			parsePosts(resData) {
				const posts = []
				const seen = {}
				const linkReg = /<a\b[^>]*href=["']([^"']*bbs-(\d+)\.html[^"']*)["'][^>]*>([\s\S]*?)<\/a>/ig
				let match
				while ((match = linkReg.exec(resData))) {
					const url = decodeHtml(match[1])
					const id = match[2]
					const title = stripHtml(match[3]).replace(/\s+/g, ' ').trim()
					if (seen[id] || this.isNoiseTitle(title)) {
						continue
					}
					seen[id] = true
					posts.push({
						id,
						title,
						url,
						author: '',
						readCount: '',
						replyCount: '',
						tags: []
					})
				}
				return posts
			},
			parseTotalPage(resData) {
				const html = decodeHtml(String(resData || ''))
				const text = stripHtml(html)
				const ratioMatch = text.match(/(?:^|[^\d])\d+\s*\/\s*(\d{1,6})\s*页/)
				if (ratioMatch) {
					return Number(ratioMatch[1]) || 0
				}
				const totalMatch = text.match(/共\s*(\d{1,8})\s*(?:条|贴|帖|个|篇)/)
				if (totalMatch) {
					return Math.max(1, Math.ceil(Number(totalMatch[1]) / PAGE_SIZE))
				}
				const getTotalMatch = String(this.getBaseUrl()).match(/[?&]gettotal=(\d+)/i)
				if (getTotalMatch) {
					return Math.max(1, Math.ceil(Number(getTotalMatch[1]) / PAGE_SIZE))
				}
				const pages = []
				html.replace(/[?&]page=(\d{1,6})/ig, (all, page) => {
					const num = Number(page)
					if (num > 0) {
						pages.push(num)
					}
					return all
				})
				return pages.length ? Math.max.apply(null, pages) : 0
			},
			mergePosts(posts) {
				if (this.page === 1) {
					this.posts = posts
					return posts.length
				}
				const seen = {}
				this.posts.forEach(post => {
					if (post.id || post.url) {
						seen[post.id || post.url] = true
					}
				})
				const freshPosts = posts.filter(post => {
					const key = post.id || post.url
					if (!key || seen[key]) {
						return false
					}
					seen[key] = true
					return true
				})
				this.posts = this.posts.concat(freshPosts)
				return freshPosts.length
			},
			handleSimpleData(resData) {
				const posts = this.parsePosts(String(resData || ''))
				const freshCount = this.mergePosts(posts)
				const parsedTotalPage = this.parseTotalPage(resData)
				if (parsedTotalPage) {
					this.totalPage = Math.max(parsedTotalPage, this.page)
				} else {
					this.totalPage = freshCount > 0 ? this.page + 1 : this.page
				}
				this.status = this.page < this.totalPage ? 'more' : 'noMore'
			}
		}
	}
</script>

<style lang="scss" scoped>
	.content {
		padding: 20rpx 20rpx;

		.post-card {
			padding: 20rpx 40rpx;
			margin-bottom: 20rpx;
			border-radius: 8px;
			position: relative;
			background: #fff;

			.tags {
				position: absolute;
				top: -10rpx;
				right: -10rpx;

				.tag {
					margin-left: 10rpx;
				}
			}

			.info {
				margin-top: 20rpx;

				.icon {
					margin: 0 10rpx;
					vertical-align: -1px;
				}
			}
		}
	}
</style>
