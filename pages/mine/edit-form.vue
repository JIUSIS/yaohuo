<template>
	<view class="page">
		<view v-if="tip" class="tip">{{tip}}</view>
		<view class="card">
			<view v-for="field in visibleFields" :key="field.name" class="form-row">
				<text class="label">{{field.label}}</text>
				<picker v-if="field.options && field.options.length" mode="selector" :range="field.options" range-key="label"
					:value="getOptionIndex(field)" @change="changeSelect(field,$event)">
					<view class="select-control">
						<text>{{getOptionLabel(field)}}</text>
						<uni-icons type="arrowdown" size="15" color="#7a8781"></uni-icons>
					</view>
				</picker>
				<textarea v-else-if="field.multiline" class="textarea" v-model="form[field.name]" :maxlength="-1"
					auto-height :show-confirm-bar="false"></textarea>
				<input v-else class="input" :password="field.password" v-model="form[field.name]"
					:placeholder="field.placeholder || field.label" />
			</view>

			<view v-if="mode === 'avatar' && headImages.length" class="head-section">
				<text class="label">系统头像</text>
				<view class="head-grid">
					<image v-for="item in headImages" :key="item" class="head-image" :class="{active: form.toheadimg === item}"
						:src="item" mode="aspectFill" @click="selectHead(item)"></image>
				</view>
			</view>

			<button class="submit-btn" type="primary" :loading="submitting" :disabled="submitting || loading"
				@click="submitForm">{{submitText}}</button>
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
		decodeHtml,
		getAttr,
		stripHtml
	} from '@/utils/html.js'

	const LABELS = {
		tonickname: '昵称',
		remark: '个性签名',
		sex: '性别',
		fenfuo: '性别',
		birthday: '生日',
		aihao: '爱好',
		city: '城市',
		zhiye: '职业',
		shenggao: '身高',
		tizhong: '体重',
		mobile: '手机',
		email: '邮箱',
		qq: 'QQ号',
		txtoldPW: '原密码',
		txtnewPW: '新密码',
		txtrePW: '确认新密码',
		toheadimg: '头像地址',
		sysimg: '头像类型'
	}

	export default {
		data() {
			return {
				mode: '',
				title: '',
				url: '',
				action: '',
				fields: [],
				form: {},
				tip: '',
				headImages: [],
				loading: false,
				submitting: false
			}
		},
		computed: {
			visibleFields() {
				return this.fields.filter(field => !field.hidden)
			},
			submitText() {
				if (this.mode === 'password') {
					return '确认修改'
				}
				if (this.mode === 'avatar') {
					return '设为头像'
				}
				return '保存资料'
			}
		},
		onLoad(option) {
			option = option || {}
			this.mode = option.mode || ''
			this.title = option.title ? decodeURIComponent(option.title) : this.getDefaultTitle()
			this.url = option.url ? decodeURIComponent(option.url) : this.getDefaultUrl()
			uni.setNavigationBarTitle({
				title: this.title || this.getDefaultTitle()
			})
			this.fetchForm()
		},
		methods: {
			getDefaultTitle() {
				if (this.mode === 'password') return '更改密码'
				if (this.mode === 'avatar') return '更换头像'
				return '修改资料'
			},
			getDefaultUrl() {
				if (this.mode === 'password') return 'https://yaohuo.me/bbs/ModifyPW.aspx'
				if (this.mode === 'avatar') return 'https://yaohuo.me/bbs/ModifyHead.aspx'
				return 'https://yaohuo.me/bbs/EditProfile.aspx'
			},
			fetchForm() {
				this.loading = true
				uni.request({
					url: absoluteYaohuoUrl(this.url),
					header: getAuthHeader(),
					success: res => {
						const html = String(res.data || '')
						if (isLoginRequiredHtml(html)) {
							return this.goLogin()
						}
						const parsed = this.parseFormPage(html)
						this.action = parsed.action
						this.fields = parsed.fields
						this.form = parsed.form
						this.tip = parsed.tip
						this.headImages = parsed.headImages
					},
					fail: () => {
						uni.showToast({
							title: '加载失败',
							icon: 'none'
						})
					},
					complete: () => {
						this.loading = false
					}
				})
			},
			parseFormPage(html) {
				const formHtml = this.pickForm(html)
				const action = this.getFormAction(formHtml) || absoluteYaohuoUrl(this.url)
				const fields = []
				const form = {}
				this.parseInputs(formHtml, fields, form)
				this.parseTextareas(formHtml, fields, form)
				this.parseSelects(formHtml, fields, form)
				const tip = stripHtml((String(html || '').match(/<div\b[^>]*class\s*=\s*(["'])[^"']*tip[^"']*\1[^>]*>([\s\S]*?)<\/div>/i) || [])[2] || '')
				return {
					action,
					fields: this.normalizeFields(fields),
					form,
					tip,
					headImages: this.parseHeadImages(html)
				}
			},
			pickForm(html) {
				const forms = String(html || '').match(/<form\b[\s\S]*?<\/form>/ig) || []
				if (!forms.length) return ''
				if (this.mode === 'profile') {
					return forms.find(form => /tonickname|remark|birthday/i.test(form)) || forms[0]
				}
				return forms[0]
			},
			getFormAction(formHtml) {
				const tag = String(formHtml || '').match(/<form\b[^>]*>/i)
				const action = tag ? getAttr(tag[0], 'action') : ''
				return action ? absoluteYaohuoUrl(action) : ''
			},
			parseInputs(formHtml, fields, form) {
				const reg = /<input\b[^>]*>/ig
				let match
				while ((match = reg.exec(String(formHtml || '')))) {
					const tag = match[0]
					const name = getAttr(tag, 'name')
					if (!name) continue
					const type = String(getAttr(tag, 'type') || 'text').toLowerCase()
					const value = getAttr(tag, 'value') || ''
					if (type === 'radio') {
						this.addRadioField(fields, form, name, value, stripHtml(tag) || value, /checked/i.test(tag))
						continue
					}
					form[name] = form[name] !== undefined ? form[name] : value
					fields.push({
						name,
						label: this.getLabel(name),
						hidden: type === 'hidden' || name === 'f',
						password: type === 'password' || /pw|pass/i.test(name),
						placeholder: getAttr(tag, 'placeholder')
					})
				}
			},
			parseTextareas(formHtml, fields, form) {
				const reg = /<textarea\b[^>]*>[\s\S]*?<\/textarea>/ig
				let match
				while ((match = reg.exec(String(formHtml || '')))) {
					const tag = (match[0].match(/<textarea\b[^>]*>/i) || [])[0] || ''
					const name = getAttr(tag, 'name')
					if (!name) continue
					const body = match[0].replace(/^<textarea\b[^>]*>/i, '').replace(/<\/textarea>$/i, '')
					form[name] = decodeHtml(body)
					fields.push({
						name,
						label: this.getLabel(name),
						multiline: true
					})
				}
			},
			parseSelects(formHtml, fields, form) {
				const reg = /<select\b[^>]*>[\s\S]*?<\/select>/ig
				let match
				while ((match = reg.exec(String(formHtml || '')))) {
					const tag = (match[0].match(/<select\b[^>]*>/i) || [])[0] || ''
					const name = getAttr(tag, 'name')
					if (!name) continue
					const options = []
					const optionReg = /<option\b[^>]*>[\s\S]*?<\/option>/ig
					let option
					while ((option = optionReg.exec(match[0]))) {
						const optionTag = (option[0].match(/<option\b[^>]*>/i) || [])[0] || ''
						const value = getAttr(optionTag, 'value') || stripHtml(option[0])
						const label = stripHtml(option[0])
						options.push({
							value,
							label
						})
						if (/selected/i.test(optionTag) || form[name] === undefined) {
							form[name] = value
						}
					}
					fields.push({
						name,
						label: this.getLabel(name),
						options
					})
				}
			},
			addRadioField(fields, form, name, value, label, checked) {
				let field = fields.find(item => item.name === name)
				if (!field) {
					field = {
						name,
						label: this.getLabel(name),
						options: []
					}
					fields.push(field)
				}
				field.options.push({
					value,
					label: label || value
				})
				if (checked || form[name] === undefined) {
					form[name] = value
				}
			},
			normalizeFields(fields) {
				const seen = {}
				return fields.filter(field => {
					if (!field.name || seen[field.name]) return false
					seen[field.name] = true
					if (field.name === 'action' || field.name === 'siteid' || field.name === 'classid' || field.name === '__CSRFToken') {
						field.hidden = true
					}
					return true
				})
			},
			parseHeadImages(html) {
				const urls = []
				const seen = {}
				const reg = /<img\b[^>]*src\s*=\s*(["'])([^"']*\/bbs\/head\/\d+\.gif[^"']*)\1[^>]*>/ig
				let match
				while ((match = reg.exec(String(html || '')))) {
					const url = absoluteYaohuoUrl(match[2])
					if (!seen[url]) {
						seen[url] = true
						urls.push(url)
					}
				}
				return urls
			},
			getLabel(name) {
				return LABELS[name] || name
			},
			getOptionIndex(field) {
				const value = this.form[field.name]
				const index = (field.options || []).findIndex(item => item.value === value)
				return index > -1 ? index : 0
			},
			getOptionLabel(field) {
				const option = (field.options || [])[this.getOptionIndex(field)]
				return option ? option.label : '请选择'
			},
			changeSelect(field, e) {
				const index = Number(e.detail.value || 0)
				const option = (field.options || [])[index]
				if (option) {
					this.$set(this.form, field.name, option.value)
				}
			},
			selectHead(url) {
				this.$set(this.form, 'toheadimg', url.replace(/^https:\/\/yaohuo\.me/i, ''))
				this.$set(this.form, 'sysimg', '1')
			},
			submitForm() {
				if (!this.action || this.submitting) return
				this.submitting = true
				uni.request({
					url: this.action,
					method: 'POST',
					header: getAuthHeader({
						'Content-Type': 'application/x-www-form-urlencoded',
						Referer: absoluteYaohuoUrl(this.url)
					}),
					data: Object.assign({}, this.form),
					success: res => {
						const text = stripHtml(String(res.data || '')).replace(/\s+/g, ' ').trim()
						const ok = /成功|已保存|修改成功|设置成功/.test(text) && !/失败|错误/.test(text)
						uni.showModal({
							title: ok ? '提交成功' : '提交结果',
							content: text.slice(0, 180) || '服务器未返回明确结果',
							showCancel: false,
							success: () => {
								if (ok) {
									uni.navigateBack()
								}
							}
						})
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
		background: #f4f6f5;
	}

	.page {
		padding: 18rpx;
		box-sizing: border-box;
	}

	.card {
		padding: 22rpx 20rpx;
		background: #fff;
		border-radius: 8px;
		box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, .04);
	}

	.tip {
		margin-bottom: 16rpx;
		padding: 16rpx;
		border-radius: 8px;
		background: #eaf8f1;
		color: #087f77;
		font-size: 14px;
	}

	.form-row {
		margin-bottom: 20rpx;
	}

	.label {
		display: block;
		margin-bottom: 10rpx;
		color: #20352c;
		font-size: 14px;
		font-weight: 700;
	}

	.input,
	.textarea,
	.select-control {
		width: 100%;
		min-height: 76rpx;
		padding: 0 18rpx;
		border: 1px solid #dfe7e2;
		border-radius: 7px;
		background: #fff;
		color: #202b27;
		font-size: 14px;
		box-sizing: border-box;
	}

	.textarea {
		min-height: 150rpx;
		padding: 16rpx 18rpx;
		line-height: 21px;
	}

	.select-control {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.head-section {
		margin: 8rpx 0 24rpx;
	}

	.head-grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 14rpx;
	}

	.head-image {
		width: 128rpx;
		height: 128rpx;
		border-radius: 8px;
		border: 2px solid transparent;
		background: #f3f4f6;
	}

	.head-image.active {
		border-color: #08a878;
	}

	.submit-btn {
		height: 82rpx;
		line-height: 82rpx;
		margin: 22rpx 0 0;
		border-radius: 8px;
		background: #07c160;
		color: #fff;
	}
</style>
