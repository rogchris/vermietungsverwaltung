#!/usr/bin/env bash
set -euo pipefail
umask 077
: "${RESTIC_REPOSITORY:?RESTIC_REPOSITORY fehlt}"
: "${RESTIC_PASSWORD_FILE:?RESTIC_PASSWORD_FILE fehlt}"
: "${VERMIETUNG_PROJECT_DIR:?VERMIETUNG_PROJECT_DIR fehlt}"
cd "$VERMIETUNG_PROJECT_DIR"
compose=(docker compose --env-file .env.production -f compose.production.yaml)
stage="$(mktemp -d)"
trap 'rm -rf -- "$stage"' EXIT
"${compose[@]}" exec -T postgres pg_dump -U postgres -d vermietung --format=custom > "$stage/database.dump"
"${compose[@]}" exec -T app tar -C /var/lib/vermietung -cf - . > "$stage/files.tar"
(cd "$stage"; sha256sum database.dump files.tar > manifest.sha256)
restic backup --stdin-from-command --stdin-filename vermietung-backup.tar --tag vermietung -- tar -C "$stage" -cf - database.dump files.tar manifest.sha256
