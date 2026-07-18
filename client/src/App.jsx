import { useEffect, useState } from 'react'
import { toUnicode } from 'gurmukhi-utils'

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

function getShabadsByIds(ids) {
  return Promise.all(ids.map((id) => api(`/shabads/${id}`)))
}

// Vishraams (pause markers) are glued to the end of a word: "." light,
// "," medium, ";" heavy. All three are stripped from display, but only
// medium (blue) and heavy (orange) get a color -- light stays plain.
const VISHRAAM_MARKERS = new Set(['.', ',', ';'])
const VISHRAAM_COLOR_CLASS = { ',': 'vishraam-light', ';': 'vishraam-heavy' }

function GurmukhiLine({ text }) {
  const words = text.split(' ')
  return words.map((word, i) => {
    const marker = word.slice(-1)
    const display = VISHRAAM_MARKERS.has(marker) ? word.slice(0, -1) : word
    return (
      <span key={i} className={VISHRAAM_COLOR_CLASS[marker]}>
        {display}
        {i < words.length - 1 ? ' ' : ''}
      </span>
    )
  })
}

function ShabadHeader({ shabad, isFavorite, onToggleFavorite, topics, onAddToTopic }) {
  return (
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
  )
}

// Full shabad, every line -- used for favorites/topics and the expanded
// detail view opened from a search result. highlightLineId marks the
// specific line that matched a search, if any.
function ShabadCard({ shabad, isFavorite, onToggleFavorite, topics, onAddToTopic, highlightLineId }) {
  return (
    <article className="shabad-card">
      <ShabadHeader
        shabad={shabad}
        isFavorite={isFavorite}
        onToggleFavorite={onToggleFavorite}
        topics={topics}
        onAddToTopic={onAddToTopic}
      />
      <ol className="lines">
        {shabad.lines.map((line) => (
          <li key={line.id} className={line.id === highlightLineId ? 'highlighted' : undefined}>
            <p className="gurmukhi">
              <GurmukhiLine text={line.gurmukhi} />
            </p>
            {line.translation && <p className="translation">{line.translation}</p>}
          </li>
        ))}
      </ol>
    </article>
  )
}

// Search result: just the one matching line, not the whole shabad. Click it
// to open the full shabad with that line highlighted.
function SearchResultRow({ shabad, isFavorite, onToggleFavorite, topics, onAddToTopic, onOpen }) {
  return (
    <article className="shabad-card">
      <ShabadHeader
        shabad={shabad}
        isFavorite={isFavorite}
        onToggleFavorite={onToggleFavorite}
        topics={topics}
        onAddToTopic={onAddToTopic}
      />
      <button type="button" className="result-line" onClick={() => onOpen(shabad.id, shabad.line.id)}>
        <p className="gurmukhi">
          <GurmukhiLine text={shabad.line.gurmukhi} />
        </p>
        {shabad.line.translation && <p className="translation">{shabad.line.translation}</p>}
      </button>
    </article>
  )
}

