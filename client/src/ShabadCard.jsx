export function ShabadCard({ shabad, isFavorite, onToggleFavorite, topics, onAddToTopic }) {
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
