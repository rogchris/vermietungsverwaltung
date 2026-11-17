#!/usr/bin/env bash
set -euo pipefail
: "${VERMIETUNG_PROJECT_DIR:?VERMIETUNG_PROJECT_DIR fehlt}"
cd "$VERMIETUNG_PROJECT_DIR"
compose=(docker compose --env-file .env.production -f compose.production.yaml)
"${compose[@]}" ps app worker postgres clamav caddy
"${compose[@]}" exec -T app node -e "fetch('http://127.0.0.1:3000/api/health',{signal:AbortSignal.timeout(3000)}).then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
"${compose[@]}" exec -T worker node -e "const fs=require('node:fs'); if(Date.now()-Number(fs.readFileSync('/tmp/vermietung-worker-health','utf8'))>120000)process.exit(1)"
"${compose[@]}" exec -T postgres psql -U postgres -d vermietung -Atc 'SELECT status, count(*) FROM "ReportJob" GROUP BY status ORDER BY status'
df -h .
