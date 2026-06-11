<template>
	<view class="rank-page">
		<view class="rank-tabs">
			<view v-for="item in tabs" :key="item.stype" class="rank-tab"
				:class="{active: activeStype === item.stype}" @click="switchTab(item.stype)">
				{{item.label}}
			</view>
		</view>

		<view v-if="items.length" class="rank-list">
			<view v-for="(item,index) in items" :key="item.userId || item.url || index" class="rank-card"
				@click="openUser(item)">
				<view class="rank-no" :class="{gold: item.rank === 1, silver: item.rank === 2, bronze: item.rank === 3}">
					<text>{{formatRank(item.rank)}}</text>
				</view>
				<view class="rank-user">
					<view class="rank-name-row">
						<text class="rank-name">{{item.name}}</text>
						<text v-if="item.userId" class="rank-id">ID {{item.userId}}</text>
					</view>
					<text class="rank-sub">{{item.label}}排行</text>
				</view>
				<view class="rank-value">
					<text class="rank-value-number">{{formatValue(item.value)}}</text>
					<text class="rank-value-label">{{item.label}}</text>
				</view>
			</view>
		</view>

		<view v-else-if="!loading" class="empty-state">暂无排行数据</view>
		<uni-load-more class="rank-load-more" :status="status"></uni-load-more>
	</view>
</template>

