import Database from 'better-sqlite3'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const DATA_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../data')
export const EMBEDDINGS_DB_PATH = path.join(DATA_DIR, 'embeddings.sqlite')

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS line_embeddings (
    line_id TEXT PRIMARY KEY,
    shabad_id TEXT NOT NULL,
    model TEXT NOT NULL,
    dim INTEGER NOT NULL,
    embedding BLOB NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_line_embeddings_shabad ON line_embeddings(shabad_id);
`

export function openEmbeddingsDb({ readonly = false } = {}) {
  const db = new Database(EMBEDDINGS_DB_PATH, { readonly })
  if (!readonly) db.exec(SCHEMA)
  return db
}
