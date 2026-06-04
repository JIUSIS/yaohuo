<template>
	<view>
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
				loginCheckTimer: null
			}
		},
		methods: {
			checkLogin() {
				if (this.url.indexOf('waplogin.aspx') < 0) {
					return
				}
				if (syncAuthCookieFromSystem()) {
					uni.showToast({
						title: '登陆成功',
						icon: 'success'
					})
					setTimeout(() => {
						uni.navigateBack()
					}, 500)
				}
			}
		},
		onLoad(option) {
			this.url = decodeURIComponent(option.url || '')
			if (this.url.indexOf('waplogin.aspx') > -1) {
				this.loginCheckTimer = setInterval(() => {
					this.checkLogin()
				}, 1000)
			}
		},
		onUnload() {
			if (this.loginCheckTimer) {
				clearInterval(this.loginCheckTimer)
				this.loginCheckTimer = null
			}
		}
	}
</script>

<style>

</style>
