import { Router } from 'express'
import { userDb } from '../db/userData.js'

export const favoritesRouter = Router()

favoritesRouter.get('/', (_req, res) => {
  const favorites = userDb
    .prepare('SELECT shabad_id, created_at FROM favorites ORDER BY created_at DESC')
    .all()
  res.json({ favorites })
})

favoritesRouter.post('/', (req, res) => {
  const { shabadId } = req.body ?? {}
  if (!shabadId) return res.status(400).json({ error: 'shabadId is required' })

  userDb
    .prepare('INSERT OR IGNORE INTO favorites (shabad_id) VALUES (?)')
    .run(shabadId)
  res.status(201).json({ shabadId })
})

favoritesRouter.delete('/:shabadId', (req, res) => {
  userDb.prepare('DELETE FROM favorites WHERE shabad_id = ?').run(req.params.shabadId)
  res.status(204).end()
})
