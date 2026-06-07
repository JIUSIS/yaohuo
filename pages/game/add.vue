<template>
	<view class="page">
		<view class="card">
			<view class="section-title">
				<text>发起挑战</text>
				<button class="random-btn" size="mini" @click="randomAll">随机</button>
			</view>
			<view v-if="formInfo.balance" class="balance">余额 {{formInfo.balance}} 妖晶</view>
			<view class="field">
				<text class="label">赌注</text>
				<input v-model="form.mymoney" class="input" type="number" :placeholder="moneyPlaceholder" />
			</view>
			<view class="field">
				<text class="label">问题</text>
				<input v-model="form.question" class="input" maxlength="20" placeholder="请输入问题" />
			</view>
			<view class="answer-grid">
				<view class="answer-card" :class="{active: form.myanswer === '1'}" @click="form.myanswer = '1'">
					<view class="answer-head">
						<view class="radio-dot"><view v-if="form.myanswer === '1'" class="radio-core"></view></view>
						<text>设为答案一</text>
					</view>
					<input v-model="form.answer1" class="answer-input" maxlength="10" placeholder="答案一" />
				</view>
				<view class="answer-card" :class="{active: form.myanswer === '2'}" @click="form.myanswer = '2'">
					<view class="answer-head">
						<view class="radio-dot"><view v-if="form.myanswer === '2'" class="radio-core"></view></view>
						<text>设为答案二</text>
					</view>
					<input v-model="form.answer2" class="answer-input" maxlength="10" placeholder="答案二" />
				</view>
			</view>
			<text v-if="formInfo.note" class="note">{{formInfo.note}}</text>
			<button class="primary-btn" :loading="submitting" :disabled="submitting" @click="submitChallenge">确定</button>
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
		openInBrowser
	} from '@/utils/browser.js'
	import {
		navigateToNativeRoute
	} from '@/utils/route.js'
	import {
		parseGameAdd
	} from '@/utils/list-pages.js'

	const PRESETS = [{
		question: '我是不是最帅的？',
		answer1: '那必须是',
		answer2: '你想多了'
	}, {
		question: '你幸福吗？',
		answer1: '幸福',
		answer2: '姓曾'
	}, {
		question: '我是吹牛大神！',
		answer1: '不是',
		answer2: '当然'
	}, {
		question: '爱生活还是爱妖火？',
		answer1: '爱生活',
		answer2: '爱妖火'
	}, {
		question: '放假去哪里玩？',
		answer1: '在家躺平',
		answer2: '出去浪'
	}, {
		question: '今天又是摸鱼的一天？',
		answer1: '摸它！',
		answer2: '认真工作'
	}]

	export default {
		data() {
			return {
				url: 'https://yaohuo.me/games/chuiniu/add.aspx',
				loading: false,
				submitting: false,
				formInfo: {
					action: 'https://yaohuo.me/games/chuiniu/add.aspx',
					fields: {},
					balance: '',
					minMoney: '100',
					maxMoney: '10000000',
					note: ''
				},
				form: {
					mymoney: '',
					question: '',
					myanswer: '1',
					answer1: '',
					answer2: ''
				}
			}
		},
		computed: {
			moneyPlaceholder() {
				return this.formInfo.balance ? `最低 ${this.formInfo.minMoney || 100}，余额 ${this.formInfo.balance}` : '最低 100 妖晶'
			}
		},
		onLoad() {
			console.log('[YAOHUO_GAME_ADD_LOAD]')
			uni.setNavigationBarTitle({
				title: '发起挑战'
			})
			this.fetchPage()
		},
		onUnload() {
			uni.setStorageSync('yaohuoGameNeedsRefresh', 1)
		},
		methods: {
			fetchPage() {
				if (this.loading) {
					return
				}
				this.loading = true
				uni.showLoading({
					title: '加载中'
				})
				uni.request({
					url: this.url,
					header: getAuthHeader(),
					success: res => {
						const html = String(res.data || '')
						if (isLoginRequiredHtml(html)) {
							return this.goLogin()
						}
						this.applyHtml(html)
					},
					fail: () => {
						uni.showToast({
							title: '加载失败',
							icon: 'none'
						})
					},
					complete: () => {
						this.loading = false
						uni.hideLoading()
					}
				})
			},
			applyHtml(html) {
				const info = parseGameAdd(html, this.url)
				if (info.tip && !Object.keys(info.fields || {}).length) {
					uni.showModal({
						title: '发起挑战',
						content: info.tip,
						showCancel: false,
						success: () => {
							this.goGameHome()
						}
					})
					return
				}
				this.formInfo = Object.assign({}, this.formInfo, info)
				this.form.question = info.fields.question || this.form.question || '我是吹牛大神！'
				this.form.answer1 = info.fields.answer1 || this.form.answer1 || '不是'
				this.form.answer2 = info.fields.answer2 || this.form.answer2 || '当然'
				this.form.myanswer = info.fields.myanswer || this.form.myanswer || '1'
				console.log('[YAOHUO_GAME_ADD_PARSE]', {
					balance: info.balance,
					hasFields: Object.keys(info.fields || {}).length
				})
			},
			randomAll() {
				const preset = PRESETS[Math.floor(Math.random() * PRESETS.length)]
				const balance = Number(String(this.formInfo.balance || '').replace(/[^\d]/g, ''))
				const max = Math.max(100, Math.min(Number(this.formInfo.maxMoney || 10000000), balance || 10000, 10000))
				const min = Math.max(100, Number(this.formInfo.minMoney || 100))
				const minMultiple = Math.ceil(min / 100)
				const maxMultiple = Math.max(minMultiple, Math.floor(max / 100))
				this.form.mymoney = String((Math.floor(Math.random() * (maxMultiple - minMultiple + 1)) + minMultiple) * 100)
				this.form.question = preset.question
				this.form.answer1 = preset.answer1
				this.form.answer2 = preset.answer2
				this.form.myanswer = Math.random() > 0.5 ? '1' : '2'
			},
			submitChallenge() {
				const money = Number(String(this.form.mymoney || '').replace(/[^\d]/g, ''))
				const min = Number(this.formInfo.minMoney || 100)
				const max = Number(this.formInfo.maxMoney || 10000000)
				if (!money || money < min) {
					return uni.showToast({
						title: `赌注至少 ${min}`,
						icon: 'none'
					})
				}
				if (money > max) {
					return uni.showToast({
						title: '赌注超过上限',
						icon: 'none'
					})
				}
				if (!String(this.form.question || '').trim()) {
					return uni.showToast({
						title: '请输入问题',
						icon: 'none'
					})
				}
				if (!String(this.form.answer1 || '').trim() || !String(this.form.answer2 || '').trim()) {
					return uni.showToast({
						title: '请填写两个答案',
						icon: 'none'
					})
				}
				if (!this.form.myanswer) {
					return uni.showToast({
						title: '请选择正确答案',
						icon: 'none'
					})
				}
				const payload = Object.assign({}, this.formInfo.fields || {}, {
					mymoney: String(money),
					question: this.form.question.trim(),
					myanswer: this.form.myanswer,
					answer1: this.form.answer1.trim(),
					answer2: this.form.answer2.trim(),
					action: 'gomod',
					classid: '0',
					siteid: '1000',
					bt: '确 定'
				})
				this.submitting = true
				uni.request({
					url: this.formInfo.action || this.url,
					method: 'POST',
					header: getAuthHeader({
						'Content-Type': 'application/x-www-form-urlencoded',
						'Referer': this.url
					}),
					data: this.formEncode(payload),
					success: res => {
						const html = String(res.data || '')
						if (isLoginRequiredHtml(html)) {
							return this.goLogin()
						}
						const info = parseGameAdd(html, this.url)
						console.log('[YAOHUO_GAME_ADD_SUBMIT]', {
							statusCode: res.statusCode,
							tip: info.tip
						})
						if (Number(res.statusCode || 0) >= 400 || /失败|错误|登录|为空|限制|不能|请先/.test(info.tip || '')) {
							return uni.showModal({
								title: '发起失败',
								content: info.tip || '服务器返回失败',
								showCancel: false
							})
						}
						if (info.tip) {
							uni.showModal({
								title: '发起挑战',
								content: info.tip,
								showCancel: false,
								success: () => {
									this.goGameHome()
								}
							})
						} else {
							this.applyHtml(html)
						}
					},
					fail: () => {
						uni.showToast({
							title: '发起失败',
							icon: 'none'
						})
					},
					complete: () => {
						this.submitting = false
					}
				})
			},
			formEncode(data) {
				return Object.keys(data || {}).map(key => {
					const value = data[key] === undefined || data[key] === null ? '' : data[key]
					return encodeURIComponent(key) + '=' + encodeURIComponent(value)
				}).join('&')
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
		justify-content: space-between;
		border-bottom: 1px solid #eee;
		color: #07a85a;
		font-size: 16px;
		font-weight: 700;
	}

	.random-btn {
		margin: 0;
		border-radius: 999rpx;
		background: #e9faf2;
		color: #07a85a;
		font-size: 12px;
	}

	.balance {
		margin-top: 20rpx;
		color: #ad6800;
		font-size: 13px;
		font-weight: 700;
	}

	.field {
		margin-top: 22rpx;
	}

	.label {
		display: block;
		margin-bottom: 10rpx;
		color: #666;
		font-size: 13px;
	}

	.input,
	.answer-input {
		height: 78rpx;
		padding: 0 18rpx;
		border-radius: 8px;
		background: #f7f7f7;
		font-size: 15px;
		box-sizing: border-box;
	}

	.answer-grid {
		margin-top: 22rpx;
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 16rpx;
	}

	.answer-card {
		padding: 18rpx;
		border: 1px solid #eee;
		border-radius: 8px;
		box-sizing: border-box;
	}

	.answer-card.active {
		border-color: #07c160;
		background: #f0fbf5;
	}

	.answer-head {
		margin-bottom: 14rpx;
		display: flex;
		align-items: center;
		color: #555;
		font-size: 13px;
	}

	.radio-dot {
		width: 34rpx;
		height: 34rpx;
		margin-right: 10rpx;
		border-radius: 50%;
		border: 2rpx solid #ccc;
		display: flex;
		align-items: center;
		justify-content: center;
		flex: 0 0 34rpx;
	}

	.answer-card.active .radio-dot {
		border-color: #07c160;
	}

	.radio-core {
		width: 18rpx;
		height: 18rpx;
		border-radius: 50%;
		background: #07c160;
	}

	.note {
		display: block;
		margin: 22rpx 0;
		color: #666;
		font-size: 13px;
		line-height: 1.6;
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
</style>
