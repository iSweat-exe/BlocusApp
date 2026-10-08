#!/usr/bin/env bash
# Synchronise the GitHub labels with .github/labels.yml.
#
#   - creates missing labels, updates colour/description of existing ones;
#   - renames a label listed in `aliases` in place (issues and PRs keep it);
#   - never deletes anything: labels unknown to the file are only reported.
#
# Requires: gh (authenticated, `issues: write`), yq (mikefarah) and jq. Preinstalled on ubuntu runners.
# Usage: bash .github/scripts/sync-labels.sh [--dry-run]
set -euo pipefail

file="$(dirname "$0")/../labels.yml"
dry_run=false
[[ "${1:-}" == "--dry-run" ]] && dry_run=true

run() {
  if $dry_run; then echo "DRY-RUN: $*"; else "$@"; fi
}

existing="$(gh label list --limit 500 --json name --jq '.[].name')"
exists() { grep -Fxq -- "$1" <<<"$existing"; }

declared="$(yq -o=json '.' "$file" | jq -r '.[].name')"

while IFS= read -r label; do
  name="$(jq -r '.name' <<<"$label")"
  color="$(jq -r '.color' <<<"$label")"
  description="$(jq -r '.description' <<<"$label")"

  if ! exists "$name"; then
    # Rename the first alias that still exists, so the history of issues and PRs is kept.
    while IFS= read -r alias; do
      [[ -z "$alias" ]] && continue
      if exists "$alias"; then
        echo "rename  $alias -> $name"
        run gh label edit "$alias" --name "$name" --color "$color" --description "$description"
        existing="$(grep -Fxv -- "$alias" <<<"$existing" || true)"$'\n'"$name"
        break
      fi
    done < <(jq -r '.aliases[]?' <<<"$label")
  fi

  if exists "$name"; then
    echo "update  $name"
    run gh label edit "$name" --color "$color" --description "$description"
  else
    echo "create  $name"
    run gh label create "$name" --color "$color" --description "$description"
  fi
done < <(yq -o=json -I=0 '.[]' "$file")

# Report (never delete) labels that are not described in labels.yml.
while IFS= read -r name; do
  grep -Fxq -- "$name" <<<"$declared" || echo "unknown $name (not in labels.yml, left untouched)"
done <<<"$(gh label list --limit 500 --json name --jq '.[].name')"
