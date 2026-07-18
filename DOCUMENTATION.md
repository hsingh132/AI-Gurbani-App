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
- An AI search mode that answers questions like "find me a shabad about patience" by searching
  the meaning of shabads, not just literal text matches (built and fully live)

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
  embeddings.sqlite            gitignored — created by server/scripts/build-embeddings.js,
                                holds one vector per line for AI search
  README.md                    data source, license, schema details

/scripts
  decompress-db.sh             gunzips data/gurbani-database.sqlite.gz
  search_cli.py                stdlib-only Python search CLI (no Node/npm needed --
                                works in Pyto on iPad/iPhone, decompresses the db itself)

/server                        Node + Express API (better-sqlite3, no build step)
  .env                          gitignored — holds VOYAGE_API_KEY, loaded via
                                `node --env-file=.env` in the dev/start/build-embeddings scripts
  src/db.js                    both database connections: read-only gurbaniDb, and
                                userDb (favorites/topics tables, created on first run)
  src/embeddingsDb.js          the AI-search vector store: opens/creates
                                data/embeddings.sqlite (one line_embeddings table)
  src/voyage.js                Voyage AI embeddings client (embedDocuments / embedQuery),
                                model + dimension + API URL all overridable via env vars
  src/semanticSearch.js        loads all line vectors into memory once, brute-force
                                cosine-similarity scan per query, rolls results up to
                                shabad IDs by best-matching line
  scripts/build-embeddings.js  one-time (re-)build: embeds every line's English
                                translation via Voyage, populates embeddings.sqlite --
                                run with `npm run build-embeddings`
  src/index.js                 entry point + every route (search, shabad detail,
                                favorites, topics, AI search), all in one file

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

**Search results show one line, not the whole shabad.** All three search modes (text,
first-letters, AI) return one matching line per shabad -- `SearchResultRow` renders just that
line, clickable. Clicking it fetches the full shabad via `GET /api/shabads/:id` and switches to
a detail view (`openShabad` + `highlightLineId` state) showing every line, with the one that
matched visually highlighted (`.lines li.highlighted`, `--highlight-bg` in `index.css`). A "←
Back to results" link returns to the compact list without re-searching. Favorites/topics
browsing is unaffected -- those still render full multi-line `ShabadCard`s directly, since
there's no single "matching line" concept for a favorited/tagged shabad.

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
| GET | `/api/shabads/search?q=&mode=text\|first-letters` | search, one matching `line` per shabad (not the full shabad) |
| GET | `/api/shabads/:id` | one shabad, every line, with English translations |
| GET | `/api/favorites` | list favorited shabad IDs |
| POST | `/api/favorites` | body `{ shabadId }` |
| DELETE | `/api/favorites/:shabadId` | remove a favorite |
| GET | `/api/topics` | list topics |
| POST | `/api/topics` | body `{ name }` |
| DELETE | `/api/topics/:id` | delete a topic (its `topic_shabads` tags cascade-delete too) |
| GET | `/api/topics/:id/shabads` | shabad IDs in a topic |
| POST | `/api/topics/:id/shabads` | body `{ shabadId }`, tag a shabad into a topic |
| DELETE | `/api/topics/:id/shabads/:shabadId` | untag |
| POST | `/api/ai-search` | body `{ q }`, natural-language semantic search -- see below |

## AI agent — built

A **search feature, not a chatbot** — natural-language queries in ("find me a shabad that
answers this question about patience"), a ranked list of real shabads out. No chat UI, no LLM
writing/explaining results, so nothing can be hallucinated — it's pure retrieval (RAG:
retrieval-augmented generation, not fine-tuning).

How it works, matching the finalized plan:

1. **Every *line* is embedded, not each shabad — 106,433 vectors, not 12,730.** A shabad is a
   multi-line poem (2-10 lines); embedding only the whole thing as one blended vector would
   dilute a single relevant line's signal. Text embedded per line: its English translation. Not
   all 141,264 lines have one, though -- 34,758 have no English translation from any source at
   all (a real gap in Shabad OS's community translation coverage, confirmed by checking every
   source per line, not fixable from this app). `build-embeddings.js`'s query picks the first
   *non-empty* English source per line and skips a line entirely if none exist, rather than
   picking whichever source has the lowest ID regardless of whether it's blank -- the first cut
   of this query did the latter and crashed the real build (Voyage's API flatly rejects empty
   strings). The same non-empty-preferring fix was applied to the live `/api/shabads/:id`
   translation lookup in `server/src/index.js` for consistency, though on inspection that one
   wasn't actually exhibiting the bug in practice (lines with any real translation only ever
   have it at the lowest source ID already, so the two queries were coincidentally consistent).
