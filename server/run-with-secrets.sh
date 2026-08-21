#!/bin/zsh
set -euo pipefail

script_root="${0:A:h}"
utopia_env="${UTOPIA_ENV_BIN:-$HOME/Utopia/bin/utopia-env}"

[[ -x "$utopia_env" ]] || {
  echo "ERROR: Project Utopia environment tooling is not installed." >&2
  echo "Install it from Project Utopia, then retry." >&2
  exit 1
}

exec "$utopia_env" run --file "$script_root/.env.op" -- "$@"
