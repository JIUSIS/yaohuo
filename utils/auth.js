export function getAuthCookie() {
	const cookie = uni.getStorageSync('cookie')
	if (hasAuthCookie(cookie)) {
		return cookie
	}
	if (cookie) {
		uni.removeStorageSync('cookie')
	}
	return syncAuthCookieFromSystem()
}

export function hasAuthCookie(cookie) {
	return /sidyaohuo=([^;]+)/.test(String(cookie || ''))
}

export function isLoginRequiredHtml(html) {
	html = String(html || '')
	const hasLoginLink = /(href|action)=["']\/?waplogin\.aspx(?:[?"']|$)/i.test(html)
	return /请先\s*<a[^>]+href=["']\/?waplogin\.aspx["'][^>]*>登录<\/a>\s*浏览完整内容/i.test(html) ||
		/<title>\s*登录\s*-\s*妖火网\s*<\/title>/i.test(html) ||
		(hasLoginLink && /请先|登录|登录失效|重新登录|失效/.test(html))
}

export function getAuthSid() {
	const cookie = getAuthCookie()
	const match = String(cookie).match(/sidyaohuo=([^;]+)/)
	return match ? match[1] : ''
}

export function getAuthHeader(extraHeader) {
	return Object.assign({}, extraHeader || {}, {
		Cookie: getAuthCookie()
	})
}

export function normalizeAuthCookie(cookieText) {
	const match = String(cookieText || '').match(/sidyaohuo=[^;]+;?/)
	if (!match) {
		return ''
	}
	return match[0].endsWith(';') ? match[0] : match[0] + ';'
}

export function normalizeCookieHeader(cookieText) {
	return String(cookieText || '')
		.split(';')
		.map(item => item.trim())
		.filter(Boolean)
		.filter(item => !/^(path|expires|max-age|secure|httponly|samesite)=?/i.test(item))
		.join('; ')
}

export function getSetCookie(headers) {
	headers = headers || {}
	for (const key in headers) {
		if (key && key.toLowerCase() === 'set-cookie') {
			return headers[key]
		}
	}
	return ''
}

export function getSystemCookie(url) {
	let cookie = ''
	// #ifdef APP-PLUS
	try {
		if (typeof plus !== 'undefined' && plus.navigator && plus.navigator.getCookie) {
			cookie = plus.navigator.getCookie(url)
		}
	} catch (e) {}
	// #endif
	return cookie || ''
}

export function syncAuthCookieFromSystem() {
	const cookie = normalizeCookieHeader(getSystemCookie('https://yaohuo.me'))
	if (hasAuthCookie(cookie)) {
		uni.setStorageSync('cookie', cookie)
		return cookie
	}
	return ''
}

export function clearAuthCookie() {
	uni.removeStorageSync('cookie')
	setSystemCookie('https://yaohuo.me', 'sidyaohuo=; expires=Thu, 01 Jan 1970 00:00:00 GMT;')
}

export function verifyAuthCookie() {
	const cookie = syncAuthCookieFromSystem() || uni.getStorageSync('cookie')
	if (!hasAuthCookie(cookie)) {
		clearAuthCookie()
		return Promise.resolve(false)
	}
	return new Promise(resolve => {
		uni.request({
			url: 'https://yaohuo.me/',
			header: getAuthHeader(),
			success: res => {
				const valid = !isLoginRequiredHtml(res && res.data)
				if (!valid) {
					clearAuthCookie()
				}
				resolve(valid)
			},
			fail: () => {
				resolve(false)
			}
		})
	})
}

export function setSystemCookie(url, cookie) {
	if (!cookie) {
		return
	}
	// #ifdef APP-PLUS
	try {
		if (typeof plus !== 'undefined' && plus.navigator && plus.navigator.setCookie) {
			plus.navigator.setCookie(url, cookie)
		}
	} catch (e) {}
	// #endif
}

export function getAuthCookieFromResponse(res, url) {
	const sources = []
	const setCookie = getSetCookie(res && res.header)
	if (Array.isArray(setCookie)) {
		sources.push(setCookie.join(';'))
	} else {
		sources.push(setCookie)
	}

	if (res && Array.isArray(res.cookies)) {
		sources.push(res.cookies.map(cookie => {
			if (typeof cookie === 'string') {
				return cookie
			}
			return cookie && cookie.name ? `${cookie.name}=${cookie.value || ''};` : ''
		}).join(';'))
	}

	if (res && typeof res.data === 'string') {
		sources.push(res.data)
	}

	sources.push(getSystemCookie(url))

	for (let i = 0; i < sources.length; i++) {
		const cookie = normalizeAuthCookie(sources[i])
		if (cookie) {
			return cookie
		}
	}
	const cookie = normalizeCookieHeader(sources.join(';'))
	return hasAuthCookie(cookie) ? cookie : ''
}
