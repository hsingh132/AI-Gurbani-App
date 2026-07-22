import cors from 'cors'
import express from 'express'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { default as gurmukhiUtils } from 'gurmukhi-utils'
import { gurbaniDb, userDb } from './db.js'
import { semanticSearch } from './semanticSearch.js'

const app = express()
const PORT = process.env.PORT ?? 3001

app.use(cors())
app.use(express.json())

app.get('/api/health', (_req, res) => res.json({ ok: true }))

// --- Shabads (read-only, from the reference Gurbani database) ---

const shabadHeaderStmt = gurbaniDb.prepare(`
  SELECT
    s.id, s.order_id,
    src.name_english AS source_name,
    w.name_english AS writer_name,
    sec.name_english AS section_name
  FROM shabads s
  JOIN sources src ON src.id = s.source_id
  LEFT JOIN writers w ON w.id = s.writer_id
  LEFT JOIN sections sec ON sec.id = s.section_id
  WHERE s.id = ?
`)

const linesForShabadStmt = gurbaniDb.prepare(`
  SELECT id, gurmukhi, pronunciation, first_letters, source_page, source_line, type_id, order_id
  FROM lines
  WHERE shabad_id = ?
  ORDER BY order_id
`)

// English translation only, for scaffold simplicity. Some lines have a blank
// translation from one source but a real one from another -- prefer the
// first non-empty source, falling back to null only if every source is blank.
const translationForLineStmt = gurbaniDb.prepare(`
  SELECT t.translation
  FROM translations t
  JOIN translation_sources ts ON ts.id = t.translation_source_id
  WHERE t.line_id = ? AND ts.language_id = 1 AND trim(t.translation) != ''
  ORDER BY t.translation_source_id
  LIMIT 1
`)

const lineByIdStmt = gurbaniDb.prepare(`
  SELECT id, gurmukhi, pronunciation, first_letters, source_page, source_line, type_id, order_id
  FROM lines
  WHERE id = ?
`)

function toDisplayLine(line) {
  return {
    ...line,
    // The database stores Gurmukhi in an ASCII font encoding (e.g. "siq nwmu"),
    // not Unicode script -- convert it for display.
    gurmukhi: gurmukhiUtils.toUnicode(line.gurmukhi),
    translation: translationForLineStmt.get(line.id)?.translation ?? null,
  }
}

function getFullShabad(shabadId) {
  const header = shabadHeaderStmt.get(shabadId)
  if (!header) return null

  const lines = linesForShabadStmt.all(shabadId).map(toDisplayLine)
  return { ...header, lines }
}

// Search results show one matching line per shabad, not the whole thing --
// the client fetches the full shabad (getFullShabad, via GET /shabads/:id)
// only when that line is clicked.
function getShabadWithMatchedLine(shabadId, lineId) {
  const header = shabadHeaderStmt.get(shabadId)
  const line = lineByIdStmt.get(lineId)
  if (!header || !line) return null
  return { ...header, line: toDisplayLine(line) }
}

const SEARCH_MODES = new Set(['first-letters', 'first-letters-anywhere'])

app.get('/api/shabads/search', (req, res) => {
  const q = (req.query.q ?? '').toString().trim()
  const mode = SEARCH_MODES.has(req.query.mode) ? req.query.mode : 'text'
  if (!q) return res.json({ results: [] })

  const column = mode === 'text' ? 'gurmukhi' : 'first_letters'
  // "first-letters" matches from the start of a line; "first-letters-anywhere"
  // matches the phrase starting anywhere within the line.
  const pattern = mode === 'first-letters' ? `${q}%` : `%${q}%`
  // One matching line per shabad (the earliest one in reading order), not
  // an arbitrary row -- matches ROW_NUMBER's determinism elsewhere in the app.
  const matches = gurbaniDb
    .prepare(
      `
      SELECT line_id, shabad_id FROM (
        SELECT id AS line_id, shabad_id,
          ROW_NUMBER() OVER (PARTITION BY shabad_id ORDER BY order_id) AS rn
        FROM lines
        WHERE ${column} LIKE ?
      )
      WHERE rn = 1
      LIMIT 40
      `
    )
    .all(pattern)

  res.json({ results: matches.map((m) => getShabadWithMatchedLine(m.shabad_id, m.line_id)) })
})

