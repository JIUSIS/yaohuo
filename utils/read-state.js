const STORAGE_KEY = 'yaohuoReadPosts'
const MAX_READ_POSTS = 2000

export function getPostReadId(input) {
	const text = String(input || '').trim()
	if (!text) {
		return ''
	}
	const patterns = [
		/bbs-(\d+)\.html/i,
		/[?&]id=(\d{3,})/i,
		/^(\d{3,})$/
	]
	for (let i = 0; i < patterns.length; i++) {
		const match = text.match(patterns[i])
		if (match) {
			return match[1]
		}
	}
	return ''
}

function readStore() {
	const raw = uni.getStorageSync(STORAGE_KEY)
	if (!raw) {
		return {}
	}
	if (typeof raw === 'object') {
		return raw || {}
	}
	try {
		const parsed = JSON.parse(String(raw))
		return parsed && typeof parsed === 'object' ? parsed : {}
	} catch (e) {
		return {}
	}
}

function writeStore(store) {
	try {
		uni.setStorageSync(STORAGE_KEY, store || {})
	} catch (e) {}
}

function pruneStore(store) {
	const entries = Object.keys(store || {}).map(id => {
		return {
			id,
			time: Number(store[id] || 0)
		}
	}).filter(item => item.id)
	if (entries.length <= MAX_READ_POSTS) {
		return store
	}
	entries.sort((a, b) => b.time - a.time)
	const next = {}
	entries.slice(0, MAX_READ_POSTS).forEach(item => {
		next[item.id] = item.time
	})
	return next
}

export function markPostRead(input) {
	const id = getPostReadId(input)
	if (!id) {
		return ''
	}
	const store = readStore()
	store[id] = Date.now()
	writeStore(pruneStore(store))
	return id
}

export function isPostRead(input) {
	const id = getPostReadId(input)
	if (!id) {
		return false
	}
	const store = readStore()
	return !!store[id]
}
