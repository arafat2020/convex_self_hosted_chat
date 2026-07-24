#!/usr/bin/env bash
# =============================================================================
# restore.sh — Restore PostgreSQL and MinIO from a cvx-chat backup
#
# Usage:
#   ./scripts/restore.sh [TIMESTAMP]
#
# Arguments:
#   TIMESTAMP    Optional: the backup folder name (e.g. 2024-07-24_10-30-00)
#                If omitted, an interactive list of available backups is shown.
#
# What it does:
#   1. Stops the Convex backend (to prevent writes during restore)
#   2. Drops and recreates the PostgreSQL database
#   3. Restores from the SQL dump
#   4. Restores all MinIO buckets (if mc is installed)
#   5. Restarts the Convex backend
#
# CAUTION: This OVERWRITES your live data. Always back up before restoring!
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$PROJECT_ROOT/.env"
BACKUPS_DIR="$PROJECT_ROOT/backups"

# ---- Colors ----
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

info()    { echo -e "${CYAN}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERR]${NC}   $*" >&2; }
die()     { error "$*"; exit 1; }

echo -e "${BOLD}"
echo "╔══════════════════════════════════════════════════╗"
echo "║   cvx-chat — Restore from Backup                ║"
echo "╚══════════════════════════════════════════════════╝"
echo -e "${NC}"

# =============================================================================
# Load environment
# =============================================================================
if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck source=/dev/null
  source "$ENV_FILE"
  set +a
fi

POSTGRES_DB="${POSTGRES_DB:-convex}"
POSTGRES_USER="${POSTGRES_USER:-convex}"
MINIO_ROOT_USER="${MINIO_ROOT_USER:-minioadmin}"
MINIO_ROOT_PASSWORD="${MINIO_ROOT_PASSWORD:-minioadmin}"
MINIO_API_PORT="${MINIO_API_PORT:-9000}"

BUCKETS=(
  "${S3_STORAGE_FILES_BUCKET:-convex-files}"
  "${S3_STORAGE_MODULES_BUCKET:-convex-modules}"
  "${S3_STORAGE_EXPORTS_BUCKET:-convex-exports}"
  "${S3_STORAGE_SEARCH_BUCKET:-convex-search}"
  "${S3_STORAGE_SNAPSHOT_IMPORTS_BUCKET:-convex-snapshot-imports}"
)

# =============================================================================
# Select backup
# =============================================================================
TIMESTAMP="${1:-}"

