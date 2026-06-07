<template>
	<view class="page">
		<view v-if="loading && !loaded" class="empty">加载中...</view>

		<view v-else-if="challenge.state === 'password'" class="card">
			<view class="section-title">需要验证密码</view>
			<text class="tip-text">{{challenge.tip || '此操作需验证密码'}}</text>
			<input v-model="password" class="input" type="password" placeholder="请输入密码" />
			<button class="primary-btn" :loading="submitting" :disabled="submitting" @click="submitPassword">确认</button>
		</view>

		<view v-else-if="challenge.state === 'answer'" class="card">
			<view class="section-title">吹牛应战</view>
			<view class="info-row" @click="openUser(challenge.authorUrl)">
				<text class="label">发起挑战</text>
				<text class="value link">{{challenge.author || '--'}}</text>
			</view>
			<view class="info-row">
				<text class="label">赌注金额</text>
				<text class="value money">{{challenge.amount || '--'}}</text>
			</view>
			<view class="question-box">
				<text class="question-label">问题</text>
				<text class="question-text">{{challenge.question || '--'}}</text>
			</view>
			<view class="answer-list">
				<view v-for="item in challenge.answers" :key="item.value" class="answer-choice"
					:class="{active: selectedAnswer === item.value}" @click="selectedAnswer = item.value">
					<view class="radio-dot"><view v-if="selectedAnswer === item.value" class="radio-core"></view></view>
					<view class="answer-body">
						<text class="answer-title">{{item.title}}</text>
						<text class="answer-text">{{item.text || '--'}}</text>
					</view>
				</view>
			</view>
			<text v-if="challenge.note" class="note">{{challenge.note}}</text>
			<button class="primary-btn" :loading="submitting" :disabled="submitting" @click="submitAnswer">确定</button>
		</view>

		<view v-else-if="challenge.state === 'result'" class="card">
			<view class="section-title">吹牛详情</view>
			<view v-if="resultStatus.value" class="result-banner" :class="{win: resultStatus.isWin, lose: resultStatus.isLose}">
				<text>{{resultStatus.value}}</text>
			</view>
			<view class="info-row" @click="openUser(challenge.authorUrl)">
				<text class="label">发起者</text>
				<text class="value link">{{challenge.author || '--'}}</text>
			</view>
			<view class="info-row">
				<text class="label">赌注金额</text>
				<text class="value money">{{challenge.amount || '--'}}</text>
			</view>
			<view class="question-box">
				<text class="question-label">问题</text>
				<text class="question-text">{{challenge.question || '--'}}</text>
			</view>
			<view class="result-answer" v-for="(item,index) in challenge.answers" :key="index">
				<text class="answer-title">{{item.title}}</text>
				<text class="answer-text">{{item.text || '--'}}</text>
			</view>
			<view class="status-list">
				<view v-for="item in challenge.statuses" :key="item.label" class="info-row" @click="openUser(item.url)">
					<text class="label">{{item.label}}</text>
					<text class="value" :class="{link: item.url}">{{item.value || '--'}}</text>
				</view>
				<view v-for="item in challenge.times" :key="item.label" class="info-row">
					<text class="label">{{item.label}}</text>
					<text class="value">{{item.value || '--'}}</text>
				</view>
			</view>
		</view>

		<view v-else class="card">
			<view class="section-title">{{challenge.title || '温馨提示'}}</view>
			<text class="tip-text">{{challenge.tip || '暂无内容'}}</text>
			<button v-if="challenge.resultUrl" class="primary-btn" @click="openResult">{{challenge.resultText || '查看结果'}}</button>
		</view>

		<view class="footer-actions">
			<button class="ghost-btn" size="mini" @click="goGameHome">返回吹牛</button>
			<button class="ghost-btn" size="mini" @click="openBrowser">浏览器打开</button>
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
		absoluteYaohuoUrl
	} from '@/utils/html.js'
	import {
		openInBrowser
	} from '@/utils/browser.js'
	import {
		navigateToNativeRoute
	} from '@/utils/route.js'
	import {
		parseGameChallenge,
		resolveYaohuoUrl
	} from '@/utils/list-pages.js'

	export default {
		data() {
			return {
				url: '',
				loaded: false,
				loading: false,
				submitting: false,
				password: '',
				selectedAnswer: '',
				challenge: {
					state: '',
					title: '',
					tip: ''
				}
			}
		},
		computed: {
			resultStatus() {
				const item = (this.challenge.statuses || []).find(row => row.label === '结果') || {}
				const value = item.value || ''
				return {
					value,
					isWin: /赢|猜对|获得/.test(value),
					isLose: /输|猜错|失败/.test(value)
				}
			}
		},
		onLoad(option) {
			option = option || {}
			this.url = this.getInitialUrl(option)
			console.log('[YAOHUO_GAME_CHALLENGE_LOAD]', {
				url: this.url
			})
			uni.setNavigationBarTitle({
				title: '疯狂吹牛'
			})
			this.fetchPage(this.url)
		},
		onUnload() {
			uni.setStorageSync('yaohuoGameNeedsRefresh', 1)
		},
		methods: {
			getInitialUrl(option) {
				if (option.url) {
					return absoluteYaohuoUrl(decodeURIComponent(option.url))
				}
				const id = String(option.id || '').match(/\d+/)
				if (option.result === '1' || /book_view/i.test(option.type || '')) {
					const userId = option.touserid || uni.getStorageSync('yaohuoUserId') || ''
					return `https://yaohuo.me/games/chuiniu/book_view.aspx?type=${encodeURIComponent(option.viewType || option.type || '0')}&touserid=${encodeURIComponent(userId)}&id=${id ? id[0] : ''}`
				}
				return `https://yaohuo.me/games/chuiniu/doit.aspx?id=${id ? id[0] : ''}`
			},
			fetchPage(url) {
				if (!url || this.loading) {
					return
				}
				this.loading = true
				uni.showLoading({
					title: '加载中'
				})
				uni.request({
					url,
					header: getAuthHeader(),
					success: res => {
						const html = String(res.data || '')
						if (isLoginRequiredHtml(html)) {
							return this.goLogin()
						}
						this.url = url
						this.applyHtml(html, url)
					},
					fail: () => {
						uni.showToast({
							title: '加载失败',
							icon: 'none'
						})
					},
					complete: () => {
						this.loaded = true
						this.loading = false
						uni.hideLoading()
					}
				})
			},
			applyHtml(html, url) {
				this.challenge = parseGameChallenge(html, url)
				this.selectedAnswer = ''
				if (this.challenge.title) {
					uni.setNavigationBarTitle({
						title: this.challenge.title
					})
				}
				console.log('[YAOHUO_GAME_CHALLENGE_PARSE]', {
					state: this.challenge.state,
					id: this.challenge.id,
					answerCount: this.challenge.answers ? this.challenge.answers.length : 0
				})
			},
			submitPassword() {
				if (!String(this.password || '').trim()) {
					return uni.showToast({
						title: '请输入密码',
						icon: 'none'
					})
				}
				const payload = Object.assign({}, this.challenge.fields || {}, {
					needpassword: this.password
				})
				this.submitForm(this.challenge.action || this.url, payload, true)
			},
			submitAnswer() {
				if (!this.selectedAnswer) {
					return uni.showToast({
						title: '请选择答案',
						icon: 'none'
					})
				}
				const payload = Object.assign({}, this.challenge.fields || {}, {
					myanswer: this.selectedAnswer,
					action: 'gomod',
					classid: '0',
					siteid: '1000',
					id: this.challenge.id,
					bt: '确 定'
				})
				this.submitForm(this.challenge.action || 'https://yaohuo.me/games/chuiniu/doit.aspx', payload, false)
			},
			submitForm(url, payload, isPassword) {
				if (this.submitting) {
					return
				}
				this.submitting = true
				uni.request({
					url,
					method: 'POST',
					header: getAuthHeader({
						'Content-Type': 'application/x-www-form-urlencoded',
						'Referer': this.url
					}),
					data: this.formEncode(payload),
					success: res => {
						const html = String(res.data || '')
						const statusCode = Number(res.statusCode || 0)
						console.log('[YAOHUO_GAME_CHALLENGE_SUBMIT]', {
							statusCode,
							isPassword
						})
						if (statusCode >= 300 && statusCode < 400) {
							return this.followRedirect(res, url, isPassword)
						}
						if (isLoginRequiredHtml(html)) {
							return this.goLogin()
						}
						const nextChallenge = parseGameChallenge(html, url)
						if (nextChallenge && nextChallenge.isFailure && nextChallenge.tip) {
							uni.showModal({
								title: isPassword ? '验证失败' : '应战失败',
								content: nextChallenge.tip,
								showCancel: false
							})
							return
						}
						this.applyHtml(html, url)
					},
					fail: () => {
						uni.showToast({
							title: '提交失败',
							icon: 'none'
						})
					},
					complete: () => {
						this.submitting = false
					}
				})
			},
			followRedirect(res, fallbackUrl, isPassword) {
				const header = res && res.header || {}
				let location = ''
				for (const key in header) {
					if (key && key.toLowerCase() === 'location') {
						location = header[key]
					}
				}
				if (!location && isPassword) {
					location = `${fallbackUrl}${fallbackUrl.indexOf('?') > -1 ? '&' : '?'}pwdStatus=success`
				}
				this.fetchPage(resolveYaohuoUrl(location || fallbackUrl, fallbackUrl))
			},
			openResult() {
				if (!this.challenge.resultUrl) {
					return
				}
				const route = `/pages/game/challenge?url=${encodeURIComponent(this.challenge.resultUrl)}`
				uni.redirectTo({
					url: route
				})
			},
			openUser(url) {
				if (!url) {
					return
				}
				uni.navigateTo({
					url: `/pages/webview/webview?url=${encodeURIComponent(absoluteYaohuoUrl(url))}`
				})
			},
			goGameHome() {
				const pages = getCurrentPages()
				const prev = pages && pages.length > 1 ? pages[pages.length - 2] : null
				if (prev && prev.route === 'pages/game/game') {
					uni.navigateBack()
					return
				}
				uni.redirectTo({
					url: '/pages/game/game',
					fail: () => {
						if (navigateToNativeRoute('https://yaohuo.me/games/chuiniu/', {
								replace: true
							})) {
							return
						}
						uni.navigateBack()
					}
				})
			},
			openBrowser() {
				openInBrowser(this.url)
			},
			formEncode(data) {
				return Object.keys(data || {}).map(key => {
					const value = data[key] === undefined || data[key] === null ? '' : data[key]
					return encodeURIComponent(key) + '=' + encodeURIComponent(value)
				}).join('&')
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
		box-sizing: border-box;
	}

	.card {
		padding: 0 22rpx 24rpx;
		background: #fff;
		border-radius: 8px;
		box-sizing: border-box;
	}

	.section-title {
		height: 82rpx;
		display: flex;
		align-items: center;
		border-bottom: 1px solid #eee;
		color: #07a85a;
		font-size: 16px;
		font-weight: 700;
	}

	.info-row {
		min-height: 78rpx;
		display: flex;
		align-items: center;
		justify-content: space-between;
		border-bottom: 1px dashed #eee;
	}

	.result-banner {
		margin: 22rpx 0 6rpx;
		padding: 22rpx 20rpx;
		border-radius: 8px;
		background: #f5f5f5;
		color: #333;
		font-size: 17px;
		font-weight: 800;
		text-align: center;
		box-sizing: border-box;
	}

	.result-banner.win {
		background: #e9faf2;
		color: #07a85a;
	}

	.result-banner.lose {
		background: #fff1f0;
		color: #d93026;
	}

	.label {
		color: #777;
		font-size: 13px;
		flex: 0 0 150rpx;
	}

	.value {
		color: #222;
		font-size: 14px;
		text-align: right;
		flex: 1;
		line-height: 1.45;
	}

	.link {
		color: #07a85a;
	}

	.money {
		color: #ad6800;
		font-weight: 700;
	}

	.question-box {
		margin: 22rpx 0;
		padding: 20rpx;
		border-radius: 8px;
		background: #f7fbf9;
	}

	.question-label {
		display: block;
		color: #07a85a;
		font-size: 12px;
		font-weight: 700;
	}

	.question-text {
		display: block;
		margin-top: 10rpx;
		color: #222;
		font-size: 18px;
		font-weight: 700;
		line-height: 1.45;
	}

	.answer-choice,
	.result-answer {
		margin-bottom: 16rpx;
		padding: 18rpx;
		border: 1px solid #eee;
		border-radius: 8px;
		display: flex;
		align-items: center;
		box-sizing: border-box;
	}

	.answer-choice.active {
		border-color: #07c160;
		background: #f0fbf5;
	}

	.radio-dot {
		width: 38rpx;
		height: 38rpx;
		border-radius: 50%;
		border: 2rpx solid #ccc;
		display: flex;
		align-items: center;
		justify-content: center;
		flex: 0 0 38rpx;
	}

	.answer-choice.active .radio-dot {
		border-color: #07c160;
	}

	.radio-core {
		width: 20rpx;
		height: 20rpx;
		border-radius: 50%;
		background: #07c160;
	}

	.answer-body {
		margin-left: 16rpx;
		min-width: 0;
		flex: 1;
	}

	.answer-title {
		display: block;
		color: #777;
		font-size: 12px;
	}

	.answer-text {
		display: block;
		margin-top: 6rpx;
		color: #222;
		font-size: 15px;
		line-height: 1.45;
	}

	.note,
	.tip-text {
		display: block;
		margin: 22rpx 0;
		color: #666;
		font-size: 13px;
		line-height: 1.6;
	}

	.input {
		height: 82rpx;
		padding: 0 18rpx;
		margin: 20rpx 0;
		border-radius: 8px;
		background: #f7f7f7;
		font-size: 15px;
		box-sizing: border-box;
	}

	.primary-btn {
		margin: 20rpx 0 0;
		border-radius: 8px;
		background: #07c160;
		color: #fff;
	}

	.footer-actions {
		margin-top: 18rpx;
		display: flex;
		gap: 16rpx;
	}

	.ghost-btn {
		flex: 1;
		margin: 0;
		border-radius: 8px;
		background: #fff;
		color: #07a85a;
	}

	.empty {
		height: 180rpx;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #999;
		font-size: 14px;
	}
</style>
