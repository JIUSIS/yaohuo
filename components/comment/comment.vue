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
								<view class="uni-comment-reply-btn danger" v-if="comment.remanage" v-for="item in comment.remanage" @click="CommentOption(index, item)">删除
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
		<view style="position: fixed;bottom: 0;background-color: #f7f7f7;left: 0;right: 0;">
			<view class="" style="padding: 10rpx 20rpx 0;">
				<uni-row>
					<uni-col :span="18">
						<view style="display: inline-block;margin-right: 20rpx;">
							<picker @change="bindPickerChange" :value="faceIndex" :range="array" range-key="name">
								<image src="../../static/smile.png" style="width: 70rpx;height: 70rpx;"></image>
							</picker>
						</view>
						<view style="display: inline-block;margin-right: 25rpx;">
							<image @click="uploadImage" src="../../static/picture.png"
								style="width: 70rpx;height: 70rpx;"></image>
						</view>
						<view style="display: inline-block;margin-right: 30rpx;">
							<image @click="showToast" src="../../static/video.png"
								style="width: 60rpx;height: 60rpx;margin-bottom: 5rpx;">
							</image>
						</view>
						<view style="display: inline-block;margin-right: 20rpx;">
							<image @click="showToast" src="../../static/music.png"
								style="width: 60rpx;height: 60rpx;margin-bottom: 5rpx;">
							</image>
						</view>
					</uni-col>
					<uni-col :span="6">
						<view class="text-right" v-show="replyData.content">
							<button :loading="loading" :disabled="loading" class="submit-btn" type="primary" size="mini"
								@click="reply">发表</button>
						</view>
					</uni-col>
				</uni-row>
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
			uploadImage() {
				uni.chooseImage({
					success: (chooseImageRes) => {
						const tempFilePaths = chooseImageRes.tempFilePaths;
						uni.showLoading({
							title: '图片上传中'
						})
						uni.uploadFile({
							url: 'https://yh-pic.ihcloud.net/api/qq.php', //仅为示例，非真实的接口地址
							filePath: tempFilePaths[0],
							name: 'image',
							success: (uploadFileRes) => {
								let jsonRes = JSON.parse(uploadFileRes.data)
								let url = jsonRes.data.url
								if (url.indexOf('失效') > -1){
									uni.showToast({
										title:'接口暂时失效'
									})
								}else{
									let ubb = `[img]${url}[/img]`
									this.replyData.content += ubb
								}
							},
							fail: () => {
								uni.showToast({
									title: '上传失败',
									icon: 'error'
								})
							},
							complete: () => {
								uni.hideLoading()
							}
						});
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
			bindPickerChange: function(e) {
				this.faceIndex = e.detail.value;
				if (this.faceIndex) {
					this.replyData.face = this.array[this.faceIndex].face
				}
			},
			cancelReply() {
				this.isReplyFloor = false
				delete this.replyData.reply
				delete this.replyData.touserid
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
									let url = item.url.replace('go', 'godel')
									uni.showLoading({
										mask:true
									})
									uni.request({
										url: 'https://yaohuo.me' + url,
										method: 'GET',
										header: getAuthHeader({
											'Content-Type': 'application/x-www-form-urlencoded'
										}),
										success: (res) => {
											let $ = cheerio.load(res.data)
											let replies = $('.tip')
											let tip = replies[0]['children'][0]
											if (tip.next) {
												uni.showToast({
													title: '删除成功',
													icon: 'success'
												})
												this.$emit('fetchReply', 1)
											} else {
												uni.showModal({
													title: '删除失败',
													content: tip['data'],
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
				if (!this.replyData.content) {
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

	.submit-btn {
		color: #fff;
		height: 70rpx;
		line-height: 70rpx;
		background-color: #07c160;
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
