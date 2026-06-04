const YAOHUO_ORIGIN = 'https://yaohuo.me'

export function decodeHtml(text) {
	return String(text || '').replace(/&(#x?[0-9a-f]+|[a-z]+);/ig, (all, entity) => {
		const lower = entity.toLowerCase()
		const named = {
			amp: '&',
			lt: '<',
			gt: '>',
			quot: '"',
			apos: "'",
			nbsp: ' '
		}
		if (named[lower]) {
			return named[lower]
		}
		if (lower[0] === '#') {
			const code = lower[1] === 'x' ? parseInt(lower.slice(2), 16) : parseInt(lower.slice(1), 10)
			return code ? String.fromCharCode(code) : all
		}
		return all
	})
}

export function stripHtml(html) {
	return decodeHtml(String(html || '')
		.replace(/<br\s*\/?>/ig, '\n')
		.replace(/<script[\s\S]*?<\/script>/ig, '')
		.replace(/<style[\s\S]*?<\/style>/ig, '')
		.replace(/<[^>]+>/g, ''))
		.replace(/\r/g, '')
		.replace(/[ \t]+\n/g, '\n')
		.replace(/\n{3,}/g, '\n\n')
		.trim()
}

export function escapeHtml(text) {
	return String(text || '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;')
}

export function absoluteYaohuoUrl(url) {
	url = decodeHtml(String(url || '')).trim()
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
		return YAOHUO_ORIGIN + url
	}
	return YAOHUO_ORIGIN + '/' + url.replace(/^\.?\//, '')
}

export function getAttr(tag, name) {
	const reg = new RegExp(`${name}\\s*=\\s*([\"'])([\\s\\S]*?)\\1`, 'i')
	const match = String(tag || '').match(reg)
	return match ? decodeHtml(match[2]) : ''
}

export function extractInputValue(html, name) {
	const reg = new RegExp(`<input[^>]+name\\s*=\\s*([\"'])${name}\\1[^>]*>`, 'i')
	const match = String(html || '').match(reg)
	return match ? getAttr(match[0], 'value') : ''
}

export function extractClassBlocks(html, classNamePart) {
	html = String(html || '')
	const escaped = String(classNamePart || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
	const reg = new RegExp(`<([a-z0-9]+)[^>]+class\\s*=\\s*(["'])[^"']*${escaped}[^"']*\\2[^>]*>`, 'ig')
	const blocks = []
	let match
	while ((match = reg.exec(html))) {
		const tag = match[1]
		const start = match.index
		const end = findTagEnd(html, tag, reg.lastIndex)
		blocks.push(html.slice(start, end))
	}
	return blocks
}

function findTagEnd(html, tag, fromIndex) {
	const tagReg = new RegExp('</?' + tag + '\\b[^>]*>', 'ig')
	tagReg.lastIndex = fromIndex
	let depth = 1
	let match
	while ((match = tagReg.exec(html))) {
		if (match[0][1] === '/') {
			depth--
			if (depth === 0) {
				return tagReg.lastIndex
			}
		} else if (!/\/>$/.test(match[0])) {
			depth++
		}
	}
	return fromIndex
}

export function normalizeHtmlUrls(html) {
	return String(html || '')
		.replace(/\s(src|href)=([\"'])([^\"']+)\2/ig, (all, attr, quote, url) => {
			if (attr.toLowerCase() === 'href' && /bbs\/book_view\.aspx/i.test(url)) {
				const idMatch = decodeHtml(url).match(/[?&]id=(\d+)/i)
				if (idMatch) {
					return ` ${attr}=${quote}/pages/detail/detail?id=${idMatch[1]}${quote}`
				}
			}
			return ` ${attr}=${quote}${absoluteYaohuoUrl(url)}${quote}`
		})
}
