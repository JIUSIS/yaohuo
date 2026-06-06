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
		extractClassBlocks,
		stripHtml
	} from '@/utils/html.js'
	import {
		navigateToNativePost
	} from '@/utils/route.js'

	const DEFAULT_URL = 'https://yaohuo.me/bbs/book_list.aspx?gettotal=2022&action=new'
	const YAOHUO_ORIGIN = 'https://yaohuo.me'
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
				nextPageUrl: '',
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
			getRequestUrl(page) {
				if (page > 1 && this.nextPageUrl) {
					return this.nextPageUrl
				}
				return this.buildPageUrl(this.getBaseUrl(), page)
			},
			resolvePageUrl(href, baseUrl) {
				href = decodeHtml(String(href || '')).trim()
				baseUrl = String(baseUrl || this.getBaseUrl() || '')
				if (!href) {
					return ''
				}
				if (/^https?:\/\//i.test(href)) {
					return href
				}
				if (href.indexOf('//') === 0) {
					return 'https:' + href
				}
				if (href[0] === '/') {
					return YAOHUO_ORIGIN + href
				}
				const cleanBase = baseUrl.split('#')[0]
				const basePath = cleanBase.split('?')[0]
				if (href[0] === '?') {
					return basePath + href
				}
				const dir = basePath.replace(/\/[^/]*$/, '/')
				return dir + href.replace(/^\.?\//, '')
			},
			getUrlPage(url) {
				const match = String(url || '').match(/[?&]page=(\d{1,6})/i)
				return match ? Number(match[1]) : 0
			},
			extractNextPageUrl(resData, requestUrl) {
				const html = String(resData || '')
				const currentPage = this.page || 1
				const candidates = []
				const reg = /<a\b[^>]*href\s*=\s*(["'])([^"']+)\1[^>]*>([\s\S]*?)<\/a>/ig
				let match
				while ((match = reg.exec(html))) {
					const href = decodeHtml(match[2])
					if (!/[?&]page=\d{1,6}/i.test(href)) {
						continue
					}
					const url = this.resolvePageUrl(href, requestUrl)
					if (!/\/bbs\/(?:book_list_search|book_list|list)\.aspx/i.test(url)) {
						continue
					}
					const page = this.getUrlPage(url)
					if (page > currentPage) {
						candidates.push({
							page,
							url
						})
					}
				}
				candidates.sort((a, b) => a.page - b.page)
				const next = candidates.find(item => item.page === currentPage + 1) || candidates[0]
				return next ? next.url : ''
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
				this.nextPageUrl = ''
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
				const requestUrl = this.getRequestUrl(requestedPage)
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
						this.handleSimpleData(html, requestUrl)
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
					const classId = this.getListClassId()
					navigateToNativePost(url, {
						classid: classId
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
			getLinkMatches(block) {
				const links = []
				const reg = /<a\b[^>]*href\s*=\s*(["'])([^"']+)\1[^>]*>([\s\S]*?)<\/a>/ig
				let match
				while ((match = reg.exec(String(block || '')))) {
					links.push({
						href: decodeHtml(match[2]),
						text: stripHtml(match[3]).replace(/\s+/g, ' ').trim(),
						index: match.index,
						end: reg.lastIndex
					})
				}
				return links
			},
			normalizePostAuthor(text) {
				return stripHtml(text)
					.replace(/\s+/g, ' ')
					.replace(/^(?:作者|楼主|发帖人|发贴人|发帖|发贴)\s*[:：]?/i, '')
					.replace(/^[\/|｜\s]+|[\/|｜\s]+$/g, '')
					.trim()
			},
			extractPostTags(block) {
				const tags = []
				const seen = {}
				const reg = /<img\b[^>]*\balt\s*=\s*(["'])([^"']+)\1/ig
				let match
				while ((match = reg.exec(String(block || '')))) {
					const tag = decodeHtml(match[2]).trim() === '礼' ? '肉' : decodeHtml(match[2]).trim()
					if (tag && this.typeObj[tag] && !seen[tag]) {
						seen[tag] = true
						tags.push(tag)
					}
				}
				return tags
			},
			extractPostAuthor(block, titleLink, replyLink, links) {
				const start = titleLink ? titleLink.end : 0
				const end = replyLink ? replyLink.index : Math.min(String(block || '').length, start + 300)
				const beforeReply = String(block || '').slice(start, end)
				const labelMatch = beforeReply.match(/(?:作者|楼主|发帖人|发贴人|发帖|发贴)\s*[:：]?\s*(?:<a\b[^>]*>([\s\S]*?)<\/a>|([^<\s\/|｜]+))/i)
				if (labelMatch) {
					return this.normalizePostAuthor(labelMatch[1] || labelMatch[2])
				}
				const userLinks = (links || []).filter(link => {
					return link.index >= start &&
						(!replyLink || link.index < replyLink.index) &&
						/userinfo\.aspx|touserid=|mainuserid=/i.test(link.href) &&
						link.text &&
						!/^\d+$/.test(link.text)
				})
				if (userLinks.length) {
					return this.normalizePostAuthor(userLinks[userLinks.length - 1].text)
				}
				const parts = stripHtml(beforeReply)
					.replace(/\s+/g, ' ')
					.split(/[\/|｜]/)
					.map(item => this.normalizePostAuthor(item))
					.filter(item => item && !/^\d+$/.test(item) && !/^(回|回复|阅|浏览|点击|最新|最后|时间)$/.test(item))
				if (parts.length) {
					return parts[parts.length - 1]
				}
				return ''
			},
			extractPostCounts(block, links, titleLink) {
				const result = {
					replyCount: '',
					readCount: '',
					replyLink: null
				}
				const titleEnd = titleLink ? titleLink.end : 0
				const replyLink = (links || []).find(link => link.index > titleEnd && /^\d+$/.test(link.text))
				if (replyLink) {
					result.replyCount = replyLink.text
					result.replyLink = replyLink
					const afterReplyText = stripHtml(String(block || '').slice(replyLink.end, replyLink.end + 120))
					const readMatch = afterReplyText.match(/(?:阅|浏览|点击)?\s*[:：\/]?\s*(\d+)/)
					result.readCount = readMatch ? readMatch[1] : ''
				}
				if (!result.readCount) {
					const text = stripHtml(block)
					const readMatch = text.match(/(?:阅|浏览|点击)\s*[:：]?\s*(\d+)/)
					result.readCount = readMatch ? readMatch[1] : ''
				}
				return result
			},
			parsePostBlock(block) {
				const links = this.getLinkMatches(block)
				const titleLink = links.find(link => /bbs-\d+\.html/i.test(link.href) && !this.isNoiseTitle(link.text))
				if (!titleLink) {
					return null
				}
				const idMatch = titleLink.href.match(/bbs-(\d+)\.html/i)
				const counts = this.extractPostCounts(block, links, titleLink)
				return {
					id: idMatch ? idMatch[1] : '',
					title: titleLink.text,
					url: titleLink.href,
					author: this.extractPostAuthor(block, titleLink, counts.replyLink, links),
					readCount: counts.readCount,
					replyCount: counts.replyCount,
					tags: this.extractPostTags(block)
				}
			},
			parsePosts(resData) {
				const posts = []
				const seen = {}
				const blocks = extractClassBlocks(resData, 'listdata')
				if (blocks.length) {
					blocks.forEach(block => {
						const post = this.parsePostBlock(block)
						if (!post || !post.id || seen[post.id]) {
							return
						}
						seen[post.id] = true
						posts.push(post)
					})
					if (posts.length) {
						return posts
					}
				}
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
				return 0
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
			handleSimpleData(resData, requestUrl) {
				const posts = this.parsePosts(String(resData || ''))
				const freshCount = this.mergePosts(posts)
				const parsedTotalPage = this.parseTotalPage(resData)
				this.nextPageUrl = this.extractNextPageUrl(resData, requestUrl)
				if (parsedTotalPage) {
					this.totalPage = Math.max(parsedTotalPage, this.page)
				} else {
					this.totalPage = (this.nextPageUrl || freshCount > 0) ? this.page + 1 : this.page
				}
				this.status = this.page < this.totalPage ? 'more' : 'noMore'
				console.log('[YAOHUO_POST_LIST_PAGE]', JSON.stringify({
					page: this.page,
					count: posts.length,
					freshCount,
					totalPage: this.totalPage,
					status: this.status,
					requestUrl,
					nextPageUrl: this.nextPageUrl
				}))
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
