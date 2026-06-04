<template>
	<view>
		<view class="uni-padding-wrap">
			<!-- 评论区 start -->
			<uni-row>
				<uni-col :span="12">
					<view class="f-16">全部评论（共{{postInfo.replyCount}}条）</view>
				</uni-col>
				<uni-col :span="12">
					<view class="text-right">
						<uni-icons class="refresh-comment-icon" @click="$emit('fetchReply',1)"
							style="vertical-align: -5px;" type="refreshempty" size="20"></uni-icons>
					</view>
				</uni-col>
			</uni-row>
			<view class="uni-comment">
				<view style="border-bottom:  1px dashed #dcdcdc;" class="uni-comment-list" v-for="(comment,index) in comments" :key="index">
					<view class="uni-comment-face">
						<view class="floor">
							{{comment.floor}}
						</view>
					</view>
					<view class="uni-comment-body">
						<view class="uni-comment-top">
							<text @click="goToUserArea(index)">{{comment.user}}</text>
						</view>
						<view class="uni-comment-date">
							<text>{{comment.time}}</text>
							<view class="flex">
								<view class="uni-comment-reply-btn danger" v-if="comment.remanage && comment.remanage.length"
									v-for="item in comment.remanage" @click="CommentOption(index, item)">删除
								</view>
								<view class="uni-comment-reply-btn" v-if="!postInfo.isEnd" @click="replyToFloor(index)">回复
								</view>
							</view>
						</view>
						<mp-html :content="comment.text" selectable domain="https://yaohuo.me"
							containerStyle="line-height:40rpx;word-break: break-all;font-size:30rpx" :copyLink="false"
							@linktap="linkTap"></mp-html>
					</view>
				</view>
			</view>
		</view>
		<view class="comment-composer">
			<view class="comment-toolbar">
				<view class="tool-group">
					<view class="tool-button" @click="toggleFacePanel">
						<image v-if="selectedFace" :src="getFaceUrl(selectedFace.face)" class="tool-image selected-face"
							mode="aspectFit"></image>
						<image v-else src="../../static/smile.png" class="tool-image" mode="aspectFit"></image>
					</view>
					<view class="tool-button" @click="uploadImage">
						<image src="../../static/picture.png" class="tool-image" mode="aspectFit"></image>
					</view>
					<view class="tool-button" @click="showToast">
						<image src="../../static/video.png" class="tool-image small" mode="aspectFit"></image>
					</view>
					<view class="tool-button" @click="showToast">
						<image src="../../static/music.png" class="tool-image small" mode="aspectFit"></image>
					</view>
				</view>
				<button v-if="!replyData.content && !replyData.face" class="browser-open-btn" size="mini"
					@click="$emit('open-browser')">浏览器打开</button>
				<button v-show="replyData.content || replyData.face" :loading="loading" :disabled="loading"
					class="submit-btn" type="primary" size="mini" @click="reply">发表</button>
			</view>
			<view v-if="facePanelShow" class="face-panel">
				<scroll-view scroll-y class="face-scroll">
					<view class="face-grid">
						<view class="face-cell" :class="{active: !replyData.face}" @click="selectFace(0)">
							<text>无</text>
						</view>
						<view v-for="(item,index) in faceList" :key="item.face" class="face-cell"
							:class="{active: replyData.face === item.face}" @click="selectFace(index + 1)">
							<image :src="getFaceUrl(item.face)" mode="aspectFit"></image>
							<text>{{item.name}}</text>
						</view>
					</view>
				</scroll-view>
			</view>
			<view style="background-color: #fff;padding: 20rpx;margin: 0 20rpx 20rpx;">
				<textarea :maxlength="-1" :fixed="true" style="width: 100%;" :cursor-spacing="20"
					:adjust-position='true' type="text" :focus="isReplyFloor" @blur="isReplyFloor=false"
					v-model="replyData.content" :placeholder="replyTips" :auto-height="true"
					:show-confirm-bar="false"></textarea>
			</view>
		</view>
	</view>
</template>

