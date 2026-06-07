<template>
	<view class="page">
		<view class="card">
			<textarea class="input" v-model="content" auto-height :maxlength="-1" placeholder="输入私信内容"
				:show-confirm-bar="false"></textarea>
			<button class="submit" :loading="loading" :disabled="loading" @click="sendMessage">发送私信</button>
		</view>
	</view>
</template>

<script>
	import {
		clearAuthCookie,
		getAuthHeader,
		isLoginRequiredHtml
	} from '@/utils/auth.js'
	import {
		stripHtml
	} from '@/utils/html.js'
	import {
		extractMessageForm
	} from '@/utils/list-pages.js'

	export default {
		data() {
			return {
				userId: '',
				url: '',
				action: 'https://yaohuo.me/bbs/messagelist_add.aspx',
				fields: {},
				content: '',
				loading: false,
				formLoading: false
			}
		},
		onLoad(option) {
			option = option || {}
			this.userId = String(option.id || option.touserid || '').replace(/[^\d]/g, '')
			this.url = option.url ? decodeURIComponent(option.url) :
				`https://yaohuo.me/bbs/messagelist_add.aspx?touserid=${this.userId}`
			uni.setNavigationBarTitle({
				title: '发私信'
			})
			this.fetchForm()
		},
		methods: {
			fetchForm() {
				this.formLoading = true
				uni.request({
					url: this.url,
					header: getAuthHeader(),
					success: res => {
						const html = String(res.data || '')
						if (isLoginRequiredHtml(html)) {
							return this.goLogin()
						}
						const form = extractMessageForm(html, this.url)
						this.action = form.action || this.action
						this.fields = form.fields || {}
						if (form.title) {
							uni.setNavigationBarTitle({
								title: form.title.replace(/\s*-\s*妖火网.*/, '')
							})
						}
					},
					complete: () => {
						this.formLoading = false
					}
				})
			},
			sendMessage() {
				const content = String(this.content || '').trim()
				if (!content) {
					return uni.showToast({
						title: '请输入内容',
						icon: 'none'
					})
				}
				const data = Object.assign({}, this.fields, {
					content,
					action: this.fields.action || 'gomod',
					classid: this.fields.classid || 0,
					siteid: this.fields.siteid || 1000,
					types: this.fields.types || 0,
					issystem: this.fields.issystem || '',
					title: this.fields.title || '',
					touseridlist: this.fields.touseridlist || this.userId,
					g: this.fields.g || '发送消息'
				})
				this.loading = true
				uni.request({
					url: this.action,
					method: 'POST',
					header: getAuthHeader({
						Referer: this.url,
						'Content-Type': 'application/x-www-form-urlencoded'
					}),
					data,
					success: res => {
						const text = stripHtml(String(res.data || ''))
						if (/发送信息成功|发送成功|成功/.test(text)) {
							this.content = ''
							uni.showToast({
								title: '发送成功',
								icon: 'success'
							})
							setTimeout(() => uni.navigateBack(), 500)
							return
						}
						uni.showModal({
							title: '发送结果',
							content: text.slice(0, 160) || '服务器未返回明确结果',
							showCancel: false
						})
					},
					fail: () => {
						uni.showToast({
							title: '发送失败',
							icon: 'none'
						})
					},
					complete: () => {
						this.loading = false
					}
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
		background: #f3f3f3;
	}

	.page {
		padding: 20rpx;
	}

	.card {
		padding: 22rpx;
		background: #fff;
		border-radius: 8px;
	}

	.input {
		width: 100%;
		min-height: 240rpx;
		padding: 18rpx;
		border: 1px solid #eef2f2;
		border-radius: 8px;
		box-sizing: border-box;
		font-size: 15px;
	}

	.submit {
		margin-top: 22rpx;
		height: 78rpx;
		line-height: 78rpx;
		border-radius: 8px;
		background: #0a8f7c;
		color: #fff;
		font-size: 15px;
	}
</style>
