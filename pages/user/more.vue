<template>
	<view class="page">
		<view class="card">
			<view class="title">个人资料</view>
			<view v-if="rows.length">
				<view v-for="item in rows" :key="item.label" class="row">
					<text class="label">{{item.label}}</text>
					<text class="value">{{item.value}}</text>
				</view>
			</view>
			<view v-else-if="!loading" class="empty">暂无资料</view>
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
		parseUserMore
	} from '@/utils/list-pages.js'

	export default {
		data() {
			return {
				userId: '',
				url: '',
				rows: [],
				loading: false
			}
		},
		onLoad(option) {
			option = option || {}
			this.userId = String(option.id || option.touserid || '').replace(/[^\d]/g, '')
			this.url = option.url ? decodeURIComponent(option.url) : `https://yaohuo.me/bbs/userinfomore.aspx?touserid=${this.userId}`
			this.fetchData()
		},
		onPullDownRefresh() {
			this.fetchData()
		},
		methods: {
			fetchData() {
				this.loading = true
				uni.showLoading({
					title: '加载资料'
				})
				uni.request({
					url: this.url,
					header: getAuthHeader(),
					success: res => {
						const html = String(res.data || '')
						if (isLoginRequiredHtml(html)) {
							return this.goLogin()
						}
						const data = parseUserMore(html)
						this.rows = data.rows || []
						uni.setNavigationBarTitle({
							title: data.title || '个人资料'
						})
					},
					complete: () => {
						this.loading = false
						uni.hideLoading()
						uni.stopPullDownRefresh()
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
		background: #fff;
		border-radius: 8px;
		padding: 20rpx;
	}

	.title {
		font-size: 17px;
		font-weight: 700;
		margin-bottom: 14rpx;
	}

	.row {
		min-height: 76rpx;
		display: flex;
		align-items: center;
		border-bottom: 1px solid #f0f0f0;
	}

	.row:last-child {
		border-bottom: 0;
	}

	.label {
		width: 180rpx;
		color: #6b7280;
		font-size: 14px;
	}

	.value {
		flex: 1;
		color: #111827;
		font-size: 14px;
		word-break: break-word;
	}

	.empty {
		padding: 80rpx 0;
		text-align: center;
		color: #999;
		font-size: 14px;
	}
</style>
