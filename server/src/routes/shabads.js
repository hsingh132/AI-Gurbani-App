import { Router } from 'express'
import { gurbaniDb } from '../db/gurbani.js'

export const shabadsRouter = Router()

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
  SELECT t.translation, ts.name_english AS translation_source
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

// GET /api/shabads/search?q=...&mode=text|first-letters
shabadsRouter.get('/search', (req, res) => {
  const q = (req.query.q ?? '').toString().trim()
  const mode = req.query.mode === 'first-letters' ? 'first-letters' : 'text'

  if (!q) {
    return res.json({ results: [] })
  }

  let shabadIds
  if (mode === 'first-letters') {
    shabadIds = gurbaniDb
      .prepare('SELECT DISTINCT shabad_id FROM lines WHERE first_letters LIKE ? LIMIT 40')
      .all(`${q}%`)
      .map((r) => r.shabad_id)
  } else {
    shabadIds = gurbaniDb
      .prepare('SELECT DISTINCT shabad_id FROM lines WHERE gurmukhi LIKE ? LIMIT 40')
      .all(`%${q}%`)
      .map((r) => r.shabad_id)
  }

  const results = shabadIds.map((id) => getFullShabad(id))
  res.json({ results })
})

// GET /api/shabads/:id
shabadsRouter.get('/:id', (req, res) => {
  const shabad = getFullShabad(req.params.id)
  if (!shabad) return res.status(404).json({ error: 'Shabad not found' })
  res.json(shabad)
})
