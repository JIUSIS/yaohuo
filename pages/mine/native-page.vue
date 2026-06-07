<template>
	<view class="page">
		<view v-if="tip" class="tip">{{tip}}</view>

		<view v-if="pageType === 'album'" class="album-page">
			<view v-if="actionUrl" class="album-action" @click="openWeb(actionUrl)">
				<uni-icons type="plusempty" size="18" color="#07a85a"></uni-icons>
				<text>上传图片</text>
			</view>
			<view v-if="albumItems.length" class="album-grid">
				<view v-for="(item,index) in albumItems" :key="item.id || item.full || index" class="album-card"
					@click="previewAlbum(index)">
					<image class="album-image" :src="item.thumb || item.full" mode="aspectFill"></image>
					<text class="album-title">{{item.title || '相册图片'}}</text>
				</view>
			</view>
			<view v-else-if="!loading" class="empty">{{emptyText || '暂无相册图片'}}</view>
		</view>

		<view v-else-if="sections.length" class="section-list">
			<view v-for="(section,sectionIndex) in sections" :key="section.title + sectionIndex" class="card section-card">
				<view v-if="section.title" class="section-heading">{{section.title}}</view>
				<view v-for="(row,rowIndex) in section.rows" :key="rowIndex" class="section-row"
					:class="{clickable: !!row.url}" @click="openItem(row)">
					<view class="section-row-main">
						<text v-if="row.title" class="section-row-title">{{row.title}}</text>
						<text v-if="row.desc" class="section-row-desc">{{row.desc}}</text>
						<view v-if="row.images && row.images.length" class="inline-images">
							<image v-for="img in row.images" :key="img" class="inline-image" :src="img" mode="aspectFit"></image>
						</view>
					</view>
					<uni-icons v-if="row.url" type="arrowright" size="17" color="#b6c1bb"></uni-icons>
				</view>
			</view>
		</view>

		<view v-else-if="items.length" class="card list-card">
			<view v-for="(item,index) in items" :key="index" class="list-row" @click="openItem(item)">
				<view class="row-main">
					<text class="row-title">{{item.title}}</text>
					<text v-if="item.desc" class="row-desc">{{item.desc}}</text>
				</view>
				<uni-icons v-if="item.url" type="arrowright" size="17" color="#b6c1bb"></uni-icons>
			</view>
		</view>
		<view v-else-if="paragraphs.length" class="card content-card">
			<text v-for="(line,index) in paragraphs" :key="index" class="paragraph">{{line}}</text>
		</view>
		<view v-else-if="!loading" class="empty">{{emptyText || '暂无内容'}}</view>
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
		stripHtml,
		getAttr
	} from '@/utils/html.js'
	import {
		navigateToNativePost,
		navigateToNativeRoute
	} from '@/utils/route.js'

	export default {
		data() {
			return {
				title: '',
				url: '',
				tip: '',
				pageType: '',
				items: [],
				sections: [],
				albumItems: [],
				paragraphs: [],
				actionUrl: '',
				emptyText: '',
				loading: false
			}
		},
		onLoad(option) {
			option = option || {}
			this.title = option.title ? decodeURIComponent(option.title) : ''
			this.url = option.url ? decodeURIComponent(option.url) : ''
			uni.setNavigationBarTitle({
				title: this.title || '详情'
			})
			this.fetchData()
		},
		onPullDownRefresh() {
			this.fetchData()
		},
		methods: {
			fetchData() {
				if (!this.url || this.loading) {
					return
				}
				this.loading = true
				uni.request({
					url: absoluteYaohuoUrl(this.url),
					header: getAuthHeader(),
					success: res => {
						const html = String(res.data || '')
						if (isLoginRequiredHtml(html)) {
							return this.goLogin()
						}
						const parsed = this.parsePage(html)
						this.pageType = parsed.pageType || ''
						this.tip = parsed.tip
						this.items = parsed.items || []
						this.sections = parsed.sections || []
						this.albumItems = parsed.albumItems || []
						this.paragraphs = parsed.paragraphs || []
						this.actionUrl = parsed.actionUrl || ''
						this.emptyText = parsed.emptyText || ''
						if (parsed.title) {
							uni.setNavigationBarTitle({
								title: parsed.title
							})
						}
					},
					fail: () => {
						uni.showToast({
							title: '加载失败',
							icon: 'none'
						})
					},
					complete: () => {
						this.loading = false
						uni.stopPullDownRefresh()
					}
				})
			},
			parsePage(html) {
				const rawSource = String(html || '')
				const source = this.getBodySource(rawSource)
				const title = this.cleanText((rawSource.match(/<title>([\s\S]*?)<\/title>/i) || [])[1] || this.title)
					.replace(/\s*-\s*妖火网\s*$/, '')
				const pageType = this.detectPageType(title)
				const base = {
					pageType,
					title: title || this.title,
					tip: this.cleanText((source.match(/<div\b[^>]*class\s*=\s*(["'])[^"']*tip[^"']*\1[^>]*>([\s\S]*?)<\/div>/i) || [])[2] || ''),
					items: [],
					sections: [],
					albumItems: [],
					paragraphs: [],
					actionUrl: '',
					emptyText: ''
				}
				if (pageType === 'album') {
					return Object.assign(base, this.parseAlbumPage(source))
				}
				if (pageType === 'rule') {
					return Object.assign(base, {
						sections: this.parseDivSections(source, false, title)
					})
				}
				if (pageType === 'clan') {
					return Object.assign(base, this.parseClanPage(source))
				}
				if (pageType === 'favorite') {
					return Object.assign(base, this.parseFavoritePage(source))
				}
				return Object.assign(base, this.parseGenericPage(source, title))
			},
			detectPageType(title) {
				const url = String(this.url || '')
				if (/\/album\/albumlist\.aspx/i.test(url)) {
					return 'album'
				}
				if (/\/clan\/main\.aspx/i.test(url)) {
					return 'clan'
				}
				if (/\/bbs\/favlist\.aspx/i.test(url)) {
					return 'favorite'
				}
				if (/\/bbs\/(?:tomoneyinfo|tolvlinfo|totimeinfo)\.aspx/i.test(url) ||
					/规则/.test(String(title || ''))) {
					return 'rule'
				}
				return 'generic'
			},
			parseGenericPage(source, title) {
				const items = this.parseLinks(source)
				const paragraphs = this.cleanText(source)
					.split(/\s{2,}|\n+/)
					.map(item => item.trim())
					.filter(item => item && !this.isNoiseText(item) && !this.isHtmlFragmentText(item) && item !== title)
					.slice(0, 80)
				return {
					items,
					paragraphs
				}
			},
			parseFavoritePage(source) {
				const items = this.parseLinks(source).filter(item => !this.isNavigationLink(item.title, item.url))
				const empty = /暂无收藏记录/.test(source) ? '暂无收藏记录' : ''
				return {
					items,
					emptyText: empty || (items.length ? '' : '暂无收藏记录')
				}
			},
			parseClanPage(source) {
				const sections = this.parseDivSections(source, true, '家族首页')
					.map(section => Object.assign({}, section, {
						rows: (section.rows || []).filter(row => !this.isNavigationLink(row.title, row.url))
					}))
					.filter(section => section.rows.length)
				return {
					sections,
					emptyText: sections.length ? '' : '暂无家族内容'
				}
			},
			parseAlbumPage(source) {
				const uploadTag = (source.match(/<button\b[^>]*id\s*=\s*(["'])albumUploadButton\1[^>]*>/i) ||
					source.match(/<[^>]+\bdata-upload-url\s*=/i) || [])[0] || ''
				const actionUrl = getAttr(uploadTag, 'data-upload-url')
				const albumItems = []
				const seen = {}
				const reg = /<button\b(?=[^>]*photo-card-trigger)([^>]*)>([\s\S]*?)<\/button>/ig
				let match
				while ((match = reg.exec(String(source || '')))) {
					const button = match[0]
					const body = match[2] || ''
					const imgTag = (body.match(/<img\b[^>]*>/i) || [])[0] || ''
					const full = this.resolveUrl(getAttr(button, 'data-full-src'), this.url)
					const thumb = this.resolveUrl(getAttr(imgTag, 'src'), this.url)
					const id = getAttr(button, 'data-image-id')
					const title = this.cleanText((body.match(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/i) || [])[1] ||
						getAttr(imgTag, 'alt') || '相册图片')
					const key = full || thumb || id
					if (!key || seen[key]) {
						continue
					}
					seen[key] = true
					albumItems.push({
						id,
						title,
						thumb,
						full: full || thumb
					})
				}
				return {
					albumItems,
					actionUrl: actionUrl ? this.resolveUrl(actionUrl, this.url) : '',
					emptyText: albumItems.length ? '' : '暂无相册图片'
				}
			},
			parseDivSections(source, allowLinks, pageTitle) {
				const sections = []
				let current = {
					title: '',
					rows: []
				}
				const reg = /<div\b[^>]*class\s*=\s*(["'])([^"']*)\1[^>]*>([\s\S]*?)<\/div>/ig
				let match
				while ((match = reg.exec(String(source || '')))) {
					const className = String(match[2] || '')
					const body = match[3] || ''
					if (/\b(?:title|subtitle)\b/i.test(className)) {
						if (current.rows.length) {
							sections.push(current)
						}
						current = {
							title: '',
							rows: []
						}
						const heading = this.cleanText(body).replace(/^首页[>＞]\s*/, '').trim()
						if (heading && !this.shouldSkipHeading(heading, pageTitle)) {
							current.title = heading
						}
						continue
					}
					if (/\bcontent\b/i.test(className)) {
						const rows = this.parseHtmlLineRows(body, allowLinks)
						if (rows.length) {
							current.rows = current.rows.concat(rows)
						}
					}
				}
				if (current.rows.length) {
					sections.push(current)
				}
				return sections
			},
			shouldSkipHeading(heading, pageTitle) {
				heading = String(heading || '').trim()
				pageTitle = String(pageTitle || this.title || '').trim()
				if (!heading) {
					return true
				}
				if (heading === pageTitle || heading === this.title) {
					return true
				}
				return /^首页[>＞]/.test(heading) || /返回/.test(heading)
			},
			parseHtmlLineRows(html, allowLinks) {
				const rows = []
				const chunks = String(html || '')
					.replace(/<hr\b[^>]*\/?>/ig, '<br>')
					.split(/<br\s*\/?>/i)
				chunks.forEach(chunk => {
					this.parseSingleHtmlLine(chunk, allowLinks).forEach(row => {
						if (row && (row.title || row.desc || row.images && row.images.length)) {
							rows.push(row)
						}
					})
				})
				return rows
			},
			parseSingleHtmlLine(chunk, allowLinks) {
				const text = this.cleanText(chunk).replace(/\s+/g, ' ').trim()
				const images = this.extractImages(chunk)
				if (!text && !images.length) {
					return []
				}
				if (this.isNoiseText(text) || this.isHtmlFragmentText(text)) {
					return []
				}
				if (allowLinks) {
					const links = this.parseInlineLinks(chunk).filter(link => !this.isNavigationLink(link.text, link.url))
					if (links.length > 1) {
						return links.map(link => ({
							title: link.text,
							desc: '',
							url: link.url,
							images: []
						}))
					}
					if (links.length === 1) {
						const desc = this.cleanDesc(text, links[0].text)
						return [{
							title: links[0].text || text,
							desc,
							url: links[0].url,
							images
						}]
					}
				}
				return [{
					title: text,
					desc: '',
					url: '',
					images
				}]
			},
			parseInlineLinks(html) {
				const result = []
				const reg = /<a\b[^>]*href\s*=\s*(["'])([\s\S]*?)\1[^>]*>([\s\S]*?)<\/a>/ig
				let match
				while ((match = reg.exec(String(html || '')))) {
					const text = this.cleanText(match[3]).replace(/\s+/g, ' ').trim()
					const url = this.resolveUrl(getAttr(match[0], 'href'), this.url)
					if (text && url) {
						result.push({
							text,
							url
						})
					}
				}
				return result
			},
			extractImages(html) {
				const images = []
				const seen = {}
				const reg = /<img\b[^>]*>/ig
				let match
				while ((match = reg.exec(String(html || '')))) {
					const src = getAttr(match[0], 'src') || getAttr(match[0], 'data-src')
					const url = this.resolveUrl(src, this.url)
					if (!url || /^data:/i.test(url) || seen[url]) {
						continue
					}
					seen[url] = true
					images.push(url)
				}
				return images
			},
			cleanDesc(text, title) {
				const desc = String(text || '').replace(String(title || ''), '').replace(/^[\s:：\-|]+/, '').trim()
				return desc === text ? '' : desc
			},
			getBodySource(html) {
				let source = String(html || '')
					.replace(/<script[\s\S]*?<\/script>/ig, '')
					.replace(/<style[\s\S]*?<\/style>/ig, '')
					.replace(/<!--[\s\S]*?-->/g, '')
				const body = source.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)
				source = body ? body[1] : source.replace(/<head[\s\S]*?<\/head>/ig, '')
				return source
			},
			parseLinks(html) {
				const result = []
				const seen = {}
				const reg = /<a\b[^>]*href\s*=\s*(["'])([\s\S]*?)\1[^>]*>([\s\S]*?)<\/a>/ig
				let match
				while ((match = reg.exec(String(html || '')))) {
					const href = getAttr(match[0], 'href')
					const text = this.cleanText(match[3])
					if (!href || !text || this.isNoiseText(text) || this.isHtmlFragmentText(text)) {
						continue
					}
					const url = this.resolveUrl(href, this.url)
					if (this.isNavigationLink(text, url)) {
						continue
					}
					const key = text + '|' + url
					if (seen[key]) {
						continue
					}
					seen[key] = true
					const desc = this.getNearText(html, match.index, text)
					result.push({
						title: text,
						desc,
						url
					})
				}
				return result.slice(0, 120)
			},
			getNearText(html, index, title) {
				const block = this.getContextBlock(html, index)
				const text = this.cleanText(block || String(html || '').slice(Math.max(0, index - 80), index + 220))
					.replace(title, '')
					.replace(/^(首页|论坛|我的地盘|返回上级|返回首页)\s*/, '')
					.trim()
				if (this.isHtmlFragmentText(text)) {
					return ''
				}
				return text.length > 8 && text.length < 90 ? text : ''
			},
			getContextBlock(html, index) {
				html = String(html || '')
				const tags = ['div', 'li', 'p', 'tr', 'section']
				let bestStart = -1
				let bestTag = ''
				tags.forEach(tag => {
					const start = html.lastIndexOf('<' + tag, index)
					if (start > bestStart && index - start < 900) {
						bestStart = start
						bestTag = tag
					}
				})
				if (bestStart < 0 || !bestTag) {
					return ''
				}
				const end = html.indexOf('</' + bestTag + '>', index)
				return end > bestStart ? html.slice(bestStart, end + bestTag.length + 3) : ''
			},
			cleanText(html) {
				return stripHtml(String(html || '').replace(/<br\s*\/?>/ig, '\n'))
					.replace(/\r/g, '')
					.replace(/<!--|-->/g, ' ')
					.replace(/\b(?:html|head|body|main|div|span|a|button|form|input|select|option|section|nav|header|footer|i)\b[^<>\n]{0,120}>/ig, ' ')
					.replace(/\b(?:class|href|id|style|type|onclick|src|siteid|classid|backurl)\s*=\s*["']?[^"'\s<>]{0,160}["']?/ig, ' ')
					.replace(/<\/?[a-z][a-z0-9-]*[^<>\n]{0,120}/ig, ' ')
					.replace(/[<>]/g, ' ')
					.replace(/[ \t]+/g, ' ')
					.replace(/\n{3,}/g, '\n\n')
					.trim()
			},
			isNoiseText(text) {
				return /^(首页|论坛|返回|返回上级|返回首页|返回来源页|我的地盘|我的收藏夹|我的相册|登录|注册|搜索|上一页|下一页)$/i.test(String(text || '').trim())
			},
			isHtmlFragmentText(text) {
				text = String(text || '').trim()
				if (!text) {
					return false
				}
				return /(?:<!--|-->|<\/|<|>|["']\s*$|\b(?:class|href|style|onclick|src|type|siteid|classid|backurl)\s*=|\b(?:html|head|body|main|div|span|button|form|input|select|option|section|nav|header|footer)\b\s*>?$|fa-[a-z-]+)/i.test(text)
			},
			resolveUrl(url, baseUrl) {
				url = decodeHtml(String(url || '')).trim()
				if (!url) {
					return ''
				}
				if (/^(?:data:|https?:\/\/)/i.test(url)) {
					return url
				}
				if (url.indexOf('//') === 0) {
					return 'https:' + url
				}
				if (url[0] === '/') {
					return absoluteYaohuoUrl(url)
				}
				const base = absoluteYaohuoUrl(baseUrl || this.url || '')
				const basePath = base.split('#')[0].split('?')[0]
				const dir = basePath.replace(/\/[^/]*$/, '/')
				return dir + url.replace(/^\.?\//, '')
			},
			normalizeComparableUrl(url) {
				url = this.resolveUrl(url, this.url).split('#')[0]
				try {
					url = decodeURIComponent(url)
				} catch (e) {}
				return url.replace(/([?&])backurl=[^&#]*/ig, '$1')
					.replace(/([?&])siteid=1000(?:&|$)/ig, '$1')
					.replace(/[?&]+$/, '')
					.replace(/\/$/, '')
					.toLowerCase()
			},
			isSameUrl(url, otherUrl) {
				return !!url && !!otherUrl && this.normalizeComparableUrl(url) === this.normalizeComparableUrl(otherUrl)
			},
			isNavigationLink(text, url) {
				text = String(text || '').trim()
				if (this.isNoiseText(text) || /^返回/.test(text)) {
					return true
				}
				if (this.isSameUrl(url, this.url)) {
					return true
				}
				return /\/myfile\.aspx/i.test(String(url || '')) && /我的|返回|收藏夹|相册/.test(text)
			},
			previewAlbum(index) {
				const urls = (this.albumItems || []).map(item => item.full || item.thumb).filter(Boolean)
				if (!urls.length) {
					return
				}
				uni.previewImage({
					current: urls[index] || urls[0],
					urls
				})
			},
			openItem(item) {
				if (!item || !item.url) {
					return
				}
				if (this.isNavigationLink(item.title, item.url)) {
					return
				}
				if (navigateToNativePost(item.url)) {
					return
				}
				if (navigateToNativeRoute(item.url)) {
					return
				}
				this.openWeb(item.url)
			},
			openWeb(url) {
				if (!url) {
					return
				}
				uni.navigateTo({
					url: `/pages/webview/webview?url=${encodeURIComponent(this.resolveUrl(url, this.url))}`
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
		background: #f4f6f5;
	}

	.page {
		padding: 18rpx;
		box-sizing: border-box;
	}

	.card {
		background: #fff;
		border-radius: 8px;
		overflow: hidden;
		box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, .04);
	}

	.section-list {
		display: flex;
		flex-direction: column;
		gap: 18rpx;
	}

	.section-card {
		padding: 0 22rpx;
	}

	.section-heading {
		min-height: 76rpx;
		display: flex;
		align-items: center;
		border-bottom: 1px solid #edf1ef;
		color: #07a85a;
		font-size: 15px;
		font-weight: 700;
		box-sizing: border-box;
	}

	.section-row {
		min-height: 82rpx;
		padding: 16rpx 0;
		border-bottom: 1px dashed #edf1ef;
		display: flex;
		align-items: center;
		box-sizing: border-box;
	}

	.section-row:last-child {
		border-bottom: none;
	}

	.section-row.clickable {
		min-height: 92rpx;
	}

	.section-row-main {
		min-width: 0;
		flex: 1;
	}

	.section-row-title {
		display: block;
		color: #18342b;
		font-size: 14px;
		line-height: 21px;
		word-break: break-word;
	}

	.section-row-desc {
		display: block;
		margin-top: 6rpx;
		color: #7a8781;
		font-size: 12px;
		line-height: 18px;
		word-break: break-word;
	}

	.inline-images {
		margin-top: 8rpx;
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 8rpx;
	}

	.inline-image {
		width: 38rpx;
		height: 38rpx;
	}

	.album-action {
		height: 82rpx;
		margin-bottom: 18rpx;
		padding: 0 22rpx;
		border-radius: 8px;
		background: #fff;
		display: flex;
		align-items: center;
		color: #07a85a;
		font-size: 15px;
		font-weight: 700;
		box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, .04);
		box-sizing: border-box;
	}

	.album-action text {
		margin-left: 10rpx;
	}

	.album-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 16rpx;
	}

	.album-card {
		min-width: 0;
		border-radius: 8px;
		background: #fff;
		overflow: hidden;
		box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, .04);
	}

	.album-image {
		width: 100%;
		height: 318rpx;
		display: block;
		background: #eef2f0;
	}

	.album-title {
		height: 62rpx;
		padding: 0 14rpx;
		display: block;
		color: #263a32;
		font-size: 13px;
		line-height: 62rpx;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		box-sizing: border-box;
	}

	.tip {
		margin-bottom: 16rpx;
		padding: 16rpx;
		border-radius: 8px;
		background: #eaf8f1;
		color: #087f77;
		font-size: 14px;
	}

	.list-row {
		min-height: 88rpx;
		padding: 18rpx 20rpx;
		border-bottom: 1px solid #edf1ef;
		display: flex;
		align-items: center;
		box-sizing: border-box;
	}

	.list-row:last-child {
		border-bottom: none;
	}

	.row-main {
		min-width: 0;
		flex: 1;
	}

	.row-title {
		display: block;
		color: #18342b;
		font-size: 15px;
		font-weight: 600;
		word-break: break-word;
	}

	.row-desc {
		display: block;
		margin-top: 6rpx;
		color: #7a8781;
		font-size: 12px;
		line-height: 18px;
	}

	.content-card {
		padding: 22rpx 20rpx;
	}

	.paragraph {
		display: block;
		margin-bottom: 16rpx;
		color: #21352d;
		font-size: 14px;
		line-height: 22px;
		word-break: break-word;
	}

	.empty {
		padding: 120rpx 0;
		text-align: center;
		color: #999;
	}
</style>