export default function App() {
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState('first-letters-anywhere')
  const [status, setStatus] = useState('idle')
  const [favoriteIds, setFavoriteIds] = useState(new Set())
  const [topics, setTopics] = useState([])
  const [newTopicName, setNewTopicName] = useState('')

  // Which results are on screen: a search, the favorites list, or one topic.
  const [view, setView] = useState('search')
  const [searchResults, setSearchResults] = useState([])
  const [browseResults, setBrowseResults] = useState([])
  const [activeTopic, setActiveTopic] = useState(null)

  // A search result that's been clicked open: the full shabad plus which
  // line to highlight. Only relevant within the search view.
  const [openShabad, setOpenShabad] = useState(null)
  const [highlightLineId, setHighlightLineId] = useState(null)

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
      const data =
        mode === 'ai'
          ? await api('/ai-search', { method: 'POST', body: JSON.stringify({ q: query.trim() }) })
          : await api(`/shabads/search?${new URLSearchParams({ q: query.trim(), mode })}`)
      setSearchResults(data.results)
      setOpenShabad(null)
      setHighlightLineId(null)
      setView('search')
      setStatus('idle')
    } catch (err) {
      console.error(err)
      setStatus('error')
    }
  }

  async function handleOpenShabad(shabadId, lineId) {
    setStatus('loading')
    try {
      const shabad = await api(`/shabads/${shabadId}`)
      setOpenShabad(shabad)
      setHighlightLineId(lineId)
      setStatus('idle')
    } catch (err) {
      console.error(err)
      setStatus('error')
    }
  }

  function handleCloseShabad() {
    setOpenShabad(null)
    setHighlightLineId(null)
  }

  async function handleViewFavorites() {
    setStatus('loading')
    try {
      const data = await api('/favorites')
      setBrowseResults(await getShabadsByIds(data.favorites.map((f) => f.shabad_id)))
      setActiveTopic(null)
      setOpenShabad(null)
      setHighlightLineId(null)
      setView('favorites')
      setStatus('idle')
    } catch (err) {
      console.error(err)
      setStatus('error')
    }
  }

  async function handleViewTopic(topicId) {
    if (!topicId) return
    setStatus('loading')
    try {
      const data = await api(`/topics/${topicId}/shabads`)
      setBrowseResults(await getShabadsByIds(data.shabadIds))
      setActiveTopic(topics.find((t) => t.id === Number(topicId)) ?? null)
      setOpenShabad(null)
      setHighlightLineId(null)
      setView('topic')
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

  async function handleDeleteTopic(topicId) {
    await api(`/topics/${topicId}`, { method: 'DELETE' })
    setTopics((prev) => prev.filter((t) => t.id !== topicId))
    if (activeTopic?.id === topicId) {
      setActiveTopic(null)
      setBrowseResults([])
      setView('search')
    }
  }

  // Favorites view stays live: unfavoriting a card removes it immediately.
  const displayedResults =
    view === 'search'
      ? searchResults
      : view === 'favorites'
        ? browseResults.filter((s) => favoriteIds.has(s.id))
        : browseResults

  const emptyMessage =
    view === 'search'
      ? 'Search for something to see results.'
      : view === 'favorites'
        ? 'No favorites yet — star a shabad to add one.'
        : 'No shabads in this topic yet.'

  const showingShabadDetail = view === 'search' && openShabad

  return (
    <div className="app">
      <h1>Gurbani Search</h1>

      <form onSubmit={handleSearch} className="search-form">
        <input
          type="text"
          // Search matches the raw ASCII Gurmukhi-font keying the database uses
          // (same scheme toUnicode() converts elsewhere) -- for every mode but
          // AI search (plain English questions), show that conversion directly
          // in the box as you type, instead of the raw ASCII you typed.
          value={mode === 'ai' ? query : toUnicode(query)}
          onChange={(e) => {
            if (mode === 'ai') setQuery(e.target.value)
          }}
          onKeyDown={(e) => {
            if (mode === 'ai' || e.ctrlKey || e.metaKey || e.altKey) return
            if (e.key === 'Backspace') {
              e.preventDefault()
              setQuery((q) => q.slice(0, -1))
            } else if (e.key.length === 1) {
              e.preventDefault()
              setQuery((q) => q + e.key)
            }
          }}
          onPaste={(e) => {
            if (mode === 'ai') return
            e.preventDefault()
            setQuery((q) => q + e.clipboardData.getData('text'))
          }}
          placeholder={
            mode === 'first-letters'
              ? 'e.g. snkpnn (start of line)'
              : mode === 'first-letters-anywhere'
                ? 'e.g. snkpnn (anywhere in line)'
                : mode === 'ai'
                  ? 'Describe what you’re looking for…'
                  : 'Search Gurmukhi text…'
          }
        />
        <label>
          <input
            type="radio"
            name="mode"
            checked={mode === 'first-letters-anywhere'}
            onChange={() => {
              setMode('first-letters-anywhere')
              setQuery('')
            }}
          />
          First letter anywhere
        </label>
        <label>
          <input
            type="radio"
            name="mode"
            checked={mode === 'first-letters'}
            onChange={() => {
              setMode('first-letters')
              setQuery('')
            }}
          />
          First letters (start)
        </label>
        <label>
          <input
            type="radio"
            name="mode"
            checked={mode === 'text'}
            onChange={() => {
              setMode('text')
              setQuery('')
            }}
          />
          Text
        </label>
        <label>
          <input
            type="radio"
            name="mode"
            checked={mode === 'ai'}
            onChange={() => {
              setMode('ai')
              setQuery('')
            }}
          />
          AI search
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

      <nav className="view-nav">
        <button
          type="button"
          onClick={() => {
            setView('search')
            setOpenShabad(null)
            setHighlightLineId(null)
          }}
          disabled={view === 'search' && !openShabad}
        >
          Search results
        </button>
        <button type="button" onClick={handleViewFavorites} disabled={view === 'favorites'}>
          ★ Favorites
        </button>
        <select
          value={view === 'topic' ? (activeTopic?.id ?? '') : ''}
          onChange={(e) => handleViewTopic(e.target.value)}
        >
          <option value="">View a topic…</option>
          {topics.map((topic) => (
            <option key={topic.id} value={topic.id}>
              {topic.name}
            </option>
          ))}
        </select>
      </nav>

      {showingShabadDetail ? (
        <>
          <button type="button" className="back-link" onClick={handleCloseShabad}>
            ← Back to results
          </button>
          <div className="results">
            <ShabadCard
              shabad={openShabad}
              isFavorite={favoriteIds.has(openShabad.id)}
              onToggleFavorite={handleToggleFavorite}
              topics={topics}
              onAddToTopic={handleAddToTopic}
              highlightLineId={highlightLineId}
            />
          </div>
        </>
      ) : (
        <>
          <h2>
            {view === 'search' && 'Search results'}
            {view === 'favorites' && 'Favorites'}
            {view === 'topic' && `Topic: ${activeTopic?.name ?? ''}`}
            {view === 'topic' && activeTopic && (
              <button
                type="button"
                className="delete-topic"
                onClick={() => handleDeleteTopic(activeTopic.id)}
              >
                Delete topic
              </button>
            )}
          </h2>

          {status === 'loading' && <p>Loading…</p>}
          {status === 'error' && <p>Something went wrong. Is the API server running?</p>}
          {status !== 'loading' && displayedResults.length === 0 && (
            <p className="empty">{emptyMessage}</p>
          )}

          <div className="results">
            {displayedResults.map((shabad) =>
              view === 'search' ? (
                <SearchResultRow
                  key={shabad.id}
                  shabad={shabad}
                  isFavorite={favoriteIds.has(shabad.id)}
                  onToggleFavorite={handleToggleFavorite}
                  topics={topics}
                  onAddToTopic={handleAddToTopic}
                  onOpen={handleOpenShabad}
                />
              ) : (
                <ShabadCard
                  key={shabad.id}
                  shabad={shabad}
                  isFavorite={favoriteIds.has(shabad.id)}
                  onToggleFavorite={handleToggleFavorite}
                  topics={topics}
                  onAddToTopic={handleAddToTopic}
                />
              )
            )}
          </div>
        </>
      )}
    </div>
  )
}
