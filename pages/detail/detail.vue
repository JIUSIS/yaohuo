<template>
	<view v-if="nodes.length">
		<uni-transition mode-class="fade" :duration="300" :show="true">
			<view class="content">
				<view class="f-18 title">
					{{info.title}}
				</view>
				<view v-if="info.extra" class="f-14" style="margin-top: 20rpx;">
					{{info.extra}}
				</view>
				<view style="margin-top: 20rpx;">
					<uni-row>
						<uni-col :span="18">
							<view class="f-14">
								{{info.author}}
							</view>
						</uni-col>
						<uni-col :span="6">
							<view class="f-14 text-right">
								{{idObj[info.classId]}}
							</view>
						</uni-col>
					</uni-row>
					<view style="margin-top: 20rpx;" v-if="honorArr.length">
						<image style="width: 40rpx;height: 50rpx;margin-right: 5rpx;" v-for="(item,index) in honorArr"
							:key="index" :src="item"></image>
					</view>
				</view>
				<view style="border-bottom:  1px dashed #dcdcdc;margin-bottom: 20rpx;margin-top: 15rpx;">
				</view>
				<mp-html :content="nodes" :copyLink="false" selectable domain="https://yaohuo.me"
					containerStyle="line-height:60rpx;word-break: break-all;font-size:32rpx" @linktap="linkTap">
				</mp-html>
				<view style="margin: 20rpx 0 30rpx;">
					<uni-row>
						<uni-col :span="12">
							<view class="f-13 info">
								浏览{{info.readCount}}次
							</view>
						</uni-col>
						<uni-col :span="12">
							<view class="f-13 text-right info">
								{{info.time}}
							</view>
						</uni-col>
					</uni-row>
				</view>
			</view>
			<view class="tip" v-if="info.status">
				<text class="tip-text">{{info.status}}</text>
			</view>
			<comment id="comment" :comments="comments" :postInfo="info" @fetchReply="fetchReply" :postId="info.postId">
			</comment>
		</uni-transition>
	</view>
</template>

