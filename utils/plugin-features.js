export const UBB_TOOLS = [{
	label: '链接',
	text: '[url=网址]文字说明[/url]'
}, {
	label: '图片',
	text: '[img]图片链接[/img]'
}, {
	label: '音频',
	text: '[audio=X]音频直链地址[/audio]'
}, {
	label: '视频',
	text: '[movie=100%*100%]视频直链地址|封面图片地址[/movie]'
}, {
	label: '真该死',
	text: '[audio=X]https://file.uhsea.com/2304/3deb45e90564252bf281f47c7b47a153KJ.mp3[/audio]'
}, {
	label: '半角',
	text: '[text]全角转半角：代码内容[/text]'
}, {
	label: '换行',
	text: '///'
}, {
	label: '加粗',
	text: '[b]加粗文字[/b]'
}, {
	label: '斜体',
	text: '[i]斜体文字[/i]'
}, {
	label: '颜色',
	text: '[forecolor=red]颜色文字，默认红[/forecolor]'
}, {
	label: '下划',
	text: '[u]下划线文字[/u]'
}, {
	label: '删除',
	text: '[strike]删除线文字[/strike]'
}, {
	label: '分割',
	text: '[hr]'
}, {
	label: '字体',
	text: '[font=serif][/font]'
}, {
	label: '短信',
	text: '[url=sms:手机号?body=短信内容]点此发送[/url]'
}, {
	label: '拨号',
	text: '[call]拨号手机号码[/call]'
}, {
	label: '时间',
	text: '当前系统日期和时间：[now]'
}, {
	label: '倒计天',
	text: '倒计天：[codo]2030-01-01[/codo]'
}, {
	label: '居左',
	text: '[left]'
}, {
	label: '居中',
	text: '[center]'
}, {
	label: '居右',
	text: '[right]'
}, {
	label: 'IP',
	text: '[ip]'
}, {
	label: '用户ID',
	text: '[userid]'
}, {
	label: '皮皮',
	url: 'https://aapi.eu.org/ppx'
}, {
	label: 'B站',
	url: 'https://aapi.eu.org/bili'
}, {
	label: '抖音',
	url: 'https://aapi.eu.org/dy'
}, {
	label: '快手',
	url: 'https://aapi.eu.org/ks'
}, {
	label: '外链',
	url: 'https://www.uhsea.com'
}, {
	label: '短链接',
	url: 'https://urlify.cn/'
}]

export function appendText(current, text) {
	current = String(current || '')
	text = String(text || '')
	if (!text) {
		return current
	}
	return `${current ? current + '\n' : ''}${text}`
}

export function autoLinkYaohuoUserIdsInHtml(html, escapeHtml, escapeHtmlAttr) {
	let inAnchor = false
	let inSkipTag = false
	return String(html || '').split(/(<[^>]+>)/g).map(part => {
		if (!part) {
			return part
		}
		if (part.charAt(0) === '<') {
			if (/^<a\b/i.test(part)) {
				inAnchor = true
			} else if (/^<\/a\b/i.test(part)) {
				inAnchor = false
			}
			if (/^<(script|style|textarea|pre|code)\b/i.test(part)) {
				inSkipTag = true
			} else if (/^<\/(script|style|textarea|pre|code)\b/i.test(part)) {
				inSkipTag = false
			}
			return part
		}
		if (inAnchor || inSkipTag) {
			return part
		}
		return autoLinkYaohuoUserIdsInText(part, escapeHtml, escapeHtmlAttr)
	}).join('')
}

const MIN_YAOHUO_USER_ID = 1000
const MAX_STANDALONE_YAOHUO_USER_ID = 999999

function createYaohuoUserLink(id, escapeHtml, escapeHtmlAttr) {
	const href = `https://yaohuo.me/bbs/userinfo.aspx?touserid=${id}`
	return `<a href="${escapeHtmlAttr(href)}" style="color:#0A98D5;text-decoration:underline;">${escapeHtml(id)}</a>`
}

function shouldLinkYaohuoUserId(id, max) {
	const value = Number(id)
	return value >= MIN_YAOHUO_USER_ID && value <= max
}

export function autoLinkYaohuoUserIdsInText(text, escapeHtml, escapeHtmlAttr) {
	const links = []
	const stashLink = html => {
		const key = `\uE000${links.length}\uE001`
		links.push(html)
		return key
	}
	const withLabeledIds = String(text || '').replace(/(^|[^\w=&?/#:;.,-])((?:ID|id|UID|uid|用户ID|用户|妖火ID|妖火)\s*[:：=是为]?\s*)(\d{4,10})(?![\w])/g, (all, prefix, label, id) => {
		if (!shouldLinkYaohuoUserId(id, 9999999999)) {
			return all
		}
		return `${prefix}${label}${stashLink(createYaohuoUserLink(id, escapeHtml, escapeHtmlAttr))}`
	})
	const withStandaloneIds = withLabeledIds.replace(/(^|[\s([（【{《<>"'“‘：:，,。.!！?？;；、|])(\d{4,6})(?![\w%]|(?:\s*(?:年|月|日|号|楼|层|次|个|元|块|妖晶|经验|秒|分钟|分|点|KB|MB|GB|TB|K|M|G|px|rpx|cm|mm|kg|斤)))/gi, (all, prefix, id) => {
		if (!shouldLinkYaohuoUserId(id, MAX_STANDALONE_YAOHUO_USER_ID)) {
			return all
		}
		return `${prefix}${stashLink(createYaohuoUserLink(id, escapeHtml, escapeHtmlAttr))}`
	})
	return withStandaloneIds.replace(/\uE000(\d+)\uE001/g, (all, index) => links[Number(index)] || all)
}
