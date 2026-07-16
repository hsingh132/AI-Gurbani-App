import Database from 'better-sqlite3'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DB_PATH = path.resolve(__dirname, '../../../data/gurbani-database.sqlite')

if (!existsSync(DB_PATH)) {
  throw new Error(
    `Gurbani database not found at ${DB_PATH}. Run ./scripts/decompress-db.sh from the repo root first.`
  )
}

export const gurbaniDb = new Database(DB_PATH, { readonly: true })
