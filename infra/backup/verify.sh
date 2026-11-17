#!/usr/bin/env bash
set -euo pipefail
: "${RESTIC_REPOSITORY:?RESTIC_REPOSITORY fehlt}"
: "${RESTIC_PASSWORD_FILE:?RESTIC_PASSWORD_FILE fehlt}"
restic check --read-data
restic snapshots --tag vermietung
