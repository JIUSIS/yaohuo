<template>
	<view class="page">
		<view v-if="profile.id || !loading" class="card profile-card">
			<view class="profile-head">
				<image v-if="profile.avatar" class="avatar" :src="profile.avatar" mode="aspectFill"></image>
				<view v-else class="avatar avatar-placeholder">{{profile.initial || '?'}}</view>
				<view class="profile-main">
					<view class="name-row">
						<text class="name">{{profile.name || '妖火用户'}}</text>
						<button class="pm-btn" size="mini" @click="openMessage">
							<uni-icons type="email" size="15" color="#0a8f7c"></uni-icons>
							<text>私信</text>
						</button>
					</view>
					<text class="id-line">ID: {{profile.id || userId || '--'}}</text>
					<view class="meta-row">
						<text v-if="profile.gender">{{profile.gender}}</text>
						<text v-if="profile.age">{{profile.age}}</text>
						<text v-if="profile.status" class="online">{{profile.status}}</text>
					</view>
					<view class="action-row">
						<button class="action-btn primary" size="mini" :loading="actionLoading === 'friend'"
							:disabled="!!actionLoading" @click="confirmRelation('friend')">加为好友</button>
						<button class="action-btn danger" size="mini" :loading="actionLoading === 'black'"
							:disabled="!!actionLoading" @click="confirmRelation('black')">加黑名单</button>
					</view>
				</view>
			</view>
			<view v-if="profile.signature" class="signature">
				<text>{{profile.signature}}</text>
			</view>
			<view class="stat-grid">
				<view v-for="item in profile.stats" :key="item.label" class="stat-tile" @click="openStat(item)">
					<uni-icons :type="item.icon || 'info'" size="23" color="#4d9c96"></uni-icons>
					<text class="stat-value">{{item.value || '--'}}</text>
					<text class="stat-label">{{item.label}}</text>
				</view>
			</view>
			<view class="detail-link" @click="openMore">
				<uni-icons type="contact" size="18" color="#2f9b90"></uni-icons>
				<text>查看详细资料</text>
			</view>
		</view>

		<view v-if="profile.medals && profile.medals.length" class="card section-card">
			<view class="section-title">勋章墙</view>
			<view class="medal-list">
				<block v-for="(item,index) in profile.medals" :key="item.src || item.name || index">
					<image v-if="typeof item === 'string'" class="medal-image" :src="item" mode="aspectFit"></image>
					<text v-else class="medal-text">{{item.name}}</text>
				</block>
			</view>
		</view>

		<view class="card section-card">
			<view class="section-title">新动态</view>
			<view v-if="profile.activities && profile.activities.length">
				<view v-for="(item,index) in profile.activities" :key="index" class="list-row" @click="openActivity(item)">
					<text class="row-main">{{item.content}}</text>
					<text class="row-sub">{{item.time}}</text>
				</view>
			</view>
			<view v-else class="empty-line">暂无动态</view>
			<view class="more-row" @click="openLogs">查看更多动态</view>
		</view>

		<view class="card section-card">
			<view class="section-title">人气值</view>
			<view class="pop-grid">
				<view v-for="item in profile.popularity" :key="item.label" class="pop-item">
					<text class="pop-value">{{item.value}}</text>
					<text class="pop-label">{{item.label}}</text>
				</view>
			</view>
		</view>

		<view class="card section-card">
			<view class="section-title">留言板</view>
			<view class="guest-form">
				<textarea class="guest-input" v-model="guestContent" auto-height :maxlength="-1"
					placeholder="我来踩踩，记得回哦" :show-confirm-bar="false"></textarea>
				<button class="guest-submit" size="mini" :loading="guestLoading" :disabled="guestLoading"
					@click="submitGuestbook">发送留言</button>
			</view>
			<view v-if="profile.guestbook && profile.guestbook.length">
				<view v-for="item in profile.guestbook" :key="item.floor + item.name" class="guest-row"
					@click="openGuestUser(item)">
					<view class="guest-top">
						<text class="guest-name">{{item.name}}</text>
						<text class="guest-time">{{item.time}}</text>
					</view>
					<mp-html class="guest-content" :content="item.contentHtml || item.content" selectable lazy-load
						domain="https://yaohuo.me" containerStyle="line-height:20px;word-break:break-all;font-size:14px"
						:copyLink="false" @tap.stop @click.stop @linktap="linkTap"></mp-html>
				</view>
			</view>
			<view v-else class="empty-line">暂无留言</view>
			<view class="more-row" @click="openGuestbook">查看更多留言</view>
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
		absoluteYaohuoUrl,
		stripHtml
	} from '@/utils/html.js'
	import {
		parseUserProfile,
		extractFormFields,
		extractFormAction
	} from '@/utils/list-pages.js'
	import {
		navigateToNativePost,
		navigateToNativeRoute
	} from '@/utils/route.js'

	export default {
		data() {
			return {
				userId: '',
				sourceUrl: '',
				profile: {
					stats: [],
					medals: [],
					activities: [],
					guestbook: [],
					popularity: [],
					actions: {}
				},
				guestContent: '',
				guestForm: {},
				guestAction: 'https://yaohuo.me/bbs/userguessbook.aspx',
				loading: false,
				guestLoading: false,
				actionLoading: ''
			}
		},
		onLoad(option) {
			option = option || {}
			this.userId = String(option.id || option.touserid || '').replace(/[^\d]/g, '')
			this.sourceUrl = option.url ? decodeURIComponent(option.url) : this.getUserUrl()
			this.fetchProfile()
		},
		onPullDownRefresh() {
			this.fetchProfile()
		},
		methods: {
			getUserUrl() {
				return this.sourceUrl || `https://yaohuo.me/bbs/userinfo.aspx?touserid=${this.userId}`
			},
			fetchProfile() {
				if (this.loading) {
					return
				}
				this.loading = true
				uni.showLoading({
					title: '加载资料'
				})
				const url = this.getUserUrl()
				uni.request({
					url,
					header: getAuthHeader(),
					success: res => {
						const html = String(res.data || '')
						if (isLoginRequiredHtml(html)) {
							return this.goLogin()
						}
						this.profile = parseUserProfile(html, url)
						this.userId = this.profile.id || this.userId
						this.extractGuestForm(html, url)
						uni.setNavigationBarTitle({
							title: this.profile.title || `${this.profile.name || '用户'}的空间`
						})
					},
					fail: () => {
						uni.showToast({
							title: '资料加载失败',
							icon: 'none'
						})
					},
					complete: () => {
						this.loading = false
						uni.hideLoading()
						uni.stopPullDownRefresh()
					}
				})
			},
			extractGuestForm(html, url) {
				const form = (String(html || '').match(/<form\b[\s\S]*?<\/form>/i) || [])[0] || ''
				this.guestForm = extractFormFields(form)
				this.guestAction = extractFormAction(form, url) || 'https://yaohuo.me/bbs/userguessbook.aspx'
			},
			openMessage() {
				if (!this.userId) {
					return
				}
				uni.navigateTo({
					url: `/pages/user/message?id=${this.userId}&url=${encodeURIComponent(this.profile.actions && this.profile.actions.messageUrl || '')}`
				})
			},
			openStat(item) {
				if (!item || !item.url) {
					return
				}
				if (navigateToNativeRoute(item.url)) {
					return
				}
				this.openWeb(item.url)
			},
			openMore() {
				uni.navigateTo({
					url: `/pages/user/more?id=${this.userId}&url=${encodeURIComponent(this.profile.actions && this.profile.actions.moreUrl || '')}`
				})
			},
			openLogs() {
				uni.navigateTo({
					url: `/pages/user/logs?id=${this.userId}&url=${encodeURIComponent(this.profile.actions && this.profile.actions.logUrl || '')}`
				})
			},
			openGuestbook() {
				uni.navigateTo({
					url: `/pages/user/guestbook?id=${this.userId}&url=${encodeURIComponent(this.profile.actions && this.profile.actions.guestbookUrl || '')}`
				})
			},
			openActivity(item) {
				if (item && item.url && navigateToNativePost(item.url)) {
					return
				}
			},
			openGuestUser(item) {
				if (!item || !item.id) {
					return
				}
				uni.navigateTo({
					url: `/pages/user/user?id=${item.id}`
				})
			},
			linkTap(e) {
				const href = absoluteYaohuoUrl(e && e.href)
				if (!href) {
					return
				}
				if (navigateToNativePost(href)) {
					return
				}
				if (navigateToNativeRoute(href)) {
					return
				}
				this.openWeb(href)
			},
			confirmRelation(type) {
				const url = type === 'black' ? (this.profile.actions && this.profile.actions.blacklistUrl) :
					(this.profile.actions && this.profile.actions.addFriendUrl)
				if (!url) {
					return uni.showToast({
						title: '缺少操作入口',
						icon: 'none'
					})
				}
				uni.showModal({
					title: type === 'black' ? '加入黑名单' : '加为好友',
					content: type === 'black' ? `确认把 ${this.profile.name || this.userId} 加入黑名单？` :
						`确认添加 ${this.profile.name || this.userId} 为好友？`,
					success: res => {
						if (res.confirm) {
							this.submitRelation(type, url)
						}
					}
				})
			},
			submitRelation(type, url) {
				this.actionLoading = type
				uni.request({
					url,
					header: getAuthHeader({
						Referer: this.getUserUrl()
					}),
					success: res => {
						const text = stripHtml(String(res.data || ''))
						uni.showToast({
							title: /失败|错误|不能|限制/.test(text) ? '操作可能失败' : '操作成功',
							icon: /失败|错误|不能|限制/.test(text) ? 'none' : 'success'
						})
					},
					fail: () => {
						uni.showToast({
							title: '操作失败',
							icon: 'none'
						})
					},
					complete: () => {
						this.actionLoading = ''
					}
				})
			},
			submitGuestbook() {
				const content = String(this.guestContent || '').trim() || '我来踩踩，记得回哦'
				if (!this.userId) {
					return
				}
				const data = Object.assign({}, this.guestForm, {
					content,
					action: this.guestForm.action || 'add',
					touserid: this.guestForm.touserid || this.userId,
					siteid: this.guestForm.siteid || 1000,
					classid: this.guestForm.classid || 0
				})
				this.guestLoading = true
				uni.request({
					url: this.guestAction,
					method: 'POST',
					header: getAuthHeader({
						Referer: this.getUserUrl(),
						'Content-Type': 'application/x-www-form-urlencoded'
					}),
					data,
					success: res => {
						const text = stripHtml(String(res.data || ''))
						if (/留言成功|成功/.test(text)) {
							this.guestContent = ''
							uni.showToast({
								title: '留言成功',
								icon: 'success'
							})
							this.fetchProfile()
							return
						}
						uni.showModal({
							title: '留言结果',
							content: text.slice(0, 120) || '服务器未返回明确结果',
							showCancel: false
						})
					},
					fail: () => {
						uni.showToast({
							title: '留言失败',
							icon: 'none'
						})
					},
					complete: () => {
						this.guestLoading = false
					}
				})
			},
			openWeb(url) {
				if (!url) {
					return
				}
				uni.navigateTo({
					url: `/pages/webview/webview?url=${encodeURIComponent(absoluteYaohuoUrl(url))}`
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
		padding: 16rpx 14rpx 42rpx;
		box-sizing: border-box;
	}

	.card {
		margin-bottom: 16rpx;
		background: #fff;
		border-radius: 8px;
		box-shadow: 0 4rpx 18rpx rgba(0, 0, 0, .04);
		overflow: hidden;
	}

	.profile-card {
		padding: 22rpx 20rpx;
	}

	.profile-head {
		display: flex;
		align-items: flex-start;
	}

	.avatar {
		width: 170rpx;
		height: 170rpx;
		border-radius: 8px;
		background: #f3f3f3;
		flex: 0 0 170rpx;
		overflow: hidden;
	}

	.avatar-placeholder {
		display: flex;
		align-items: center;
		justify-content: center;
		color: #0a8f7c;
		font-size: 30px;
		font-weight: 700;
	}

	.profile-main {
		margin-left: 22rpx;
		min-width: 0;
		flex: 1;
	}

	.name-row {
		display: flex;
		align-items: center;
		min-width: 0;
	}

	.name {
		flex: 1;
		min-width: 0;
		color: #16a34a;
		font-size: 20px;
		font-weight: 700;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.pm-btn {
		height: 48rpx;
		line-height: 48rpx;
		margin: 0 0 0 12rpx;
		padding: 0 16rpx;
		border-radius: 999rpx;
		background: #f8fffd;
		color: #0a8f7c;
		border: 1px solid #d8f0ec;
		font-size: 12px;
		display: flex;
		align-items: center;
	}

	.pm-btn text {
		margin-left: 6rpx;
	}

	.id-line,
	.meta-row {
		margin-top: 8rpx;
		color: #536175;
		font-size: 13px;
	}

	.meta-row {
		display: flex;
		gap: 12rpx;
	}

	.online {
		color: #0a8f7c;
	}

	.action-row {
		margin-top: 18rpx;
		display: flex;
		gap: 12rpx;
	}

	.action-btn {
		flex: 1;
		height: 60rpx;
		line-height: 60rpx;
		margin: 0;
		border-radius: 8px;
		background: #fff;
		font-size: 14px;
	}

	.action-btn.primary {
		color: #0a8f7c;
		border: 1px solid #0a8f7c;
	}

	.action-btn.danger {
		color: #d61f2c;
		border: 1px solid #ef4444;
	}

	.signature {
		margin-top: 22rpx;
		padding: 18rpx;
		border-radius: 6px;
		background: #f7fbfa;
		color: #4b5563;
		font-size: 14px;
		line-height: 1.45;
	}

	.stat-grid,
	.pop-grid {
		margin-top: 22rpx;
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 14rpx;
	}

	.stat-tile,
	.pop-item {
		min-height: 108rpx;
		border: 1px solid #eef2f2;
		border-radius: 8px;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
	}

	.stat-value,
	.pop-value {
		margin-top: 6rpx;
		color: #087f77;
		font-size: 18px;
		font-weight: 700;
	}

	.stat-label,
	.pop-label {
		margin-top: 4rpx;
		color: #7a8796;
		font-size: 12px;
	}

	.detail-link,
	.more-row {
		height: 72rpx;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #2f9b90;
		font-size: 15px;
	}

	.detail-link text {
		margin-left: 8rpx;
	}

	.section-card {
		padding: 20rpx;
	}

	.section-title {
		color: #111827;
		font-size: 16px;
		font-weight: 700;
		margin-bottom: 16rpx;
	}

	.medal-list {
		display: flex;
		flex-wrap: wrap;
		gap: 12rpx;
	}

	.medal-image {
		width: 52rpx;
		height: 70rpx;
	}

	.medal-text {
		padding: 8rpx 14rpx;
		border-radius: 999rpx;
		background: #f3f4f6;
		color: #4b5563;
		font-size: 12px;
	}

	.list-row,
	.guest-row {
		padding: 18rpx 16rpx;
		margin-bottom: 12rpx;
		border: 1px solid #eef2f2;
		border-radius: 7px;
	}

	.row-main,
	.guest-content {
		display: block;
		color: #111827;
		font-size: 14px;
		line-height: 1.45;
		word-break: break-word;
	}

	.row-sub,
	.guest-time {
		display: block;
		margin-top: 6rpx;
		color: #8b9aad;
		font-size: 12px;
	}

	.guest-form {
		margin-bottom: 18rpx;
	}

	.guest-input {
		width: 100%;
		min-height: 92rpx;
		padding: 16rpx;
		border: 1px solid #eef2f2;
		border-radius: 7px;
		font-size: 14px;
		box-sizing: border-box;
	}

	.guest-submit {
		height: 58rpx;
		line-height: 58rpx;
		margin: 14rpx 0 0 auto;
		padding: 0 24rpx;
		background: #0a8f7c;
		color: #fff;
		border-radius: 999rpx;
		font-size: 13px;
	}

	.guest-top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 8rpx;
	}

	.guest-name {
		color: #0a8f7c;
		font-size: 14px;
		font-weight: 700;
	}

	::v-deep .guest-content img {
		max-width: 100%;
		vertical-align: middle;
	}

	::v-deep .guest-content .ubbimg {
		width: 42rpx;
		height: 42rpx;
	}

	.empty-line {
		padding: 26rpx 0;
		text-align: center;
		color: #9ca3af;
		font-size: 13px;
	}
</style>