app.get('/api/shabads/:id', (req, res) => {
  const shabad = getFullShabad(req.params.id)
  if (!shabad) return res.status(404).json({ error: 'Shabad not found' })
  res.json(shabad)
})

// --- Favorites ---

app.get('/api/favorites', (_req, res) => {
  const favorites = userDb
    .prepare('SELECT shabad_id, created_at FROM favorites ORDER BY created_at DESC')
    .all()
  res.json({ favorites })
})

app.post('/api/favorites', (req, res) => {
  const { shabadId } = req.body ?? {}
  if (!shabadId) return res.status(400).json({ error: 'shabadId is required' })
  userDb.prepare('INSERT OR IGNORE INTO favorites (shabad_id) VALUES (?)').run(shabadId)
  res.status(201).json({ shabadId })
})

app.delete('/api/favorites/:shabadId', (req, res) => {
  userDb.prepare('DELETE FROM favorites WHERE shabad_id = ?').run(req.params.shabadId)
  res.status(204).end()
})

// --- Topics ---

app.get('/api/topics', (_req, res) => {
  const topics = userDb.prepare('SELECT id, name, created_at FROM topics ORDER BY name').all()
  res.json({ topics })
})

app.post('/api/topics', (req, res) => {
  const { name } = req.body ?? {}
  if (!name) return res.status(400).json({ error: 'name is required' })
  const { lastInsertRowid } = userDb.prepare('INSERT INTO topics (name) VALUES (?)').run(name)
  res.status(201).json({ id: lastInsertRowid, name })
})

// topic_shabads rows cascade on delete (ON DELETE CASCADE, see db.js).
app.delete('/api/topics/:id', (req, res) => {
  userDb.prepare('DELETE FROM topics WHERE id = ?').run(req.params.id)
  res.status(204).end()
})

app.get('/api/topics/:id/shabads', (req, res) => {
  const shabadIds = userDb
    .prepare('SELECT shabad_id FROM topic_shabads WHERE topic_id = ? ORDER BY created_at DESC')
    .all(req.params.id)
    .map((r) => r.shabad_id)
  res.json({ shabadIds })
})

app.post('/api/topics/:id/shabads', (req, res) => {
  const { shabadId } = req.body ?? {}
  if (!shabadId) return res.status(400).json({ error: 'shabadId is required' })
  userDb
    .prepare('INSERT OR IGNORE INTO topic_shabads (topic_id, shabad_id) VALUES (?, ?)')
    .run(req.params.id, shabadId)
  res.status(201).json({ topicId: req.params.id, shabadId })
})

app.delete('/api/topics/:id/shabads/:shabadId', (req, res) => {
  userDb
    .prepare('DELETE FROM topic_shabads WHERE topic_id = ? AND shabad_id = ?')
    .run(req.params.id, req.params.shabadId)
  res.status(204).end()
})

// --- AI search: semantic search over line-level embeddings (see
// scripts/build-embeddings.js and DOCUMENTATION.md).

app.post('/api/ai-search', async (req, res) => {
  if (!process.env.VOYAGE_API_KEY) {
    return res.status(501).json({ error: 'AI search is not configured (missing VOYAGE_API_KEY)' })
  }

  const q = (req.body?.q ?? '').toString().trim()
  if (!q) return res.json({ results: [] })

  try {
    const matches = await semanticSearch(q)
    if (matches === null) {
      return res
        .status(503)
        .json({ error: 'Embeddings not built yet -- run `npm run build-embeddings` in server/' })
    }
    res.json({
      results: matches.map(({ shabadId, lineId }) => getShabadWithMatchedLine(shabadId, lineId)),
    })
  } catch (err) {
    console.error(err)
    res.status(502).json({ error: `AI search failed: ${err.message}` })
  }
})

// Serve the built client (npm run build in client/) from the same origin/port
// as the API, if it's been built. Lets the whole app run as one process --
// simpler for always-on setups (pm2, Meshnet) than running two dev servers.
// In normal two-terminal dev mode client/dist won't exist, so this is a no-op.
const CLIENT_DIST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist')
if (existsSync(CLIENT_DIST)) {
  app.use(express.static(CLIENT_DIST))
  app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(path.join(CLIENT_DIST, 'index.html')))
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Gurbani API listening on http://localhost:${PORT}`)
})
