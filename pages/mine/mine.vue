<template>
	<view class="mine-page">
		<view class="card profile-card">
			<view class="profile-main">
				<image v-if="profile.avatar" class="avatar" :src="profile.avatar" mode="aspectFill"></image>
				<view v-else class="avatar avatar-placeholder">
					<image src="https://yaohuo.me/tupian/yaohuo.png" mode="aspectFit"></image>
				</view>
				<view class="profile-text">
					<view class="name-row">
						<text class="nickname">{{profile.name || '妖火用户'}}</text>
						<image v-if="profile.levelIcon" class="level-icon" :src="profile.levelIcon" mode="aspectFit"></image>
						<text v-if="profile.level" class="level-chip">{{profile.level}}</text>
					</view>
					<view class="id-chip">ID: {{profile.id || '--'}}</view>
				</view>
				<view class="edit-link" @click="showEditActions">
					<uni-icons type="compose" size="17" color="#666"></uni-icons>
					<text>编辑</text>
				</view>
			</view>

			<view class="stat-grid">
				<view class="stat-tile" v-for="item in statTiles" :key="item.label" @click="openMenu(item)">
					<text class="stat-value">{{item.value || '--'}}</text>
					<text class="stat-label">{{item.label}}</text>
				</view>
			</view>

			<view class="exp-row">
				<view class="exp-meta">
					<text>经验值: {{profile.exp || '--'}}</text>
					<text class="level-text">{{profile.level || '--'}}</text>
				</view>
				<view class="progress-track">
					<view class="progress-bar" :style="{width: levelProgress + '%'}"></view>
				</view>
			</view>
		</view>
		<view class="profile-card-spacer"></view>

		<view class="card section-card">
			<view class="section-title">
				<uni-icons type="wallet" size="20" color="#07c160"></uni-icons>
				<text>我的资产</text>
			</view>
			<view class="info-row" v-for="item in assetRows" :key="item.title" @click="openMenu(item)">
				<view class="row-left">
					<uni-icons :type="item.icon" size="18" color="#888"></uni-icons>
					<text>{{item.title}}</text>
				</view>
				<view class="row-right">
					<text class="row-value">{{item.value || '--'}}</text>
					<text v-if="item.actionText" class="row-action">{{item.actionText}}</text>
				</view>
			</view>
		</view>

		<view class="card section-card">
			<view class="section-title">
				<uni-icons type="person-filled" size="20" color="#07c160"></uni-icons>
				<text>个人信息</text>
			</view>
			<view class="info-row" v-for="item in infoRows" :key="item.title" @click="openMenu(item)">
				<view class="row-left">
					<uni-icons :type="item.icon" size="18" color="#888"></uni-icons>
					<text>{{item.title}}</text>
				</view>
				<view class="row-right">
					<text class="row-value">{{item.value || '--'}}</text>
					<text v-if="item.actionText" class="row-action">{{item.actionText}}</text>
				</view>
			</view>
		</view>

		<view class="card section-card medals-card">
			<view class="section-title">
				<uni-icons type="medal" size="20" color="#07c160"></uni-icons>
				<text>我的勋章</text>
			</view>
			<view v-if="profile.medals && profile.medals.length" class="medal-list">
				<image v-for="item in profile.medals" :key="item" class="medal-image" :src="item" mode="aspectFit"></image>
			</view>
			<view v-else class="empty-line">暂无勋章</view>
		</view>

		<view class="card section-card">
			<view class="section-title">
				<uni-icons type="map" size="20" color="#07c160"></uni-icons>
				<text>我的内容</text>
			</view>
			<view class="content-grid">
				<view class="content-tile" v-for="item in contentTiles" :key="item.title" @click="openMenu(item)">
					<uni-icons :type="item.icon" size="23" color="#777"></uni-icons>
					<text>{{item.title}}</text>
				</view>
			</view>
		</view>

		<view class="card section-card">
			<view class="section-title">
				<uni-icons type="info" size="20" color="#07c160"></uni-icons>
				<text>网站规则</text>
			</view>
			<view class="rule-row" v-for="item in ruleRows" :key="item.title" @click="openMenu(item)">
				<text>{{item.title}}</text>
				<uni-icons type="arrowright" size="17" color="#bbb"></uni-icons>
			</view>
		</view>

		<button class="logout-btn" @click="confirmLogout">
			<uni-icons type="paperplane" size="18" color="#fff"></uni-icons>
			<text>安全退出</text>
		</button>
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
		extractClassBlocks,
		getAttr,
		stripHtml
	} from '@/utils/html.js'
	import {
		openInBrowser
	} from '@/utils/browser.js'
	import {
		navigateToNativePost,
		navigateToNativeRoute
	} from '@/utils/route.js'

	export default {
		data() {
			return {
				loading: false,
				profile: {
					id: '',
					name: '',
					level: '',
					levelIcon: '',
					title: '',
					avatar: '',
					coin: '',
					rmb: '',
					exp: '',
					mailbox: '',
					friendCount: '',
					postCount: '',
					replyCount: '',
					identity: '',
					expire: '',
					medals: [],
					links: []
				}
			}
		},
		computed: {
			userId() {
				return this.profile.id || uni.getStorageSync('yaohuoUserId') || ''
			},
			editUrl() {
				return this.findLink(['编辑', '资料']) || this.findLink(['资料设置']) || 'https://yaohuo.me/bbs/userinfo_edit.aspx'
			},
			levelProgress() {
				const exp = Number(String(this.profile.exp || '').replace(/[^\d]/g, ''))
				if (!exp) {
					return 0
				}
				return Math.max(8, Math.min(100, Math.round((exp % 10000) / 100)))
			},
			statTiles() {
				const id = this.userId
				return [{
					label: '信箱',
					value: this.profile.mailbox,
					nativeUrl: '/pages/message/message'
				}, {
					label: '好友',
					value: this.profile.friendCount,
					nativeUrl: '/pages/friends/friends?type=0',
					webUrl: this.findLink(['好友']) || 'https://yaohuo.me/bbs/FriendList.aspx?friendtype=0'
				}, {
					label: '帖子',
					value: this.profile.postCount,
					nativeUrl: id ? `/pages/bbsList/bbsList?url=${encodeURIComponent(JSON.stringify({url: `https://yaohuo.me/bbs/book_list_search.aspx?action=search&siteid=1000&classid=0&type=pub&key=${id}`}))}` : '',
					webUrl: id ? `https://yaohuo.me/bbs/book_list_search.aspx?action=search&siteid=1000&classid=0&type=pub&key=${id}` :
						(this.findLink(['帖子']) || 'https://yaohuo.me/myfile.aspx')
				}, {
					label: '回复',
					value: this.profile.replyCount,
					nativeUrl: id ? `/pages/replies/replies?userId=${id}` : '',
					webUrl: id ? `https://yaohuo.me/bbs/book_re_my.aspx?action=class&touserid=${id}` : (this.findLink(['回复']) ||
						'https://yaohuo.me/myfile.aspx')
				}]
			},
			assetRows() {
				return [{
					title: '我的妖晶',
					icon: 'medal',
					value: this.profile.coin,
					actionText: '明细',
					nativeUrl: this.buildNativePageRoute('妖晶明细', this.findLink(['妖晶', '明细']) || this.findLink(['明细']) ||
						`https://yaohuo.me/bbs/banklist.aspx?key=${this.userId}`)
				}, {
					title: '我的RMB',
					icon: 'wallet',
					value: this.profile.rmb || '¥0.00',
					actionText: '充值',
					webUrl: this.findLink(['充值']) || 'https://yaohuo.me/myfile.aspx'
				}]
			},
			infoRows() {
				return [{
					title: '我的身份',
					icon: 'contact',
					value: this.profile.identity || '普通会员'
				}, {
					title: '有效期至',
					icon: 'calendar',
					value: this.profile.expire || '无限期',
					actionText: '开通VIP',
					webUrl: this.findLink(['VIP']) || 'https://yaohuo.me/myfile.aspx'
				}]
			},
			contentTiles() {
				return [{
					title: '我的收藏',
					icon: 'star',
					nativeUrl: this.buildNativePageRoute('我的收藏', this.findLink(['收藏']) || 'https://yaohuo.me/bbs/favlist.aspx')
				}, {
					title: '我的相册',
					icon: 'images',
					nativeUrl: this.buildNativePageRoute('我的相册', this.findLink(['相册']) ||
						`https://yaohuo.me/album/albumlist.aspx?touserid=${this.userId}`)
				}, {
					title: '我的家族',
					icon: 'personadd',
					nativeUrl: this.buildNativePageRoute('我的家族', this.findLink(['家族']) || 'https://yaohuo.me/clan/main.aspx')
				}, {
					title: '黑名单',
					icon: 'locked',
					nativeUrl: '/pages/friends/friends?type=1',
					webUrl: this.findLink(['黑名单']) || 'https://yaohuo.me/bbs/FriendList.aspx?friendtype=1'
				}]
			},
			ruleRows() {
				return [{
					title: '妖晶获取消费规则',
					nativeUrl: this.buildNativePageRoute('妖晶获取消费规则', this.findLink(['妖晶', '规则']) ||
						'https://yaohuo.me/bbs/tomoneyinfo.aspx')
				}, {
					title: '经验头衔等级规则',
					nativeUrl: this.buildNativePageRoute('经验头衔等级规则', this.findLink(['经验', '规则']) ||
						'https://yaohuo.me/bbs/tolvlinfo.aspx')
				}, {
					title: '在线时间图标规则',
					nativeUrl: this.buildNativePageRoute('在线时间图标规则', this.findLink(['在线', '规则']) ||
						'https://yaohuo.me/bbs/totimeinfo.aspx')
				}]
			}
		},
		onLoad() {
			uni.setNavigationBarTitle({
				title: '我的地盘'
			})
			this.fetchProfile()
		},
		onPullDownRefresh() {
			this.fetchProfile()
		},
		methods: {
			refreshProfile() {
				this.fetchProfile()
			},
			fetchProfile() {
				if (this.loading) {
					return
				}
				this.loading = true
				uni.showLoading({
					title: '加载资料'
				})
				uni.request({
					url: 'https://yaohuo.me/myfile.aspx',
					header: getAuthHeader(),
					success: res => {
						const html = String(res.data || '')
						if (isLoginRequiredHtml(html)) {
							return this.goLogin()
						}
						const profile = this.parseProfile(html)
						this.profile = Object.assign({}, this.profile, profile)
						if (profile.id) {
							uni.setStorageSync('yaohuoUserId', profile.id)
						}
					},
					fail: () => {
						uni.showToast({
							title: '资料加载失败',
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
			parseProfile(html) {
				const source = String(html || '')
				const text = stripHtml(source).replace(/\s+/g, ' ').trim()
				const id = this.extractUserId(source, text)
				const links = this.extractLinks(source)
				const levelIcon = this.extractLevelIcon(source)
				return {
					id,
					name: this.extractName(source, text, id),
					level: this.extractByPatterns(text, [
						/(?:等级|级别)\s*[:：]?\s*([0-9]+级[^\s]*)/,
						/([0-9]+级[^\s\])）]*)/
					]),
					levelIcon,
					title: this.extractByPatterns(text, [
						/(?:头衔|称号)\s*[:：]?\s*([^\s\[\]【】()（）]{1,16})/,
						/[（(]([^\s()（）]{2,16})[)）]/
					]),
					avatar: this.extractAvatar(source),
					coin: this.extractNumber(text, ['妖晶', '金币', '金钱', '余额']),
					rmb: this.extractMoney(text, ['RMB', '人民币']),
					exp: this.extractNumber(text, ['经验值', '经验']),
					mailbox: this.extractProfileCount(source, text, links, ['信箱', '邮箱']),
					friendCount: this.extractProfileCount(source, text, links, ['好友']),
					postCount: this.extractProfileCount(source, text, links, ['帖子', '主题', '发帖']),
					replyCount: this.extractProfileCount(source, text, links, ['回复', '回帖']),
					identity: this.extractTextValue(text, ['我的身份', '身份']),
					expire: this.extractTextValue(text, ['有效期至', '有效期', '到期']),
					medals: this.extractMedals(source, levelIcon),
					links
				}
			},
			extractLinks(html) {
				const links = []
				const reg = /<a\b[^>]*href\s*=\s*(["'])([\s\S]*?)\1[^>]*>([\s\S]*?)<\/a>/ig
				let match
				while ((match = reg.exec(String(html || '')))) {
					const text = stripHtml(match[3]).replace(/\s+/g, ' ').trim()
					const href = absoluteYaohuoUrl(match[2])
					if (text && href) {
						links.push({
							text,
							href
						})
					}
				}
				return links
			},
			findLink(words) {
				const links = this.profile.links || []
				return (links.find(link => words.every(word => link.text.indexOf(word) > -1)) || {}).href || ''
			},
			buildNativePageRoute(title, url) {
				return `/pages/mine/native-page?title=${encodeURIComponent(title)}&url=${encodeURIComponent(absoluteYaohuoUrl(url))}`
			},
			extractUserId(html, text) {
				const patterns = [
					/userinfo\.aspx\?touserid=(\d+)/i,
					/book_re_my\.aspx[^"']*[?&]touserid=(\d+)/i,
					/book_list\.aspx[^"']*[?&]key=(\d+)[^"']*[?&]type=pub/i,
					/\bID\s*[:：]?\s*(\d+)/i,
					/用户ID\s*[:：]?\s*(\d+)/i
				]
				for (let i = 0; i < patterns.length; i++) {
					const match = String(html || '').match(patterns[i]) || String(text || '').match(patterns[i])
					if (match) {
						return match[1]
					}
				}
				return ''
			},
			extractName(html, text, id) {
				if (id) {
					const reg = new RegExp(`<a\\b[^>]*href\\s*=\\s*(["'])[^"']*userinfo\\.aspx\\?touserid=${id}[^"']*\\1[^>]*>([\\s\\S]*?)<\\/a>`, 'i')
					const match = String(html || '').match(reg)
					const name = match ? stripHtml(match[2]) : ''
					if (this.isGoodName(name)) {
						return name
					}
				}
				const titleMatch = String(html || '').match(/<title>([\s\S]*?)<\/title>/i)
				const titleName = titleMatch ? stripHtml(titleMatch[1]).replace(/\s*-\s*妖火网.*/, '').replace(/的空间.*/, '')
					.trim() : ''
				if (this.isGoodName(titleName)) {
					return titleName
				}
				const name = this.extractByPatterns(text, [
					/(?:昵称|会员名|用户名|用户)\s*[:：]?\s*([^\s\[\]【】()（）]{1,24})/
				])
				return this.isGoodName(name) ? name : ''
			},
			isGoodName(name) {
				return !!name && !/^(首页|论坛|返回|我的|空间|用户|妖火网|登录|\d+)$/.test(String(name || '').trim())
			},
			extractAvatar(html) {
				const images = this.extractImageCandidates(html)
				const best = images.map(item => Object.assign({}, item, {
					score: this.scoreAvatar(item)
				})).filter(item => item.score >= 0).sort((a, b) => b.score - a.score)[0]
				return best ? absoluteYaohuoUrl(best.src) : ''
			},
			extractMedals(html, levelIcon) {
				const seen = {}
				const collect = source => this.extractImageCandidates(source)
					.map(item => absoluteYaohuoUrl(item.src))
					.filter(url => this.isMedalUrl(url, levelIcon))
					.filter(url => {
						if (!url || seen[url]) {
							return false
						}
						seen[url] = true
						return true
					})
				const medalBlocks = extractClassBlocks(html, 'xunzhangtupian')
					.concat(extractClassBlocks(html, 'rongyutupian'))
				let urls = medalBlocks.reduce((result, block) => result.concat(collect(block)), [])
				if (!urls.length) {
					urls = this.extractImageCandidates(html)
						.filter(item => this.isMedalIcon(item))
						.map(item => absoluteYaohuoUrl(item.src))
						.filter(url => this.isMedalUrl(url, levelIcon))
						.filter(url => {
							if (!url || seen[url]) {
								return false
							}
							seen[url] = true
							return true
						})
				}
				return urls.slice(0, 8)
			},
			extractLevelIcon(html) {
				const onlineBlocks = extractClassBlocks(html, 'online')
				for (let i = 0; i < onlineBlocks.length; i++) {
					const image = this.extractImageCandidates(onlineBlocks[i])
						.map(item => absoluteYaohuoUrl(item.src))
						.filter(url => url && !/\/NetImages\/on[01]\.gif|\/on[01]\.gif/i.test(url))[0]
					if (image) {
						return image
					}
				}
				const levelUrl = this.extractImageCandidates(html)
					.map(item => absoluteYaohuoUrl(item.src))
					.filter(url => /\/bbs\/medal\/t\d+\.gif(?:[?#].*)?$/i.test(url))[0]
				if (levelUrl) {
					return levelUrl
				}
				return this.extractImageCandidates(html)
					.filter(item => this.isLevelIcon(item))
					.map(item => absoluteYaohuoUrl(item.src))[0] || ''
			},
			isMedalUrl(url, levelIcon) {
				url = String(url || '')
				const level = String(levelIcon || '')
				if (!url || (level && url === level)) {
					return false
				}
				if (/online|on1\.gif|on0\.gif|favicon|logo|face\/|NetImages\/new/i.test(url)) {
					return false
				}
				if (/\/bbs\/medal\/t\d+\.gif(?:[?#].*)?$/i.test(url)) {
					return false
				}
				return true
			},
			isLevelIcon(item) {
				const text = `${item && item.tag || ''} ${item && item.context || ''} ${item && item.src || ''}`.toLowerCase()
				if (!text || /online|on1\.gif|on0\.gif|favicon|logo|face\/|netimages\/new/i.test(text)) {
					return false
				}
				return /等级|级别|头衔|level|grade|dengji|jibie|lv\d|\/lv\/|\/level\//i.test(text) ||
					(/badge/i.test(text) && !/荣誉|勋章|xunzhang|medal|rongyu|honor/i.test(text))
			},
			isMedalIcon(item) {
				const text = `${item && item.tag || ''} ${item && item.context || ''} ${item && item.src || ''}`.toLowerCase()
				if (!text || this.isLevelIcon(item)) {
					return false
				}
				return /荣誉|勋章|xunzhang|medal|rongyu|honor/i.test(text)
			},
			extractImageCandidates(html) {
				const images = []
				const reg = /<img\b[^>]*>/ig
				let match
				while ((match = reg.exec(String(html || '')))) {
					const tag = match[0]
					const src = getAttr(tag, 'src') || getAttr(tag, 'data-src')
					if (!src) {
						continue
					}
					const context = String(html || '').slice(Math.max(0, match.index - 180), match.index + 180)
					images.push({
						src,
						tag,
						context
					})
				}
				return images
			},
			scoreAvatar(item) {
				const raw = String(item.src || '')
				const text = `${item.tag} ${item.context} ${raw}`.toLowerCase()
				if (!raw || /\/face\/|favicon|logo|netcss\/img\/icon|honor|medal|level|badge|emoji|emotion|online|rongyu/i
					.test(text)) {
					return -1
				}
				let score = 0
				if (/头像|头象|avatar|userface|head|portrait|photo|faceimg|tx|touxiang/i.test(text)) {
					score += 8
				}
				if (/userinfo|user|space|myfile/i.test(text)) {
					score += 2
				}
				if (/\/bbs\/upload\/|\/upload\/|userface|avatar|head|portrait|photo/i.test(raw)) {
					score += 3
				}
				if (/\.(?:png|jpe?g|gif|webp|bmp)(?:[?#].*)?$/i.test(raw)) {
					score += 1
				}
				return score
			},
			extractByPatterns(text, patterns) {
				text = String(text || '')
				for (let i = 0; i < patterns.length; i++) {
					const match = text.match(patterns[i])
					if (match && match[1]) {
						return match[1].trim()
					}
				}
				return ''
			},
			extractNumber(text, labels) {
				text = String(text || '').replace(/,/g, '')
				for (let i = 0; i < labels.length; i++) {
					const label = labels[i]
					const reg = new RegExp(`${label}\\s*[:：]?\\s*([+-]?\\d+)`)
					const match = text.match(reg)
					if (match) {
						return match[1]
					}
				}
				return ''
			},
			extractCount(text, labels) {
				text = String(text || '').replace(/,/g, '')
				for (let i = 0; i < labels.length; i++) {
					const label = labels[i]
					const after = text.match(new RegExp(`${label}\\s*[:：]?\\s*(\\d+\\s*/\\s*\\d+|\\d+)`))
					if (after) {
						return after[1].replace(/\s+/g, '')
					}
					const before = text.match(new RegExp(`(\\d+\\s*/\\s*\\d+|\\d+)\\s*${label}`))
					if (before) {
						return before[1].replace(/\s+/g, '')
					}
				}
				return ''
			},
			extractProfileCount(html, text, links, labels) {
				const linkCount = this.extractCountFromLinks(links, labels)
				if (linkCount) {
					return linkCount
				}
				const nearbyCount = this.extractCountNearLabel(html, labels)
				if (nearbyCount) {
					return nearbyCount
				}
				return this.extractCount(text, labels)
			},
			extractCountFromLinks(links, labels) {
				links = links || []
				for (let i = 0; i < links.length; i++) {
					const item = links[i] || {}
					const text = String(item.text || '').replace(/,/g, '')
					if (!labels.some(label => text.indexOf(label) > -1)) {
						continue
					}
					const count = this.extractCountFromSegment(text, labels)
					if (count) {
						return count
					}
				}
				return ''
			},
			extractCountNearLabel(html, labels) {
				const source = String(html || '').replace(/<script[\s\S]*?<\/script>/ig, '').replace(/<style[\s\S]*?<\/style>/ig, '')
				const plain = stripHtml(source).replace(/\s+/g, ' ').replace(/,/g, '')
				for (let i = 0; i < labels.length; i++) {
					const label = labels[i]
					const index = plain.indexOf(label)
					if (index < 0) {
						continue
					}
					const start = Math.max(0, index - 24)
					const end = Math.min(plain.length, index + label.length + 40)
					const count = this.extractCountFromSegment(plain.slice(start, end), labels)
					if (count) {
						return count
					}
				}
				return ''
			},
			extractCountFromSegment(segment, labels) {
				const text = String(segment || '').replace(/\s+/g, '').replace(/,/g, '')
				for (let i = 0; i < labels.length; i++) {
					const label = this.escapeRegExp(labels[i])
					const after = text.match(new RegExp(`${label}[：:：\\(（\\[]?([0-9]+/[0-9]+|[0-9]+)`))
					if (after) {
						return after[1]
					}
					const before = text.match(new RegExp(`([0-9]+/[0-9]+|[0-9]+)[个条篇封]?${label}`))
					if (before) {
						return before[1]
					}
				}
				return ''
			},
			escapeRegExp(value) {
				return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
			},
			extractMoney(text, labels) {
				for (let i = 0; i < labels.length; i++) {
					const match = String(text || '').match(new RegExp(`${labels[i]}\\s*[:：]?\\s*(¥?\\d+(?:\\.\\d+)?)`, 'i'))
					if (match) {
						return match[1].indexOf('¥') === 0 ? match[1] : `¥${match[1]}`
					}
				}
				return ''
			},
			extractTextValue(text, labels) {
				for (let i = 0; i < labels.length; i++) {
					const match = String(text || '').match(new RegExp(`${labels[i]}\\s*[:：]?\\s*([^\\s|，,。；;]{1,18})`))
					if (match) {
						return match[1]
					}
				}
				return ''
			},
			openMenu(item) {
				if (!item) {
					return
				}
				if (item.nativeUrl) {
					return this.openNativeMenu(item)
				}
				if (item.browserUrl) {
					return openInBrowser(item.browserUrl)
				}
				this.openWeb(item.webUrl)
			},
			showEditActions() {
				uni.showActionSheet({
					itemList: ['修改资料', '更改密码', '更换头像'],
					success: res => {
						const items = [{
							mode: 'profile',
							title: '修改资料',
							url: 'https://yaohuo.me/bbs/EditProfile.aspx'
						}, {
							mode: 'password',
							title: '更改密码',
							url: 'https://yaohuo.me/bbs/ModifyPW.aspx'
						}, {
							mode: 'avatar',
							title: '更换头像',
							url: 'https://yaohuo.me/bbs/ModifyHead.aspx'
						}]
						this.openEditForm(items[res.tapIndex])
					}
				})
			},
			openEditForm(item) {
				if (!item) {
					return
				}
				uni.navigateTo({
					url: `/pages/mine/edit-form?mode=${encodeURIComponent(item.mode)}&title=${encodeURIComponent(item.title)}&url=${encodeURIComponent(item.url)}`
				})
			},
			openNativeMenu(item) {
				const route = item && item.nativeUrl || ''
				uni.navigateTo({
					url: route,
					success: () => {
						console.log('[YAOHUO_MINE_NATIVE_NAV_OK]', {
							label: item && item.label || item && item.title || '',
							route
						})
					},
					fail: err => {
						console.log('[YAOHUO_MINE_NATIVE_NAV_FAIL]', {
							label: item && item.label || item && item.title || '',
							route,
							fallbackUrl: item && item.webUrl || '',
							errMsg: err && err.errMsg || String(err || '')
						})
						if (item && item.webUrl) {
							this.openWeb(item.webUrl)
							return
						}
						uni.showToast({
							title: '页面打不开',
							icon: 'none'
						})
					}
				})
			},
			openWeb(url) {
				if (!url) {
					return
				}
				const targetUrl = absoluteYaohuoUrl(url)
				if (navigateToNativeRoute(targetUrl)) {
					return
				}
				if (navigateToNativePost(targetUrl)) {
					return
				}
				uni.navigateTo({
					url: `/pages/webview/webview?url=${encodeURIComponent(targetUrl)}`
				})
			},
			goLogin() {
				clearAuthCookie()
				uni.redirectTo({
					url: '/pages/login/login?clear=1'
				})
			},
			confirmLogout() {
				uni.showModal({
					title: '退出登录',
					content: '确认退出当前账号吗？',
					success: res => {
						if (!res.confirm) {
							return
						}
						clearAuthCookie()
						uni.reLaunch({
							url: '/pages/login/login?clear=1'
						})
					}
				})
			}
		}
	}
</script>

<style scoped>
	page {
		background-color: #f3f3f3;
	}

	.mine-page {
		padding: 0 8rpx 48rpx;
		box-sizing: border-box;
	}

	.card {
		margin: 14rpx 0;
		background: #fff;
		border-radius: 8px;
		box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, .04);
		overflow: hidden;
		box-sizing: border-box;
	}

	.profile-card {
		position: fixed;
		top: 0;
		left: 8rpx;
		right: 8rpx;
		z-index: 20;
		margin: 0;
		padding: 28rpx 20rpx 24rpx;
	}

	.profile-card-spacer {
		height: 384rpx;
	}

	.profile-main {
		display: flex;
		align-items: center;
		min-width: 0;
	}

	.avatar {
		width: 92rpx;
		height: 92rpx;
		border-radius: 46rpx;
		background: #f3f3f3;
		flex: 0 0 92rpx;
		overflow: hidden;
	}

	.avatar-placeholder {
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.avatar-placeholder image {
		width: 78rpx;
		height: 44rpx;
	}

	.profile-text {
		margin-left: 20rpx;
		min-width: 0;
		flex: 1;
	}

	.name-row {
		display: flex;
		align-items: center;
		min-width: 0;
	}

	.nickname {
		color: #222;
		font-size: 18px;
		font-weight: 700;
		line-height: 1.25;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.level-icon {
		width: 34rpx;
		height: 34rpx;
		margin-left: 8rpx;
		flex: 0 0 34rpx;
		display: block;
	}

	.level-chip {
		margin-left: 10rpx;
		padding: 4rpx 10rpx;
		border-radius: 999rpx;
		background: #e9faf2;
		color: #07a85a;
		font-size: 12px;
		line-height: 1.2;
		flex: 0 0 auto;
	}

	.id-chip {
		display: inline-flex;
		margin-top: 12rpx;
		padding: 6rpx 12rpx;
		border-radius: 999rpx;
		background: #e9faf2;
		color: #059553;
		font-size: 12px;
		font-weight: 600;
		line-height: 1.2;
	}

	.edit-link {
		height: 54rpx;
		padding: 0 4rpx 0 16rpx;
		display: flex;
		align-items: center;
		color: #666;
		font-size: 13px;
		flex: 0 0 auto;
	}

	.edit-link text {
		margin-left: 6rpx;
	}

	.stat-grid {
		margin-top: 24rpx;
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 10rpx;
	}

	.stat-tile {
		min-width: 0;
		height: 96rpx;
		border-radius: 7px;
		background: #e9faf2;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
	}

	.stat-value {
		max-width: 100%;
		color: #068a4f;
		font-size: 17px;
		font-weight: 700;
		line-height: 1.25;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.stat-label {
		margin-top: 6rpx;
		color: #666;
		font-size: 12px;
	}

	.exp-row {
		margin-top: 28rpx;
	}

	.exp-meta {
		display: flex;
		align-items: center;
		justify-content: space-between;
		color: #666;
		font-size: 14px;
	}

	.level-text {
		color: #07c160;
		font-weight: 600;
	}

	.progress-track {
		margin-top: 16rpx;
		height: 14rpx;
		border-radius: 999rpx;
		background: #f0f0f0;
		overflow: hidden;
	}

	.progress-bar {
		height: 100%;
		border-radius: 999rpx;
		background: #07c160;
	}

	.section-card {
		padding: 0 12rpx;
	}

	.section-title {
		height: 82rpx;
		display: flex;
		align-items: center;
		border-bottom: 1px solid #eee;
		color: #07a85a;
		font-size: 16px;
		font-weight: 500;
		box-sizing: border-box;
	}

	.section-title text {
		margin-left: 8rpx;
	}

	.info-row,
	.rule-row {
		min-height: 88rpx;
		display: flex;
		align-items: center;
		justify-content: space-between;
		border-bottom: 1px dashed #eee;
		box-sizing: border-box;
	}

	.info-row:last-child,
	.rule-row:last-child {
		border-bottom: 0;
	}

	.row-left,
	.row-right {
		display: flex;
		align-items: center;
		min-width: 0;
	}

	.row-left {
		color: #666;
		font-size: 15px;
	}

	.row-left text {
		margin-left: 12rpx;
	}

	.row-right {
		justify-content: flex-end;
		color: #333;
		font-size: 15px;
	}

	.row-value {
		font-weight: 600;
		max-width: 280rpx;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.row-action {
		margin-left: 18rpx;
		color: #07c160;
		font-size: 14px;
		font-weight: 400;
	}

	.medals-card {
		min-height: 156rpx;
	}

	.medal-list {
		min-height: 96rpx;
		padding: 18rpx 0 24rpx;
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 14rpx;
	}

	.medal-image {
		width: 58rpx;
		height: 82rpx;
	}

	.empty-line {
		height: 96rpx;
		display: flex;
		align-items: center;
		color: #999;
		font-size: 13px;
	}

	.content-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 12rpx;
		padding: 22rpx 0;
	}

	.content-tile {
		height: 88rpx;
		border: 1px solid #eee;
		border-radius: 7px;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #333;
		font-size: 14px;
		box-shadow: 0 3rpx 10rpx rgba(0, 0, 0, .03);
	}

	.content-tile text {
		margin-left: 10rpx;
	}

	.rule-row {
		padding: 0 0 0 2rpx;
		color: #333;
		font-size: 14px;
	}

	.logout-btn {
		width: 260rpx;
		height: 78rpx;
		line-height: 78rpx;
		margin: 36rpx auto 0;
		border-radius: 999rpx;
		background: #f34d43;
		color: #fff;
		font-size: 15px;
		box-shadow: 0 10rpx 24rpx rgba(243, 77, 67, .25);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.logout-btn text {
		margin-left: 8rpx;
	}
</style>
