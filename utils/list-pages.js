import {
	absoluteYaohuoUrl,
	decodeHtml,
	escapeHtml,
	extractClassBlocks,
	getAttr,
	stripHtml
} from './html.js'

export const YAOHUO_ORIGIN = 'https://yaohuo.me'

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

export function resolveYaohuoUrl(href, baseUrl) {
	href = decodeHtml(String(href || '')).trim()
	baseUrl = String(baseUrl || YAOHUO_ORIGIN)
	if (!href || /^javascript:/i.test(href)) {
		return ''
	}
	if (/^https?:\/\//i.test(href)) {
		return href
	}
	if (href.indexOf('//') === 0) {
		return 'https:' + href
	}
	if (href[0] === '/') {
		return YAOHUO_ORIGIN + href
	}
	const cleanBase = baseUrl.split('#')[0]
	const basePath = cleanBase.split('?')[0]
	if (href[0] === '?') {
		return basePath + href
	}
	const dir = basePath.replace(/\/[^/]*$/, '/')
	return dir + href.replace(/^\.?\//, '')
}

export function buildPageUrl(url, page) {
	url = String(url || '')
	if (!url) {
		return ''
	}
	const pageReg = /([?&])page=[^&#]*/i
	if (pageReg.test(url)) {
		return url.replace(pageReg, `$1page=${page}`)
	}
	return `${url}${url.indexOf('?') > -1 ? '&' : '?'}page=${page}`
}

export function getUrlPage(url) {
	const match = String(url || '').match(/[?&]page=(\d{1,6})/i)
	return match ? Number(match[1]) : 0
}

export function extractNextPageUrl(html, requestUrl, currentPage, urlPattern) {
	const candidates = []
	const reg = /<a\b[^>]*href\s*=\s*(["'])([^"']+)\1[^>]*>([\s\S]*?)<\/a>/ig
	let match
	while ((match = reg.exec(String(html || '')))) {
		const href = decodeHtml(match[2])
		if (!/[?&]page=\d{1,6}/i.test(href)) {
			continue
		}
		const url = resolveYaohuoUrl(href, requestUrl)
		if (urlPattern && !urlPattern.test(url)) {
			continue
		}
		const page = getUrlPage(url)
		if (page > Number(currentPage || 1)) {
			candidates.push({
				page,
				url
			})
		}
	}
	candidates.sort((a, b) => a.page - b.page)
	const next = candidates.find(item => item.page === Number(currentPage || 1) + 1) || candidates[0]
	return next ? next.url : ''
}

export function parseTotalPage(html, pageSize) {
	const text = stripHtml(decodeHtml(String(html || ''))).replace(/\s+/g, ' ')
	const ratioMatch = text.match(/第\s*\d{1,6}\s*\/\s*(\d{1,6})\s*页/)
	if (ratioMatch) {
		return Number(ratioMatch[1]) || 0
	}
	const totalMatch = text.match(/共\s*(\d{1,8})\s*条/)
	if (totalMatch && pageSize) {
		return Math.max(1, Math.ceil(Number(totalMatch[1]) / pageSize))
	}
	return 0
}

export function parseTitle(html, fallback) {
	const match = String(html || '').match(/<title>([\s\S]*?)<\/title>/i)
	const title = match ? stripHtml(match[1]).replace(/\s*-\s*妖火网\s*$/, '').trim() : ''
	return title || fallback || ''
}

export function parseLinks(html) {
	const links = []
	const reg = /<a\b[^>]*href\s*=\s*(["'])([\s\S]*?)\1[^>]*>([\s\S]*?)<\/a>/ig
	let match
	while ((match = reg.exec(String(html || '')))) {
		links.push({
			href: decodeHtml(match[2]),
			text: stripHtml(match[3]).replace(/\s+/g, ' ').trim(),
			index: match.index,
			end: reg.lastIndex,
			tag: match[0]
		})
	}
	return links
}

export function extractFormFields(formHtml) {
	const fields = {}
	const inputReg = /<input\b[^>]*>/ig
	let inputMatch
	while ((inputMatch = inputReg.exec(String(formHtml || '')))) {
		const tag = inputMatch[0]
		const name = getAttr(tag, 'name')
		if (!name || hasBooleanAttr(tag, 'disabled')) {
			continue
		}
		const type = String(getAttr(tag, 'type') || 'text').toLowerCase()
		if ((type === 'checkbox' || type === 'radio') && !hasBooleanAttr(tag, 'checked')) {
			if (type === 'radio') {
				fields[name] = fields[name] || ''
			}
			continue
		}
		fields[name] = getAttr(tag, 'value') || ''
	}
	const textareaReg = /<textarea\b[^>]*>[\s\S]*?<\/textarea>/ig
	let textareaMatch
	while ((textareaMatch = textareaReg.exec(String(formHtml || '')))) {
		const openTag = textareaMatch[0].match(/<textarea\b[^>]*>/i)
		const tag = openTag ? openTag[0] : ''
		const name = getAttr(tag, 'name')
		if (!name || hasBooleanAttr(tag, 'disabled')) {
			continue
		}
		const body = textareaMatch[0].replace(/^<textarea\b[^>]*>/i, '').replace(/<\/textarea>$/i, '')
		fields[name] = decodeHtml(body)
	}
	const selectReg = /<select\b[^>]*>[\s\S]*?<\/select>/ig
	let selectMatch
	while ((selectMatch = selectReg.exec(String(formHtml || '')))) {
		const openTag = selectMatch[0].match(/<select\b[^>]*>/i)
		const tag = openTag ? openTag[0] : ''
		const name = getAttr(tag, 'name')
		if (!name || hasBooleanAttr(tag, 'disabled')) {
			continue
		}
		const selectedOption = selectMatch[0].match(/<option\b[^>]*(?:\sselected(?:\s|=|>|\/))[^>]*>[\s\S]*?<\/option>/i)
		const firstOption = selectMatch[0].match(/<option\b[^>]*>[\s\S]*?<\/option>/i)
		const option = selectedOption || firstOption
		if (!option) {
			fields[name] = ''
			continue
		}
		const optionTag = option[0].match(/<option\b[^>]*>/i)
		fields[name] = optionTag && getAttr(optionTag[0], 'value') || stripHtml(option[0])
	}
	return fields
}

export function extractFormAction(formHtml, baseUrl) {
	const formTag = String(formHtml || '').match(/<form\b[^>]*>/i)
	const action = formTag ? getAttr(formTag[0], 'action') : ''
	return action ? resolveYaohuoUrl(action, baseUrl) : ''
}

export function extractTipText(html) {
	const match = String(html || '').match(/<div\b[^>]*class\s*=\s*(["'])[^"']*tip[^"']*\1[^>]*>([\s\S]*?)<\/div>/i)
	return match ? cleanGameActionText(normalizeGameText(match[2])) : ''
}

function hasBooleanAttr(tag, name) {
	const escaped = String(name || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
	return new RegExp('(?:^|\\s)' + escaped + '(?:\\s|=|>|/)', 'i').test(String(tag || ''))
}

function firstForm(html, predicate) {
	const forms = String(html || '').match(/<form\b[\s\S]*?<\/form>/ig) || []
	for (let i = 0; i < forms.length; i++) {
		if (!predicate || predicate(forms[i])) {
			return forms[i]
		}
	}
	return ''
}

function extractTextByClass(html, className) {
	const block = extractClassBlocks(html, className)[0]
	if (block) {
		return normalizeGameText(block)
	}
	const escaped = String(className || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
	const reg = new RegExp(`<[^>]+class\\s*=\\s*(["'])[^"']*${escaped}[^"']*\\1[^>]*>([\\s\\S]*?)<\\/[^>]+>`, 'i')
	const match = String(html || '').match(reg)
	return match ? normalizeGameText(match[2]) : ''
}

function normalizeGameText(html) {
	return stripHtml(String(html || '').replace(/\]br\]/ig, '\n')).replace(/\n{3,}/g, '\n\n').trim()
}

function cleanGameActionText(text, actionText) {
	let result = String(text || '').replace(/\s+/g, ' ').trim()
	if (actionText) {
		const escapedAction = String(actionText).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
		result = result.replace(new RegExp('\\s*' + escapedAction + '\\s*$', 'i'), '')
	}
	return result
		.replace(/\s*返回(?:上级|吹牛|首页)\s*/g, ' ')
		.replace(/\s{2,}/g, ' ')
		.trim()
}

function extractGameContentText(html, actionText) {
	const blocks = extractClassBlocks(html, 'content')
		.concat(extractClassBlocks(html, 'tip'))
	const source = blocks.find(block => !/<form\b/i.test(block)) || blocks[0] || html
	let text = normalizeGameText(String(source || '').replace(/<form\b[\s\S]*?<\/form>/ig, ''))
	text = text.replace(/^(?:应战|提示信息|吹牛应战)\s*/, '')
	return cleanGameActionText(text, actionText)
}

function extractInfoRows(html) {
	const rows = []
	const reg = /<div\b[^>]*class\s*=\s*(["'])[^"']*info-row[^"']*\1[^>]*>([\s\S]*?)<\/div>/ig
	let match
	while ((match = reg.exec(String(html || '')))) {
		const labelMatch = match[2].match(/<span\b[^>]*class\s*=\s*(["'])[^"']*info-label[^"']*\1[^>]*>([\s\S]*?)<\/span>/i)
		const valueMatch = match[2].match(/<span\b[^>]*class\s*=\s*(["'])[^"']*info-value[^"']*\1[^>]*>([\s\S]*?)<\/span>/i)
		const link = (parseLinks(match[2]).find(item => item.href) || {})
		rows.push({
			label: labelMatch ? normalizeGameText(labelMatch[2]).replace(/[:：]\s*$/, '') : '',
			value: valueMatch ? normalizeGameText(valueMatch[2]) : normalizeGameText(match[2]),
			url: link.href ? absoluteYaohuoUrl(link.href) : ''
		})
	}
	return rows
}

function getInfoValue(rows, label) {
	const item = (rows || []).find(row => String(row.label || '').indexOf(label) > -1)
	return item ? item.value : ''
}

function getInfoUrl(rows, label) {
	const item = (rows || []).find(row => String(row.label || '').indexOf(label) > -1)
	return item ? item.url : ''
}

export function parseFriends(html) {
	const blocks = extractClassBlocks(html, 'modern-list-item')
	const friends = []
	const seen = {}
	blocks.forEach(block => {
		if (!/friendlist-item-title|userinfo\.aspx/i.test(block)) {
			return
		}
		const link = (parseLinks(block).find(item => /userinfo\.aspx/i.test(item.href)) || {})
		const idMatch = String(link.href || link.text || '').match(/touserid=(\d+)|\((\d+)\)/i)
		const id = idMatch ? (idMatch[1] || idMatch[2]) : ''
		const name = stripHtml(String(link.text || '').replace(/\(\d+\)/, '')).trim()
		if (!id || seen[id]) {
			return
		}
		seen[id] = true
		const remarkMatch = block.match(/<span\b[^>]*class\s*=\s*(["'])[^"']*friendlist-item-remark[^"']*\1[^>]*>([\s\S]*?)<\/span>/i)
		const dateMatch = block.match(/<div\b[^>]*class\s*=\s*(["'])[^"']*friendlist-item-date[^"']*\1[^>]*>([\s\S]*?)<\/div>/i)
		friends.push({
			id,
			name: name || `ID ${id}`,
			remark: remarkMatch ? stripHtml(remarkMatch[2]).replace(/^备注[:：]?\s*/, '').trim() : '',
			date: dateMatch ? stripHtml(dateMatch[2]).trim() : '',
			url: absoluteYaohuoUrl(link.href)
		})
	})
	return friends
}

export function parseUserProfile(html, requestUrl) {
	const source = String(html || '')
	const text = normalizeUserText(source)
	const links = parseLinks(source).map(link => Object.assign({}, link, {
		url: resolveYaohuoUrl(link.href, requestUrl)
	}))
	const id = getQueryValue(requestUrl, 'touserid') || extractUserProfileId(source, text)
	const title = parseTitle(source, id ? `ID ${id}` : '用户空间')
	const name = extractUserProfileName(source, text, id, title)
	const stats = extractUserStats(source, links)
	const actions = {
		messageUrl: getLinkUrl(links, /messagelist_add\.aspx/i),
		addFriendUrl: getLinkUrl(links, /FriendList\.aspx/i, url => getQueryValue(url, 'friendtype') !== '1'),
		blacklistUrl: getLinkUrl(links, /FriendList\.aspx/i, url => getQueryValue(url, 'friendtype') === '1'),
		postsUrl: getLinkUrl(links, /book_list_search\.aspx/i),
		repliesUrl: getLinkUrl(links, /book_re_my\.aspx/i),
		moreUrl: getLinkUrl(links, /userinfomore\.aspx/i),
		logUrl: getLinkUrl(links, /book_list_log\.aspx/i),
		guestbookUrl: getLinkUrl(links, /userguessbook\.aspx/i)
	}
	return {
		id,
		name,
		title,
		initial: name ? name.slice(0, 1) : (id ? id.slice(0, 1) : 'U'),
		avatar: extractUserProfileAvatar(source),
		gender: extractFirstMatch(text, /(男|女)(?:\s+\d+岁)?(?:\s+(?:在线|离线))?/),
		age: extractFirstMatch(text, /(?:男|女)\s+(\d+岁)/),
		status: extractFirstMatch(text, /(在线|离线)/),
		signature: extractUserSignature(source, text, links),
		stats,
		medals: extractUserMedals(source),
		activities: parseUserActivities(source, links).slice(0, 3),
		guestbook: parseUserGuestbook(source, links, requestUrl).slice(0, 3),
		actions,
		popularity: extractUserPopularity(text),
		rawText: text
	}
}

export function parseUserMore(html) {
	const text = normalizeUserText(html)
	const rows = []
	const reg = /【([^】]+)】\s*([^【>\n\r]*)/g
	let match
	while ((match = reg.exec(text))) {
		const label = String(match[1] || '').trim()
		const value = String(match[2] || '').replace(/^[:：\s]+/, '').trim()
		if (label && value !== '') {
			rows.push({
				label,
				value
			})
		}
	}
	if (!rows.length) {
		text.split(/\s*>?\s*/).forEach(line => {
			const pair = line.match(/^([^:：]{2,12})[:：]\s*(.+)$/)
			if (pair) {
				rows.push({
					label: pair[1].trim(),
					value: pair[2].trim()
				})
			}
		})
	}
	return {
		title: parseTitle(html, '个人资料'),
		rows
	}
}

export function parseUserLogs(html, requestUrl, currentPage) {
	requestUrl = requestUrl || ''
	currentPage = Number(currentPage || getUrlPage(requestUrl) || 1)
	const modernLogs = []
	const seenModern = {}
	extractClassBlocks(html, 'line').forEach(block => {
		if (!/\bline[12]\b/i.test(block)) {
			return
		}
		const text = stripHtml(block).replace(/\s+/g, ' ').trim()
		const match = text.match(/^(\d+\s*(?:秒|分钟|小时|天|月|年)前|刚刚|昨天|前天)\s*(.+)$/)
		if (!match) {
			return
		}
		const link = (parseLinks(block).find(item => item.href && !/javascript:/i.test(item.href)) || {})
		const key = match[1] + match[2] + (link.href || '')
		if (seenModern[key]) {
			return
		}
		seenModern[key] = true
		modernLogs.push({
			time: match[1].replace(/\s+/g, ''),
			content: match[2].trim(),
			url: link.href ? resolveYaohuoUrl(link.href, requestUrl) : ''
		})
	})
	if (modernLogs.length) {
		return {
			title: parseTitle(html, '最近动态'),
			logs: modernLogs,
			page: currentPage,
			totalPage: parseTotalPage(html, 15) || currentPage,
			nextPageUrl: extractNextPageUrl(html, requestUrl, currentPage, /\/bbs\/book_list_log\.aspx/i)
		}
	}
	const text = normalizeUserText(html)
	const logs = []
	const seen = {}
	let body = text
		.replace(/^.*?(?:好友动态\s+)?他的动态\s*/, '')
		.replace(/\s*(?:下一页|上一页|第\s*\d+\s*\/\s*\d+\s*页).*$/i, '')
	const reg = /(\d+\s*(?:秒|分钟|小时|天|月|年)前|刚刚|昨天|前天)\s*([^]+?)(?=(?:\d+\s*(?:秒|分钟|小时|天|月|年)前|刚刚|昨天|前天)|$)/g
	let match
	while ((match = reg.exec(body))) {
		const time = match[1].replace(/\s+/g, '')
		const content = String(match[2] || '').trim()
		const key = time + content
		if (content && !seen[key]) {
			seen[key] = true
			logs.push({
				time,
				content,
				url: ''
			})
		}
	}
	if (!logs.length) {
		body.split(/\n+/).map(item => item.trim()).filter(Boolean).forEach(line => {
			const item = line.match(/^(\S+前|刚刚|昨天|前天)\s*(.+)$/)
			if (item) {
				logs.push({
					time: item[1],
					content: item[2],
					url: ''
				})
			}
		})
	}
	return {
		title: parseTitle(html, '最近动态'),
		logs,
		page: currentPage,
		totalPage: parseTotalPage(html, 15) || currentPage,
		nextPageUrl: extractNextPageUrl(html, requestUrl, currentPage, /\/bbs\/book_list_log\.aspx/i)
	}
}

export function parseUserGuestbook(html, links, requestUrl) {
	links = links || parseLinks(html)
	const source = String(html || '')
	const modernBlocks = extractClassBlocks(source, 'uinfo-gb-item')
	if (modernBlocks.length) {
		return modernBlocks.map((block, index) => {
			const openTag = (block.match(/^<[^>]+>/) || [])[0] || ''
			const userLink = (parseLinks(block).find(link => /userinfo\.aspx/i.test(link.href)) || {})
			const id = getQueryValue(userLink.href || '', 'touserid')
			const contentBlock = extractClassBlock(block, 'uinfo-gb-content') || block
			const contentHtml = formatGuestbookContentHtml(contentBlock, requestUrl)
			return {
				floor: String(index + 1),
				name: String(userLink.text || extractClassText(block, 'uinfo-gb-author') || (id ? `ID ${id}` : '')).trim(),
				id,
				time: extractClassText(block, 'gb-time') || getAttr(openTag, 'data-detail-time'),
				content: stripHtml(contentHtml || contentBlock).replace(/\s+/g, ' ').trim(),
				contentHtml
			}
		}).filter(item => item.name || item.content)
	}
	const blockItems = parseUserGuestbookBlocks(source, links, requestUrl)
	if (blockItems.length) {
		return blockItems
	}
	const text = normalizeUserText(source)
	const items = []
	const seen = {}
	const reg = /\[(\d+)楼\]\s*([^\n\r>]+?)\s+((?:\d{2,4}[-/])?\d{1,2}[-/]\d{1,2}\s+\d{1,2}:\d{2}|(?:\d{1,2}-\d{1,2}|昨天|前天|今天)\s*\d{0,2}:?\d{0,2}|(?:\d+天前|\d+小时前))\s*>?\s*([\s\S]*?)(?=\s*\[\d+楼\]|\s*(?:加载更多|下一页|上一页|第\s*\d+\s*\/\s*\d+\s*页|返回上级|我的地盘)|$)/g
	let match
	while ((match = reg.exec(text))) {
		const floor = match[1]
		const name = String(match[2] || '').trim()
		const time = String(match[3] || '').trim()
		const content = String(match[4] || '').replace(/^>+/, '').trim()
		const contentHtml = escapeHtml(content).replace(/\n/g, '<br>')
		const userLink = (links || []).find(link => link.text === name || String(link.text || '').indexOf(name) > -1) || {}
		const id = getQueryValue(userLink.href || '', 'touserid')
		const key = floor + name + time
		if (!seen[key]) {
			seen[key] = true
			items.push({
				floor,
				name,
				id,
				time,
				content,
				contentHtml
			})
		}
	}
	return items
}

export function parseGuestbookPage(html, requestUrl, currentPage) {
	requestUrl = requestUrl || ''
	currentPage = Number(currentPage || getUrlPage(requestUrl) || 1)
	const totalPage = parseTotalPage(html, 15) || currentPage
	return {
		title: parseTitle(html, '留言板'),
		tip: extractTipText(html),
		items: parseUserGuestbook(html, null, requestUrl),
		sortUrls: extractGuestbookSortUrls(html, requestUrl),
		page: currentPage,
		totalPage,
		nextPageUrl: currentPage < totalPage ? extractNextPageUrl(html, requestUrl, currentPage, /\/bbs\/userguessbook\.aspx/i) : ''
	}
}

function extractGuestbookSortUrls(html, requestUrl) {
	const urls = {
		'0': '',
		'1': ''
	}
	parseLinks(html).forEach(link => {
		const url = resolveYaohuoUrl(link.href, requestUrl)
		if (!/\/bbs\/userguessbook\.aspx/i.test(url)) {
			return
		}
		const ot = getQueryValue(url, 'ot')
		const pageMatch = String(url || '').match(/[?&]page=(\d{1,6})/i)
		const page = pageMatch ? Number(pageMatch[1]) : 1
		if ((ot === '0' || ot === '1') && page === 1) {
			urls[ot] = url
		}
	})
	return urls
}

function parseUserGuestbookBlocks(html, links, requestUrl) {
	const items = []
	const seen = {}
	const blocks = extractClassBlocks(html, 'line')
	blocks.forEach(block => {
		if (!/\bline[12]\b/i.test(block) || !/userinfo\.aspx/i.test(block)) {
			return
		}
		const floorMatch = block.match(/\[(\d+)楼\]/)
		const retextBlock = extractClassBlock(block, 'retext') || block
		const userLink = (parseLinks(retextBlock).find(link => /userinfo\.aspx/i.test(link.href)) || {})
		const time = extractClassText(retextBlock, 'right')
		const id = getQueryValue(userLink.href || '', 'touserid')
		let contentBlock = retextBlock
			.replace(/^\s*<span\b[^>]*class\s*=\s*(["'])[^"']*retext[^"']*\1[^>]*>/i, '')
			.replace(/<\/span>\s*$/i, '')
			.replace(/<a\b[\s\S]*?<\/a>/i, '')
			.replace(/<span\b[^>]*class\s*=\s*(["'])[^"']*right[^"']*\1[^>]*>[\s\S]*?<\/span>/i, '')
			.replace(/^(\s*<br\s*\/?>)+/i, '')
		const contentHtml = formatGuestbookContentHtml(contentBlock, requestUrl)
		const content = stripHtml(contentHtml || contentBlock).replace(/\s+/g, ' ').trim()
		const floor = floorMatch ? floorMatch[1] : ''
		const name = String(userLink.text || (id ? `ID ${id}` : '')).trim()
		const key = `${floor}|${id}|${name}|${time}`
		if ((name || content) && !seen[key]) {
			seen[key] = true
			items.push({
				floor,
				name,
				id,
				time,
				content,
				contentHtml
			})
		}
	})
	if (items.length) {
		return items
	}
	return []
}

function formatGuestbookContentHtml(html, requestUrl) {
	let content = String(html || '')
		.replace(/<script[\s\S]*?<\/script>/ig, '')
		.replace(/<style[\s\S]*?<\/style>/ig, '')
		.replace(/^<[^>]+class\s*=\s*(["'])[^"']*uinfo-gb-content[^"']*\1[^>]*>/i, '')
		.replace(/<\/div>\s*$/i, '')
	content = content.replace(/\s(src|href)=([\"'])([^\"']+)\2/ig, (all, attr, quote, value) => {
		const url = resolveYaohuoUrl(value, requestUrl)
		return url ? ` ${attr}=${quote}${escapeHtml(url)}${quote}` : ''
	})
	content = content.replace(/<img\b([^>]*)>/ig, (all, attrs) => {
		const src = getAttr(all, 'src') || getAttr(all, 'data-src')
		const url = resolveYaohuoUrl(src, requestUrl)
		if (!url) {
			return ''
		}
		const alt = getAttr(all, 'alt') || ''
		return `<img src="${escapeHtml(url)}" alt="${escapeHtml(alt)}" class="ubbimg" referrerpolicy="no-referrer">`
	})
	return content.trim()
}

export function extractMessageForm(html, requestUrl) {
	const form = firstForm(html, item => /messagelist_add\.aspx|touseridlist|发送信息|发送消息/i.test(item))
	return {
		title: parseTitle(html, '发私信'),
		action: extractFormAction(form, requestUrl) || 'https://yaohuo.me/bbs/messagelist_add.aspx',
		fields: extractFormFields(form),
		tip: extractTipText(html)
	}
}

function normalizeUserText(html) {
	return stripHtml(String(html || '')
		.replace(/<br\s*\/?>/gi, '\n'))
		.replace(/\r/g, '')
		.replace(/[ \t]+\n/g, '\n')
		.replace(/\n{2,}/g, '\n')
		.replace(/[ \t]{2,}/g, ' ')
		.trim()
}

function extractFirstMatch(text, pattern) {
	const match = String(text || '').match(pattern)
	return match ? (match[1] || match[0] || '').trim() : ''
}

function extractClassBlock(html, classNamePart) {
	const blocks = extractClassBlocks(html, classNamePart)
	return blocks.length ? blocks[0] : ''
}

function extractClassText(html, classNamePart) {
	return stripHtml(extractClassBlock(html, classNamePart)).replace(/\s+/g, ' ').trim()
}

function getLinkUrl(links, pattern, predicate) {
	const item = (links || []).find(link => {
		const url = link.url || resolveYaohuoUrl(link.href)
		return pattern.test(url) && (!predicate || predicate(url, link))
	})
	return item ? (item.url || resolveYaohuoUrl(item.href)) : ''
}

function extractUserProfileId(html, text) {
	const match = String(html || '').match(/userinfo\.aspx\?[^"']*touserid=(\d+)/i) ||
		String(text || '').match(/\bID\s*[:：]\s*(\d+)/i)
	return match ? match[1] : ''
}

function extractUserProfileName(html, text, id, title) {
	if (id) {
		const reg = new RegExp(`<a\\b[^>]*href\\s*=\\s*(["'])[^"']*userinfo\\.aspx\\?[^"']*touserid=${id}[^"']*\\1[^>]*>([\\s\\S]*?)<\\/a>`, 'i')
		const match = String(html || '').match(reg)
		const name = match ? stripHtml(match[2]) : ''
		if (name && !/^\d+$/.test(name)) {
			return name
		}
	}
	const titleName = String(title || '').replace(/的空间.*/, '').trim()
	if (titleName && !/^(我的空间|空间|用户)$/.test(titleName)) {
		return titleName
	}
	const idIndex = String(text || '').indexOf('ID: ' + id)
	if (idIndex > 0) {
		const before = String(text).slice(Math.max(0, idIndex - 80), idIndex)
		const parts = before.split(/\s+/).filter(Boolean)
		const candidate = parts[parts.length - 1]
		if (candidate && !/^(私信|男|女|在线|离线)$/.test(candidate)) {
			return candidate
		}
	}
	return id ? `ID ${id}` : ''
}

function extractUserProfileAvatar(html) {
	const images = []
	const reg = /<img\b[^>]*>/ig
	let match
	while ((match = reg.exec(String(html || '')))) {
		const tag = match[0]
		const src = getAttr(tag, 'src') || getAttr(tag, 'data-src')
		if (!src || /face\/|medal|new\.gif|on[01]\.gif|favicon|logo/i.test(src + tag)) {
			continue
		}
		const context = String(html || '').slice(Math.max(0, match.index - 200), match.index + 200)
		let score = 0
		if (/avatar|head|portrait|photo|user|uinfo|澶村儚|头像/i.test(tag + context + src)) {
			score += 5
		}
		if (/album\/upload|\/upload\//i.test(src)) {
			score += 2
		}
		images.push({
			src: resolveYaohuoUrl(src),
			score
		})
	}
	images.sort((a, b) => b.score - a.score)
	return images.length && images[0].score >= 2 ? images[0].src : ''
}

function extractUserSignature(html, text, links) {
	let result = String(text || '')
	const labels = ['帖子', '回复', '妖晶', '等级', '注册时长']
	const actionLabels = ['私信', '加为好友', '加黑名单']
	const startIndexes = actionLabels.map(label => result.indexOf(label)).filter(index => index > -1)
	const endIndexes = labels.map(label => result.indexOf(label)).filter(index => index > -1)
	if (startIndexes.length && endIndexes.length) {
		const start = Math.max.apply(null, startIndexes) + '加黑名单'.length
		const end = Math.min.apply(null, endIndexes.filter(index => index > start))
		const candidate = result.slice(start, end).replace(/\d{4}\/\d{1,2}\/\d{1,2}[^帖回复妖晶等级注册]*/, '').trim()
		if (candidate && candidate.length < 80) {
			return candidate
		}
	}
	return ''
}

function extractUserStats(html, links) {
	const stats = []
	const seen = {}
	const add = (label, value, url, icon) => {
		label = String(label || '').trim()
		value = String(value || '').trim()
		if (!label || seen[label] || (!value && !url)) {
			return
		}
		seen[label] = true
		stats.push({
			label,
			value,
			url,
			icon
		})
	}
	const statBlocks = extractClassBlocks(html, 'uinfo-stat')
	statBlocks.forEach(block => {
		const label = extractClassText(block, 'label')
		const value = extractClassText(block, 'value')
		const link = (parseLinks(block).find(item => item.href) || {})
		const url = link.href ? resolveYaohuoUrl(link.href) : ''
		const iconMap = {
			'帖子': 'compose',
			'回复': 'chatboxes',
			'妖晶': 'wallet',
			'等级': 'medal',
			'注册时长': 'calendar'
		}
		if (iconMap[label]) {
			add(label, value, url, iconMap[label])
		}
	})
	const statLinks = (links || []).filter(link => /uinfo-stat|book_list_search|book_re_my/i.test(link.tag || link.href || ''))
	statLinks.forEach(link => {
		const text = String(link.text || '').replace(/\s+/g, ' ')
		const item = text.match(/^(帖子|回复)\s*([^\s]+)?/)
		if (item) {
			add(item[1], item[2] || '', link.url || resolveYaohuoUrl(link.href), item[1] === '帖子' ? 'compose' : 'chatboxes')
		}
	})
	const text = normalizeUserText(html)
	add('妖晶', extractFirstMatch(text, /([+-]?\d+(?:\.\d+)?万?)\s*妖晶/), '', 'wallet')
	add('等级', extractFirstMatch(text, /(\d+级)\s*等级/), '', 'medal')
	add('注册时长', extractFirstMatch(text, /((?:\d+年)?(?:\d+个月)?(?:\d+天)?(?:\d+小时)?(?:\d+分)?|[^\s帖回复妖晶等级]+)\s*注册时长/), '', 'calendar')
	return stats
}

function extractUserMedals(html) {
	const medals = []
	const seen = {}
	const blocks = extractClassBlocks(html, 'uinfo-medal')
		.concat(extractClassBlocks(html, 'medal'))
		.concat(extractClassBlocks(html, '勋章'))
	const source = blocks.length ? blocks.join('\n') : String(html || '')
	const imgReg = /<img\b[^>]*>/ig
	let img
	while ((img = imgReg.exec(source))) {
		const src = getAttr(img[0], 'src') || getAttr(img[0], 'data-src')
		if (!src || /face\/|avatar|head|on[01]\.gif|new\.gif|favicon|logo/i.test(src + img[0])) {
			continue
		}
		const url = resolveYaohuoUrl(src)
		if (!seen[url]) {
			seen[url] = true
			medals.push(url)
		}
	}
	if (medals.length) {
		return medals.slice(0, 12)
	}
	const text = normalizeUserText(html)
	const medalText = text.match(/勋章墙\s*([\s\S]*?)(?:新动态|人气值|留言板|返回上级|$)/)
	return medalText ? medalText[1].split(/\s+/).filter(Boolean).slice(0, 8).map(name => ({
		name
	})) : []
}

function parseUserActivities(html, links) {
	const modernBlocks = extractClassBlocks(html, 'uinfo-dyn-item')
	const modernItems = []
	modernBlocks.forEach(block => {
		const contentBlock = extractClassBlock(block, 'uinfo-dyn-content') || block
		const link = (parseLinks(contentBlock).find(item => item.href) || {})
		const content = stripHtml(contentBlock).replace(/\s+/g, ' ').trim()
		const time = extractClassText(block, 'uinfo-dyn-meta')
		if (content || time) {
			modernItems.push({
				content,
				time,
				url: link.href ? resolveYaohuoUrl(link.href) : ''
			})
		}
	})
	if (modernItems.length) {
		return modernItems
	}
	const text = normalizeUserText(html)
	const section = (text.match(/新动态\s*([\s\S]*?)(?:查看更多动态|人气值|留言板|返回上级|$)/) || [])[1] || ''
	if (!section) {
		return []
	}
	const result = []
	const reg = /(.+?)\s+(\d+\s*(?:秒|分钟|小时|天|月|年)前|刚刚|昨天|前天)(?=\s+.+?\s+(?:\d+\s*(?:秒|分钟|小时|天|月|年)前|刚刚|昨天|前天)|$)/g
	let match
	while ((match = reg.exec(section))) {
		result.push({
			content: String(match[1] || '').trim(),
			time: String(match[2] || '').trim(),
			url: ''
		})
	}
	if (!result.length) {
		section.split(/\n+/).map(item => item.trim()).filter(Boolean).forEach(line => {
			const m = line.match(/^(.+?)\s+(\d+\s*(?:秒|分钟|小时|天|月|年)前|刚刚|昨天|前天)$/)
			result.push({
				content: m ? m[1] : line,
				time: m ? m[2] : '',
				url: ''
			})
		})
	}
	return result
}

function extractUserPopularity(text) {
	const source = String(text || '')
	return [{
		label: '空间人气',
		value: extractFirstMatch(source, /人气值\s*([0-9,.万]+)/) || extractFirstMatch(source, /([0-9,.万]+)\s*空间人气/)
	}, {
		label: '今日人气',
		value: extractFirstMatch(source, /空间人气\s*([0-9,.万]+)\s*今日人气/) || extractFirstMatch(source, /([0-9,.万]+)\s*今日人气/)
	}].filter(item => item.value)
}

export function parseMyReplies(html) {
	const blocks = extractClassBlocks(html, 'reply-item')
	const replies = []
	const seen = {}
	blocks.forEach(block => {
		const userLink = (parseLinks(block).find(item => /userinfo\.aspx/i.test(item.href)) || {})
		const viewLink = (parseLinks(block).find(item => /bbs-\d+\.html/i.test(item.href)) || {})
		const postIdMatch = String(viewLink.href || '').match(/bbs-(\d+)\.html/i)
		const floorMatch = block.match(/<span\b[^>]*class\s*=\s*(["'])[^"']*reply-index[^"']*\1[^>]*>([\s\S]*?)<\/span>/i)
		const contentMatch = block.match(/<div\b[^>]*class\s*=\s*(["'])[^"']*reply-content[^"']*\1[^>]*>([\s\S]*?)<\/div>/i)
		const dateMatch = block.match(/<span\b[^>]*class\s*=\s*(["'])[^"']*reply-date[^"']*\1[^>]*>([\s\S]*?)<\/span>/i)
		const key = `${postIdMatch ? postIdMatch[1] : viewLink.href}|${floorMatch ? stripHtml(floorMatch[2]) : ''}`
		if (!viewLink.href || seen[key]) {
			return
		}
		seen[key] = true
		replies.push({
			author: userLink.text || '',
			floor: floorMatch ? stripHtml(floorMatch[2]).trim() : '',
			content: contentMatch ? stripHtml(contentMatch[2]).replace(/\n{3,}/g, '\n\n').trim() : '',
			date: dateMatch ? stripHtml(dateMatch[2]).trim() : '',
			url: absoluteYaohuoUrl(viewLink.href),
			postId: postIdMatch ? postIdMatch[1] : ''
		})
	})
	return replies
}

export function parseGameHome(html) {
	const links = parseLinks(html)
	const stats = []
	const statReg = /<span\b[^>]*class\s*=\s*(["'])[^"']*stats-label[^"']*\1[^>]*>([\s\S]*?)<\/span>\s*<span\b[^>]*class\s*=\s*(["'])[^"']*stats-value[^"']*\3[^>]*>([\s\S]*?)<\/span>/ig
	let statMatch
	while ((statMatch = statReg.exec(String(html || '')))) {
		stats.push({
			label: stripHtml(statMatch[2]),
			value: stripHtml(statMatch[4])
		})
	}
	const quickLinks = links.filter(link => /book_list\.aspx|monthly\.aspx/i.test(link.href) && link.text).slice(0, 4)
	const challenges = links.filter(link => /\/games\/chuiniu\/doit\.aspx/i.test(link.href) && link.text).map(link => {
		const amountMatch = link.text.match(/（([^）]+)）|\(([^)]+)\)/)
		return {
			title: link.text.replace(/^\d+\s*/, '').replace(/（[^）]+）|\([^)]+\)/g, '').trim(),
			amount: amountMatch ? (amountMatch[1] || amountMatch[2]) : '',
			url: absoluteYaohuoUrl(link.href)
		}
	}).slice(0, 10)
	const chatBlocks = extractClassBlocks(html, 'chat-item')
	const chats = chatBlocks.map(block => {
		const user = (parseLinks(block).find(link => /userinfo\.aspx/i.test(link.href)) || {})
		const textMatch = block.match(/<span\b[^>]*class\s*=\s*(["'])[^"']*chat-text[^"']*\1[^>]*>([\s\S]*?)<\/span>/i)
		const timeMatch = block.match(/<span\b[^>]*class\s*=\s*(["'])[^"']*chat-time[^"']*\1[^>]*>([\s\S]*?)<\/span>/i)
		return {
			user: user.text || '',
			text: textMatch ? stripHtml(textMatch[2]) : '',
			time: timeMatch ? stripHtml(timeMatch[2]) : '',
			userUrl: user.href ? absoluteYaohuoUrl(user.href) : ''
		}
	}).filter(item => item.user || item.text).slice(0, 10)
	return {
		stats,
		quickLinks,
		challenges,
		chats,
		title: parseTitle(html, '疯狂吹牛')
	}
}

export function parseGameChat(html, requestUrl, currentPage) {
	requestUrl = requestUrl || 'https://yaohuo.me/games/chat/book_re.aspx?nid=chuiniu'
	currentPage = Number(currentPage || getUrlPage(requestUrl) || 1)
	const blocks = extractClassBlocks(html, 'line')
	const chats = []
	const seen = {}
	blocks.forEach(block => {
		const userLink = (parseLinks(block).find(link => /userinfo\.aspx/i.test(link.href)) || {})
		if (!userLink.href) {
			return
		}
		const time = extractTextByClass(block, 'right')
		const userId = getQueryValue(userLink.href, 'touserid')
		const chatId = getQueryValue(userLink.href, 'id')
		let content = block
			.replace(/<a\b[\s\S]*?<\/a>/i, '')
			.replace(/<span\b[^>]*class\s*=\s*(["'])[^"']*right[^"']*\1[^>]*>[\s\S]*?<\/span>/i, '')
		content = normalizeGameText(content)
		const key = chatId || `${userId}|${time}|${content}`
		if (!content || seen[key]) {
			return
		}
		seen[key] = true
		chats.push({
			id: chatId,
			userId,
			user: userLink.text || (userId ? `ID ${userId}` : ''),
			userUrl: userLink.href ? absoluteYaohuoUrl(userLink.href) : '',
			time,
			text: content
		})
	})
	const totalPage = parseTotalPage(html, 20) || currentPage
	const nextPageUrl = extractNextPageUrl(html, requestUrl, currentPage, /\/games\/chat\/book_re\.aspx/i)
	return {
		chats,
		page: currentPage,
		totalPage,
		nextPageUrl,
		tip: extractTipText(html),
		title: parseTitle(html, '游戏聊天')
	}
}

export function parseGameChallenge(html, requestUrl) {
	requestUrl = requestUrl || ''
	const title = parseTitle(html, '吹牛应战')
	const tip = extractTipText(html)
	const result = parseGameResult(html, requestUrl)
	if (result.state === 'result') {
		return result
	}
	const failure = parseGameChallengeFailure(html, requestUrl, title)
	if (failure.state === 'tip') {
		return failure
	}
	const passwordForm = firstForm(html, form => /needpassword/i.test(form))
	if (passwordForm) {
		return {
			state: 'password',
			title,
			id: getQueryValue(requestUrl, 'id'),
			action: extractFormAction(passwordForm, requestUrl) || requestUrl,
			fields: extractFormFields(passwordForm),
			tip: tip || '此操作需验证密码'
		}
	}
	const answerForm = firstForm(html, form => /answer-form|name\s*=\s*(["'])myanswer\1/i.test(form))
	if (answerForm) {
		const rows = extractInfoRows(html)
		const answers = []
		const labelReg = /<label\b[^>]*class\s*=\s*(["'])[^"']*answer-choice[^"']*\1[^>]*>([\s\S]*?)<\/label>/ig
		let labelMatch
		while ((labelMatch = labelReg.exec(String(html || '')))) {
			const input = labelMatch[2].match(/<input\b[^>]*name\s*=\s*(["'])myanswer\1[^>]*>/i)
			const value = input ? getAttr(input[0], 'value') : ''
			answers.push({
				value,
				title: extractTextByClass(labelMatch[2], 'answer-title') || `答案${value}`,
				text: extractTextByClass(labelMatch[2], 'answer-text')
			})
		}
		const fields = extractFormFields(answerForm)
		return {
			state: 'answer',
			title,
			id: fields.id || getQueryValue(requestUrl, 'id'),
			action: extractFormAction(answerForm, requestUrl) || 'https://yaohuo.me/games/chuiniu/doit.aspx',
			fields,
			author: getInfoValue(rows, '发起挑战'),
			authorUrl: getInfoUrl(rows, '发起挑战'),
			amount: getInfoValue(rows, '赌注金额'),
			question: extractTextByClass(html, 'question-text'),
			answers,
			note: extractTextByClass(html, 'note-text'),
			tip
		}
	}
	const plainResult = parseGamePlainChallengeResult(html, requestUrl, title)
	if (plainResult.state === 'result') {
		return plainResult
	}
	const resultLink = (parseLinks(html).find(link => /\/games\/chuiniu\/book_view\.aspx/i.test(link.href)) || {})
	const cleanTip = cleanGameActionText(tip || extractGameContentText(html, resultLink.text), resultLink.text)
	return {
		state: 'tip',
		title,
		id: getQueryValue(requestUrl, 'id'),
		tip: cleanTip,
		resultUrl: resultLink.href ? absoluteYaohuoUrl(resultLink.href) : '',
		resultText: resultLink.text || '查看结果'
	}
}

function parseGameChallengeFailure(html, requestUrl, title) {
	const text = extractGameContentText(html)
	if (!/(妖晶不足|余额不足|余额不够|钱不够)/.test(text)) {
		return {
			state: ''
		}
	}
	const resultLink = (parseLinks(html).find(link => /\/games\/chuiniu\/book_view\.aspx/i.test(link.href)) || {})
	return {
		state: 'tip',
		title: title || '应战失败',
		id: getQueryValue(requestUrl, 'id'),
		tip: extractGameInsufficientBalanceTip(text),
		resultUrl: resultLink.href ? absoluteYaohuoUrl(resultLink.href) : '',
		resultText: resultLink.text || '查看结果',
		isFailure: true
	}
}

function extractGameInsufficientBalanceTip(text) {
	let clean = cleanGameActionText(text)
	const insufficientMatch = clean.match(/妖晶不足|余额不足|余额不够|钱不够/)
	if (!insufficientMatch) {
		return clean
	}
	const insufficientIndex = insufficientMatch.index || 0
	const sorryIndex = clean.lastIndexOf('抱歉', insufficientIndex)
	const start = sorryIndex > -1 ? sorryIndex : insufficientIndex
	let end = clean.length
	const rest = clean.slice(start)
	const balanceMatch = rest.match(/余额[:：]?\s*\d+\s*(?:个)?\s*妖晶/)
	if (balanceMatch) {
		end = start + (balanceMatch.index || 0) + balanceMatch[0].length
	} else {
		const labels = ['发起挑战', '赌注金额', '问题', '答案一', '答案二', '说明', '返回上级', '返回首页']
		labels.forEach(label => {
			const index = clean.indexOf(label, insufficientIndex + insufficientMatch[0].length)
			if (index > -1 && index < end) {
				end = index
			}
		})
	}
	const message = clean.slice(start, end).trim()
	return message || clean
}

function parseGamePlainChallengeResult(html, requestUrl, title) {
	const text = extractGameContentText(html)
	if (!/(您的选择|对方设置|正确答案|很遗憾|您输了|您赢了|获得了|输光)/.test(text)) {
		return {
			state: ''
		}
	}
	const author = extractBetween(text, '发起挑战', '赌注金额')
	const amount = extractBetween(text, '赌注金额', '问题')
	const question = extractBetween(text, '问题', '对方设置') || extractBetween(text, '问题', '正确答案') ||
		extractBetween(text, '问题', '您的选择')
	const correct = extractBracketValue(text, '对方设置') || extractBracketValue(text, '正确答案')
	const selected = extractBracketValue(text, '您的选择')
	let result = (text.match(/(很遗憾，?您输了\s*\d+\s*个?妖晶|您输了\s*\d+\s*个?妖晶|恭喜[^，。！!]*[，,]?\s*您赢了\s*\d+\s*个?妖晶|您赢了\s*\d+\s*个?妖晶|获得了\s*\d+\s*个?妖晶)/) || [])[1] || ''
	if (!result) {
		result = deriveGameChallengeResult(correct, selected, amount)
	}
	const statuses = []
	if (correct) {
		statuses.push({
			label: '对方设置',
			value: correct,
			url: ''
		})
	}
	if (selected) {
		statuses.push({
			label: '您的选择',
			value: selected,
			url: ''
		})
	}
	if (result) {
		statuses.push({
			label: '结果',
			value: result,
			url: ''
		})
	}
	return {
		state: 'result',
		title: title || '应战结果',
		id: getQueryValue(requestUrl, 'id'),
		author,
		authorUrl: '',
		amount,
		question,
		answers: [],
		statuses,
		times: [],
		tip: cleanGameActionText(text)
	}
}

function deriveGameChallengeResult(correct, selected, amountText) {
	if (!correct || !selected) {
		return ''
	}
	const isWin = normalizeGameAnswerLabel(correct) === normalizeGameAnswerLabel(selected)
	const amount = Number(String(amountText || '').replace(/[^\d]/g, ''))
	if (!amount) {
		return isWin ? '猜对了' : '猜错了'
	}
	if (isWin) {
		return `猜对了，赢得 ${Math.floor(amount * 0.9)} 妖晶`
	}
	return `猜错了，输了 ${amount} 妖晶`
}

function normalizeGameAnswerLabel(value) {
	return String(value || '')
		.replace(/\s+/g, '')
		.replace(/答案一/g, '答案1')
		.replace(/答案二/g, '答案2')
		.replace(/第一/g, '答案1')
		.replace(/第二/g, '答案2')
		.replace(/[【】\[\]：:]/g, '')
}

function extractBetween(text, startLabel, endLabel) {
	const start = String(text || '').indexOf(startLabel)
	if (start < 0) {
		return ''
	}
	const from = start + startLabel.length
	const end = String(text || '').indexOf(endLabel, from)
	const raw = end > -1 ? String(text).slice(from, end) : String(text).slice(from)
	return raw.replace(/^[:：]\s*/, '').trim()
}

function extractBracketValue(text, label) {
	const start = String(text || '').indexOf(label)
	if (start < 0) {
		return ''
	}
	const segment = String(text).slice(start + label.length, start + label.length + 24)
	const bracket = segment.match(/[【\[]\s*([^】\]]+)\s*[】\]]/)
	if (bracket) {
		return bracket[1].trim()
	}
	const plain = segment.match(/^[:：]?\s*([^\s，,。；;]+)/)
	return plain ? plain[1].trim() : ''
}

export function parseGameResult(html, requestUrl) {
	requestUrl = requestUrl || ''
	const source = String(html || '')
	if (!/detail-card|detail-item|status-block|吹牛详情/i.test(source)) {
		return {
			state: ''
		}
	}
	const rows = []
	const detailReg = /<div\b[^>]*class\s*=\s*(["'])[^"']*detail-item[^"']*\1[^>]*>([\s\S]*?)<\/div>/ig
	let detailMatch
	while ((detailMatch = detailReg.exec(source))) {
		const label = extractTextByClass(detailMatch[2], 'detail-label')
		const value = extractTextByClass(detailMatch[2], 'detail-value')
		const link = (parseLinks(detailMatch[2]).find(item => item.href) || {})
		rows.push({
			label,
			value,
			url: link.href ? absoluteYaohuoUrl(link.href) : ''
		})
	}
	const answers = []
	const answerReg = /<div\b[^>]*class\s*=\s*(["'])[^"']*answer-line[^"']*\1[^>]*>([\s\S]*?)<\/div>/ig
	let answerMatch
	while ((answerMatch = answerReg.exec(source))) {
		answers.push({
			title: extractTextByClass(answerMatch[2], 'answer-index'),
			text: extractTextByClass(answerMatch[2], 'answer-text')
		})
	}
	const statuses = []
	const statusReg = /<div\b[^>]*class\s*=\s*(["'])[^"']*status-line[^"']*\1[^>]*>([\s\S]*?)<\/div>/ig
	let statusMatch
	while ((statusMatch = statusReg.exec(source))) {
		const link = (parseLinks(statusMatch[2]).find(item => item.href) || {})
		statuses.push({
			label: extractTextByClass(statusMatch[2], 'status-label'),
			value: extractTextByClass(statusMatch[2], 'status-value'),
			url: link.href ? absoluteYaohuoUrl(link.href) : ''
		})
	}
	const times = []
	const timeReg = /<div\b[^>]*class\s*=\s*(["'])[^"']*time-line[^"']*\1[^>]*>([\s\S]*?)<\/div>/ig
	let timeMatch
	while ((timeMatch = timeReg.exec(source))) {
		times.push({
			label: extractTextByClass(timeMatch[2], 'time-label').replace(/[:：]\s*$/, ''),
			value: extractTextByClass(timeMatch[2], 'time-value')
		})
	}
	const idMatch = source.match(/吹牛详情（ID:\s*(\d+)\）|吹牛详情\(ID:\s*(\d+)\)/i) || String(requestUrl || '').match(/[?&]id=(\d+)/i)
	return {
		state: 'result',
		title: parseTitle(source, '吹牛详情'),
		id: idMatch ? (idMatch[1] || idMatch[2]) : '',
		author: getInfoValue(rows, '发起者'),
		authorUrl: getInfoUrl(rows, '发起者'),
		amount: getInfoValue(rows, '赌注金额'),
		question: extractTextByClass(source, 'question-text'),
		answers,
		statuses,
		times
	}
}

export function parseGameAdd(html, requestUrl) {
	requestUrl = requestUrl || 'https://yaohuo.me/games/chuiniu/add.aspx'
	const form = firstForm(html, item => /\/games\/chuiniu\/add\.aspx|name\s*=\s*(["'])mymoney\1/i.test(item))
	const fields = extractFormFields(form)
	const moneyInput = form.match(/<input\b[^>]*name\s*=\s*(["'])mymoney\1[^>]*>/i)
	const placeholder = moneyInput ? getAttr(moneyInput[0], 'placeholder') : ''
	const balanceMatch = placeholder.match(/余额\s*([0-9,]+)\s*妖晶/)
	return {
		title: parseTitle(html, '发起挑战'),
		action: extractFormAction(form, requestUrl) || requestUrl,
		fields,
		balance: balanceMatch ? balanceMatch[1] : '',
		minMoney: moneyInput ? getAttr(moneyInput[0], 'min') : '',
		maxMoney: moneyInput ? getAttr(moneyInput[0], 'max') : '',
		note: extractTextByClass(html, 'note-text'),
		tip: extractTipText(html)
	}
}

export function parseGameRecords(html) {
	const text = stripHtml(html).replace(/\s+/g, ' ')
	const summary = {
		winRate: (text.match(/(\d+%)\s*胜率/) || [])[1] || '',
		win: (text.match(/胜利\s*(\d+)\s*局/) || [])[1] || '',
		lose: (text.match(/失败\s*(\d+)\s*局/) || [])[1] || '',
		profit: (text.match(/净收益\s*([+-]?\s*[\d,]+)\s*妖晶/) || [])[1] || ''
	}
	const blocks = extractClassBlocks(html, 'record-item')
	const records = blocks.map(block => {
		const links = parseLinks(block)
		const idLink = links.find(link => /book_view\.aspx/i.test(link.href)) || {}
		const userLink = links.find(link => /userinfo\.aspx/i.test(link.href)) || {}
		const statusText = stripHtml(block).replace(/\s+/g, ' ').trim()
		const amount = (statusText.match(/([+-]?\d[\d,]*)\s*妖晶/) || [])[1] || ''
		return {
			id: idLink.text || '',
			user: userLink.text || '',
			status: statusText.replace(/^编号\s*\d+\s*/, '').trim(),
			amount,
			isWin: /赢了/.test(statusText),
			url: idLink.href ? absoluteYaohuoUrl(idLink.href) : ''
		}
	}).filter(item => item.id || item.status)
	return {
		title: parseTitle(html, '吹牛记录'),
		summary,
		records
	}
}

export function parseGameMonthly(html) {
	const links = parseLinks(html).filter(link => /userinfo\.aspx/i.test(link.href) && link.text)
	const groups = ['赚币榜', '爆赢榜', '爆输榜', '活跃榜']
	const size = Math.max(1, Math.ceil(links.length / groups.length))
	return groups.map((title, index) => ({
		title,
		items: links.slice(index * size, index * size + 10).map((link, itemIndex) => ({
			rank: itemIndex + 1,
			name: link.text,
			url: absoluteYaohuoUrl(link.href)
		}))
	})).filter(group => group.items.length)
}
