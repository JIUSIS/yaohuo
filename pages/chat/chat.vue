<template>
	<view>
		<view class="tips color_fff size_12 align_c" :class="{ 'show':ajax.loading }">
			{{ajax.loadText}}
		</view>
		<view class="box-1" id="list-box">
			<view class="talk-list">
				<view v-for="(item,index) in talkList" :key="item.id || index" :id="`msg-${item.id}`">
					<view class="item flex_col" :class=" item.type == 1 ? 'push':'pull' ">
						<view class="content">
							<mp-html :content="item.content" selectable lazy-load domain="https://yaohuo.me"
								containerStyle="line-height:40rpx;word-break: break-all;font-size:30rpx"></mp-html>
						</view>
					</view>
				</view>
				<view id="bottom"></view>
			</view>
		</view>
		<view class="box-2">
			<view class="flex_col">
				<view class="flex_grow">
					<input type="text" class="content" v-model="replyData.content" placeholder="请输入聊天内容"
						placeholder-style="color:#DDD;" :cursor-spacing="6">
				</view>
				<button class="send" @tap="send">发送</button>
			</view>
		</view>
	</view>
</template>

<script>
	import {
		clearAuthCookie,
		getAuthHeader,
		getAuthSid,
		isLoginRequiredHtml
	} from '@/utils/auth.js'
	import {
		absoluteYaohuoUrl,
		decodeHtml,
		escapeHtml,
		extractClassBlocks,
		extractInputValue,
		getAttr,
		normalizeHtmlUrls,
		stripHtml
	} from '@/utils/html.js'

	export default {
		data() {
			return {
				talkList: [],
				ajax: {
					loading: true,
					loadText: '正在获取消息'
				},
				replyData: {
					content: '',
					action: 'gomod',
					classid: 0,
					siteid: 1000,
					types: 0,
					issystem: '',
					toid: '',
					backurl: 'wapindex.aspx?siteid=1000&classid=0',
					title: '',
					touseridlist: '',
					sid: getAuthSid(),
					g: ' 发 送 '
				}
			}
		},
		onLoad(option) {
			this.replyData.toid = option.id
			this.fetchChat(option)
		},
		methods: {
			goLogin() {
				clearAuthCookie()
				uni.redirectTo({
					url: '/pages/login/login?clear=1'
				})
			},
			parseChatMessages(html) {
				const blocks = extractClassBlocks(html, 'listmms')
				return blocks.map((block, index) => {
					const isMe = /class\s*=\s*["'][^"']*the_me/i.test(block)
					let content = block
						.replace(/<script[\s\S]*?<\/script>/ig, '')
						.replace(/<style[\s\S]*?<\/style>/ig, '')
					const firstInner = content.match(/<[^>]+class\s*=\s*["'][^"']*listmms[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>$/i)
					content = firstInner ? firstInner[1] : content
					const fullReplyUrl = this.getFullReplyUrl(content)
					content = normalizeHtmlUrls(content)
					if (!stripHtml(content) && !/<img|<video|<a/i.test(content)) {
						content = ''
					}
					return {
						id: index + 1,
						type: isMe ? 1 : 0,
						content: content || ' ',
						fullReplyUrl
					}
				}).reverse()
			},
			getFullReplyUrl(html) {
				const reg = /<a\b[^>]*href\s*=\s*(["'])([\s\S]*?)\1[^>]*>([\s\S]*?)<\/a>/ig
				let fallback = ''
				let match
				while ((match = reg.exec(String(html || '')))) {
					const tag = match[0]
					const href = getAttr(tag, 'href')
					const text = stripHtml(match[3])
					if (!href || !/book_re\.aspx/i.test(href)) {
						continue
					}
					if (/完整回复|查看回复|回复内容/.test(text)) {
						return absoluteYaohuoUrl(href)
					}
					if (!fallback && /(?:[?&](?:tofloor|reply)=|#floor-)/i.test(decodeHtml(href))) {
						fallback = absoluteYaohuoUrl(href)
					}
				}
				return fallback
			},
			getQueryValue(url, name) {
				const reg = new RegExp(`[?&]${name}=([^&#]*)`, 'i')
				const match = decodeHtml(url).match(reg)
				if (!match) {
					return ''
				}
				try {
					return decodeURIComponent(match[1])
				} catch (e) {
					return match[1]
				}
			},
			fetchHtml(url) {
				return new Promise((resolve, reject) => {
					uni.request({
						url,
						header: getAuthHeader(),
						success: (res) => resolve(String(res.data || '')),
						fail: reject
					})
				})
			},
			getReplyFloorFromUrl(url) {
				const hashMatch = String(url || '').match(/#floor-(\d+)/i)
				return this.getQueryValue(url, 'tofloor') || this.getQueryValue(url, 'reply') || (hashMatch ? hashMatch[1] : '')
			},
			findReplyBlock(html, sourceUrl) {
				html = String(html || '')
				const floor = this.getReplyFloorFromUrl(sourceUrl)
				if (floor) {
					const reg = new RegExp(`<div[^>]+class=["'][^"']*list-reply[^"']*["'][^>]*(?:id=["']floor-${floor}["']|data-floor=["']${floor}["'])[^>]*>`, 'i')
					const match = reg.exec(html)
					if (match) {
						const start = match.index
						const nextReg = /<div[^>]+class=["'][^"']*list-reply[^"']*["'][^>]*>/ig
						nextReg.lastIndex = start + match[0].length
						const next = nextReg.exec(html)
						const listEnd = html.indexOf('<!--listE-->', start)
						const end = next ? next.index : (listEnd > start ? listEnd : html.length)
						return html.slice(start, end)
					}
				}
				const blocks = extractClassBlocks(html, 'list-reply')
				return blocks[0] || ''
			},
			collectAttachmentLinks(html) {
				const links = []
				const seen = {}
				const reg = /<a\b[^>]*href\s*=\s*(["'])([\s\S]*?)\1[^>]*>([\s\S]*?)<\/a>/ig
				let match
				while ((match = reg.exec(String(html || '')))) {
					const tag = match[0]
					const href = getAttr(tag, 'href')
					if (!href || !/(book_re_addfileshow|picDIY\.aspx|download\.aspx)/i.test(href)) {
						continue
					}
					const url = absoluteYaohuoUrl(href)
					if (!seen[url]) {
						seen[url] = true
						links.push(url)
					}
				}
				return links
			},
			collectDirectImages(html, currentContent) {
				const parts = []
				const seen = {}
				const reg = /<img\b[^>]*>/ig
				let match
				while ((match = reg.exec(String(html || '')))) {
					const src = absoluteYaohuoUrl(getAttr(match[0], 'src'))
					if (!src || /\/face\//i.test(src) || seen[src] || String(currentContent || '').indexOf(src) > -1) {
						continue
					}
					seen[src] = true
					parts.push(`<br><img style="max-width:100%;" src="${src}">`)
				}
				return parts
			},
			resolveAttachmentLink(url, currentContent) {
				return this.fetchHtml(url).then(html => {
					const imgMatch = String(html || '').match(/<img\b[^>]*src\s*=\s*(["'])([^"']+)\1[^>]*>/i)
					if (imgMatch) {
						const imgUrl = absoluteYaohuoUrl(imgMatch[2])
						if (imgUrl && String(currentContent || '').indexOf(imgUrl) < 0) {
							return `<br><img style="max-width:100%;" src="${imgUrl}">`
						}
					}
					const fileMatch = String(html || '').match(/<a\b[^>]*href\s*=\s*(["'])([^"']*download\.aspx[^"']*)\1[^>]*>([\s\S]*?)<\/a>/i)
					if (fileMatch) {
						const fileUrl = absoluteYaohuoUrl(fileMatch[2])
						const text = stripHtml(fileMatch[3]) || '查看附件'
						return `<br><a href="${fileUrl}">${escapeHtml(text)}</a>`
					}
					return ''
				}).catch(() => '')
			},
			getReplyAttachmentHtml(html, sourceUrl, currentContent) {
				const block = this.findReplyBlock(html, sourceUrl)
				if (!block) {
					return Promise.resolve('')
				}
				const directParts = this.collectDirectImages(block, currentContent)
				const links = this.collectAttachmentLinks(block)
				return Promise.all(links.map(url => this.resolveAttachmentLink(url, currentContent))).then(linkParts => {
					const parts = []
					const seen = {}
					directParts.concat(linkParts).forEach(part => {
						if (part && !seen[part]) {
							seen[part] = true
							parts.push(part)
						}
					})
					return parts.join('')
				})
			},
			hydrateChatAttachments() {
				const tasks = this.talkList.map((message, index) => {
					if (!message.fullReplyUrl) {
						return Promise.resolve()
					}
					return this.fetchHtml(message.fullReplyUrl)
						.then(html => this.getReplyAttachmentHtml(html, message.fullReplyUrl, message.content))
						.then(extra => {
							if (extra && this.talkList[index] && this.talkList[index].content.indexOf(extra) < 0) {
								this.$set(this.talkList, index, Object.assign({}, this.talkList[index], {
									content: this.talkList[index].content + extra
								}))
							}
						})
						.catch(() => {})
				})
				return Promise.all(tasks).then(() => {
					this.$nextTick(() => {
						this.setPageScrollTo('#bottom')
					})
				})
			},
			fetchChat(option) {
				this.ajax.loading = true
				this.ajax.loadText = '正在获取消息'
				uni.request({
					url: `https://yaohuo.me/bbs/messagelist_view.aspx?id=${option.id}`,
					header: getAuthHeader(),
					success: (res) => {
						const html = String(res.data || '')
						if (isLoginRequiredHtml(html)) {
							return this.goLogin()
						}
						this.replyData.touseridlist = extractInputValue(html, 'touseridlist')
						if (this.replyData.touseridlist) {
							uni.setNavigationBarTitle({
								title: `${decodeURIComponent(option.user || '')}(${this.replyData.touseridlist})`
							})
						}
						this.talkList = this.parseChatMessages(html)
						this.hydrateChatAttachments()
						if (!this.talkList.length) {
							console.log('[YAOHUO_CHAT_EMPTY]', html.slice(0, 500))
						}
						this.ajax.loadText = '消息获取成功'
						setTimeout(() => {
							this.ajax.loading = false
							this.$nextTick(() => {
								this.setPageScrollTo('#bottom')
							})
						}, 500)
					},
					fail: () => {
						this.ajax.loading = false
						uni.showToast({
							title: '消息获取失败',
							icon: 'none'
						})
					}
				})
			},
			setPageScrollTo(selector) {
				let query = uni.createSelectorQuery().in(this)
				if (!query || typeof query.select !== 'function') {
					return
				}
				let view = query.select(selector)
				if (!view) {
					return
				}
				view.boundingClientRect((res) => {
					if (!res) {
						return
					}
					uni.pageScrollTo({
						scrollTop: res.top,
						duration: 300
					})
				}).exec()
			},
			send() {
				if (!this.replyData.content) {
					return uni.showToast({
						title: '请输入有效的内容',
						icon: 'none'
					})
				}
				this.replyData.sid = getAuthSid()
				uni.showLoading({
					title: '正在发送'
				})
				uni.request({
					method: 'POST',
					url: 'https://yaohuo.me/bbs/messagelist_add.aspx',
					header: getAuthHeader({
						'Content-Type': 'application/x-www-form-urlencoded'
					}),
					data: this.replyData,
					success: (res) => {
						const html = String(res.data || '')
						if (isLoginRequiredHtml(html)) {
							uni.hideLoading()
							return this.goLogin()
						}
						const tip = html.match(/<div class=["']tip["'][^>]*>([\s\S]*?)<\/div>/i)
						if (tip && /失败|错误|限制|不能|请先|为空/.test(stripHtml(tip[1]))) {
							uni.hideLoading()
							return uni.showModal({
								title: '发送失败',
								content: stripHtml(tip[1]) || '服务器返回失败',
								showCancel: false
							})
						}
						uni.hideLoading()
						this.talkList.push({
							id: new Date().getTime(),
							content: escapeHtml(this.replyData.content).replace(/\n/g, '<br>'),
							type: 1
						})
						this.$nextTick(() => {
							this.replyData.content = ''
							uni.pageScrollTo({
								scrollTop: 999999,
								duration: 300
							})
						})
					},
					fail: () => {
						uni.hideLoading()
						uni.showToast({
							title: '发送失败',
							icon: 'none'
						})
					}
				})
			}
		}
	}
</script>

<style lang="scss">
	@import "../../lib/global.scss";

	page {
		background-color: #F3F3F3;
		font-size: 28rpx;
	}

	.tips {
		position: fixed;
		left: 0;
		top: var(--window-top);
		width: 100%;
		z-index: 9;
		background-color: rgba(0, 0, 0, 0.15);
		height: 72rpx;
		line-height: 72rpx;
		transform: translateY(-80rpx);
		transition: transform 0.3s ease-in-out 0s;

		&.show {
			transform: translateY(0);
		}
	}

	.box-1 {
		width: 100%;
		height: auto;
		padding-bottom: 100rpx;
		box-sizing: content-box;
		margin-bottom: 0;
		margin-bottom: constant(safe-area-inset-bottom);
		margin-bottom: env(safe-area-inset-bottom);
	}

	.box-2 {
		position: fixed;
		left: 0;
		width: 100%;
		bottom: 0;
		height: auto;
		z-index: 2;
		border-top: #e5e5e5 solid 1px;
		box-sizing: content-box;
		background-color: #F3F3F3;
		padding-bottom: 0;
		padding-bottom: constant(safe-area-inset-bottom);
		padding-bottom: env(safe-area-inset-bottom);

		>view {
			padding: 0 20rpx;
			height: 100rpx;
		}

		.content {
			background-color: #fff;
			height: 64rpx;
			padding: 0 20rpx;
			border-radius: 32rpx;
			font-size: 28rpx;
		}

		.send {
			background-color: #42b983;
			color: #fff;
			height: 64rpx;
			margin-left: 20rpx;
			border-radius: 32rpx;
			padding: 0;
			width: 120rpx;
			line-height: 62rpx;

			&:active {
				background-color: #5fc496;
			}
		}
	}

	.talk-list {
		padding-bottom: 20rpx;

		.item {
			padding: 20rpx 20rpx 0 20rpx;
			align-items: flex-start;
			align-content: flex-start;
			color: #333;

			.content {
				padding: 20rpx;
				border-radius: 4px;
				max-width: 500rpx;
				word-break: break-all;
				line-height: 52rpx;
				position: relative;
			}

			&.pull {
				.content {
					margin-left: 32rpx;
					background-color: #fff;

					&::after {
						content: '';
						display: block;
						width: 0;
						height: 0;
						border-top: 16rpx solid transparent;
						border-bottom: 16rpx solid transparent;
						border-right: 20rpx solid #fff;
						position: absolute;
						top: 30rpx;
						left: -18rpx;
					}
				}
			}

			&.push {
				flex-direction: row-reverse;

				.content {
					margin-right: 32rpx;
					background-color: #a0e959;

					&::after {
						content: '';
						display: block;
						width: 0;
						height: 0;
						border-top: 16rpx solid transparent;
						border-bottom: 16rpx solid transparent;
						border-left: 20rpx solid #a0e959;
						position: absolute;
						top: 30rpx;
						right: -18rpx;
					}
				}
			}
		}
	}
</style>
