const BASE = '/api'

async function request(path, options) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok && res.status !== 204) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `Request failed: ${res.status}`)
  }
  return res.status === 204 ? null : res.json()
}

export function searchShabads(q, mode) {
  const params = new URLSearchParams({ q, mode })
  return request(`/shabads/search?${params}`)
}

export function listFavorites() {
  return request('/favorites')
}

export function addFavorite(shabadId) {
  return request('/favorites', { method: 'POST', body: JSON.stringify({ shabadId }) })
}

export function removeFavorite(shabadId) {
  return request(`/favorites/${shabadId}`, { method: 'DELETE' })
}

export function listTopics() {
  return request('/topics')
}

export function createTopic(name) {
  return request('/topics', { method: 'POST', body: JSON.stringify({ name }) })
}

export function addShabadToTopic(topicId, shabadId) {
  return request(`/topics/${topicId}/shabads`, {
    method: 'POST',
    body: JSON.stringify({ shabadId }),
  })
}
