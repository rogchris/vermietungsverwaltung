#!/usr/bin/env bash
set -euo pipefail
umask 077
: "${RESTIC_REPOSITORY:?RESTIC_REPOSITORY fehlt}"
: "${RESTIC_PASSWORD_FILE:?RESTIC_PASSWORD_FILE fehlt}"
: "${VERMIETUNG_PROJECT_DIR:?VERMIETUNG_PROJECT_DIR fehlt}"
: "${VERMIETUNG_RESTORE_PROJECT:?Separates Restore-Compose-Projekt fehlt}"
if [[ ! "$VERMIETUNG_RESTORE_PROJECT" =~ ^vermietung-restore(-[a-z0-9]+)*$ ]]; then
  echo "Das Compose-Ziel muss ein separates Projekt namens vermietung-restore oder vermietung-restore-NAME sein." >&2
  exit 2
fi
if [[ $# != 3 || ! "$2" =~ ^vermietung_restore_[a-z0-9_]+$ || "$3" != /* || -e "$3" ]]; then
  echo "Aufruf: restore.sh SNAPSHOT_ID vermietung_restore_NAME /absoluter/neuer/Dateipfad" >&2
  exit 2
fi
if [[ ! "$1" =~ ^[0-9a-f]{8,64}$ ]]; then echo "Bitte eine konkrete Restic-Snapshot-ID angeben." >&2; exit 2; fi
snapshot=$1
database=$2
files=$3
cd "$VERMIETUNG_PROJECT_DIR"
compose=(docker compose -p "$VERMIETUNG_RESTORE_PROJECT" --env-file .env.production -f compose.production.yaml)
stage="$(mktemp -d)"
trap 'rm -rf -- "$stage"' EXIT
restic dump "$snapshot" /vermietung-backup.tar | tar -xf - -C "$stage" database.dump files.tar manifest.sha256
(cd "$stage"; sha256sum -c manifest.sha256)
"${compose[@]}" exec -T postgres createdb -U postgres "$database"
"${compose[@]}" exec -T postgres pg_restore --exit-on-error --no-owner -U postgres -d "$database" < "$stage/database.dump"
mkdir -- "$files"
tar --no-same-owner --no-same-permissions -xf "$stage/files.tar" -C "$files"
printf 'Wiederherstellung zur Prüfung bereit: %s und %s\n' "$database" "$files"
