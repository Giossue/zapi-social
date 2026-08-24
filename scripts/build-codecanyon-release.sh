#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
version="${1:-}"

if [[ ! "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+([.-][0-9A-Za-z.-]+)?$ ]]; then
  printf 'Usage: bun run release:codecanyon -- 1.0.0\n' >&2
  exit 1
fi

for command_name in git tar zip sha256sum; do
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
(
  cd "$temporary_root"
  find "$package_name" -type f -print | LC_ALL=C sort | zip -X -q "$archive_path" -@
)
(
  cd "$release_root"
  sha256sum "$archive_name" > "$archive_name.sha256"
)

printf 'Created %s\nCreated %s\n' "$archive_path" "$checksum_path"
