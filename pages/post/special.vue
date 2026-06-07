<template>
	<view class="special-page">
		<view class="board-select-card">
			<picker mode="selector" :range="boardOptions" range-key="name" :value="boardIndex" @change="changeBoard">
				<view class="board-select-row">
					<view class="board-select-text">
						<text class="board-select-label">发帖版块</text>
						<text class="board-select-name">{{currentBoardName}}</text>
					</view>
					<uni-icons type="arrowdown" size="17" color="#7b8a82"></uni-icons>
				</view>
			</picker>
		</view>

		<view v-if="type === 'ubb'" class="card ubb-card">
			<view v-if="paragraphs.length">
				<text v-for="(line,index) in paragraphs" :key="index" class="paragraph">{{line}}</text>
			</view>
			<view v-else-if="!loading" class="empty">暂无内容</view>
		</view>

		<view v-else class="card form-card">
			<view class="form-row">
				<text class="form-label">标题</text>
				<input class="input" v-model="form.title" :maxlength="50" placeholder="请输入标题" />
			</view>
			<view class="form-row">
				<text class="form-label">内容</text>
				<textarea class="textarea" v-model="form.content" :maxlength="-1" auto-height
					:show-confirm-bar="false" placeholder="请输入正文"></textarea>
			</view>

			<view v-if="type === 'sendmoney'" class="sub-section">
				<view class="form-row">
					<text class="form-label">派出妖晶</text>
					<input class="input" type="number" v-model="form.freeMoney" placeholder="请输入派币数量" />
				</view>
				<view class="form-row">
					<text class="form-label">领取条件</text>
					<input class="input" v-model="form.freeRule1" placeholder="按官网规则填写，可留空" />
				</view>
				<view class="form-row">
					<text class="form-label">领取说明</text>
					<input class="input" v-model="form.freeRule2" placeholder="按官网规则填写，可留空" />
				</view>
			</view>

			<view v-if="type === 'vote'" class="sub-section">
				<view class="form-row">
					<text class="form-label">投票选项</text>
					<view class="vote-list">
						<input v-for="(item,index) in voteOptions" :key="index" class="input vote-input"
							v-model="voteOptions[index]" :placeholder="'选项' + (index + 1)" />
					</view>
					<view class="inline-actions">
						<button size="mini" class="small-btn" @click="addVoteOption">添加选项</button>
						<button v-if="voteOptions.length > 2" size="mini" class="small-btn muted" @click="removeVoteOption">减少选项</button>
					</view>
				</view>
				<view class="form-row">
					<text class="form-label">展示数量</text>
					<input class="input" type="number" v-model="form.displayNum" placeholder="默认按官网表单" />
				</view>
				<view class="form-row">
					<text class="form-label">附加妖晶</text>
					<input class="input" type="number" v-model="form.freeMoney" placeholder="选填" />
				</view>
			</view>

			<view v-if="type === 'resource'" class="sub-section">
				<view class="form-row">
					<text class="form-label">资源名称</text>
					<input class="input" v-model="form.fileTitle" placeholder="请输入资源名称" />
				</view>
				<view class="form-row">
					<text class="form-label">资源地址</text>
					<input class="input" v-model="form.fileUrl" placeholder="请输入下载地址" />
				</view>
				<view class="form-row two-cols">
					<view class="col">
						<text class="form-label">文件大小</text>
						<input class="input" v-model="form.fileSize" placeholder="如 12MB" />
					</view>
					<view class="col">
						<text class="form-label">扩展名</text>
						<input class="input" v-model="form.fileExt" placeholder="如 zip" />
					</view>
				</view>
				<view class="form-row">
					<text class="form-label">资源说明</text>
					<textarea class="textarea small" v-model="form.fileInfo" :maxlength="-1" auto-height
						:show-confirm-bar="false" placeholder="选填"></textarea>
				</view>
			</view>

			<button class="submit-btn" type="primary" :loading="submitting" :disabled="submitting || loading"
				@click="submitSpecial">{{submitText}}</button>
		</view>
	</view>
</template>

