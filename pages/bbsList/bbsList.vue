<template>
	<view>
		<post-list ref="postList" :url="url" @login-invalid="goLogin"></post-list>
	</view>
</template>

<script>
	import {
		clearAuthCookie
	} from '@/utils/auth.js'

	export default {
		data() {
			return {
				url: ''
			}
		},
		onLoad(option) {
			this.url = JSON.parse(decodeURIComponent(option.url)).url
		},
		onReachBottom() {
			if (this.$refs.postList) {
				this.$refs.postList.loadMore()
			}
		},
		onPullDownRefresh() {
			if (this.$refs.postList) {
				this.$refs.postList.refreshData()
			} else {
				uni.stopPullDownRefresh()
			}
		},
		methods: {
			goLogin() {
				clearAuthCookie()
				uni.redirectTo({
					url: '/pages/login/login?clear=1'
				})
			}
		}
	}
</script>

<style>
	page {
		background-color: #F3F3F3;
	}
</style>
