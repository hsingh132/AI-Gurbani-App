import { Router } from 'express'

export const aiSearchRouter = Router()

// Not implemented yet. Planned approach: embed shabad translations into a
// vector index (e.g. sqlite-vec) and do similarity search against the query,
// optionally using an LLM to explain/rank results. See root DOCUMENTATION.md.
aiSearchRouter.post('/', (_req, res) => {
  res.status(501).json({ error: 'AI search is not implemented yet' })
})
