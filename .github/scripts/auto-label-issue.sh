#!/usr/bin/env bash
# Automatic labels of an issue, from the answers of the issue forms (.github/ISSUE_TEMPLATE/*.yml).
# Run by .github/workflows/auto-label.yml. Labels are only added, never removed: humans own the triage.
#
#   Area dropdown                -> "area: <value>"
#   Platform dropdown            -> "platform: ios|android|desktop"
#   Priority / Severity dropdown -> "priority: <value>"
#   Checklist ID                 -> "checklist: organisation" (O-xxx) or "checklist: application" (A-xxx)
#   a new issue without priority -> "status: needs-triage"
#
# Environment: GH_TOKEN, REPO (owner/name), ISSUE_NUMBER, ISSUE_BODY, EVENT_ACTION.
# ISSUE_BODY is user input: it is only ever read as data, never evaluated.
set -euo pipefail

# First answer line of a form section ("### Heading" until the next heading). Empty if absent.
section() {
  awk -v heading="### $1" '
    { sub(/\r$/, "") }
    $0 == heading { found = 1; next }
    /^### / { found = 0 }
    found && NF { print; exit }
  ' <<<"$ISSUE_BODY"
}

labels=()
has_priority=false

area="$(section "Area")"
case "$area" in
  auth | permissions | database | admin | announcements | calendar | map | posts | profile | settings | \
    health | ui | pwa | accessibility | infra | docs) labels+=("area: $area") ;;
esac

platform="$(section "Platform")"
if [[ "$platform" == *iOS* ]]; then labels+=("platform: ios"); fi
if [[ "$platform" == *Android* ]]; then labels+=("platform: android"); fi
if [[ "$platform" == *Desktop* ]]; then labels+=("platform: desktop"); fi

for heading in "Priority" "Severity"; do
  value="$(section "$heading")"
  case "$value" in
    critical* | high* | medium* | low*)
      labels+=("priority: ${value%% *}")
      has_priority=true
      ;;
  esac
done

checklist="$(section "Checklist ID")"
case "$checklist" in
  O-*) labels+=("checklist: organisation") ;;
  A-*) labels+=("checklist: application") ;;
esac

if [[ "$EVENT_ACTION" == "opened" ]] && ! $has_priority; then labels+=("status: needs-triage"); fi

if ((${#labels[@]} == 0)); then
  echo "Nothing to add."
  exit 0
fi

args=()
for label in "${labels[@]}"; do args+=(--add-label "$label"); done
echo "add: ${labels[*]}"
gh issue edit "$ISSUE_NUMBER" --repo "$REPO" "${args[@]}"