<script>
	import {
		clearAuthCookie,
		getAuthHeader,
		isLoginRequiredHtml
	} from '@/utils/auth.js'
	import {
		absoluteYaohuoUrl,
		decodeHtml,
		extractClassBlocks,
		getAttr,
		stripHtml
	} from '@/utils/html.js'
	import {
		getQueryValue,
		navigateToNativeRoute
	} from '@/utils/route.js'

	const DEFAULT_URL = 'https://yaohuo.me/bbs/book_list_rank.aspx'
	const YAOHUO_ORIGIN = 'https://yaohuo.me'
	const PAGE_SIZE = 15
	const TABS = [{
		stype: '0',
		label: '帖子'
	}, {
		stype: '1',
		label: '回复'
	}, {
		stype: '2',
		label: '妖晶'
	}, {
		stype: '3',
		label: '经验'
	}, {
		stype: '4',
		label: '人气'
	}]

	export default {
		data() {
			return {
				tabs: TABS,
				sourceUrl: DEFAULT_URL,
				activeStype: '0',
				page: 1,
				totalPage: 1,
				nextPageUrl: '',
				items: [],
				loading: false,
				status: 'more'
			}
		},
		onLoad(option) {
			this.sourceUrl = this.parseOptionUrl(option && option.url) || DEFAULT_URL
			this.activeStype = this.normalizeStype(getQueryValue(this.sourceUrl, 'stype'))
			this.page = Number(getQueryValue(this.sourceUrl, 'page')) || 1
			this.fetchData(true)
		},
		onReachBottom() {
			this.loadMore()
		},
		onPullDownRefresh() {
			this.refreshData()
		},
		methods: {
			parseOptionUrl(input) {
				let text = String(input || '').trim()
				if (!text) {
					return ''
				}
				for (let i = 0; i < 2; i++) {
					try {
						const decoded = decodeURIComponent(text)
						if (decoded === text) {
							break
						}
						text = decoded
					} catch (e) {
						break
					}
				}
				try {
					if (/^\s*\{/.test(text)) {
						const parsed = JSON.parse(text)
						if (parsed && parsed.url) {
							text = parsed.url
						}
					}
				} catch (e) {}
				return absoluteYaohuoUrl(text)
			},
			normalizeStype(stype) {
				stype = String(stype || '0')
				return TABS.some(item => item.stype === stype) ? stype : '0'
			},
			getActiveLabel() {
				const tab = TABS.find(item => item.stype === this.activeStype)
				return tab ? tab.label : '帖子'
			},
			buildRankUrl(stype, page) {
				stype = this.normalizeStype(stype)
				const query = [`stype=${encodeURIComponent(stype)}`]
				if (page && Number(page) > 1) {
					query.push(`page=${Number(page)}`)
				}
				return `${DEFAULT_URL}?${query.join('&')}`
			},
			buildPageUrl(url, page) {
				const base = String(url || this.buildRankUrl(this.activeStype, 1))
				if (!base) {
					return ''
				}
				if (/[?&]page=[^&#]*/i.test(base)) {
					return base.replace(/([?&])page=[^&#]*/i, `$1page=${page}`)
				}
				return `${base}${base.indexOf('?') > -1 ? '&' : '?'}page=${page}`
			},
			getRequestUrl(page) {
				if (page > 1 && this.nextPageUrl) {
					return this.nextPageUrl
				}
				if (page === 1) {
					return this.buildRankUrl(this.activeStype, 1)
				}
				return this.buildPageUrl(this.sourceUrl, page)
			},
			resolvePageUrl(href, baseUrl) {
				href = decodeHtml(String(href || '')).trim()
				baseUrl = String(baseUrl || DEFAULT_URL)
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
			extractNextPageUrl(html, requestUrl) {
				const currentPage = this.page || 1
				const candidates = []
				const reg = /<a\b[^>]*href\s*=\s*(["'])([^"']+)\1[^>]*>([\s\S]*?)<\/a>/ig
				let match
				while ((match = reg.exec(String(html || '')))) {
					const url = this.resolvePageUrl(match[2], requestUrl)
					if (!/\/bbs\/book_list_rank\.aspx/i.test(url)) {
						continue
					}
					if (this.normalizeStype(getQueryValue(url, 'stype')) !== this.activeStype) {
						continue
					}
					const page = Number(getQueryValue(url, 'page')) || 0
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
			refreshData() {
				this.page = 1
				this.totalPage = 1
				this.nextPageUrl = ''
				this.status = 'more'
				this.fetchData(true)
			},
			loadMore() {
				if (this.loading || this.status === 'noMore' || this.page >= this.totalPage) {
					return
				}
				this.page++
				this.status = 'loading'
				this.fetchData(false)
			},
			switchTab(stype) {
				stype = this.normalizeStype(stype)
				if (stype === this.activeStype) {
					return
				}
				this.activeStype = stype
				this.sourceUrl = this.buildRankUrl(stype, 1)
				this.page = 1
				this.totalPage = 1
				this.nextPageUrl = ''
				this.items = []
				this.status = 'more'
				this.fetchData(true)
			},
			fetchData(reset) {
				if (this.loading) {
					return
				}
				const requestedPage = this.page || 1
				const requestUrl = this.getRequestUrl(requestedPage)
				this.loading = true
				if (requestedPage === 1) {
					this.status = 'loading'
				}
				uni.request({
					url: requestUrl,
					header: getAuthHeader({
						Referer: 'https://yaohuo.me/'
					}),
					success: res => {
						const html = String(res.data || '')
						if (isLoginRequiredHtml(html)) {
							this.goLogin()
							return
						}
						this.handleRankData(html, requestUrl, reset)
					},
					fail: err => {
						if (requestedPage > 1) {
							this.page = requestedPage - 1
						}
						this.status = this.items.length ? 'more' : 'noMore'
						console.log('[YAOHUO_RANK_REQUEST_FAIL]', err)
					},
					complete: () => {
						this.loading = false
						uni.stopPullDownRefresh()
					}
				})
			},
			handleRankData(html, requestUrl, reset) {
				const parsedPage = this.parseCurrentPage(html) || this.page
				const parsedTotalPage = this.parseTotalPage(html)
				this.page = parsedPage
				const rows = this.parseRankItems(html)
				this.mergeItems(rows, reset || parsedPage === 1)
				this.nextPageUrl = this.extractNextPageUrl(html, requestUrl)
				if (parsedTotalPage) {
					this.totalPage = Math.max(parsedTotalPage, this.page)
				} else {
					this.totalPage = this.nextPageUrl ? this.page + 1 : this.page
				}
				this.status = this.page < this.totalPage ? 'more' : 'noMore'
				uni.setNavigationBarTitle({
					title: `${this.getActiveLabel()}排行`
				})
				console.log('[YAOHUO_RANK_PAGE]', JSON.stringify({
					stype: this.activeStype,
					page: this.page,
					count: rows.length,
					totalPage: this.totalPage,
					nextPageUrl: this.nextPageUrl
				}))
			},
			parseCurrentPage(html) {
				const match = stripHtml(html).match(/第\s*(\d{1,6})\s*\/\s*\d{1,6}\s*页/)
				return match ? Number(match[1]) || 0 : 0
			},
			parseTotalPage(html) {
				const match = stripHtml(html).match(/第\s*\d{1,6}\s*\/\s*(\d{1,6})\s*页/)
				return match ? Number(match[1]) || 0 : 0
			},
			parseRankItems(html) {
				const blocks = extractClassBlocks(html, 'rank-item')
				const rows = []
				blocks.forEach((block, index) => {
					if (/<[a-z0-9]+\b[^>]*class\s*=\s*(["'])[^"']*\brank-item\b[^"']*\bactive\b[^"']*\1/i.test(block)) {
						return
					}
					const row = this.parseRankItem(block, index)
					if (row && row.name) {
						rows.push(row)
					}
				})
				return rows
			},
			parseRankItem(block, index) {
				const nameBlock = extractClassBlocks(block, 'rank-name')[0] || block
				const linkMatch = nameBlock.match(/<a\b[^>]*href\s*=\s*(["'])([^"']+)\1[^>]*>([\s\S]*?)<\/a>/i)
				if (!linkMatch) {
					return null
				}
				const url = absoluteYaohuoUrl(getAttr(linkMatch[0], 'href') || linkMatch[2])
				const name = stripHtml(linkMatch[3]).replace(/\s+/g, ' ').trim()
				const valueBlock = extractClassBlocks(block, 'rank-value')[0] || block
				const rankBlock = extractClassBlocks(block, 'rank-number')[0] || ''
				const rankText = stripHtml(rankBlock)
				const rankMatch = rankText.match(/\d+/)
				const rank = rankMatch ? Number(rankMatch[0]) : ((this.page - 1) * PAGE_SIZE + index + 1)
				const labelMatch = valueBlock.match(/class\s*=\s*(["'])[^"']*\brank-value-label\b[^"']*\1[^>]*>([\s\S]*?)<\/div>/i)
				const numberMatch = valueBlock.match(/class\s*=\s*(["'])[^"']*\brank-value-number\b[^"']*\1[^>]*>([\s\S]*?)<\/div>/i)
				return {
					rank,
					name,
					userId: getQueryValue(url, 'touserid'),
					url,
					label: labelMatch ? stripHtml(labelMatch[2]) : this.getActiveLabel(),
					value: numberMatch ? stripHtml(numberMatch[2]) : ''
				}
			},
			mergeItems(rows, reset) {
				if (reset) {
					this.items = rows
					return
				}
				const seen = {}
				this.items.forEach(item => {
					seen[item.userId || item.url || item.rank] = true
				})
				const fresh = rows.filter(item => {
					const key = item.userId || item.url || item.rank
					if (seen[key]) {
						return false
					}
					seen[key] = true
					return true
				})
				this.items = this.items.concat(fresh)
			},
			formatRank(rank) {
				rank = Number(rank) || 0
				return rank > 3 ? `#${rank}` : String(rank || '')
			},
			formatValue(value) {
				const num = String(value || '').replace(/[^\d]/g, '')
				if (!num) {
					return String(value || '')
				}
				return num.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
			},
			openUser(item) {
				if (!item || !item.url) {
					return
				}
				if (navigateToNativeRoute(item.url)) {
					return
				}
				if (item.userId) {
					uni.navigateTo({
						url: `/pages/user/user?id=${encodeURIComponent(item.userId)}`
					})
				}
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

<style>
	page {
		background-color: #F3F3F3;
	}
</style>

<style lang="scss" scoped>
	.rank-page {
		padding: 20rpx;
		box-sizing: border-box;
	}

	.rank-tabs {
		position: sticky;
		top: 0;
		z-index: 9;
		padding: 6rpx;
		border-radius: 8px;
		background: #fff;
		display: flex;
		box-sizing: border-box;
	}

	.rank-tab {
		flex: 1;
		height: 62rpx;
		line-height: 62rpx;
		border-radius: 6px;
		text-align: center;
		color: #666;
		font-size: 14px;
	}

	.rank-tab.active {
		background: #07c160;
		color: #fff;
		font-weight: 600;
	}

	.rank-list {
		margin-top: 20rpx;
	}

	.rank-card {
		margin-bottom: 16rpx;
		padding: 20rpx;
		border-radius: 8px;
		background: #fff;
		display: flex;
		align-items: center;
		box-sizing: border-box;
	}

	.rank-no {
		width: 72rpx;
		height: 72rpx;
		border-radius: 36rpx;
		background: #f1f5f9;
		color: #64748b;
		display: flex;
		align-items: center;
		justify-content: center;
		flex: 0 0 auto;
		font-size: 14px;
		font-weight: 700;
	}

	.rank-no.gold {
		background: #f59e0b;
		color: #fff;
	}

	.rank-no.silver {
		background: #94a3b8;
		color: #fff;
	}

	.rank-no.bronze {
		background: #b45309;
		color: #fff;
	}

	.rank-user {
		min-width: 0;
		flex: 1;
		margin-left: 18rpx;
	}

	.rank-name-row {
		display: flex;
		align-items: center;
		min-width: 0;
	}

	.rank-name {
		min-width: 0;
		font-size: 16px;
		color: #222;
		line-height: 22px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.rank-id {
		margin-left: 10rpx;
		padding: 2rpx 8rpx;
		border-radius: 6px;
		background: #eef7f1;
		color: #07a85a;
		font-size: 11px;
		line-height: 16px;
		flex: 0 0 auto;
	}

	.rank-sub {
		margin-top: 8rpx;
		color: #888;
		font-size: 12px;
		line-height: 16px;
	}

	.rank-value {
		margin-left: 16rpx;
		min-width: 120rpx;
		text-align: right;
		display: flex;
		flex-direction: column;
		align-items: flex-end;
	}

	.rank-value-number {
		max-width: 170rpx;
		color: #222;
		font-size: 17px;
		line-height: 22px;
		font-weight: 700;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.rank-value-label {
		margin-top: 8rpx;
		color: #999;
		font-size: 12px;
		line-height: 16px;
	}

	.empty-state {
		margin-top: 160rpx;
		text-align: center;
		color: #999;
		font-size: 14px;
	}

	.rank-load-more {
		height: 72rpx;
	}
</style>
