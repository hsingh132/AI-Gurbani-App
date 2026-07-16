import { useEffect, useState } from 'react'

async function api(path, options) {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok && res.status !== 204) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `Request failed: ${res.status}`)
  }
  return res.status === 204 ? null : res.json()
}

function ShabadCard({ shabad, isFavorite, onToggleFavorite, topics, onAddToTopic }) {
  return (
    <article className="shabad-card">
      <header>
        <h3>{shabad.source_name}</h3>
        <p className="meta">
          {shabad.writer_name ?? 'Unknown writer'} &middot; {shabad.section_name}
        </p>
        <div className="actions">
          <button type="button" onClick={() => onToggleFavorite(shabad.id)}>
            {isFavorite ? '★ Favorited' : '☆ Favorite'}
          </button>
          {topics.length > 0 && (
            <select
              defaultValue=""
              onChange={(e) => {
                if (e.target.value) onAddToTopic(Number(e.target.value), shabad.id)
                e.target.value = ''
              }}
            >
              <option value="" disabled>
                Add to topic…
              </option>
              {topics.map((topic) => (
                <option key={topic.id} value={topic.id}>
                  {topic.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </header>
      <ol className="lines">
        {shabad.lines.map((line) => (
          <li key={line.id}>
            <p className="gurmukhi">{line.gurmukhi}</p>
            {line.translation && <p className="translation">{line.translation}</p>}
          </li>
        ))}
      </ol>
    </article>
  )
}

export default function App() {
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState('text')
  const [results, setResults] = useState([])
  const [status, setStatus] = useState('idle')
  const [favoriteIds, setFavoriteIds] = useState(new Set())
  const [topics, setTopics] = useState([])
  const [newTopicName, setNewTopicName] = useState('')

  useEffect(() => {
    api('/favorites').then((data) =>
      setFavoriteIds(new Set(data.favorites.map((f) => f.shabad_id)))
    )
    api('/topics').then((data) => setTopics(data.topics))
  }, [])

  async function handleSearch(e) {
    e.preventDefault()
    if (!query.trim()) return
    setStatus('loading')
    try {
      const params = new URLSearchParams({ q: query.trim(), mode })
      const data = await api(`/shabads/search?${params}`)
      setResults(data.results)
      setStatus('idle')
    } catch (err) {
      console.error(err)
      setStatus('error')
    }
  }

  async function handleToggleFavorite(shabadId) {
    if (favoriteIds.has(shabadId)) {
      await api(`/favorites/${shabadId}`, { method: 'DELETE' })
      setFavoriteIds((prev) => {
        const next = new Set(prev)
        next.delete(shabadId)
        return next
      })
    } else {
      await api('/favorites', { method: 'POST', body: JSON.stringify({ shabadId }) })
      setFavoriteIds((prev) => new Set(prev).add(shabadId))
    }
  }

  async function handleCreateTopic(e) {
    e.preventDefault()
    if (!newTopicName.trim()) return
    const topic = await api('/topics', {
      method: 'POST',
      body: JSON.stringify({ name: newTopicName.trim() }),
    })
    setTopics((prev) => [...prev, topic])
    setNewTopicName('')
  }

  async function handleAddToTopic(topicId, shabadId) {
    await api(`/topics/${topicId}/shabads`, {
      method: 'POST',
      body: JSON.stringify({ shabadId }),
    })
  }

  return (
    <div className="app">
      <h1>Gurbani Search</h1>

      <form onSubmit={handleSearch} className="search-form">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={mode === 'first-letters' ? 'e.g. snkpnn' : 'Search Gurmukhi text…'}
        />
        <label>
          <input
            type="radio"
            name="mode"
            checked={mode === 'text'}
            onChange={() => setMode('text')}
          />
          Text
        </label>
        <label>
          <input
            type="radio"
            name="mode"
            checked={mode === 'first-letters'}
            onChange={() => setMode('first-letters')}
          />
          First letters
        </label>
        <button type="submit">Search</button>
      </form>

      <form onSubmit={handleCreateTopic} className="topic-form">
        <input
          type="text"
          value={newTopicName}
          onChange={(e) => setNewTopicName(e.target.value)}
          placeholder="New topic name…"
        />
        <button type="submit">Add topic</button>
      </form>

      {status === 'loading' && <p>Searching…</p>}
      {status === 'error' && <p>Something went wrong. Is the API server running?</p>}

      <div className="results">
        {results.map((shabad) => (
          <ShabadCard
            key={shabad.id}
            shabad={shabad}
            isFavorite={favoriteIds.has(shabad.id)}
            onToggleFavorite={handleToggleFavorite}
            topics={topics}
            onAddToTopic={handleAddToTopic}
          />
        ))}
      </div>
    </div>
  )
}