if [[ -z "$TIMESTAMP" ]]; then
  # List available backups
  mapfile -t AVAILABLE < <(find "$BACKUPS_DIR" -maxdepth 1 -mindepth 1 -type d \
    -name "????-??-??_??-??-??" | sort -r)

  if [[ ${#AVAILABLE[@]} -eq 0 ]]; then
    die "No backups found in $BACKUPS_DIR. Run ./scripts/backup.sh first."
  fi

  echo "Available backups:"
  echo ""
  for i in "${!AVAILABLE[@]}"; do
    TS=$(basename "${AVAILABLE[$i]}")
    SIZE=$(du -sh "${AVAILABLE[$i]}" 2>/dev/null | cut -f1)
    echo "  [$((i+1))] $TS  ($SIZE)"
  done
  echo ""
  read -rp "Select backup number [1-${#AVAILABLE[@]}]: " SELECTION

  if ! [[ "$SELECTION" =~ ^[0-9]+$ ]] || \
     [[ "$SELECTION" -lt 1 ]] || \
     [[ "$SELECTION" -gt ${#AVAILABLE[@]} ]]; then
    die "Invalid selection."
  fi

  BACKUP_DIR="${AVAILABLE[$((SELECTION-1))]}"
  TIMESTAMP=$(basename "$BACKUP_DIR")
else
  BACKUP_DIR="$BACKUPS_DIR/$TIMESTAMP"
  if [[ ! -d "$BACKUP_DIR" ]]; then
    die "Backup not found: $BACKUP_DIR"
  fi
fi

# =============================================================================
# Show manifest if available
# =============================================================================
if [[ -f "$BACKUP_DIR/manifest.json" ]]; then
  echo ""
  info "Backup details:"
  cat "$BACKUP_DIR/manifest.json"
  echo ""
fi

# =============================================================================
# Safety confirmation
# =============================================================================
echo -e "${RED}${BOLD}"
echo "  ⚠  WARNING: This will OVERWRITE the live database and object storage."
echo "  ⚠  All current data will be replaced with the backup from: $TIMESTAMP"
echo -e "${NC}"
read -rp "Type 'yes' to confirm: " CONFIRM
[[ "$CONFIRM" == "yes" ]] || die "Restore cancelled."

# =============================================================================
# Preflight checks
# =============================================================================
info "Running preflight checks..."
command -v docker >/dev/null 2>&1 || die "Docker not found."

HAVE_MC=false
command -v mc >/dev/null 2>&1 && HAVE_MC=true || \
  warn "MinIO Client 'mc' not found — MinIO restore will be SKIPPED."

DUMP_FILE="$BACKUP_DIR/backup.sql.gz"
[[ -f "$DUMP_FILE" ]] || die "PostgreSQL dump not found: $DUMP_FILE"

# =============================================================================
# 1. Stop Convex backend (prevents writes during restore)
# =============================================================================
info "Stopping Convex backend..."
docker compose -f "$PROJECT_ROOT/compose.yaml" stop cvx_backend cvx_dashboard || true
success "Backend stopped."

# =============================================================================
# 2. Restore PostgreSQL
# =============================================================================
info "Restoring PostgreSQL database '$POSTGRES_DB'..."

# Drop and recreate the database
docker compose -f "$PROJECT_ROOT/compose.yaml" exec -T postgres \
  psql -U "$POSTGRES_USER" -d postgres -c \
  "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='$POSTGRES_DB' AND pid <> pg_backend_pid();" \
  > /dev/null 2>&1 || true

docker compose -f "$PROJECT_ROOT/compose.yaml" exec -T postgres \
  psql -U "$POSTGRES_USER" -d postgres -c "DROP DATABASE IF EXISTS \"$POSTGRES_DB\";" \
  > /dev/null

docker compose -f "$PROJECT_ROOT/compose.yaml" exec -T postgres \
  psql -U "$POSTGRES_USER" -d postgres -c "CREATE DATABASE \"$POSTGRES_DB\" OWNER \"$POSTGRES_USER\";" \
  > /dev/null

# Restore from dump
gunzip -c "$DUMP_FILE" | docker compose -f "$PROJECT_ROOT/compose.yaml" exec -T postgres \
  psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" > /dev/null

success "PostgreSQL restored from backup.sql.gz"

# =============================================================================
# 3. Restore MinIO buckets
# =============================================================================
if [[ "$HAVE_MC" == true ]]; then
  info "Configuring MinIO Client alias..."
  mc alias set cvx-restore "http://127.0.0.1:$MINIO_API_PORT" \
    "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" --quiet

  TEMP_DIR=$(mktemp -d)
  trap 'rm -rf "$TEMP_DIR"' EXIT

  for BUCKET in "${BUCKETS[@]}"; do
    ARCHIVE="$BACKUP_DIR/minio/${BUCKET}.tar.gz"
    if [[ -f "$ARCHIVE" ]]; then
      info "Restoring bucket: $BUCKET..."
      # Extract to temp dir
      tar -xzf "$ARCHIVE" -C "$TEMP_DIR"

      # Clear and re-upload
      mc rb --force "cvx-restore/$BUCKET" --quiet 2>/dev/null || true
      mc mb "cvx-restore/$BUCKET" --quiet
      mc mirror --quiet "$TEMP_DIR/$BUCKET" "cvx-restore/$BUCKET"
      rm -rf "$TEMP_DIR/$BUCKET"

      success "  $BUCKET restored"
    else
      warn "  No archive for bucket '$BUCKET' — skipping."
    fi
  done
else
  warn "MinIO restore skipped (mc not installed)."
fi

# =============================================================================
# 4. Restart Convex backend
# =============================================================================
info "Restarting Convex backend and dashboard..."
docker compose -f "$PROJECT_ROOT/compose.yaml" up -d cvx_backend cvx_dashboard

info "Waiting for Convex backend to become healthy..."
TIMEOUT=90
ELAPSED=0
while ! docker compose -f "$PROJECT_ROOT/compose.yaml" ps cvx_backend | grep -q "(healthy)"; do
  if [[ $ELAPSED -ge $TIMEOUT ]]; then
    error "Timed out. Check: docker compose logs cvx_backend"
    exit 1
  fi
  printf "."
  sleep 3
  ELAPSED=$((ELAPSED + 3))
done
echo ""

# =============================================================================
# Done
# =============================================================================
echo ""
echo -e "${BOLD}${GREEN}══════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}  Restore complete!${NC}"
echo -e "  Restored from: ${CYAN}$TIMESTAMP${NC}"
echo -e "${BOLD}${GREEN}══════════════════════════════════════════════════════${NC}"
echo ""
success "All services are back online."
echo ""
