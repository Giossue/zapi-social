#!/bin/sh
set -eu

files_storage_path="${FILES_STORAGE_PATH:-/app/.data/files}"

if [ -z "$files_storage_path" ] || [ "$files_storage_path" = "/" ]; then
  echo "FILES_STORAGE_PATH must point to a dedicated directory." >&2
  exit 1
fi

mkdir -p "$files_storage_path"

if [ "$(stat -c '%U:%G' "$files_storage_path")" != "bun:bun" ]; then
  chown -R bun:bun "$files_storage_path"
fi

exec gosu bun "$@"
