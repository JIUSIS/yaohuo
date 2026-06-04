<template>
	<view class="webview-page">
		<web-view :src="url"></web-view>
	</view>
</template>

<script>
	import {
		syncAuthCookieFromSystem
	} from '@/utils/auth.js'

	export default {
		data() {
			return {
				url: '',
				loginCheckTimer: null,
				loginMode: false,
				redirecting: false
			}
		},
		onLoad(option) {
			this.url = decodeURIComponent(option.url || '')
			this.loginMode = option.login === '1' || this.url.indexOf('waplogin.aspx') > -1
			if (this.loginMode) {
				this.startLoginCheck()
			}
		},
		onUnload() {
			this.stopLoginCheck()
		},
		methods: {
			checkLogin() {
				if (!this.loginMode || this.redirecting) {
					return
				}
				if (syncAuthCookieFromSystem()) {
					this.redirecting = true
					this.stopLoginCheck()
					uni.showToast({
						title: '登录成功',
						icon: 'success'
					})
					setTimeout(() => {
						uni.reLaunch({
							url: '/pages/index/index'
						})
					}, 300)
				}
			},
			startLoginCheck() {
				this.stopLoginCheck()
				this.loginCheckTimer = setInterval(() => {
					this.checkLogin()
				}, 1000)
			},
			stopLoginCheck() {
				if (this.loginCheckTimer) {
					clearInterval(this.loginCheckTimer)
					this.loginCheckTimer = null
				}
			}
		}
	}
</script>

<style lang="scss" scoped>
	.webview-page {
		width: 100vw;
		height: 100vh;
	}
</style>