2. **Provider: Voyage AI** (`server/src/voyage.js`). Model, output dimension, and even the API
   URL are all overridable via env vars (`VOYAGE_MODEL`, `VOYAGE_OUTPUT_DIMENSION`,
   `VOYAGE_API_URL`) -- the URL override is what let this get built and tested in an environment
   where `api.voyageai.com` is network-blocked, by pointing at a local mock server that mimics
   Voyage's response shape. Default model is `voyage-4-large`; if that ID turns out to be wrong
   when the real build runs, set `VOYAGE_MODEL` in `server/.env` to whatever's current at
   [docs.voyageai.com](https://docs.voyageai.com/docs/embeddings).
3. **No vector database.** `server/src/semanticSearch.js` loads every line's vector into one
   flat `Float32Array` on first use and does a brute-force cosine-similarity scan per query --
   no `sqlite-vec`, no LanceDB/Chroma. Verified working end-to-end with a mock Voyage server:
   seeded 3 real lines from 3 different real shabads with distinct keyword content, confirmed a
   "patience" query and a "fear" query each correctly ranked their matching shabad first. After
   the empty-translation fix, also ran the full corrected `build-embeddings.js` query (all
   106,433 lines) against the mock end-to-end with no errors.
4. **Results roll up to shabads.** A search finds the single best-matching *line*, looks up its
   `shabad_id`, and returns the whole shabad via the existing `getFullShabad` -- so AI search
   results render as the exact same shabad cards as regular search, just ranked by their
   strongest-matching line. Multiple matching lines in one shabad dedupe to a single card,
   keeping the best score.
5. **Client**: a third radio option ("AI search") next to Text / First letters in the search
   form, `client/src/App.jsx`. Same results list/rendering as the other two modes.

**Status: fully live.** The real `npm run build-embeddings` run against the live Voyage API
completed -- all 106,433 lines embedded, `data/embeddings.sqlite` populated. `/api/ai-search`
works for real now, not just against the mock server used to build/verify the code.

**Voyage rate limits without a payment method on file**: 3 requests/minute -- `voyage.js`
retries on 429 with real backoff (up to 15 retries, honors a `Retry-After` header, exponential
otherwise) so it won't crash, but at that pace the full run takes **roughly 6 hours**. Adding a
payment method at [dashboard.voyageai.com](https://dashboard.voyageai.com) unlocks standard
rate limits and the run finishes in minutes instead -- still free, the 200M free-token
allowance applies either way and this corpus only needs ~3.1M. `build-embeddings.js` is
resumable either way: it skips line IDs already present in `embeddings.sqlite`, so an
interrupted run (laptop sleep, closed terminal, whatever) can just be rerun rather than
restarting from zero. Verified: seeded a partial run, killed it mid-flight, reran, confirmed it
picked up exactly where it left off instead of redoing finished work.

**Rebuild steps (e.g. on a fresh clone/machine)** -- `embeddings.sqlite` is gitignored like the
other local databases, so this needs to be redone anywhere the repo gets cloned fresh:

```bash
# server/.env (gitignored) needs:
VOYAGE_API_KEY=pa-...

cd server
npm install          # picks up nothing new -- voyage.js uses native fetch, no new deps
npm run build-embeddings   # one-time, costs well under $1; minutes with a payment method
                            # on file at Voyage, ~6 hours without one (safe to interrupt/rerun)
```

**Online-enhanced, not offline-first, and that's fine here.** Keyword/first-letter search
always works with no internet; AI search needs Voyage's API both to build the index once and to
embed each query afterward. Deliberate tradeoff, given the quality gap between local and API
embedding models for matching vague natural-language topics to centuries-old text.

### Typing Gurmukhi, case-sensitive keying, and deleting topics

- **Live Gurmukhi preview while typing.** The `gurmukhi` column (and therefore Text/First
  letters search) is keyed in the same ASCII "GurbaniAkhar" scheme described above -- typing is
  meant to be done directly in that scheme (e.g. `siq nwmu`), not English. Rather than convert
  the input box's own value in place (cursor position gets unreliable once `toUnicode()` starts
  reordering matras mid-word), the client shows a live read-only preview line right under the
  input (`.gurmukhi-preview` in `client/src/App.jsx`/`index.css`) running the same
  `gurmukhi-utils` `toUnicode()` conversion used for display elsewhere, so you can see the real
  Gurmukhi your keystrokes produce before hitting search.
- **Fixed: search was case-insensitive, which broke the aspirated/unaspirated letter
  distinction.** In this ASCII scheme, case is meaningful -- e.g. lowercase `b` is ਬ (baba),
  uppercase `B` is ਭ (bhabha) -- but SQLite's `LIKE` folds ASCII case by default, so searching
  `B` was also matching every `b`. Fixed with `PRAGMA case_sensitive_like = ON` on `gurbaniDb`
  in `server/src/db.js`. Verified: searching `B` now only returns ਭ-containing lines.
- **Delete topics.** `DELETE /api/topics/:id`, with a "Delete topic" button next to the heading
  when viewing a topic in the client. `topic_shabads` rows for that topic delete automatically
  (`ON DELETE CASCADE`, already set up in the schema).

## Todos

1. ~~Gurmukhi rendering~~ done
2. ~~Favorites/Topics browsing UI~~ done
3. ~~Vishraam (pause marker) coloring~~ done
4. ~~AI search (RAG layer)~~ **fully done** -- real build completed against the live Voyage API,
   all 106,433 lines embedded
5. Visual overhaul -- last, not started

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
- ~~AI search~~ **Done.** Fully working, real embeddings built against the live Voyage API.