<script>
	import {
		cheerio
	} from '@/utils/cheerio.js'
	import {
		idObj
	} from '@/utils/yaohuo.js'
	import HTMLParser from '@/utils/html-parser.js'
	import {
		getAuthHeader
	} from '@/utils/auth.js'
	export default {
		data() {
			return {
				id: '',
				nodes: '',
				comments: [],
				info: {},
				page: 1,
				totalPage: 0,
				status: 'more',
				replyPageBaseUrl: '',
				replyGo: '',
				idObj: idObj,
				honorArr: []
			}
		},
		onLoad(option) {
			this.info.postId = option.id
			this.info.classId = option.classid || option.classId || ''
			this.fetchDetail()
		},
		onPullDownRefresh() {
			this.fetchDetail()
		},
		onReachBottom() {
			if (this.page < this.totalPage) {
				uni.showNavigationBarLoading()
				this.status = 'loading'
				this.page++
				this.fetchReply()
			}
		},
		methods: {
			linkTap(e) {
				if (e.href.indexOf('bbs/picDIY.aspx') > -1) {
					let imgUrl = 'https://yaohuo.me/' + e.href.split('path=')[1]
					uni.previewImage({
						current: imgUrl,
						urls: [imgUrl]
					})
				} else {
					if (e.href.indexOf('bbs-') < 0) {
						uni.navigateTo({
							url: `/pages/webview/webview?url=${e.href}`
						})
					} else {
						let id = e.href.split('-')[1].split('.')[0]
						uni.navigateTo({
							url: `/pages/detail/detail?id=${id}`
						})
					}
				}
			},
			fetchReply(flag, auto) {
				if (flag) {
					this.page = 1
					this.replyPageBaseUrl = ''
					this.replyGo = String(Date.now()).slice(-5)
					uni.showLoading({
						title: '刷新评论中'
					})
				}
				if (!this.page) {
					this.page = 1
				}
				const url = this.getReplyUrl()
				uni.request({
					url,
					header: getAuthHeader(),
					success: (res) => {
						const replyHtml = String(res.data || '')
						this.updateReplyPaging(replyHtml)
						let comments = this.parseReplies(replyHtml)
						if (flag) {
							this.comments = comments
							uni.showToast({
								title: '刷新成功'
							})
						} else {
							this.comments = this.sortComments(this.mergeComments(this.comments, comments))
						}
						if (!comments.length || this.page >= this.totalPage) {
							this.status = 'noMore'
						} else {
							this.status = 'more'
						}
					},
					fail: () => {
						uni.hideLoading()
					},
					complete: () => {
						if (!auto) {
							uni.hideLoading()
							uni.hideNavigationBarLoading()
						}
					}
				})
			},
			getReplyUrl() {
				const classId = this.cleanClassId(this.info.classId)
				const baseUrl = this.replyPageBaseUrl ||
					`https://yaohuo.me/bbs/book_re.aspx?action=class&id=${this.info.postId}&siteid=1000&classid=${classId}&lpage=&ot=1&go=${this.replyGo || Date.now()}`
				return this.setQueryParam(this.cleanReplyListUrl(baseUrl), 'page', this.page || 1)
			},
			updateReplyPaging(html) {
				const moreUrl = this.extractReplyMoreUrl(html)
				if (moreUrl) {
					this.replyPageBaseUrl = this.cleanReplyListUrl(this.removeQueryParam(moreUrl, 'page'))
				}
				const totalMatch = String(html || '').match(/getTotal=(\d+)/i)
				if (totalMatch) {
					this.totalPage = Math.ceil(Number(totalMatch[1]) / 15)
				}
				if (!this.totalPage && this.info.replyCount) {
					this.totalPage = Math.ceil(Number(this.info.replyCount) / 15)
				}
				if (!this.totalPage) {
					this.totalPage = 1
				}
			},
			extractReplyMoreUrl(html) {
				html = String(html || '')
				const moreBlock = html.match(/<div[^>]+class=["'][^"']*more[^"']*["'][^>]*>[\s\S]*?<\/div>/i)
				if (!moreBlock) {
					return ''
				}
				const hrefMatch = moreBlock[0].match(/<a[^>]+href=["']([^"']*(?:book_re\.aspx|getTotal=)[^"']*)["']/i)
				if (!hrefMatch || hrefMatch[1].indexOf('page=') < 0) {
					return ''
				}
				return this.normalizeReplyUrl(hrefMatch[1])
			},
			normalizeReplyUrl(url) {
				url = String(url || '').replace(/&amp;/g, '&')
				if (url.indexOf('//') === 0) {
					return 'https:' + url
				}
				if (url.indexOf('http') === 0) {
					return url
				}
				if (url.charAt(0) === '/') {
					return 'https://yaohuo.me' + url
				}
				return 'https://yaohuo.me/' + url
			},
			setQueryParam(url, name, value) {
				const hashParts = String(url || '').split('#')
				const main = hashParts.shift()
				const hash = hashParts.length ? '#' + hashParts.join('#') : ''
				const parts = main.split('?')
				const path = parts.shift()
				const query = parts.join('?')
				const params = query ? query.split('&').filter(Boolean) : []
				const nextParams = params.filter(item => item.split('=')[0].toLowerCase() !== name.toLowerCase())
				nextParams.push(name + '=' + encodeURIComponent(value))
				return path + '?' + nextParams.join('&') + hash
			},
			removeQueryParam(url, name) {
				const hashParts = String(url || '').split('#')
				const main = hashParts.shift()
				const hash = hashParts.length ? '#' + hashParts.join('#') : ''
				const parts = main.split('?')
				const path = parts.shift()
				const query = parts.join('?')
				const params = query ? query.split('&').filter(Boolean) : []
				const nextParams = params.filter(item => item.split('=')[0].toLowerCase() !== name.toLowerCase())
				return path + (nextParams.length ? '?' + nextParams.join('&') : '') + hash
			},
			cleanReplyListUrl(url) {
				url = this.setQueryParam(url, 'id', this.info.postId)
				url = this.setQueryParam(url, 'siteid', 1000)
				url = this.setQueryParam(url, 'classid', this.cleanClassId(this.info.classId))
				;['mainuserid', 'reply', 'touserid', 'tofloor'].forEach(name => {
					url = this.removeQueryParam(url, name)
				})
				return url
			},
			cleanClassId(classId) {
				const match = String(classId || '').match(/\d+/)
				return match ? match[0] : ''
			},
			decodeHtmlText(text) {
				return String(text || '')
					.replace(/&amp;/g, '&')
					.replace(/&quot;/g, '"')
					.replace(/&#39;/g, "'")
			},
			decodeUrlText(text) {
				try {
					return decodeURIComponent(String(text || ''))
				} catch (e) {
					return String(text || '')
				}
			},
			extractClassId(html) {
				const raw = String(html || '')
				const htmlDecoded = this.decodeHtmlText(raw)
				const urlDecoded = this.decodeUrlText(htmlDecoded)
				const sources = [raw, htmlDecoded, urlDecoded]
				const patterns = [
					/name=["']classid["'][^>]*value=["']?(\d+)/i,
					/(?:[?&])classid=(\d+)/i,
					/classid=(\d+)/i,
					/classid%3d(\d+)/i
				]
				for (let i = 0; i < sources.length; i++) {
					for (let j = 0; j < patterns.length; j++) {
						const match = sources[i].match(patterns[j])
						if (match) {
							return match[1]
						}
					}
				}
				return ''
			},
			fetchDetail() {
				uni.showLoading({
					title: '拼命加载中'
				})
				uni.request({
					url: `https://yaohuo.me/bbs-${this.info.postId}.html`,
					header: getAuthHeader(),
					success: (res) => {
						const html = String(res.data || '')
						let tip = html.match(/<div class=\"tip\">(.*?)<\/div>/)
						this.info.isEnd = false
						if (tip) {
							if (tip[1].indexOf('结束原因') > -1) {
								this.info.status = '已结帖'
								this.info.isEnd = true
							}
							if (tip[1].indexOf('锁定原因') > -1) {
								this.info.status = '已锁定'
							}
							if (tip[1].indexOf('审核') > -1) {
								setTimeout(() => {
									uni.navigateBack({
										delta: 1
									})
								}, 1000)
								return uni.showToast({
									title: '帖子已被删除',
									icon: 'error'
								})
							}
						}
						let replyCountMatch = html.match(/全部回帖\((.*?)\)/)
						this.info.replyCount = replyCountMatch ? replyCountMatch[1] : 0
						this.totalPage = Math.ceil(this.info.replyCount / 15)
						this.info.classId = this.cleanClassId(this.extractClassId(html) || this.info.classId)
						let content = html.match(/<!--listS-->([\s\S]*?)<!--listE-->/)
						this.nodes = content ? content[1].replace(
							/height=\"100%px\"/, '').replace(/width=\"100%px\"/, 'width="100%"').replace(
							/<a href=\"\/bbs\/picDIY.aspx.*?\""/,
							'<a href=\"\"') : ' '
						let fileList = html.match(/<div class=\"line\">([\s\S]*?)<\/div>/g)
						if (fileList) {
							fileList.forEach(r => {
								this.nodes += r.replace(/\/bbs\/download.aspx/,
									'https://yaohuo.me/bbs/download.aspx')
							})
						}
						this.honorArr = []
						this.getPostInfoFromHtml(html)
						this.comments = []
						this.page = 1
						this.replyPageBaseUrl = ''
						this.replyGo = String(Date.now()).slice(-5)
						this.fetchReply()
					},
					fail: () => {
						uni.showToast({
							title: '加载失败',
							icon: 'none'
						})
					},
					complete: () => {
						uni.hideLoading()
						uni.stopPullDownRefresh()
					}
				})
			},
			stripHtml(html) {
				return String(html || '')
					.replace(/<br\s*\/?>/gi, '\n')
					.replace(/<[^>]+>/g, '')
					.replace(/&nbsp;/g, ' ')
					.trim()
			},
			decodeReplyAttr(text) {
				return String(text || '')
					.replace(/&amp;/g, '&')
					.replace(/&quot;/g, '"')
					.replace(/&#39;/g, "'")
			},
			extractReplyActions(block) {
				const actions = []
				const seen = {}
				const reg = /<a\b[^>]*href\s*=\s*(["'])([^"']+)\1[^>]*>([\s\S]*?)<\/a>/ig
				let match
				while ((match = reg.exec(String(block || '')))) {
					const href = this.decodeReplyAttr(match[2])
					const text = this.stripHtml(match[3])
					const isDelete = /book_re_del\.aspx/i.test(href) ||
						/(^|[-_\s])(?:del|delete)(?:[-_\s]|$)/i.test(match[0]) ||
						text === '删' || text === '删除'
					if (!isDelete || seen[href]) {
						continue
					}
					seen[href] = true
					actions.push({
						url: href,
						option: '删'
					})
				}
				return actions
			},
			parseReplies(html) {
				let comments = []
				html = String(html || '')
				const blocks = this.splitReplyBlocks(html)
				blocks.forEach((block, index) => {
					const floorMatch = block.match(/data-floor=["']([^"']+)["']/i) || block.match(/class=["'][^"']*(?:floornumber|floor-number|floor-info)[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/i) || block.match(/\[(?:<[^>]+>)*([^<\]]+)(?:<[^>]+>)*楼(?:<[^>]+>)*\]/)
					const userMatch = block.match(/class=["'][^"']*(?:renick|user-name)[^"']*["'][\s\S]*?<span[^>]*>([\s\S]*?)<\/span>|class=["'][^"']*(?:renick|user-name)[^"']*["'][\s\S]*?<a[^>]*>([\s\S]*?)<\/a>|class=["'][^"']*(?:renick|user-name)[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/i)
					const userIdMatch = block.match(/touserid=(\d+)/i) || block.match(/mainuserid=(\d+)/i) || block.match(/class=["']renickid["'][^>]*>(\d+)<\/span>/i)
					const timeMatch = block.match(/class=["'][^"']*(?:retime|redate|post-date)[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/i)
					const textMatch = block.match(/class=["'][^"']*(?:retext|post-content)[^"']*["'][^>]*>([\s\S]*?)<\/(?:span|div)>/i)
					let floor = floorMatch ? this.stripHtml(floorMatch[1]).replace('楼', '') : String(index + 1)
					if (floor === '沙发') {
						floor = '1'
					} else if (floor === '椅子') {
						floor = '2'
					} else if (floor === '板凳') {
						floor = '3'
					}
					const comment = {
						floor,
						user: userMatch ? this.stripHtml(userMatch[1] || userMatch[2] || userMatch[3]) : '',
						userId: userIdMatch ? userIdMatch[1] : '',
						time: timeMatch ? this.stripHtml(timeMatch[1]) : '',
						text: textMatch ? textMatch[1] : '',
						remanage: this.extractReplyActions(block)
					}
					if (comment.text || comment.user || comment.time) {
						comments.push(comment)
					}
				})
				return comments
			},
			splitReplyBlocks(html) {
				const makeBlocks = (starts) => {
					const listEnd = html.indexOf('<!--listE-->')
					return starts.map((start, index) => {
						const next = starts[index + 1]
						const end = next || (listEnd > start ? listEnd : html.length)
						return html.slice(start, end > start ? end : html.length)
					})
				}
				const collectStarts = (reg) => {
					const starts = []
					let match
					while ((match = reg.exec(html))) {
						starts.push(match.index)
					}
					return starts
				}
				const replyStarts = collectStarts(/<[^>]+class=["'][^"']*list-reply[^"']*["'][^>]*>/ig)
				if (replyStarts.length) {
					return makeBlocks(replyStarts)
				}
				const postStarts = collectStarts(/<[^>]+class=["'][^"']*forum-post[^"']*["'][^>]*>/ig)
				if (postStarts.length > 1) {
					return makeBlocks(postStarts)
				}
				const numberStarts = collectStarts(/<[^>]+class=["'][^"']*(?:number|floor-number|floor-info)[^"']*["'][^>]*>/ig)
				if (numberStarts.length > 1) {
					return makeBlocks(numberStarts)
				}
				const lineStarts = collectStarts(/<[^>]+class=["'][^"']*reline[^"']*["'][^>]*>/ig)
				if (lineStarts.length > 1) {
					return makeBlocks(lineStarts)
				}
				const floorStarts = collectStarts(/\[(?:\d+|沙发|椅子|板凳|顶楼)楼?\]/g)
				if (floorStarts.length > 1) {
					return makeBlocks(floorStarts)
				}
				const userStarts = collectStarts(/<span[^>]+class=["']renick["'][^>]*>/ig)
				if (userStarts.length > 1) {
					return makeBlocks(userStarts)
				}
				return makeBlocks(replyStarts.length ? replyStarts : floorStarts)
			},
			commentKey(comment) {
				return [
					comment.floor || '',
					comment.userId || '',
					comment.user || '',
					comment.time || '',
					this.stripHtml(comment.text || '').slice(0, 80)
				].join('|')
			},
			mergeComments(oldComments, newComments) {
				const seen = {}
				const result = []
				;(oldComments || []).concat(newComments || []).forEach(comment => {
					const key = this.commentKey(comment)
					if (!seen[key]) {
						seen[key] = true
						result.push(comment)
					}
				})
				return result
			},
			sortComments(comments) {
				return (comments || []).slice().sort((a, b) => {
					const af = Number(a.floor)
					const bf = Number(b.floor)
					if (!isNaN(af) && !isNaN(bf)) {
						return af - bf
					}
					return 0
				})
			},
			getPostInfoFromHtml(html) {
				const titleMatch = String(html || '').match(/<title>(.*?)<\/title>/i)
				if (!this.info.title && titleMatch) {
					this.info.title = titleMatch[1].replace(/\s*-\s*妖火网.*/, '').trim()
				}
				const readMatch = String(html || '').match(/浏览(?:次数)?[^\d]*(\d+)/)
				this.info.readCount = readMatch ? readMatch[1] : this.info.readCount || ''
				const timeMatch = String(html || '').match(/(\d{4}-\d{1,2}-\d{1,2}[\s\S]{0,20})/)
				this.info.time = timeMatch ? this.stripHtml(timeMatch[1]) : this.info.time || ''
			},
			getReply(reply, comments) {
				if (!reply || reply.data == 'listE') {
					return
				}
				let replyObj = {}
				let first = reply.children[0]
				replyObj.floor = first.data.match(/\[(.*?)\]/)[1]
				if (replyObj.floor == '沙发') {
					replyObj.floor = '1'
				} else if (replyObj.floor == '椅子') {
					replyObj.floor = '2'
				} else if (replyObj.floor == '板凳') {
					replyObj.floor = '3'
				} else if (replyObj.floor == '顶楼') {
					replyObj.floor = '顶楼'
				} else {
					replyObj.floor = replyObj.floor.replace('楼', '')
				}
				replyObj.text = ''
				first = first.next
				while (first) {
					if (first.type && first.type === 'tag' && first.name === 'span') {
						if (first.attribs.class == 'renick') {
							replyObj.user = ''
							first.children[0].children.forEach(username => {
								if (username.type == 'tag' && username.name == 'font') {
									replyObj.user += username.children[0].data
								}
								if (username.type == 'text') {
									replyObj.user += username.data
								}
							})
						}
						if (first.attribs.class == 'retime') { // 时间
							replyObj.time = first.children[0].data
						}
						if (first.attribs.class == 'reother') {
							replyObj.text += `[<b>${first.children[0].data}</b>]`
						}
						if (first.attribs.class == 'remanage') {
							replyObj.remanage = [];
							first.children.forEach(remanageBox => {
								if (remanageBox.type === 'tag' && remanageBox.name === 'a') {
									replyObj.remanage.push({
										url: remanageBox.attribs.href,
										option: remanageBox.children[0].data
									})
								}
							})
						}
						if (first.attribs.class == 'retext') {
							replyObj.text += ''
							first.children.forEach(ContentBox => {
								if (ContentBox.type === 'tag') {
									if (ContentBox.name === 'video') {
										replyObj.text +=
											`<video src="${ContentBox.attribs.src}" poster="${ContentBox.attribs.poster}"></video>`
									}
									if (ContentBox.name === 'br') {
										replyObj.text += '<br>'
									}
									if (ContentBox.name === 'img') {
										if (ContentBox.attribs.src.indexOf('face/') > -1) {
											replyObj.text += `<img src="${ContentBox.attribs.src}">`
										} else {
											replyObj.text += (replyObj.text ? '<br />' : '') + `<img style="max-width:80%" src="${ContentBox.attribs.src}">`
										}
									}
									if (ContentBox.name === 'span') {
										replyObj.text += `${ContentBox.children[0].data}`
									}
									if (ContentBox.name === 'a' && ContentBox.attribs.href) {
										if (ContentBox.attribs.href.indexOf('book_re_addfileshow') > -1) {
											uni.request({
												url: `https://yaohuo.me${ContentBox.attribs.href}`,
												header: getAuthHeader(),
												success: (res) => {
													let imgUrl = res.data.match(/img src=\"(.*?)\"/)
													if (imgUrl) {
														replyObj.text += `<img style="max-width:80%" src="https://yaohuo.me${imgUrl[1]}">`
													} else {
														let fileUrl = res.data.match(
															/\"(\/bbs\/download.*?)\"/)
														if (fileUrl) {
															replyObj.text +=
																`<a href="https://yaohuo.me${fileUrl[1]}">点击复制附件链接</a>`
														}
													}
												}
											})
										}
										if (ContentBox.attribs.href.indexOf('bbs-') < 0 && ContentBox.attribs.href.indexOf('bbs/Book_re.aspx') < 0 && ContentBox.attribs.href.indexOf('bbs/Book_re_del.aspx') < 0 && ContentBox.attribs.href.indexOf('book_re_addfileshow') < 0) {
											replyObj.text += `<a href="${ContentBox.attribs.href}">${ContentBox.children[0].data}</a>`
										}
										if (ContentBox.attribs.href.indexOf('bbs-') > -1) {
											let url = ContentBox.attribs.href
											replyObj.text += `<a href="${url}">${ContentBox.children[0].data}</a>`
										}
									}
								}
								if (ContentBox.type === 'text') {
									replyObj.text += ContentBox.data
								}
							})
						}
					}
					first = first.next
				}
				replyObj.text = replyObj.text.replace('{}', '').replace('[]', '')
				comments.push(replyObj)
				reply = reply.next
				this.getReply(reply, comments)
				return comments
			},
			getPostInfo($) {
				// this.info.postId = this.url.split('-')[1].split('.')[0]
				let data = $('.content')[0]
				let children = data.children
				if (children[0].data.indexOf('标题') > -1) {
					this.info.title = children[0].data.match(/](.*?)\(阅/)[1].trim()
					this.info.readCount = children[0].data.match(/\(阅(.*?)\)/)[1].trim()
					this.info.time = children[2].data.match(/\](.*)/)[1].trim()
				} else if (children[0].data.indexOf('悬赏') > -1) {
					this.info.title = children[2].data.match(/](.*?)\(阅/)[1].trim()
					this.info.readCount = children[2].data.match(/\(阅(.*?)\)/)[1].trim()
					this.info.time = children[4].data.match(/\](.*)/)[1].trim()
					this.info.extra = children[0].data
				} else if (children[0].data.indexOf('礼金') > -1) {
					this.info.title = children[4].data.match(/](.*?)\(阅/)[1].trim()
					this.info.readCount = children[4].data.match(/\(阅(.*?)\)/)[1].trim()
					this.info.time = children[6].data.match(/\](.*)/)[1].trim()
					this.info.extra = children[0].data
				}
				let authorData = $('.subtitle')[0]
				let authorChildren = authorData.children[1].children
				if (authorChildren.length === 1) {
					this.info.author = authorChildren[0].data
				} else {
					let first = authorChildren[0]
					this.info.author = ''
					while (first) {
						if (first.type === 'text' && first.data !== ' ') {
							this.info.author += first.data
						}
						if (first.type === 'tag' && first.name === 'font') {
							this.info.author += first.children[0].data
						}
						first = first.next
					}
				}
			}
		}
	}
</script>
<style>
	page {
		background: #fff;
	}
</style>
<style scoped>
	.content {
		padding: 20rpx 20rpx 0;
	}

	.title {
		color: 999;
	}

	.info {
		color: rgba(0, 0, 0, .3);
	}

	.tip {
		text-align: center;
	}

	.tip-text {
		background: rgba(247, 247, 247);
		font-size: 28upx;
		line-height: 28upx;
		padding: 0 30upx;
		border-radius: 30upx;
		color: #333 !important;
		display: inline-block;
	}
</style>
