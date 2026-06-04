<template>
	<view class="content">
		<view class="logo">
			<image src="https://yaohuo.me/tupian/yaohuo.png"></image>
		</view>
		<uni-forms :modelValue="formData" label-position="top">
			<uni-forms-item required label="用户名" name="username">
				<uni-easyinput type="text" v-model="formData.username" placeholder="请输入用户名" />
			</uni-forms-item>
			<uni-forms-item required name="password" label="密码">
				<uni-easyinput type="password" v-model="formData.password" placeholder="请输入密码" />
			</uni-forms-item>
		</uni-forms>
		<button @click="openWebLogin" type="default" class="btn">网页登录</button>
		<button @click="syncWebLogin" type="default" class="btn ghost">已登录，进入App</button>
		<button @click="clearLogin" type="default" class="btn ghost">清除登录状态</button>
	</view>
</template>

<script>
	import {
		getAuthCookieFromResponse,
		setSystemCookie,
		syncAuthCookieFromSystem
	} from '@/utils/auth.js'
	export default {
		data() {
			return {
				formData: {
					username: '',
					password: ''
				},
				loading: false
			}
		},
		onShow() {
			this.syncWebLogin(true)
		},
		methods: {
			openWebLogin() {
				uni.navigateTo({
					url: `/pages/webview/webview?url=${encodeURIComponent('https://yaohuo.me/waplogin.aspx?fallback=1')}`
				})
			},
			clearLogin() {
				uni.removeStorageSync('cookie')
				setSystemCookie('https://yaohuo.me', 'sidyaohuo=; expires=Thu, 01 Jan 1970 00:00:00 GMT;')
				uni.showToast({
					title: '已清除',
					icon: 'none'
				})
			},
			syncWebLogin(silent) {
				const cookie = syncAuthCookieFromSystem()
				if (!cookie) {
					if (!silent) {
						uni.showToast({
							title: '还没检测到登录',
							icon: 'none'
						})
					}
					return
				}
				uni.showToast({
					title: '登陆成功',
					icon: 'success'
				})
				setTimeout(() => {
					uni.redirectTo({
						url: '/pages/index/index'
					})
				}, 500)
			},
			login() {
				this.loading = true
				const loginUrl = 'https://yaohuo.me/waplogin.aspx'
				setSystemCookie('https://yaohuo.me', 'sidyaohuo=; expires=Thu, 01 Jan 1970 00:00:00 GMT;')
				uni.request({
					url: loginUrl,
					method: 'POST',
					header: {
						'Content-Type': 'application/x-www-form-urlencoded',
					},
					data: {
						logname: this.formData.username,
						logpass: this.formData.password,
						action: 'login',
						classid: 0,
						siteid: 1000,
						sid: '',
						backurl: 'wapindex.aspx?sid=-2',
						referer: '',
						remember: 1
					},
					success: (res) => {
						const sidCookie = getAuthCookieFromResponse(res, 'https://yaohuo.me')
						if (!sidCookie) {
							let matchReg = /<div class=\"tip\">([\s\S]*)<\/div><body id=\"login\"/;
							let tip = String(res.data || '').match(matchReg)
							return uni.showToast({
								title: tip && tip[1] ? tip[1] : '登录失败',
								icon: 'error'
							})
						}
						uni.setStorageSync('cookie', sidCookie)
						setSystemCookie('https://yaohuo.me', sidCookie)
						uni.showToast({
							title: '登陆成功',
							icon: 'success'
						})
						setTimeout(() => {
							uni.redirectTo({
								url: '/pages/index/index'
							})
						}, 500)

					},
					fail: (err) => {
						uni.showToast({
							title: '连接服务器失败',
							icon: 'error'
						})
					},
					complete: () => {
						this.loading = false
					}
				})
			}
		}
	}
</script>

<style lang="scss" scoped>
	.content {
		padding: 0 20rpx;

		.btn {
			color: #fff;
			background-color: rgb(0, 122, 255);
		}

		.logo {
			text-align: center;
			margin: 60rpx 0;

			image {
				width: 180px;
				height: 61px;
			}
		}

	}

	.ghost {
		margin-top: 20rpx;
		background-color: #666;
	}
</style>
