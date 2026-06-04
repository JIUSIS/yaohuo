<template>
	<view class="webview-page">
		<web-view :src="url"></web-view>
		<view v-if="url && !loginMode" class="browser-open-btn" @click.stop="openCurrentUrlInBrowser">浏览器打开</view>
	</view>
</template>

<script>
	import {
		syncAuthCookieFromSystem,
		verifyAuthCookie
	} from '@/utils/auth.js'
	import {
		openInBrowser
	} from '@/utils/browser.js'

	export default {
		data() {
			return {
				url: '',
				loginCheckTimer: null,
				loginMode: false,
				checking: false,
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
			openCurrentUrlInBrowser() {
				openInBrowser(this.url)
			},
			checkLogin() {
				if (!this.loginMode || this.redirecting || this.checking || !syncAuthCookieFromSystem()) {
					return
				}
				this.checking = true
				verifyAuthCookie().then(valid => {
					this.checking = false
					if (!valid) {
						return
					}
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
				})
			},
			startLoginCheck() {
				this.stopLoginCheck()
				this.loginCheckTimer = setInterval(() => {
					this.checkLogin()
				}, 1200)
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

	.browser-open-btn {
		position: fixed;
		right: 24rpx;
		bottom: 34rpx;
		z-index: 20;
		padding: 14rpx 22rpx;
		border-radius: 8rpx;
		background: rgba(7, 193, 96, .92);
		color: #fff;
		font-size: 13px;
		line-height: 1;
		box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, .16);
	}
</style>
