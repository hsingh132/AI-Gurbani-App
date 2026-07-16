#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

gunzip -k -f data/gurbani-database.sqlite.gz

echo "Decompressed to data/gurbani-database.sqlite"
