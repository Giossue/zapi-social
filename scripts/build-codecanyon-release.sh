#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
version="${1:-}"

if [[ ! "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+([.-][0-9A-Za-z.-]+)?$ ]]; then
  printf 'Usage: bun run release:codecanyon -- 1.0.0\n' >&2
  exit 1
fi

for command_name in git tar python3 sha256sum; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    printf 'Missing required command: %s\n' "$command_name" >&2
    exit 1
  fi
done

release_root="$project_root/release"
archive_name="zapi-social-$version.zip"
archive_path="$release_root/$archive_name"
checksum_path="$archive_path.sha256"
temporary_root="$(mktemp -d)"
package_name="zapi-social-$version"
package_root="$temporary_root/$package_name"

case "$temporary_root" in
  /tmp/*) ;;
  *)
    printf 'Unexpected temporary path: %s\n' "$temporary_root" >&2
    exit 1
    ;;
esac

cleanup() {
  rm -rf -- "$temporary_root"
}
trap cleanup EXIT

mkdir -p "$release_root" "$package_root"
git -C "$project_root" archive HEAD | tar -x -C "$package_root"

rm -rf -- \
  "$package_root/.agents" \
  "$package_root/.claude" \
  "$package_root/apps/.github" \
  "$package_root/apps/api/.data" \
  "$package_root/docs/conocimiento" \
  "$package_root/docs/planes" \
  "$package_root/docs/reglas"
rm -f -- \
  "$package_root/AGENTS.md" \
  "$package_root/CLAUDE.md" \
  "$package_root/docs/README.md"
find "$package_root" -type f -name 'CLAUDE.md' -delete
cp "$package_root/documentation/README.md" "$package_root/README.md"

if find "$package_root" -type f -name '.env' -print -quit | grep -q .; then
  printf 'Release aborted: a real .env file was included.\n' >&2
  exit 1
fi

commit_id="$(git -C "$project_root" rev-parse HEAD)"
source_epoch="${SOURCE_DATE_EPOCH:-$(git -C "$project_root" show -s --format=%ct HEAD)}"
build_date="$(date -u -d "@$source_epoch" +%Y-%m-%dT%H:%M:%SZ)"
printf 'Zapi Social %s\nSource commit: %s\nRelease date: %s\n' \
  "$version" "$commit_id" "$build_date" > "$package_root/RELEASE.txt"

find "$package_root" -exec touch -h -d "@$source_epoch" {} +
rm -f -- "$archive_path" "$checksum_path"
PACKAGE_ROOT="$package_root" \
ARCHIVE_PATH="$archive_path" \
SOURCE_EPOCH="$source_epoch" \
python3 - <<'PY'
import os
import time
import zipfile
from pathlib import Path

root = Path(os.environ["PACKAGE_ROOT"])
archive = Path(os.environ["ARCHIVE_PATH"])
epoch = max(int(os.environ["SOURCE_EPOCH"]), 315532800)
timestamp = time.gmtime(epoch)[:6]

with zipfile.ZipFile(
    archive, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9
) as output:
    for path in sorted(item for item in root.rglob("*") if item.is_file()):
        relative = path.relative_to(root.parent).as_posix()
        info = zipfile.ZipInfo(relative, timestamp)
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = (path.stat().st_mode & 0xFFFF) << 16
        output.writestr(info, path.read_bytes())
PY
(
  cd "$release_root"
  sha256sum "$archive_name" > "$archive_name.sha256"
)

printf 'Created %s\nCreated %s\n' "$archive_path" "$checksum_path"
