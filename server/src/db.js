import Database from 'better-sqlite3'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const DATA_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../data')

const GURBANI_DB_PATH = path.join(DATA_DIR, 'gurbani-database.sqlite')
if (!existsSync(GURBANI_DB_PATH)) {
  throw new Error(
    `Gurbani database not found at ${GURBANI_DB_PATH}. Run ./scripts/decompress-db.sh from the repo root first.`
  )
}

// Reference database: the Gurbani text itself. Read-only, never modified.
export const gurbaniDb = new Database(GURBANI_DB_PATH, { readonly: true })
// SQLite's LIKE is case-insensitive by default, which breaks Gurmukhi ASCII
// search: e.g. "B" (ਭ, bhabha) would also match "b" (ਬ, baba).
gurbaniDb.pragma('case_sensitive_like = ON')

// Personal data: favorites and topics. Kept separate from the reference
// database so that can stay pristine/swappable.
export const userDb = new Database(path.join(DATA_DIR, 'user-data.sqlite'))
userDb.pragma('journal_mode = WAL')
userDb.pragma('foreign_keys = ON')
userDb.exec(`
  CREATE TABLE IF NOT EXISTS favorites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shabad_id TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS topics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS topic_shabads (
    topic_id INTEGER NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
    shabad_id TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (topic_id, shabad_id)
  );
`)
