#!/usr/bin/env bash
# Local load test: seeds a local Supabase with a realistic volume, builds and starts the app, runs the k6 scenario
# (200 virtual users) through Docker, and prints the database and CPU cost. See docs/load-testing.md.
#
# Usage: bash load/run-local.sh [hold-duration, default 120s]
# Needs Docker and the Supabase CLI (npx). Never targets a hosted project: everything is local.
set -u
HOLD="${1:-120s}"
PORT=3200
cd "$(dirname "$0")/.."

export SUPABASE_AUTH_EXTERNAL_DISCORD_CLIENT_ID=local-dummy SUPABASE_AUTH_EXTERNAL_DISCORD_SECRET=local-dummy
EXCLUDED=studio,imgproxy,realtime,storage-api,edge-runtime,logflare,vector,supavisor,mailpit,postgres-meta
npx supabase start -x "$EXCLUDED" >/dev/null 2>&1
npx supabase db reset >/dev/null 2>&1
eval "$(npx supabase status -o env 2>/dev/null | grep -E '^(API_URL|SERVICE_ROLE_KEY|PUBLISHABLE_KEY|ANON_KEY)=')"
case "$API_URL" in
  http://127.0.0.1:*|http://localhost:*) ;;
  *) echo "Refusing to run: the database is not local ($API_URL)"; exit 1 ;;
esac

# One admin account to sign in with, then the target volume: 1000 profiles, 50 announcements, 40 events.
curl -s -X POST "$API_URL/auth/v1/admin/users" -H "apikey: $ANON_KEY" -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"boss@seed.test","password":"Local-Test-1234!","email_confirm":true,"user_metadata":{"user_name":"boss"}}' >/dev/null
docker exec supabase_db_BlocusApp psql -U postgres -q -c "
update public.profiles set role='admin' where pseudo='boss';
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
select gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'u'||g||'@bulk.test', jsonb_build_object('user_name', 'user'||g)
from generate_series(1, 1000) g;
insert into public.announcements (author_id, title, body, created_at)
select p.id, 'Annonce '||g, repeat('Texte de l''annonce numéro '||g||'. ', 40), now() - (g||' hours')::interval
from generate_series(1, 50) g, (select id from public.profiles where pseudo='boss') p;
insert into public.events (author_id, title, location, starts_at)
select p.id, 'Événement '||g, 'Lieu '||g, date_trunc('month', now()) + ((g * 18) || ' hours')::interval + interval '10 hours'
from generate_series(1, 40) g, (select id from public.profiles where pseudo='boss') p
where date_trunc('month', now()) + ((g * 18) || ' hours')::interval > now();" >/dev/null 2>&1

# Session cookie of the admin (the app reads `sb-<project ref>-auth-token`; the ref of a local URL is "127").
SESSION=$(curl -s -X POST "$API_URL/auth/v1/token?grant_type=password" -H "apikey: $ANON_KEY" \
  -H "Content-Type: application/json" -d '{"email":"boss@seed.test","password":"Local-Test-1234!"}')
COOKIE=$(python -c "
import sys, base64
print('base64-' + base64.urlsafe_b64encode(sys.argv[1].encode()).decode().rstrip('='))" "$SESSION")

export NEXT_PUBLIC_SUPABASE_URL="$API_URL" NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="$PUBLISHABLE_KEY" NEXT_PUBLIC_SITE_URL="http://localhost:$PORT"
npm run build >/dev/null 2>&1 || { echo "Build failed"; exit 1; }
# Keep connections open longer than the pauses between page views: otherwise every virtual user reconnects through
# Docker Desktop's network layer and part of the requests time out on connect, which says nothing about the app.
(npx next start -p "$PORT" --keepAliveTimeout 60000 >/dev/null 2>&1 &)
sleep 8
PID=$(netstat -ano | grep ":$PORT " | grep LISTENING | head -1 | awk '{print $NF}')

# Warm-up so that the first compilation is not counted, then reset the counters.
for path in / /calendar; do curl -s -o /dev/null "http://localhost:$PORT$path"; done
docker exec supabase_db_BlocusApp psql -U postgres -tAc "select pg_stat_statements_reset()::text" >/dev/null
cpu() { powershell -NoProfile -Command "(Get-Process -Id $PID).CPU" | tr -d '\r' | tr ',' '.'; }
CPU_BEFORE=$(cpu)

docker run --rm -i -e HOLD="$HOLD" -e AUTH_COOKIE_NAME="sb-127-auth-token" -e AUTH_COOKIE_VALUE="$COOKIE" \
  grafana/k6 run --quiet - <load/k6-200-users.js | tee load/last-run.txt
K6_EXIT=${PIPESTATUS[0]}

CPU_AFTER=$(cpu)
echo
echo "---- cost of the run ----"
python -c "
before, after = float('$CPU_BEFORE'), float('$CPU_AFTER')
print(f'server CPU time: {after - before:.1f} s (Node process, this machine)')"
docker exec supabase_db_BlocusApp psql -U postgres -tAc "
select 'database reads: ' || coalesce(sum(calls), 0) || ' (PostgREST)'
from pg_stat_statements where query like '%pgrst_source%';"

[ -n "$PID" ] && taskkill //F //PID "$PID" >/dev/null 2>&1
npx supabase stop >/dev/null 2>&1
exit "$K6_EXIT"
