<template>
	<view class="content">
		<view v-for="(item,index) in messages" :key="item.id || index" class="message" @click="goToDetail(index)"
			@longpress="deleteMessage(index)">
			<view class="f-16">
				<image v-if="item.unRead" src="https://yaohuo.me/NetImages/new.gif" style="width: 50rpx;height: 25rpx;">
				</image>{{item.content}}
			</view>
			<view class="info">
				<uni-row>
					<uni-col :span="12">
						<view class="f-13">{{item.from}}</view>
					</uni-col>
					<uni-col :span="12">
						<view class="text-right f-13">{{item.time}}</view>
					</uni-col>
				</uni-row>
			</view>
		</view>
		<view v-if="!messages.length && !loading" class="empty">暂无消息</view>
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
		navigateToNativePost
	} from '@/utils/route.js'

	export default {
		data() {
			return {
				messages: [],
				page: 1,
				totalPage: 1,
				canFresh: true,
				loading: false
			}
		},
		onLoad() {
			this.fetchMessage()
		},
		onReachBottom() {
			if (this.page < this.totalPage) {
				this.page++
				this.fetchMessage()
			}
		},
		onPullDownRefresh() {
			if (!this.canFresh) {
				uni.showToast({
					title: '请勿频繁刷新',
					icon: 'error'
				})
				uni.stopPullDownRefresh()
				return
			}
			this.canFresh = false
			this.page = 1
			setTimeout(() => {
				this.canFresh = true
			}, 1000 * 20)
			this.fetchMessage()
		},
		methods: {
			deleteMessage(index) {
				const message = this.messages[index]
				const deleteUrl = this.getMessageDeleteUrl(message)
				if (!deleteUrl) {
					return uni.showToast({
						title: '这条消息不能删除',
						icon: 'none'
					})
				}
				uni.showModal({
					title: '操作提醒',
					content: '删除后无法恢复，确认删除吗？',
					success: (res) => {
						if (res.confirm) {
							uni.request({
								url: deleteUrl,
								header: getAuthHeader(),
								success: () => {
									this.messages.splice(index, 1)
									uni.showToast({
										title: '删除成功',
										icon: 'success'
									})
								}
							})
						}
					}
				})
			},
			goToDetail(index) {
				const message = this.messages[index]
				if (!message) {
					return
				}
				if (message.href) {
					return this.openMessageHref(message.href)
				}
				if (message.id) {
					return uni.navigateTo({
						url: `/pages/chat/chat?id=${message.id}&user=${encodeURIComponent(message.from || '')}`
					})
				}
				return uni.showToast({
					title: '这条是系统通知',
					icon: 'none'
				})
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
			openMessageHref(href) {
				const url = absoluteYaohuoUrl(href)
				if (navigateToNativePost(url)) {
					return true
				}
				uni.navigateTo({
					url: `/pages/webview/webview?url=${encodeURIComponent(url)}`
				})
				return true
			},
			getMessageDeleteUrl(message) {
				if (!message) {
					return ''
				}
				let url = message.deleteHref ? absoluteYaohuoUrl(message.deleteHref) : ''
				const id = message.deleteId || message.id
				if (!url && id) {
					url = `https://yaohuo.me/bbs/messagelist_del.aspx?action=godel&id=${id}`
				}
				if (!url) {
					return ''
				}
				if (/action=/i.test(url)) {
					return url.replace(/([?&]action=)[^&#]*/i, '$1godel')
				}
				return url + (url.indexOf('?') > -1 ? '&' : '?') + 'action=godel'
			},
			getFirstActionHref(block) {
				const reg = /<a\b[^>]*href\s*=\s*(["'])([\s\S]*?)\1[^>]*>([\s\S]*?)<\/a>/ig
				let postHref = ''
				let fallback = ''
				let match
				while ((match = reg.exec(block))) {
					const tag = match[0]
					const href = decodeHtml(getAttr(tag, 'href'))
					const text = stripHtml(match[3])
					if (!href || /^javascript:|^#/i.test(href) || /messagelist_del\.aspx/i.test(href) || text === '删除') {
						continue
					}
					if (/messagelist_view\.aspx/i.test(href)) {
						if (!fallback) {
							fallback = href
						}
						continue
					}
					if (!postHref && /\/?bbs-(\d+)\.html|\/bbs\/book_(?:view|re)\.aspx/i.test(href)) {
						postHref = href
					}
					if (!fallback) {
						fallback = href
					}
				}
				return postHref || fallback
			},
			getDeleteInfo(block, viewId) {
				const match = block.match(/<a\b[^>]*href\s*=\s*(["'])([^"']*messagelist_del\.aspx[^"']*)\1[^>]*>/i)
				const href = match ? decodeHtml(match[2]) : ''
				return {
					href,
					id: href ? this.getQueryValue(href, 'id') : (viewId || '')
				}
			},
			goLogin() {
				clearAuthCookie()
				uni.redirectTo({
					url: '/pages/login/login?clear=1'
				})
			},
			parseTotalPage(html) {
				const text = stripHtml(html)
				const match = text.match(/(\d+)\s*\/\s*(\d+)\s*页/) || text.match(/共\s*(\d+)\s*页/)
				return match ? Number(match[2] || match[1]) || 1 : 1
			},
			parseMessageBlock(block) {
				const viewLink = block.match(/<a[^>]+href=["']([^"']*messagelist_view\.aspx[^"']*)["'][^>]*>([\s\S]*?)<\/a>/i)
				const viewHref = viewLink ? decodeHtml(viewLink[1]) : ''
				const viewId = viewHref ? this.getQueryValue(viewHref, 'id') : ''
				const actionHref = this.getFirstActionHref(block)
				const deleteInfo = this.getDeleteInfo(block, viewId)
				const allText = stripHtml(block)
				const fromMatch = allText.match(/来自\s*([^\[\]\n\r]+)/)
				const timeMatch = allText.match(/\[([^\[\]]*(?:\d{1,2}:\d{2}|\d{1,2}-\d{1,2})[^\[\]]*)\]/) ||
					allText.match(/(\d{2,4}-\d{1,2}-\d{1,2}\s+\d{1,2}:\d{2}(?::\d{2})?|\d{1,2}-\d{1,2}\s+\d{1,2}:\d{2})/)
				let content = viewLink ? stripHtml(viewLink[2]) : allText
				content = content
					.replace(/来自\s*[^\[\]\n\r]+/g, '')
					.replace(/\[[^\[\]]*(?:\d{1,2}:\d{2}|\d{1,2}-\d{1,2})[^\[\]]*\]/g, '')
					.replace(/删除/g, '')
					.trim()
				return {
					id: viewId,
					href: actionHref && !/messagelist_view\.aspx/i.test(actionHref) ? actionHref : '',
					deleteId: deleteInfo.id,
					deleteHref: deleteInfo.href,
					content: content || (viewId ? '私信' : '系统通知'),
					from: fromMatch ? fromMatch[1].trim() : '',
					time: timeMatch ? (timeMatch[1] || '').trim() : '',
					unRead: /new\.gif/i.test(block)
				}
			},
			parseMessages(html) {
				const blocks = extractClassBlocks(html, 'listmms')
				const result = []
				const seen = {}
				if (blocks.length) {
					blocks.forEach(block => {
						const message = this.parseMessageBlock(block)
						const key = message.id || message.href || `${message.content}|${message.from}|${message.time}`
						if (!seen[key]) {
							seen[key] = true
							result.push(message)
						}
					})
				} else {
					const reg = /<a[^>]+href=["']([^"']*messagelist_view\.aspx[^"']*)["'][^>]*>([\s\S]*?)<\/a>/ig
					let match
					while ((match = reg.exec(html))) {
						const id = this.getQueryValue(match[1], 'id')
						if (id && !seen[id]) {
							seen[id] = true
							result.push({
								id,
								href: '',
								deleteId: id,
								deleteHref: '',
								content: stripHtml(match[2]) || '私信',
								from: '',
								time: '',
								unRead: false
							})
						}
					}
				}
				return result.filter(item => item.id || item.href || item.content)
			},
			fetchMessage() {
				this.loading = true
				uni.showLoading({
					title: '加载中'
				})
				uni.request({
					url: `https://yaohuo.me/bbs/messagelist.aspx?page=${this.page}`,
					header: getAuthHeader(),
					success: (res) => {
						const html = String(res.data || '')
						if (isLoginRequiredHtml(html)) {
							return this.goLogin()
						}
						this.totalPage = this.parseTotalPage(html)
						const messageArr = this.parseMessages(html)
						if (this.page === 1) {
							this.messages = messageArr
						} else {
							this.messages = this.messages.concat(messageArr)
						}
						if (!messageArr.length && this.page === 1) {
							console.log('[YAOHUO_MESSAGE_EMPTY]', html.slice(0, 500))
						}
					},
					fail: () => {
						uni.showToast({
							title: '消息加载失败',
							icon: 'none'
						})
					},
					complete: () => {
						this.loading = false
						uni.hideLoading()
						uni.stopPullDownRefresh()
					}
				})
			}
		}
	}
</script>
<style>
	page {
		background-color: #fff;
	}
</style>
<style scoped>
	.message {
		border-bottom: 1px solid #F3F3F3;
		padding: 30rpx;
	}

	.info {
		margin-top: 20rpx;
		color: rgba(0, 0, 0, .3);
	}

	.empty {
		padding: 80rpx 30rpx;
		text-align: center;
		color: #999;
		font-size: 14px;
	}
</style>
