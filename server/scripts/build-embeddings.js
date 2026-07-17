// One-time (re-)build of the AI search index: embeds every line's English
// translation via Voyage AI and stores the vectors in data/embeddings.sqlite.
// Costs real money (a fraction of a dollar for this corpus) and needs
// network access to api.voyageai.com. Run with: npm run build-embeddings

import { gurbaniDb } from '../src/db.js'
import { openEmbeddingsDb } from '../src/embeddingsDb.js'
import { EMBEDDING_DIMENSION, EMBEDDING_MODEL, embedDocuments } from '../src/voyage.js'

const BATCH_SIZE = 100

async function main() {
  const rows = gurbaniDb
    .prepare(
      `
      SELECT line_id, shabad_id, translation FROM (
        SELECT l.id AS line_id, l.shabad_id, t.translation,
          ROW_NUMBER() OVER (PARTITION BY l.id ORDER BY t.translation_source_id) AS rn
        FROM lines l
        JOIN translations t ON t.line_id = l.id
        JOIN translation_sources ts ON ts.id = t.translation_source_id
        WHERE ts.language_id = 1
      )
      WHERE rn = 1
      `
    )
    .all()

  console.log(`Embedding ${rows.length} lines with ${EMBEDDING_MODEL} (dim ${EMBEDDING_DIMENSION})...`)

  const embeddingsDb = openEmbeddingsDb()
  const insert = embeddingsDb.prepare(
    'INSERT OR REPLACE INTO line_embeddings (line_id, shabad_id, model, dim, embedding) VALUES (?, ?, ?, ?, ?)'
  )
  const insertBatch = embeddingsDb.transaction((batch, vectors) => {
    batch.forEach((row, i) => {
      const blob = Buffer.from(new Float32Array(vectors[i]).buffer)
      insert.run(row.line_id, row.shabad_id, EMBEDDING_MODEL, EMBEDDING_DIMENSION, blob)
    })
  })

  let done = 0
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE)
    const vectors = await embedDocuments(batch.map((row) => row.translation))
    insertBatch(batch, vectors)
    done += batch.length
    process.stdout.write(`\r${done}/${rows.length}`)
  }

  console.log('\nDone.')
  embeddingsDb.close()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
