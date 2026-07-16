import { useEffect, useState } from 'react'
import {
  addFavorite,
  addShabadToTopic,
  createTopic,
  listFavorites,
  listTopics,
  removeFavorite,
  searchShabads,
} from './api'
import { ShabadCard } from './ShabadCard'

export default function App() {
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState('text')
  const [results, setResults] = useState([])
  const [status, setStatus] = useState('idle')
  const [favoriteIds, setFavoriteIds] = useState(new Set())
  const [topics, setTopics] = useState([])
  const [newTopicName, setNewTopicName] = useState('')

  useEffect(() => {
    listFavorites().then((data) =>
      setFavoriteIds(new Set(data.favorites.map((f) => f.shabad_id)))
    )
    listTopics().then((data) => setTopics(data.topics))
  }, [])

  async function handleSearch(e) {
    e.preventDefault()
    if (!query.trim()) return
    setStatus('loading')
    try {
      const data = await searchShabads(query.trim(), mode)
      setResults(data.results)
      setStatus('idle')
    } catch (err) {
      console.error(err)
      setStatus('error')
    }
  }

  async function handleToggleFavorite(shabadId) {
    if (favoriteIds.has(shabadId)) {
      await removeFavorite(shabadId)
      setFavoriteIds((prev) => {
        const next = new Set(prev)
        next.delete(shabadId)
        return next
      })
    } else {
      await addFavorite(shabadId)
      setFavoriteIds((prev) => new Set(prev).add(shabadId))
    }
  }

  async function handleCreateTopic(e) {
    e.preventDefault()
    if (!newTopicName.trim()) return
    const topic = await createTopic(newTopicName.trim())
    setTopics((prev) => [...prev, topic])
    setNewTopicName('')
  }

  async function handleAddToTopic(topicId, shabadId) {
    await addShabadToTopic(topicId, shabadId)
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
