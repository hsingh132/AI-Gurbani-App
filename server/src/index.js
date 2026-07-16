import cors from 'cors'
import express from 'express'
import { gurbaniDb, userDb } from './db.js'

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

// English translation only, for scaffold simplicity
const translationForLineStmt = gurbaniDb.prepare(`
  SELECT t.translation
  FROM translations t
  JOIN translation_sources ts ON ts.id = t.translation_source_id
  WHERE t.line_id = ? AND ts.language_id = 1
  LIMIT 1
`)

function getFullShabad(shabadId) {
  const header = shabadHeaderStmt.get(shabadId)
  if (!header) return null

  const lines = linesForShabadStmt.all(shabadId).map((line) => ({
    ...line,
    translation: translationForLineStmt.get(line.id)?.translation ?? null,
  }))

  return { ...header, lines }
}

app.get('/api/shabads/search', (req, res) => {
  const q = (req.query.q ?? '').toString().trim()
  const mode = req.query.mode === 'first-letters' ? 'first-letters' : 'text'
  if (!q) return res.json({ results: [] })

  const column = mode === 'first-letters' ? 'first_letters' : 'gurmukhi'
  const pattern = mode === 'first-letters' ? `${q}%` : `%${q}%`
  const shabadIds = gurbaniDb
    .prepare(`SELECT DISTINCT shabad_id FROM lines WHERE ${column} LIKE ? LIMIT 40`)
    .all(pattern)
    .map((r) => r.shabad_id)

  res.json({ results: shabadIds.map(getFullShabad) })
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

// --- AI search: not implemented yet. Planned as retrieval-augmented search
// over embedded translations -- see DOCUMENTATION.md.

app.post('/api/ai-search', (_req, res) => {
  res.status(501).json({ error: 'AI search is not implemented yet' })
})

app.listen(PORT, () => {
  console.log(`Gurbani API listening on http://localhost:${PORT}`)
})
