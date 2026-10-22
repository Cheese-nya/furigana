#!/usr/bin/env bash
# Builds the static web bundle (`out/`) that the native shells and the website serve.
# The Pixiv API route needs a Node server, which a static export cannot contain, so it
# is moved out of the way for the duration of the build and always restored.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

API_BACKUP_DIR=""
restore_api_routes() {
  if [[ -n "$API_BACKUP_DIR" && -d "$API_BACKUP_DIR/api" && ! -d "$ROOT_DIR/app/api" ]]; then
    mv "$API_BACKUP_DIR/api" "$ROOT_DIR/app/api"
    rmdir "$API_BACKUP_DIR" 2>/dev/null || true
  fi
}
trap restore_api_routes EXIT

rm -rf "$ROOT_DIR/out"
if [[ -d "$ROOT_DIR/app/api" ]]; then
  API_BACKUP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/uku-web-api-backup.XXXXXX")"
  mv "$ROOT_DIR/app/api" "$API_BACKUP_DIR/api"
fi

NEXT_EXPORT=true npx next build

if [[ ! -f "$ROOT_DIR/out/index.html" ]]; then
  echo "ERROR: static export out/index.html was not generated." >&2
  exit 1
fi
echo "==> Static bundle ready in out/"
