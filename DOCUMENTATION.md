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

### Vishraams (pause markers)

The converted Gurmukhi text still has vishraam markers glued to the end of certain words:
`.` (light pause), `,` (medium), `;` (heavy) -- straight from the source data, not added by
the Unicode conversion. `GurmukhiLine` in `client/src/App.jsx` splits each line on spaces and
strips a trailing marker off any word that has one (all three types), but only colors two of
them: `,` gets the `vishraam-light` class (sky blue), `;` gets `vishraam-heavy` (orange). `.`
is stripped like the others but left plain -- no color assigned. Colors live in `index.css`
as `--vishraam-light` / `--vishraam-heavy`.

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

## AI agent — finalized plan, not yet built

This is a **search feature, not a chatbot** — natural-language queries in ("find me a shabad
that answers this question about patience"), a ranked list of real shabads out. No chat UI, no
LLM writing/explaining results, so nothing can be hallucinated — it's pure retrieval.
"Trained on the entire database" isn't the right frame either — fine-tuning a model on this
data would be expensive, unnecessary, and go stale. The actual mechanism is **RAG**
(retrieval-augmented generation), specifically:

1. **Embed every *line*, not every shabad — 141,264 vectors, not 12,730.** A shabad is a
   multi-line poem (2-10 lines); embedding only the whole thing as one blended vector dilutes a
   single relevant line's signal (e.g. one line about patience in an 8-line shabad about
   something else would get lost in the average). Embedding at line granularity catches
   single-line matches. Text embedded per line: its English translation (the same text already
   served by `/api/shabads/:id`).
2. **Provider: Voyage AI**, since Claude has no embeddings endpoint and Anthropic recommends
   Voyage. Requires a Voyage API key from the user before this can be built — not needed for
   anything else in the app, so building was deferred until the key is available.
3. **Cost is a non-issue.** Measured against the actual database: all English translations
   total ~12.5M characters / **~3.1M tokens**. One-time cost to embed the *entire* corpus, even
   at Voyage's priciest tier (`voyage-3-large`/`voyage-4-large`, ~$0.18/1M tokens), is under
   $0.60 -- likely fully covered by Voyage's introductory free-token allowance. Per-query cost
   (embedding a few words of search text) is negligible.
4. **No vector database needed.** 141K vectors is small enough to store as blobs in a table in
   the existing SQLite (or a new local file) and do a plain in-memory cosine-similarity scan in
   Node at query time -- no `sqlite-vec`, no LanceDB/Chroma. Verify actual scan latency once
   built; there's headroom to add an index later if it's ever slow.
5. **Results roll up to shabads.** A search finds the single best-matching *line*, looks up its
   `shabad_id`, and returns the whole shabad (via the existing `getFullShabad`) -- so results
   still render as the normal shabad cards, just ranked by their strongest-matching line instead
   of a blurred per-shabad average. Multiple matching lines in the same shabad dedupe to one
   card, keeping the best score.

**Online-enhanced, not offline-first, and that's fine here.** Keyword/first-letter search
always works with no internet (already built); AI search is a layer on top that needs Voyage's
API both to build the index once and to embed each query. This was an explicit, deliberate
tradeoff given the quality gap between local and API embedding models for matching vague
natural-language topics to centuries-old text.

## Todos

1. ~~Gurmukhi rendering~~ done
2. ~~Favorites/Topics browsing UI~~ done
3. ~~Vishraam (pause marker) coloring~~ done
4. AI search (RAG layer) -- plan finalized (see above), blocked on getting a Voyage AI API key
   before implementation starts
5. Visual overhaul -- last

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
