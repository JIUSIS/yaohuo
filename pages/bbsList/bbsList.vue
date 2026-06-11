<template>
	<view>
		<view v-if="boardClassId" class="board-tabs">
			<view v-for="item in boardTabs" :key="item.key" class="board-tab"
				:class="{active: activeBoardMode === item.key}" @click="switchBoardMode(item.key)">
				{{item.label}}
			</view>
		</view>
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
				url: '',
				sourceUrl: '',
				boardClassId: '',
				activeBoardMode: 'class',
				boardTabs: [{
					key: 'class',
					label: '全部'
				}, {
					key: 'good',
					label: '精选'
				}, {
					key: 'new',
					label: '新帖'
				}]
			}
		},
		onLoad(option) {
			this.sourceUrl = JSON.parse(decodeURIComponent(option.url)).url
			this.boardClassId = this.extractBoardClassId(this.sourceUrl)
			this.activeBoardMode = this.extractBoardMode(this.sourceUrl)
			this.url = this.boardClassId ? this.buildBoardUrl(this.activeBoardMode) : this.sourceUrl
		},
		onShow() {
			if (this.$refs.postList && this.$refs.postList.syncReadState) {
				this.$refs.postList.syncReadState()
			}
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
			extractBoardClassId(url) {
				url = String(url || '')
				if (!/\/bbs\/(?:list|book_list)\.aspx/i.test(url) || /book_list_search/i.test(url)) {
					return ''
				}
				const match = url.match(/[?&]classid=(\d+)/i)
				return match ? match[1] : ''
			},
			extractBoardMode(url) {
				const actionMatch = String(url || '').match(/[?&]action=(good|new|class)/i)
				return actionMatch ? actionMatch[1].toLowerCase() : 'class'
			},
			buildBoardUrl(mode) {
				const classId = this.boardClassId
				if (!classId) {
					return this.sourceUrl
				}
				if (mode === 'good' || mode === 'new') {
					return `https://yaohuo.me/bbs/book_list.aspx?action=${mode}&classid=${classId}`
				}
				return `https://yaohuo.me/bbs/book_list.aspx?classid=${classId}`
			},
			switchBoardMode(mode) {
				if (!this.boardClassId || mode === this.activeBoardMode) {
					return
				}
				this.activeBoardMode = mode
				this.url = this.buildBoardUrl(mode)
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

<style>
	page {
		background-color: #F3F3F3;
	}
</style>
<style lang="scss" scoped>
	.board-tabs {
		margin: 20rpx 20rpx 0;
		padding: 6rpx;
		border-radius: 8px;
		background: #fff;
		display: flex;
		box-sizing: border-box;
	}

	.board-tab {
		flex: 1;
		height: 62rpx;
		line-height: 62rpx;
		border-radius: 6px;
		text-align: center;
		color: #666;
		font-size: 14px;
	}

	.board-tab.active {
		background: #07c160;
		color: #fff;
		font-weight: 600;
	}
</style>