<script>
	import {
		getAuthHeader,
		isLoginRequiredHtml
	} from '@/utils/auth.js'
	import {
		absoluteYaohuoUrl,
		getAttr,
		stripHtml
	} from '@/utils/html.js'

	const BOARD_OPTIONS = [{
		id: '177',
		name: '妖火茶馆'
	}, {
		id: '213',
		name: '悬赏问答'
	}, {
		id: '201',
		name: '资源分享'
	}, {
		id: '197',
		name: '技术教程'
	}, {
		id: '204',
		name: '活动线报'
	}, {
		id: '203',
		name: '免流讨论'
	}, {
		id: '240',
		name: '贴图视频'
	}, {
		id: '299',
		name: '拼团互助'
	}, {
		id: '199',
		name: '站务处理'
	}, {
		id: '198',
		name: '投诉建议'
	}]

	const TYPE_META = {
		sendmoney: {
			title: '发表派币帖',
			path: 'book_view_sendmoney.aspx',
			submitText: '发表派币帖'
		},
		vote: {
			title: '发表投票帖',
			path: 'book_view_addvote.aspx',
			submitText: '发表投票帖'
		},
		resource: {
			title: '发表资源帖',
			path: 'book_view_addurl.aspx',
			submitText: '发表资源帖',
			extraQuery: '&num=1'
		},
		ubb: {
			title: 'UBB方法',
			path: 'book_view_ubb.aspx',
			submitText: ''
		}
	}

	export default {
		data() {
			return {
				type: 'sendmoney',
				boardOptions: BOARD_OPTIONS,
				boardIndex: 0,
				classid: '177',
				action: '',
				hiddenFields: {},
				form: {
					title: '',
					content: '',
					freeMoney: '',
					freeRule1: '',
					freeRule2: '',
					displayNum: '',
					fileTitle: '',
					fileUrl: '',
					fileSize: '',
					fileExt: '',
					fileInfo: ''
				},
				voteOptions: ['', '', ''],
				paragraphs: [],
				loading: false,
				submitting: false
			}
		},
		computed: {
			meta() {
				return TYPE_META[this.type] || TYPE_META.sendmoney
			},
			currentBoardName() {
				const board = this.boardOptions[this.boardIndex]
				return board ? board.name : '妖火茶馆'
			},
			submitText() {
				return this.meta.submitText || '提交'
			}
		},
		onLoad(options) {
			options = options || {}
			this.type = TYPE_META[options.type] ? options.type : 'sendmoney'
			const classid = String(options.classid || '177')
			const index = this.boardOptions.findIndex(item => item.id === classid)
			this.boardIndex = index > -1 ? index : 0
			this.classid = this.boardOptions[this.boardIndex].id
			uni.setNavigationBarTitle({
				title: this.meta.title
			})
			this.fetchOfficialPage()
		},
		methods: {
			changeBoard(e) {
				this.boardIndex = Number(e.detail.value || 0)
				this.classid = this.boardOptions[this.boardIndex].id
				this.fetchOfficialPage()
			},
			getOfficialUrl() {
				return `https://yaohuo.me/bbs/${this.meta.path}?classid=${encodeURIComponent(this.classid)}${this.meta.extraQuery || ''}`
			},
			fetchOfficialPage() {
				this.loading = true
				uni.showLoading({
					title: '加载中'
				})
				uni.request({
					url: this.getOfficialUrl(),
					header: getAuthHeader(),
					success: res => {
						const html = String(res.data || '')
						if (isLoginRequiredHtml(html)) {
							return this.goLogin()
						}
						if (this.type === 'ubb') {
							this.paragraphs = this.parseUbb(html)
							return
						}
						const parsed = this.parseForm(html)
						this.action = parsed.action || this.getOfficialUrl()
						this.hiddenFields = parsed.fields
						this.applyParsedDefaults(parsed.fields)
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
			parseForm(html) {
				const formHtml = this.pickForm(html)
				const formTag = formHtml.match(/<form\b[^>]*>/i)
				const action = formTag ? this.normalizeFormAction(getAttr(formTag[0], 'action')) : ''
				const fields = {}
				const inputReg = /<input\b[^>]*>/ig
				let input
				while ((input = inputReg.exec(formHtml))) {
					const name = getAttr(input[0], 'name')
					if (name && fields[name] === undefined) {
						fields[name] = getAttr(input[0], 'value')
					}
				}
				const textareaReg = /<textarea\b[^>]*>[\s\S]*?<\/textarea>/ig
				let textarea
				while ((textarea = textareaReg.exec(formHtml))) {
					const tag = (textarea[0].match(/<textarea\b[^>]*>/i) || [])[0] || ''
					const name = getAttr(tag, 'name')
					if (name) {
						fields[name] = stripHtml(textarea[0].replace(/^<textarea\b[^>]*>/i, '').replace(/<\/textarea>$/i, ''))
					}
				}
				return {
					action,
					fields
				}
			},
			pickForm(html) {
				const forms = String(html || '').match(/<form\b[\s\S]*?<\/form>/ig) || []
				if (!forms.length) {
					return ''
				}
				return forms.find(form => /book_title|book_content|file_title|vote/i.test(form)) || forms[0]
			},
			normalizeFormAction(action) {
				action = String(action || '').replace(/&amp;/g, '&').trim()
				if (!action) {
					return ''
				}
				if (/^https?:\/\//i.test(action)) {
					return action
				}
				if (action.indexOf('//') === 0) {
					return 'https:' + action
				}
				if (action.charAt(0) === '/') {
					return 'https://yaohuo.me' + action
				}
				return 'https://yaohuo.me/bbs/' + action.replace(/^\.?\//, '')
			},
			applyParsedDefaults(fields) {
				fields = fields || {}
				this.form.title = fields.book_title || ''
				this.form.content = fields.book_content || ''
				this.form.freeMoney = fields.freemoney || ''
				this.form.freeRule1 = fields.freerule1 || ''
				this.form.freeRule2 = fields.freerule2 || ''
				this.form.displayNum = fields.displayNum || ''
				this.form.fileTitle = fields.file_title || ''
				this.form.fileUrl = fields.file_url || ''
				this.form.fileSize = fields.file_size || ''
				this.form.fileExt = fields.file_ext || ''
				this.form.fileInfo = fields.file_info || ''
			},
			buildBaseData() {
				const data = Object.assign({}, this.hiddenFields)
				data.action = data.action || 'gomod'
				data.classid = this.classid
				data.siteid = data.siteid || 1000
				data.page = data.page || ''
				data.book_title = this.form.title.trim()
				data.book_content = String(this.form.content || '').replace(/\n/g, '\r\n')
				data.g = data.g || this.submitText
				return data
			},
			buildSubmitPairs() {
				const data = this.buildBaseData()
				if (this.type === 'sendmoney') {
					data.freemoney = String(this.form.freeMoney || '').replace(/[^\d]/g, '')
					data.freerule1 = this.form.freeRule1 || ''
					data.freerule2 = this.form.freeRule2 || ''
				}
				if (this.type === 'vote') {
					data.displayNum = this.form.displayNum || data.displayNum || ''
					data.freemoney = String(this.form.freeMoney || '').replace(/[^\d]/g, '')
					data.freerule1 = this.form.freeRule1 || data.freerule1 || ''
					data.freerule2 = this.form.freeRule2 || data.freerule2 || ''
					data.num = data.num || this.voteOptions.filter(item => String(item || '').trim()).length
				}
				if (this.type === 'resource') {
					data.displayNum = this.form.displayNum || data.displayNum || ''
					data.file_title = this.form.fileTitle.trim()
					data.file_url = this.form.fileUrl.trim()
					data.file_size = this.form.fileSize.trim()
					data.file_ext = this.form.fileExt.trim()
					data.file_info = this.form.fileInfo.trim()
					data.num = data.num || 1
				}
				const pairs = []
				Object.keys(data).forEach(key => {
					if (this.type === 'vote' && key === 'vote') {
						return
					}
					pairs.push([key, data[key]])
				})
				if (this.type === 'vote') {
					this.voteOptions.forEach(item => {
						const value = String(item || '').trim()
						if (value) {
							pairs.push(['vote', value])
						}
					})
				}
				return pairs
			},
			validateForm() {
				const title = this.form.title.trim()
				const content = String(this.form.content || '').trim()
				if (!title) {
					return '标题不得为空'
				}
				if (title.length < 5) {
					return '标题最少5个字符'
				}
				if (!content) {
					return '内容不得为空'
				}
				if (this.type === 'sendmoney' && !String(this.form.freeMoney || '').replace(/[^\d]/g, '')) {
					return '请填写派出妖晶'
				}
				if (this.type === 'vote' && this.voteOptions.filter(item => String(item || '').trim()).length < 2) {
					return '至少填写两个投票选项'
				}
				if (this.type === 'resource' && !this.form.fileUrl.trim()) {
					return '请填写资源地址'
				}
				return ''
			},
			submitSpecial() {
				const error = this.validateForm()
				if (error) {
					return uni.showToast({
						title: error,
						icon: 'none'
					})
				}
				this.submitting = true
				uni.request({
					url: this.action || this.getOfficialUrl(),
					method: 'POST',
					header: getAuthHeader({
						'Content-Type': 'application/x-www-form-urlencoded',
						Referer: this.getOfficialUrl()
					}),
					data: this.encodePairs(this.buildSubmitPairs()),
					success: res => {
						const html = String(res.data || '')
						if (isLoginRequiredHtml(html) || this.isFailureHtml(html)) {
							return uni.showModal({
								title: '发表失败',
								content: this.extractTip(html) || '服务器返回失败',
								showCancel: false
							})
						}
						const postId = this.extractPostId(html)
						uni.showToast({
							title: '发表成功',
							icon: 'success'
						})
						setTimeout(() => {
							if (postId) {
								uni.redirectTo({
									url: `/pages/detail/detail?id=${postId}&classid=${this.classid}`
								})
								return
							}
							uni.navigateBack()
						}, 600)
					},
					fail: () => {
						uni.showToast({
							title: '发表失败',
							icon: 'none'
						})
					},
					complete: () => {
						this.submitting = false
					}
				})
			},
			encodePairs(pairs) {
				return (pairs || []).map(pair => `${encodeURIComponent(pair[0])}=${encodeURIComponent(pair[1] == null ? '' : pair[1])}`).join('&')
			},
			addVoteOption() {
				if (this.voteOptions.length >= 12) {
					return
				}
				this.voteOptions.push('')
			},
			removeVoteOption() {
				if (this.voteOptions.length > 2) {
					this.voteOptions.pop()
				}
			},
			parseUbb(html) {
				const text = stripHtml(String(html || '')
						.replace(/<script[\s\S]*?<\/script>/ig, '')
						.replace(/<style[\s\S]*?<\/style>/ig, ''))
					.replace(/\s{2,}/g, '\n')
				return text.split(/\n+/)
					.map(item => item.trim())
					.filter(item => item && !/^(首页|论坛|发表新帖|返回上级|返回首页)$/i.test(item))
					.slice(0, 120)
			},
			isFailureHtml(html) {
				return /<div class=["']tip["'][^>]*>[\s\S]*?(失败|错误|验证码|登录|为空|加黑|限制|不能|请先)/.test(String(html || ''))
			},
			extractTip(html) {
				const match = String(html || '').match(/<div class=["']tip["'][^>]*>([\s\S]*?)<\/div>/i)
				return match ? stripHtml(match[1]) : stripHtml(html).slice(0, 120)
			},
			extractPostId(html) {
				const text = String(html || '')
				const patterns = [
					/bbs-(\d+)\.html/i,
					/book_view\.aspx[^"']*[?&]id=(\d+)/i,
					/[?&]id=(\d{3,})/i
				]
				for (let i = 0; i < patterns.length; i++) {
					const match = text.match(patterns[i])
					if (match) {
						return match[1]
					}
				}
				return ''
			},
			goLogin() {
				uni.redirectTo({
					url: '/pages/login/login'
				})
			}
		}
	}
</script>

<style scoped>
	page {
		background: #f4f6f5;
	}

	.special-page {
		padding: 20rpx;
		box-sizing: border-box;
	}

	.card,
	.board-select-card {
		background: #fff;
		border-radius: 8px;
		overflow: hidden;
		box-shadow: 0 1px 5px rgba(20, 80, 50, .05);
	}

	.board-select-card {
		margin-bottom: 18rpx;
	}

	.board-select-row {
		min-height: 86rpx;
		padding: 0 22rpx;
		display: flex;
		align-items: center;
		justify-content: space-between;
		box-sizing: border-box;
	}

	.board-select-text {
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 6rpx;
	}

	.board-select-label {
		color: #7b8a82;
		font-size: 12px;
	}

	.board-select-name {
		color: #18342b;
		font-size: 16px;
		font-weight: 600;
	}

	.form-row {
		padding: 22rpx 24rpx;
		border-bottom: 1px solid #edf0ee;
		box-sizing: border-box;
	}

	.form-label {
		display: block;
		margin-bottom: 14rpx;
		color: #333;
		font-size: 15px;
		font-weight: 600;
	}

	.input,
	.textarea {
		width: 100%;
		border: 1px solid #dfe7e2;
		border-radius: 6px;
		background: #fff;
		color: #222;
		box-sizing: border-box;
		font-size: 15px;
	}

	.input {
		height: 76rpx;
		line-height: 76rpx;
		padding: 0 20rpx;
	}

	.textarea {
		min-height: 260rpx;
		padding: 18rpx 20rpx;
		line-height: 22px;
	}

	.textarea.small {
		min-height: 150rpx;
	}

	.vote-list {
		display: flex;
		flex-direction: column;
		gap: 14rpx;
	}

	.inline-actions {
		margin-top: 16rpx;
		display: flex;
		gap: 12rpx;
	}

	.small-btn {
		height: 58rpx;
		line-height: 58rpx;
		margin: 0;
		padding: 0 18rpx;
		border-radius: 6px;
		background: #f5faf7;
		color: #2f6f55;
		border: 1px solid #dbe8df;
		font-size: 12px;
	}

	.small-btn.muted {
		color: #7d3f3f;
		background: #fff8f8;
		border-color: #f1dddd;
	}

	.two-cols {
		display: flex;
		gap: 16rpx;
	}

	.col {
		min-width: 0;
		flex: 1;
	}

	.submit-btn {
		height: 88rpx;
		line-height: 88rpx;
		margin: 26rpx 24rpx 28rpx;
		border-radius: 8px;
		background-color: #07c160;
		font-size: 16px;
	}

	.ubb-card {
		padding: 24rpx;
	}

	.paragraph {
		display: block;
		margin-bottom: 16rpx;
		color: #21352d;
		font-size: 14px;
		line-height: 22px;
		word-break: break-word;
	}

	.empty {
		padding: 110rpx 0;
		text-align: center;
		color: #999;
	}
</style>
