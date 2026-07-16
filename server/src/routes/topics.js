import { Router } from 'express'
import { userDb } from '../db/userData.js'

export const topicsRouter = Router()

topicsRouter.get('/', (_req, res) => {
  const topics = userDb.prepare('SELECT id, name, created_at FROM topics ORDER BY name').all()
  res.json({ topics })
})

topicsRouter.post('/', (req, res) => {
  const { name } = req.body ?? {}
  if (!name) return res.status(400).json({ error: 'name is required' })

  const { lastInsertRowid } = userDb
    .prepare('INSERT INTO topics (name) VALUES (?)')
    .run(name)
  res.status(201).json({ id: lastInsertRowid, name })
})

topicsRouter.get('/:id/shabads', (req, res) => {
  const shabadIds = userDb
    .prepare('SELECT shabad_id FROM topic_shabads WHERE topic_id = ? ORDER BY created_at DESC')
    .all(req.params.id)
    .map((r) => r.shabad_id)
  res.json({ shabadIds })
})

topicsRouter.post('/:id/shabads', (req, res) => {
  const { shabadId } = req.body ?? {}
  if (!shabadId) return res.status(400).json({ error: 'shabadId is required' })

  userDb
    .prepare('INSERT OR IGNORE INTO topic_shabads (topic_id, shabad_id) VALUES (?, ?)')
    .run(req.params.id, shabadId)
  res.status(201).json({ topicId: req.params.id, shabadId })
})

topicsRouter.delete('/:id/shabads/:shabadId', (req, res) => {
  userDb
    .prepare('DELETE FROM topic_shabads WHERE topic_id = ? AND shabad_id = ?')
    .run(req.params.id, req.params.shabadId)
  res.status(204).end()
})
