<template>
	<view class="login-page">
		<web-view :src="loginUrl"></web-view>
	</view>
</template>

<script>
	import {
		clearAuthCookie,
		syncAuthCookieFromSystem,
		verifyAuthCookie
	} from '@/utils/auth.js'

	export default {
		data() {
			return {
				loginUrl: 'https://yaohuo.me/waplogin.aspx?fallback=1',
				checkTimer: null,
				checking: false,
				redirecting: false
			}
		},
		onLoad(option) {
			if (option && option.clear === '1') {
				clearAuthCookie()
			}
			this.checkLogin()
			this.startLoginCheck()
		},
		onShow() {
			this.checkLogin()
		},
		onUnload() {
			this.stopLoginCheck()
		},
		methods: {
			startLoginCheck() {
				this.stopLoginCheck()
				this.checkTimer = setInterval(() => {
					this.checkLogin()
				}, 1200)
			},
			stopLoginCheck() {
				if (this.checkTimer) {
					clearInterval(this.checkTimer)
					this.checkTimer = null
				}
			},
			checkLogin() {
				if (this.redirecting || this.checking || !syncAuthCookieFromSystem()) {
					return
				}
				this.checking = true
				verifyAuthCookie().then(valid => {
					this.checking = false
					if (valid) {
						uni.showToast({
							title: '登录成功',
							icon: 'success'
						})
						this.goHome()
					}
				})
			},
			goHome() {
				if (this.redirecting) {
					return
				}
				this.redirecting = true
				this.stopLoginCheck()
				setTimeout(() => {
					uni.reLaunch({
						url: '/pages/index/index'
					})
				}, 300)
			}
		}
	}
</script>

<style lang="scss" scoped>
	.login-page {
		width: 100vw;
		height: 100vh;
	}
</style>
