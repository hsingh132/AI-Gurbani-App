# AI Gurbani App — Documentation

Personal, offline-first Gurbani search app. Not commercial. Built to have full control over
the database and features, unlike existing apps (e.g. SikhiToTheMax).

This file is the continuation point for picking this project back up in a new chat.

## Goal

A search app over Sri Guru Granth Sahib Ji, Sri Dasam Granth, Vaaran Bhai Gurdas Ji, and Bhai
Nand Lal's Baani, with:

- Full-text and first-letter-of-each-word search (e.g. searching `snkpnn` for the Mool Mantar)
- A favorites feature (bookmark individual shabads)
- A topics feature (tag/group shabads into custom topics, many-to-many)
- Eventually, an AI agent that can answer questions like "find me a shabad about patience" by
  searching the meaning of shabads, not just literal text matches

## Data source decision

- **BaniDB (Khalis Foundation)** was checked first (`KhalisFoundation/banidb-api` on GitHub).
  It's **API-only** — no downloadable dataset, no release assets, just a Dockerized REST
  service. Ruled out for an offline-first app.
- **Shabad OS (`@shabados/database`)** is what this app uses. It ships a prebuilt SQLite file
  directly in the npm package, MIT-licensed code, gurbani text itself public domain.
  - Note: the `main` branch of `shabados/database` on GitHub is an **in-progress v5 rewrite**
    with a different schema (not release-ready). This app pins to **v4.8.7**, the last stable
    published version, which has the classic schema and ships `build/database.sqlite` in the
    npm tarball with no build step needed.

See `data/README.md` for full details on the database: license, the 12 included
sources/texts, and the table schema.

## Repo layout

```
/data
  gurbani-database.sqlite.gz   tracked in git — the reference database, compressed
  gurbani-database.sqlite      gitignored — regenerate with scripts/decompress-db.sh
  user-data.sqlite             gitignored — created at runtime, holds favorites/topics
  README.md                    data source, license, schema details

/scripts
  decompress-db.sh             gunzips data/gurbani-database.sqlite.gz
  search_cli.py                stdlib-only Python search CLI (no Node/npm needed --
                                works in Pyto on iPad/iPhone, decompresses the db itself)

/server                        Node + Express API (better-sqlite3, no build step)
  src/db.js                    both database connections: read-only gurbaniDb, and
                                userDb (favorites/topics tables, created on first run)
  src/index.js                 entry point + every route (search, shabad detail,
                                favorites, topics, ai-search stub), all in one file

/client                        React + Vite frontend
  src/App.jsx                  everything: the api() fetch helper, the ShabadCard
                                component, and the App component (search form,
                                view nav, favorite/topic UI)
  vite.config.js                proxies /api to http://localhost:3001 in dev
```

The client has three views, switched with the "Search results" / "★ Favorites" / topic
dropdown nav row: a search view (last search's results), a favorites view (fetches
`/api/favorites` then each shabad by id), and a topic view (same, via
`/api/topics/:id/shabads`). The favorites view stays live -- unfavoriting a card there
removes it immediately by filtering `browseResults` against `favoriteIds`, no refetch needed.

Deliberately kept flat: one file per concern (db, server, UI) rather than splitting
into many small route/component files. Re-split only if a file actually gets hard to
navigate — not preemptively.

### Why the database is committed as a `.gz`

The raw SQLite file is 158.7 MB, which is over GitHub's hard 100MB-per-file push limit — it
gets rejected outright, not just warned about. Gzipped it's ~64.7 MB, which fits. Only the
`.gz` is tracked in git; the decompressed `.sqlite` is gitignored and regenerated locally with
`./scripts/decompress-db.sh` (a couple seconds, no dependencies).

### Why favorites/topics live in a separate database

`user-data.sqlite` is kept completely separate from the reference Gurbani database so the
reference data stays pristine and swappable (e.g. if a future database version is pulled in),
and personal data (favorites, topics) isn't at risk of being overwritten alongside it.

## How to run it

```bash
# one-time setup
./scripts/decompress-db.sh
cd server && npm install
cd ../client && npm install

# two terminals
cd server && npm run dev   # http://localhost:3001
cd client && npm run dev   # http://localhost:5173 (proxies /api to the server)
```

