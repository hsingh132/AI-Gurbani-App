import { existsSync } from 'node:fs'
import { EMBEDDINGS_DB_PATH, openEmbeddingsDb } from './embeddingsDb.js'
import { embedQuery } from './voyage.js'

// Loaded once, kept in memory: one flat Float32Array of all line vectors
// (no vector DB needed at this corpus size -- ~141k lines).
let cache = null

function loadEmbeddings() {
  if (cache) return cache
  if (!existsSync(EMBEDDINGS_DB_PATH)) return null

  const db = openEmbeddingsDb({ readonly: true })
  const rows = db.prepare('SELECT line_id, shabad_id, dim, embedding FROM line_embeddings').all()
  db.close()
  if (rows.length === 0) return null

  const dim = rows[0].dim
  const vectors = new Float32Array(rows.length * dim)
  const norms = new Float32Array(rows.length)
  const shabadIds = new Array(rows.length)

  rows.forEach((row, i) => {
    const vec = new Float32Array(row.embedding.buffer, row.embedding.byteOffset, dim)
    vectors.set(vec, i * dim)
    let normSq = 0
    for (let j = 0; j < dim; j++) normSq += vec[j] * vec[j]
    norms[i] = Math.sqrt(normSq)
    shabadIds[i] = row.shabad_id
  })

  cache = { dim, count: rows.length, vectors, norms, shabadIds }
  return cache
}

// Returns shabad IDs ranked by their single best-matching line, or null if
// the embeddings haven't been built yet (see scripts/build-embeddings.js).
export async function semanticSearch(query, topN = 20) {
  const data = loadEmbeddings()
  if (!data) return null

  const queryVec = await embedQuery(query)
  const { dim, count, vectors, norms, shabadIds } = data

  let queryNormSq = 0
  for (let j = 0; j < dim; j++) queryNormSq += queryVec[j] * queryVec[j]
  const queryNorm = Math.sqrt(queryNormSq)

  const bestPerShabad = new Map()
  for (let i = 0; i < count; i++) {
    const offset = i * dim
    let dot = 0
    for (let j = 0; j < dim; j++) dot += vectors[offset + j] * queryVec[j]
    const score = dot / (norms[i] * queryNorm)
    const shabadId = shabadIds[i]
    if (!bestPerShabad.has(shabadId) || score > bestPerShabad.get(shabadId)) {
      bestPerShabad.set(shabadId, score)
    }
  }

  return [...bestPerShabad.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([shabadId]) => shabadId)
}