<script>
	import {
		cheerio
	} from '@/utils/cheerio.js'
	import faces from '@/utils/faces.js'
	import {
		getAuthHeader,
		getAuthSid
	} from '@/utils/auth.js'
	export default {
		name: 'comment',
		props: {
			comments: {
				type: Array,
				default: () => {
					return []
				}
			},
			postInfo: {
				type: Object,
				default: () => {
					return {}
				}
			}
		},
		data() {
			return {
				replyTips: '请勿乱打字回复,以免被加黑。',
				array: faces,
				faceIndex: 0,
				facePanelShow: false,
				loading: false,
				isReplyFloor: false,
				replyModalShow: false,
				replyData: {
					face: '',
					sendmsg: 0,
					content: '',
					action: 'add',
					id: this.postInfo.postId,
					siteid: 1000,
					lpage: 1,
					classid: this.postInfo.classId,
					sid: getAuthSid(),
					g: '快速回复'
				},
				originReplyData: {}
			}
		},
		computed: {
			faceList() {
				return this.array.filter(item => item.face)
			},
			selectedFace() {
				return this.array[this.faceIndex] && this.array[this.faceIndex].face ? this.array[this.faceIndex] : null
			}
		},
		mounted() {
			this.originReplyData = JSON.parse(JSON.stringify(this.replyData))
		},
		methods: {
			getPostClassId() {
				const match = String(this.postInfo.classId || '').match(/\d+/)
				return match ? match[0] : ''
			},
			syncReplyData() {
				this.replyData.id = this.postInfo.postId
				this.replyData.classid = this.getPostClassId()
				this.replyData.siteid = 1000
				this.replyData.sid = getAuthSid()
				this.replyData.lpage = this.replyData.lpage || 1
			},
			showToast() {
				uni.showToast({
					title: '开发中',
					icon: 'none'
				})
			},
			getFaceUrl(face) {
				return face ? `https://yaohuo.me/face/${encodeURIComponent(face)}` : ''
			},
			toggleFacePanel() {
				this.facePanelShow = !this.facePanelShow
			},
			selectFace(index) {
				this.faceIndex = index
				const item = this.array[index]
				this.replyData.face = item && item.face ? item.face : ''
				this.facePanelShow = false
			},
			extractUploadUrl(data) {
				if (!data) {
					return ''
				}
				if (typeof data === 'string') {
					const text = data.trim()
					if (/^https?:\/\//i.test(text)) {
						return text
					}
					try {
						return this.extractUploadUrl(JSON.parse(text))
					} catch (e) {
						const urlMatch = text.match(/https?:\/\/[^\s"'<>\\]+/i)
						return urlMatch ? urlMatch[0] : ''
					}
				}
				if (data.code === 200 && data.data && data.data.url) {
					return data.data.url
				}
				if (data.data) {
					if (typeof data.data === 'string' && /^https?:\/\//i.test(data.data)) {
						return data.data
					}
					if (Array.isArray(data.data) && data.data[0]) {
						return this.extractUploadUrl(data.data[0])
					}
					const dataUrl = this.extractUploadUrl(data.data)
					if (dataUrl) {
						return dataUrl
					}
				}
				if (data.url && /^https?:\/\//i.test(data.url)) {
					return data.url
				}
				for (const key in data) {
					if (typeof data[key] === 'string' && /^https?:\/\//i.test(data[key])) {
						return data[key]
					}
				}
				return ''
			},
			uploadToHost(filePath, hostIndex) {
				const hosts = [{
					url: 'https://tc.qdqqd.com/uploadmt',
					field: 'file'
				}, {
					url: 'https://aapi.helioho.st/upload.php',
					field: 'image'
				}, {
					url: 'https://yh-pic.ihcloud.net/api/qq.php',
					field: 'image'
				}]
				const host = hosts[hostIndex]
				if (!host) {
					return Promise.reject(new Error('全部图床都上传失败'))
				}
				return new Promise((resolve, reject) => {
					uni.uploadFile({
						url: host.url,
						filePath,
						name: host.field,
						header: {
							Referer: 'https://yaohuo.me/'
						},
						success: (uploadFileRes) => {
							const url = this.extractUploadUrl(uploadFileRes.data)
							if (url) {
								resolve(url)
							} else {
								reject(new Error(String(uploadFileRes.data || '').slice(0, 80) || '图床未返回图片地址'))
							}
						},
						fail: (err) => {
							reject(new Error((err && (err.errMsg || err.message)) || '上传请求失败'))
						}
					})
				}).catch(() => this.uploadToHost(filePath, hostIndex + 1))
			},
			uploadImage() {
				uni.chooseImage({
					count: 1,
					success: (chooseImageRes) => {
						const tempFilePaths = chooseImageRes.tempFilePaths
						uni.showLoading({
							title: '图片上传中'
						})
						this.uploadToHost(tempFilePaths[0], 0).then(url => {
							this.replyData.content += `${this.replyData.content ? '\n' : ''}[img]${url}[/img]`
							uni.hideLoading()
							uni.showToast({
								title: '上传成功',
								icon: 'success'
							})
						}).catch(err => {
							uni.hideLoading()
							uni.showModal({
								title: '上传失败',
								content: (err && err.message) || '图床接口暂时不可用',
								showCancel: false
							})
						})
					},
					fail: () => {
						uni.showToast({
							title: '未选择图片',
							icon: 'none'
						})
					}
				})
			},
			linkTap(e) {
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
			},
			cancelReply() {
				this.isReplyFloor = false
				delete this.replyData.reply
				delete this.replyData.touserid
				this.faceIndex = 0
				this.replyData.face = ''
				this.facePanelShow = false
				this.replyData.g = '快速回复'
				this.replyTips = '请勿乱打字回复,以免被加黑。'
			},
			replyToFloor(index) {
				let floor = this.comments[index]
				this.replyData.g = '发表回复'
				this.replyData.reply = floor.floor
				const userId = floor.userId || this.getUserId(floor.user)
				if (!userId) {
					return uni.showToast({
						title: '无法获取用户ID',
						icon: 'none'
					})
				}
				this.replyData.touserid = userId
				this.isReplyFloor = true
				this.replyTips = `回复${floor.floor}楼：`
			},
			CommentOption(index, item){
				switch (item.option) {
					case '删':
						uni.showModal({
							title: '删除操作',
							content: `删除自己回贴扣2倍币和经验！如有附件一并删除。`,
							confirmText: '确定删除',
							success: (res) => {
								if (res.confirm) {
									let url = this.getDeleteUrl(item.url)
									uni.showLoading({
										mask:true
									})
									uni.request({
										url,
										method: 'GET',
										header: getAuthHeader({
											'Content-Type': 'application/x-www-form-urlencoded'
										}),
										success: (res) => {
											let $ = cheerio.load(res.data)
											let replies = $('.tip')
											let tip = replies[0] && replies[0]['children'] ? replies[0]['children'][0] : null
											let tipText = tip && tip['data'] ? tip['data'] : '服务器未返回删除结果'
											if (tip && tip.next) {
												uni.showToast({
													title: '删除成功',
													icon: 'success'
												})
												this.$emit('fetchReply', 1)
											} else {
												uni.showModal({
													title: '删除失败',
													content: tipText,
													showCancel: false
												})
											}
										},
										fail: (err) => {
											uni.showToast({
												title: '删除失败',
												icon: 'error'
											})
										},
										complete: () => {
											uni.hideLoading()
										}
									})
								}
							}
						})
						break;
					default:
				}
			},
			getDeleteUrl(rawUrl) {
				let url = String(rawUrl || '').replace(/&amp;/g, '&')
				if (/^\/\//.test(url)) {
					url = 'https:' + url
				} else if (!/^https?:\/\//i.test(url)) {
					url = 'https://yaohuo.me' + (url.charAt(0) === '/' ? url : '/' + url)
				}
				if (/action=/i.test(url)) {
					return url.replace(/([?&]action=)[^&#]*/i, '$1godel')
				}
				return url + (url.indexOf('?') > -1 ? '&' : '?') + 'action=godel'
			},
			goToUserArea(index) {
				let comment = this.comments[index]
				let id = comment.userId || this.getUserId(comment.user)
				if (!id) {
					return uni.showToast({
						title: '无法获取用户ID',
						icon: 'none'
					})
				}
				uni.navigateTo({
					url: `/pages/webview/webview?url=https://yaohuo.me/bbs/userinfo.aspx?touserid=${id}`
				})
			},
			getUserId(user) {
				const match = String(user || '').match(/\((\d{1,10})\)/)
				return match ? match[1] : ''
			},
			reply() {
				this.syncReplyData()
				if (!this.replyData.classid) {
					return uni.showToast({
						title: '缺少版块ID',
						icon: 'none'
					})
				}
				if (!this.replyData.content && !this.replyData.face) {
					return uni.showToast({
						title: '评论不得为空',
						icon: 'error'
					})
				}
				this.replyData.content = this.replyData.content.replace(/\n/g, '\r\n')
				this.loading = true
				uni.request({
					url: 'https://yaohuo.me/bbs/book_re.aspx',
					method: 'POST',
					header: getAuthHeader({
						'Content-Type': 'application/x-www-form-urlencoded'
					}),
					data: this.replyData,
					success: (res) => {
						const html = String(res.data || '')
						if (/<div class=["']tip["'][^>]*>[\s\S]*?(失败|错误|验证码|登录|为空|加黑|限制|不能|请先)/.test(html)) {
							const tip = html.match(/<div class=["']tip["'][^>]*>([\s\S]*?)<\/div>/i)
							return uni.showModal({
								title: '评论失败',
								content: tip ? tip[1].replace(/<[^>]+>/g, '').trim() : '服务器返回失败',
								showCancel: false
							})
						}
						uni.showToast({
							title: '评论成功',
							icon: 'success'
						})
						this.cancelReply()
						this.$emit('fetchReply', 1)
					},
					fail: (err) => {
						uni.showToast({
							title: '评论失败',
							icon: 'error'
						})
					},
					complete: () => {
						this.loading = false
						this.replyData.content = ''
					}
				})
			}
		}
	}
</script>

<style scoped>
	/* comment */
	page {
		background-color: #fff;
	}

	.uni-padding-wrap {
		padding: 0 20rpx 200rpx;
	}


	.uni-comment {
		padding: 5rpx 0;
		display: flex;
		flex-grow: 1;
		flex-direction: column;
	}

	.uni-comment-list {
		flex-wrap: nowrap;
		padding: 10rpx 0;
		margin: 10rpx 0;
		width: 100%;
		display: flex;
	}

	.uni-comment-face {
		width: 70rpx;
		height: 70rpx;
		border-radius: 50%;
		margin-right: 15rpx;
		background-color: #1E90FF;
	}

	.uni-comment-face image {
		width: 100%;
		border-radius: 100%;
	}

	.uni-comment-body {
		width: calc(100% - 85rpx);
	}

	.uni-comment-top {
		line-height: 1.5em;
		justify-content: space-between;
	}

	.uni-comment-top text {
		color: #0A98D5;
		font-size: 30upx;
	}

	.uni-comment-date {
		line-height: 38upx;
		flex-direction: row;
		justify-content: space-between;
		display: flex !important;
		flex-grow: 1;
		color: rgba(0, 0, 0, .3);
		font-size: 24rpx;
	}

	.uni-comment-date view {
		color: #666666;
		font-size: 24upx;
		line-height: 38upx;
	}

	.uni-comment-content {
		line-height: 1.6em;
		font-size: 28upx;
		padding: 8rpx 0;
	}

	.uni-comment-reply-btn {
		background: rgba(247, 247, 247);
		font-size: 24upx;
		line-height: 28upx;
		padding: 5rpx 20upx;
		border-radius: 30upx;
		color: #333 !important;
		margin: 0 10upx;
	}
	.uni-comment-reply-btn.danger{
		background: #ff4400;
		color: #fff !important;
	}

	.refresh-comment-icon {
		background: rgba(247, 247, 247);
		padding: 15upx;
		border-radius: 50%;
		color: #333 !important;
	}

	.comment-composer {
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		background-color: #f7f7f7;
	}

	.comment-toolbar {
		height: 92rpx;
		padding: 10rpx 20rpx 0;
		display: flex;
		align-items: center;
		justify-content: space-between;
		box-sizing: border-box;
	}

	.tool-group {
		display: flex;
		align-items: center;
		gap: 18rpx;
	}

	.tool-button {
		width: 72rpx;
		height: 72rpx;
		display: flex;
		align-items: center;
		justify-content: center;
		flex: 0 0 72rpx;
	}

	.tool-image {
		width: 70rpx;
		height: 70rpx;
		display: block;
	}

	.tool-image.small {
		width: 62rpx;
		height: 62rpx;
	}

	.submit-btn {
		color: #fff;
		height: 70rpx;
		line-height: 70rpx;
		background-color: #07c160;
		margin: 0;
		padding: 0 28rpx;
		flex: 0 0 auto;
	}

	.browser-open-btn {
		color: #fff;
		height: 70rpx;
		line-height: 70rpx;
		background-color: #07c160;
		margin: 0;
		padding: 0 28rpx;
		flex: 0 0 auto;
	}

	.selected-face {
		width: 70rpx;
		height: 70rpx;
	}

	.face-panel {
		margin: 8rpx 20rpx 0;
		background: #fff;
		border: 1px solid #eee;
		border-radius: 8rpx;
	}

	.face-scroll {
		height: 330rpx;
	}

	.face-grid {
		display: flex;
		flex-wrap: wrap;
		padding: 10rpx;
	}

	.face-cell {
		width: 20%;
		height: 106rpx;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		box-sizing: border-box;
		border-radius: 8rpx;
		color: #666;
		font-size: 20rpx;
	}

	.face-cell.active {
		background: #eaf7f4;
		color: #0a8f7c;
	}

	.face-cell image {
		width: 58rpx;
		height: 58rpx;
		margin-bottom: 4rpx;
	}

	.face-cell text {
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.floor {
		width: 70rpx;
		height: 70rpx;
		line-height: 70rpx;
		text-align: center;
		font-size: 22rpx;
		color: #ffffff;
	}
</style>
