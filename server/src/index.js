import cors from 'cors'
import express from 'express'
import { aiSearchRouter } from './routes/aiSearch.js'
import { favoritesRouter } from './routes/favorites.js'
import { shabadsRouter } from './routes/shabads.js'
import { topicsRouter } from './routes/topics.js'

const app = express()
const PORT = process.env.PORT ?? 3001

app.use(cors())
app.use(express.json())

app.get('/api/health', (_req, res) => res.json({ ok: true }))

app.use('/api/shabads', shabadsRouter)
app.use('/api/favorites', favoritesRouter)
app.use('/api/topics', topicsRouter)
app.use('/api/ai-search', aiSearchRouter)

app.listen(PORT, () => {
  console.log(`Gurbani API listening on http://localhost:${PORT}`)
})
