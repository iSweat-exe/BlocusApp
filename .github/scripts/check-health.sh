#!/usr/bin/env bash
# Asks the public health check of the application whether it is up, and writes the verdict to $GITHUB_OUTPUT:
#   down=true|false
#   reason=<one line, no secret>
#
# "ok" and "degraded" (HTTP 200) count as up: a slow service is not an outage. Anything else counts as down: an
# HTTP error, a body without a status, or no answer after the retries. Three tries, 20 s apart, so that one lost
# packet does not open an incident.
#
# Usage: check-health.sh <base URL of the production site, https, no trailing path>
set -u

base="${1:-}"
out="${GITHUB_OUTPUT:-/dev/stdout}"

# https only, plus localhost for the tests of this script.
if [[ ! "$base" =~ ^(https://[A-Za-z0-9.-]+|http://localhost)(:[0-9]+)?/?$ ]]; then
  echo "PRODUCTION_URL must be an https origin (got: '${base}')" >&2
  echo "down=false" >>"$out"
  echo "reason=not configured" >>"$out"
  exit 0
fi
url="${base%/}/api/health"

reason="no answer"
for attempt in 1 2 3; do
  body="$(mktemp)"
  code="$(curl --silent --show-error --max-time 15 --output "$body" --write-out '%{http_code}' "$url" 2>/dev/null || true)"
  if [[ "$code" == "200" ]] && grep -Eq '"status"[[:space:]]*:[[:space:]]*"(ok|degraded)"' "$body"; then
    status="$(grep -Eo '"status"[[:space:]]*:[[:space:]]*"[a-z]+"' "$body" | grep -Eo '"[a-z]+"$' | tr -d '"')"
    echo "attempt $attempt: up ($status)"
    echo "down=false" >>"$out"
    echo "reason=$status" >>"$out"
    rm -f "$body"
    exit 0
  fi
  reason="HTTP ${code:-000}"
  echo "attempt $attempt: down ($reason)"
  rm -f "$body"
  [[ "$attempt" -lt 3 ]] && sleep 20
done

echo "down=true" >>"$out"
echo "reason=$reason" >>"$out"
exit 0
