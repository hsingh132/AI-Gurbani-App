#!/usr/bin/env python3
"""
Standalone, dependency-free CLI to search the Gurbani database.

Uses only the Python standard library (sqlite3, gzip) -- no pip installs
needed, so it works anywhere Python 3 runs, including Pyto on iPad/iPhone,
without the Node.js server/client in this repo.

Usage:
    python3 scripts/search_cli.py "nwnk" --mode text
    python3 scripts/search_cli.py "snkpnn" --mode first-letters

Or run with no arguments and answer the prompts.
"""
import argparse
import gzip
import shutil
import sqlite3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DB_GZ = ROOT / "data" / "gurbani-database.sqlite.gz"
DB_PATH = ROOT / "data" / "gurbani-database.sqlite"


def ensure_db():
    if DB_PATH.exists():
        return
    if not DB_GZ.exists():
        sys.exit(f"Missing {DB_GZ}. Did you clone the full repo?")
    print("Decompressing database (first run only, a few seconds)...")
    with gzip.open(DB_GZ, "rb") as src, open(DB_PATH, "wb") as dst:
        shutil.copyfileobj(src, dst)


def search(conn, query, mode, limit=15):
    if mode == "first-letters":
        sql = "SELECT DISTINCT shabad_id FROM lines WHERE first_letters LIKE ? LIMIT ?"
        params = (f"{query}%", limit)
    else:
        sql = "SELECT DISTINCT shabad_id FROM lines WHERE gurmukhi LIKE ? LIMIT ?"
        params = (f"%{query}%", limit)
    shabad_ids = [row[0] for row in conn.execute(sql, params)]

    if not shabad_ids:
        print("No results.")
        return

    for shabad_id in shabad_ids:
        source_name, writer_name, section_name = conn.execute(
            """
            SELECT src.name_english, w.name_english, sec.name_english
            FROM shabads s
            JOIN sources src ON src.id = s.source_id
            LEFT JOIN writers w ON w.id = s.writer_id
            LEFT JOIN sections sec ON sec.id = s.section_id
            WHERE s.id = ?
            """,
            (shabad_id,),
        ).fetchone()
        print(f"\n=== {source_name} -- {writer_name or 'Unknown'} -- {section_name} ===")

        lines = conn.execute(
            "SELECT id, gurmukhi FROM lines WHERE shabad_id = ? ORDER BY order_id",
            (shabad_id,),
        ).fetchall()
        for line_id, gurmukhi in lines:
            translation = conn.execute(
                """
                SELECT t.translation FROM translations t
                JOIN translation_sources ts ON ts.id = t.translation_source_id
                WHERE t.line_id = ? AND ts.language_id = 1
                LIMIT 1
                """,
                (line_id,),
            ).fetchone()
            print(gurmukhi)
            if translation:
                print(f"  {translation[0]}")


def main():
    parser = argparse.ArgumentParser(description="Search the offline Gurbani database")
    parser.add_argument("query", nargs="?", help="Search text")
    parser.add_argument("--mode", choices=["text", "first-letters"], default=None)
    args = parser.parse_args()

    query = args.query or input("Search query: ").strip()
    mode = args.mode
    if mode is None:
        mode_input = input("Mode [text/first-letters] (default text): ").strip()
        mode = mode_input or "text"

    ensure_db()
    conn = sqlite3.connect(DB_PATH)
    try:
        search(conn, query, mode)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
