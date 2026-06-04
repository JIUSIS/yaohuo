export function openInBrowser(url) {
	url = normalizeUrl(url)
	if (!url) {
		uni.showToast({
			title: '没有可打开的链接',
			icon: 'none'
		})
		return
	}
	// #ifdef APP-PLUS
	if (typeof plus !== 'undefined' && plus.runtime && plus.runtime.openURL) {
		plus.runtime.openURL(url, () => {
			copyUrl(url)
		})
		return
	}
	// #endif
	copyUrl(url)
}

function normalizeUrl(url) {
	url = String(url || '').trim()
	if (!url) {
		return ''
	}
	if (/^https?:\/\//i.test(url)) {
		return url
	}
	if (url.indexOf('//') === 0) {
		return 'https:' + url
	}
	if (url[0] === '/') {
		return 'https://yaohuo.me' + url
	}
	return 'https://yaohuo.me/' + url.replace(/^\.?\//, '')
}

function copyUrl(url) {
	uni.setClipboardData({
		data: url,
		success: () => {
			uni.showToast({
				title: '链接已复制',
				icon: 'none'
			})
		}
	})
}
