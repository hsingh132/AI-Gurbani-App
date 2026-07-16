# Gurbani Database

`gurbani-database.sqlite.gz` is a gzip-compressed SQLite database containing the core Gurbani
and Panthic texts this app is built around. It's stored locally so the app can run fully
offline, with no dependency on any live API.

## Source

- Package: [`@shabados/database`](https://www.npmjs.com/package/@shabados/database) (Shabad OS)
- Version: **4.8.7** (last stable release before the in-progress v5 schema rewrite on the
  `main` branch of [`shabados/database`](https://github.com/shabados/database) — v5 is not
  yet release-ready, so this app pins to 4.8.7)
- Retrieved from the npm tarball's prebuilt `build/database.sqlite`, no build step required
- Uncompressed size: 158,707,712 bytes (~151 MiB) — SHA-256:
  `d8e071347bd5485cc6aa2533c1f51347a16ed1724b4d8abaa4939520257074c2`
- Compressed size: ~64.7 MB (kept under GitHub's 100MB per-file push limit without needing
  Git LFS)

To use it, decompress first:

```bash
./scripts/decompress-db.sh
# -> data/gurbani-database.sqlite
```

The decompressed `.sqlite` file is gitignored — only the `.gz` is tracked in git (the
uncompressed file is 158.7 MB, over GitHub's 100MB hard push limit). Re-run the script any
time after cloning; it's a couple seconds.

## License

- Code/schema/database generation: MIT (Shabad OS Organization and Contributors)
- Gurbani and Panthic text itself: public domain (work of factual compilation)

## Texts included (`sources` table)

| id | Source (English) | Source (Gurmukhi) | Length |
|----|-------------------|--------------------|--------|
| 1  | Sri Guru Granth Sahib Ji | SRI gurU gRMQ swihb jI | 1430 Ang |
| 2  | Sri Dasam Granth | SRI dsm gRMQ | 1428 Panna |
| 3  | Vaaran Bhai Gurdas Ji | vwrW BweI gurdws jI | 41 Vaar |
| 4  | Kabit Savaiye Bhai Gurdas Ji | kibq svXy BweI gurdws jI | 675 Kabit |
| 5  | Ghazals Bhai Nand Lal Ji | ZzlW BweI nµd lwl jI | 65 Ghazal |
| 6  | Zindagi Nama Bhai Nand Lal Ji | izMdgI nwmw BweI nµd lwl jI | 1 Panna |
| 7  | Ganj Nama Bhai Nand Lal Ji | gMj nwmw BweI nµd lwl jI | 10 Patishahi |
| 8  | Jot Bigas Bhai Nand Lal Ji | joiq ibgws BweI nµd lwl jI | 2 Panna |
| 9  | Ardaas | Ardws | 1 Panna |
| 10 | Rehitname | rihqnwmy | 10 Rehitnama |
| 11 | Sarabloh Granth | srbloh gRMQ | 4 Shabad |
| 12 | Uggardanti | augRdMqI | 6 Chand |

This covers everything originally scoped — Sri Guru Granth Sahib Ji, Dasam Granth, Bhai Gurdas
Ji's Vaaran, and Bhai Nand Lal's Baani (split across 4 separate works: Ghazals, Zindagi Nama,
Ganj Nama, Jot Bigas) — plus several extras (Ardaas, Rehitname, Sarabloh Granth, Uggardanti).

## Schema (tables)

- `sources` — the 12 compositions above
- `writers` — authors (Guru Nanak Dev Ji, Bhai Gurdas Ji, Bhai Nand Lal Ji, etc.)
- `sections` / `subsections` — structural groupings (e.g. raag)
- `shabads` — groups of lines (id, source_id, writer_id, section_id, subsection_id, sttm_id, order_id)
- `lines` — the actual text unit (id, shabad_id, source_page, source_line, gurmukhi,
  pronunciation, first_letters, vishraam_first_letters, type_id, order_id)
- `line_types` — line classification (e.g. sirlekh, sortha, etc.)
- `translations` — per-line translations (line_id, translation_source_id, translation)
- `translation_sources` — which translator/edition/language a translation came from
- `transliterations` — per-line transliteration (line_id, language_id, transliteration)
- `languages` — language reference table
- `banis` / `bani_lines` — named prayer compilations (e.g. Nitnem banis) and their line ordering

`source_page` + `source_line` map to the traditional Ang/Panna/Vaar/Kabit/Ghazal + line
reference for each source (see the `page_name_english` column in `sources`).

## Not yet covered

BaniDB (Khalis Foundation) was checked first but only offers a live REST API
(`KhalisFoundation/banidb-api`) — no downloadable dataset — so it wasn't used as the data
source for this offline-first app.
