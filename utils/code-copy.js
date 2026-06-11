const codeBlockMap = {}
let codeBlockSeed = 0

export function clearCodeBlocks(scope) {
	scope = String(scope || '')
	if (!scope) {
		Object.keys(codeBlockMap).forEach(key => {
			delete codeBlockMap[key]
		})
		return
	}
	Object.keys(codeBlockMap).forEach(key => {
		if (key.indexOf(scope + '-') === 0) {
			delete codeBlockMap[key]
		}
	})
}

export function registerCodeBlock(code, scope) {
	scope = String(scope || 'code')
	codeBlockSeed += 1
	const key = `${scope}-${Date.now().toString(36)}-${codeBlockSeed}`
	codeBlockMap[key] = String(code || '')
	return key
}

export function getCodeBlockText(key) {
	return codeBlockMap[String(key || '')] || ''
}

export function buildCodeCopyUrl(key) {
	return `copy-code://${encodeURIComponent(String(key || ''))}`
}

export function getCodeCopyKey(url) {
	const match = String(url || '').match(/^copy-code:\/\/(.+)$/i)
	if (!match) {
		return ''
	}
	try {
		return decodeURIComponent(match[1])
	} catch (e) {
		return match[1]
	}
}