Verified working end-to-end (search, favorite toggle, topic creation) via a scripted browser
smoke test during scaffolding.

### Running without Node (e.g. from an iPad in Pyto)

The server/client scaffold needs Node.js/npm, which isn't available in Python-only mobile
environments like Pyto. For those, `scripts/search_cli.py` searches the database directly
using only `sqlite3` and `gzip` from the Python standard library -- no pip installs, no Node:

```bash
python3 scripts/search_cli.py "nwnk" --mode text
python3 scripts/search_cli.py "jsgpq" --mode first-letters
# or run with no arguments and answer the prompts
```

It decompresses `data/gurbani-database.sqlite.gz` itself on first run.

## API (current)

| Method | Path | What |
|---|---|---|
| GET | `/api/shabads/search?q=&mode=text\|first-letters` | search, returns full shabads |
| GET | `/api/shabads/:id` | one shabad with lines + English translations |
| GET | `/api/favorites` | list favorited shabad IDs |
| POST | `/api/favorites` | body `{ shabadId }` |
| DELETE | `/api/favorites/:shabadId` | remove a favorite |
| GET | `/api/topics` | list topics |
| POST | `/api/topics` | body `{ name }` |
| GET | `/api/topics/:id/shabads` | shabad IDs in a topic |
| POST | `/api/topics/:id/shabads` | body `{ shabadId }`, tag a shabad into a topic |
| DELETE | `/api/topics/:id/shabads/:shabadId` | untag |
| POST | `/api/ai-search` | **not implemented**, returns 501 — see below |

## AI agent — plan, not yet built

"Trained on the entire database" isn't quite the right frame — fine-tuning a model on this data
would be expensive, unnecessary, and go stale. The actual plan is **RAG** (retrieval-augmented
generation):

1. Embed each shabad's English translation (or a per-shabad summary) into a vector index —
   candidates: `sqlite-vec` (keeps everything in one SQLite file, stays offline-friendly) or a
   dedicated local vector store (LanceDB, Chroma).
2. On a query like "find me a shabad about patience," embed the query and do a similarity
   search against that index to retrieve real matching shabad IDs — grounded in actual rows,
   not hallucinated.
3. Optionally have an LLM explain/rank the retrieved results in natural language.

**Known tradeoff to decide later:** doing this fully offline means a local embedding model,
which is noticeably weaker than an API-based one (e.g. Claude). Recommended approach is to
treat AI search as an *online-enhanced* layer on top of the offline-first core — keyword and
first-letter search always work with no internet; AI search calls out when a connection is
available. This needs an explicit decision on API keys/costs before building, so it wasn't
started as part of this scaffold.

## Todos

1. ~~Gurmukhi rendering~~ done
2. ~~Favorites/Topics browsing UI~~ done
3. AI search (RAG layer) -- needs a decision on local-embeddings-vs-API-based first
4. Visual overhaul -- last

## Known limitations / next steps

- ~~Gurmukhi text encoding~~ **Fixed.** The `gurmukhi` column stores text in an ASCII
  "GurbaniAkhar"-style font encoding (e.g. `siq nwmu`), not Unicode Gurmukhi script. The server
  now converts it with [`gurmukhi-utils`](https://github.com/shabados/gurmukhi-utils)'s
  `toUnicode()` before sending it in API responses (see `getFullShabad` in
  `server/src/index.js`), so the client always receives real Gurmukhi script (ਸਤਿ ਨਾਮੁ). Search
  still matches against the raw ASCII column, which is unaffected.
- **Search is `LIKE`-based**, not indexed full-text search. Fine for a scaffold; consider
  SQLite FTS5 if search feels slow once real usage starts.
- **No auth / single-user assumption** — favorites and topics aren't scoped to a user account.
  Fine for a personal app; would need addressing if this ever becomes multi-user.
- **Translations are English-only** in the current API (`language_id = 1`); the database has
  Punjabi, Spanish, Hindi, and Urdu translation sources too (see `data/README.md`).
- **AI search**: see above, fully unbuilt.
