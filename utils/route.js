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

function buildPostRoute(id, classId) {
	const cleanId = String(id || '').match(/\d+/)
	if (!cleanId) {
		return ''
	}
	const cleanClassId = String(classId || '').match(/\d+/)
	return `/pages/detail/detail?id=${cleanId[0]}${cleanClassId ? '&classid=' + cleanClassId[0] : ''}`
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
