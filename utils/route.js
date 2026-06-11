import {
	absoluteYaohuoUrl,
	decodeHtml
} from './html.js'

export function getQueryValue(url, name) {
	const reg = new RegExp(`[?&]${name}=([^&#]*)`, 'i')
	const match = String(url || '').match(reg)
	if (!match) {
		return ''
	}
	try {
		return decodeURIComponent(match[1])
	} catch (e) {
		return match[1]
	}
}

export function getNativePostRoute(input, fallbackClassId, depth) {
	depth = depth || 0
	const url = normalizeRouteUrl(input)
	if (!url) {
		return ''
	}
	const currentRouteMatch = url.match(/\/pages\/detail\/detail\?[^#]*\bid=(\d+)/i)
	if (currentRouteMatch) {
		return buildPostRoute(currentRouteMatch[1], getQueryValue(url, 'classid') || fallbackClassId)
	}
	const htmlRouteMatch = url.match(/\/bbs-(\d+)\.html(?:[?#].*)?$/i)
	if (htmlRouteMatch) {
		return buildPostRoute(htmlRouteMatch[1], getQueryValue(url, 'classid') || fallbackClassId)
	}
	if (/\/bbs\/book_(?:view|re)\.aspx/i.test(url) && isPostReadUrl(url)) {
		const id = getQueryValue(url, 'id')
		if (id) {
			return buildPostRoute(id, getQueryValue(url, 'classid') || fallbackClassId)
		}
	}
	if (depth < 2) {
		const embedded = getEmbeddedRoute(url, fallbackClassId, depth)
		if (embedded) {
			return embedded
		}
	}
	return ''
}

export function navigateToNativePost(input, options) {
	const route = getNativePostRoute(input, options && options.classid)
	if (!route) {
		return false
	}
	const method = options && options.replace ? 'redirectTo' : 'navigateTo'
	uni[method]({
		url: route,
		fail: () => {
			uni.navigateTo({
				url: route
			})
		}
	})
	return true
}

export function getNativeRoute(input) {
	const url = normalizeRouteUrl(input)
	if (!url) {
		return ''
	}
	const postRoute = getNativePostRoute(url)
	if (postRoute) {
		return postRoute
	}
	if (/\/myfile\.aspx/i.test(url)) {
		return '/pages/mine/mine'
	}
	if (/\/bbs\/book_view_add\.aspx/i.test(url)) {
		const classId = getQueryValue(url, 'classid') || '177'
		return `/pages/post/post?classid=${encodeURIComponent(classId)}`
	}
	if (/\/bbs\/book_view_mod\.aspx/i.test(url)) {
		return buildPostEditRoute(url)
	}
	if (/\/bbs\/book_view_sendmoney\.aspx/i.test(url)) {
		return buildSpecialPostRoute('sendmoney', url)
	}
	if (/\/bbs\/book_view_addvote\.aspx/i.test(url)) {
		return buildSpecialPostRoute('vote', url)
	}
	if (/\/bbs\/book_view_addurl\.aspx/i.test(url)) {
		return buildSpecialPostRoute('resource', url)
	}
	if (/\/bbs\/book_view_ubb\.aspx/i.test(url)) {
		return buildSpecialPostRoute('ubb', url)
	}
	if (/\/bbs\/EditProfile\.aspx/i.test(url)) {
		return buildEditRoute('profile', '修改资料', url)
	}
	if (/\/bbs\/ModifyPW\.aspx/i.test(url)) {
		return buildEditRoute('password', '更改密码', url)
	}
	if (/\/bbs\/ModifyHead\.aspx/i.test(url)) {
		return buildEditRoute('avatar', '更换头像', url)
	}
	if (/\/bbs\/favlist\.aspx/i.test(url)) {
		return buildMineNativeRoute('我的收藏', url)
	}
	if (/\/bbs\/banklist\.aspx/i.test(url)) {
		return buildMineNativeRoute('妖晶明细', url)
	}
	if (/\/album\/albumlist\.aspx/i.test(url)) {
		return buildMineNativeRoute('我的相册', url)
	}
	if (/\/clan\/main\.aspx/i.test(url)) {
		return buildMineNativeRoute('我的家族', url)
	}
	if (/\/bbs\/tomoneyinfo\.aspx/i.test(url)) {
		return buildMineNativeRoute('妖晶获取消费规则', url)
	}
	if (/\/bbs\/tolvlinfo\.aspx/i.test(url)) {
		return buildMineNativeRoute('经验头衔等级规则', url)
	}
	if (/\/bbs\/totimeinfo\.aspx/i.test(url)) {
		return buildMineNativeRoute('在线时间图标规则', url)
	}
	if (/\/games\/chuiniu\/(?:$|index\.aspx|\?)/i.test(url)) {
		return '/pages/game/game'
	}
	if (/\/games\/chat\/book_re\.aspx/i.test(url)) {
		return '/pages/game/game?chat=1'
	}
	if (/\/games\/chuiniu\/add\.aspx/i.test(url)) {
		return '/pages/game/add'
	}
	if (/\/games\/chuiniu\/doit\.aspx/i.test(url)) {
		const id = getQueryValue(url, 'id')
		return id ? `/pages/game/challenge?id=${encodeURIComponent(id)}` : '/pages/game/game'
	}
	if (/\/games\/chuiniu\/book_view\.aspx/i.test(url)) {
		const id = getQueryValue(url, 'id')
		const type = getQueryValue(url, 'type')
		const touserid = getQueryValue(url, 'touserid')
		const params = [
			'result=1',
			id ? 'id=' + encodeURIComponent(id) : '',
			type ? 'viewType=' + encodeURIComponent(type) : '',
			touserid ? 'touserid=' + encodeURIComponent(touserid) : ''
		].filter(Boolean)
		return `/pages/game/challenge?${params.join('&')}`
	}
	if (/\/games\/chuiniu\/monthly\.aspx/i.test(url)) {
		return '/pages/game/game?mode=rank'
	}
	if (/\/games\/chuiniu\/book_list\.aspx/i.test(url)) {
		const type = getQueryValue(url, 'type') === '1' ? 'records1' : 'records0'
		return `/pages/game/game?mode=${type}`
	}
	if (/\/bbs\/userinfo\.aspx/i.test(url)) {
		const id = getQueryValue(url, 'touserid')
		return id ? `/pages/user/user?id=${encodeURIComponent(id)}` : ''
	}
	if (/\/bbs\/userinfomore\.aspx/i.test(url)) {
		const id = getQueryValue(url, 'touserid')
		return id ? `/pages/user/more?id=${encodeURIComponent(id)}&url=${encodeURIComponent(url)}` : ''
	}
	if (/\/bbs\/book_list_log\.aspx/i.test(url) && getQueryValue(url, 'touserid')) {
		const id = getQueryValue(url, 'touserid')
		return `/pages/user/logs?id=${encodeURIComponent(id)}&url=${encodeURIComponent(url)}`
	}
	if (/\/bbs\/userguessbook\.aspx/i.test(url)) {
		const id = getQueryValue(url, 'touserid')
		return id ? `/pages/user/guestbook?id=${encodeURIComponent(id)}&url=${encodeURIComponent(url)}` : ''
	}
	if (/\/bbs\/messagelist_add\.aspx/i.test(url)) {
		const id = getQueryValue(url, 'touserid') || getQueryValue(url, 'touseridlist')
		return id ? `/pages/user/message?id=${encodeURIComponent(id)}&url=${encodeURIComponent(url)}` : ''
	}
	if (/\/bbs\/FriendList\.aspx/i.test(url)) {
		const action = String(getQueryValue(url, 'action') || '').toLowerCase()
		if (action && action !== 'class' && action !== 'list') {
			return ''
		}
		const type = getQueryValue(url, 'friendtype') === '1' ? '1' : '0'
		return `/pages/friends/friends?type=${type}`
	}
	if (/\/bbs\/book_re_my\.aspx/i.test(url)) {
		const userId = getQueryValue(url, 'touserid')
		const ot = getQueryValue(url, 'ot')
		return `/pages/replies/replies?userId=${encodeURIComponent(userId || '')}${ot ? '&ot=' + encodeURIComponent(ot) : ''}`
	}
	if (/\/bbs\/book_list_rank\.aspx/i.test(url)) {
		return `/pages/rank/rank?url=${encodeURIComponent(url)}`
	}
	if (/\/bbs\/(?:book_list_search|book_list_hot|book_list|list)\.aspx/i.test(url)) {
		return `/pages/bbsList/bbsList?url=${encodeURIComponent(JSON.stringify({url}))}`
	}
	return ''
}

export function navigateToNativeRoute(input, options) {
	const route = getNativeRoute(input)
	if (!route) {
		return false
	}
	const method = options && options.replace ? 'redirectTo' : 'navigateTo'
	uni[method]({
		url: route,
		fail: () => {
			uni.navigateTo({
				url: route
			})
		}
	})
	return true
}

function buildPostRoute(id, classId) {
	const cleanId = String(id || '').match(/\d+/)
	if (!cleanId) {
		return ''
	}
	const cleanClassId = String(classId || '').match(/\d+/)
	return `/pages/detail/detail?id=${cleanId[0]}${cleanClassId ? '&classid=' + cleanClassId[0] : ''}`
}

function buildSpecialPostRoute(type, url) {
	const classId = getQueryValue(url, 'classid') || '177'
	return `/pages/post/special?type=${encodeURIComponent(type)}&classid=${encodeURIComponent(classId)}`
}

function buildPostEditRoute(url) {
	const id = getQueryValue(url, 'id')
	const classId = getQueryValue(url, 'classid') || '177'
	const params = [
		`url=${encodeURIComponent(url)}`,
		id ? `id=${encodeURIComponent(id)}` : '',
		classId ? `classid=${encodeURIComponent(classId)}` : ''
	].filter(Boolean)
	return `/pages/post/edit?${params.join('&')}`
}

function buildMineNativeRoute(title, url) {
	return `/pages/mine/native-page?title=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`
}

function buildEditRoute(mode, title, url) {
	return `/pages/mine/edit-form?mode=${encodeURIComponent(mode)}&title=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`
}

function normalizeRouteUrl(input) {
	let text = decodeHtml(String(input || '').trim())
	for (let i = 0; i < 2; i++) {
		try {
			const decoded = decodeURIComponent(text)
			if (decoded === text) {
				break
			}
			text = decoded
		} catch (e) {
			break
		}
	}
	if (!text) {
		return ''
	}
	try {
		if (/^\s*\{/.test(text)) {
			const parsed = JSON.parse(text)
			if (parsed && parsed.url) {
				text = parsed.url
			}
		}
	} catch (e) {}
	if (/^\/pages\//i.test(text)) {
		return text
	}
	return absoluteYaohuoUrl(text)
}

function getEmbeddedRoute(url, fallbackClassId, depth) {
	const names = ['url', 'backurl', 'backUrl', 'gourl', 'goUrl', 'href', 'link', 'u']
	for (let i = 0; i < names.length; i++) {
		const value = getQueryValue(url, names[i])
		if (!value || value === url) {
			continue
		}
		if (!/(?:bbs-\d+\.html|\/bbs\/book_(?:view|re)\.aspx|\/pages\/detail\/detail)/i.test(value)) {
			continue
		}
		const route = getNativePostRoute(value, fallbackClassId, depth + 1)
		if (route) {
			return route
		}
	}
	return ''
}

function isPostReadUrl(url) {
	const action = String(getQueryValue(url, 'action') || '').toLowerCase()
	if (!action) {
		return true
	}
	return action === 'class' || action === 'view' || action === 'list'
}
