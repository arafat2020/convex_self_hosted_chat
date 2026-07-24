#!/usr/bin/env bash
# =============================================================================
# backup.sh — Backup PostgreSQL database and MinIO buckets for cvx-chat
#
# Usage:
#   ./scripts/backup.sh [OPTIONS]
#
# Options:
#   -o, --output DIR      Directory to write backups to (default: ./backups)
#   -r, --retain DAYS     Delete backups older than N days (default: 7, 0=keep all)
#   -h, --help            Show this help message
#
# Requirements:
#   - Docker + Docker Compose
#   - 'mc' (MinIO Client) must be installed for MinIO backup.
#     Install: https://min.io/docs/minio/linux/reference/minio-mc.html
#     macOS:   brew install minio/stable/mc
#     Linux:   curl -O https://dl.min.io/client/mc/release/linux-amd64/mc && chmod +x mc && mv mc /usr/local/bin/
#
# The backup creates a timestamped directory containing:
#   backup.sql.gz            — PostgreSQL dump (all Convex tables)
#   minio/<bucket>.tar.gz    — One archive per MinIO bucket
#   manifest.json            — Metadata (timestamp, versions, bucket list)
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$PROJECT_ROOT/.env"

# ---- Defaults ----
OUTPUT_DIR="$PROJECT_ROOT/backups"
RETAIN_DAYS=7

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

# ---- Parse arguments ----
while [[ $# -gt 0 ]]; do
  case $1 in
    -o|--output) OUTPUT_DIR="$2"; shift 2 ;;
    -r|--retain) RETAIN_DAYS="$2"; shift 2 ;;
    -h|--help)
      sed -n '2,30p' "$0" | grep '^#' | sed 's/^# \?//'
      exit 0
      ;;
    *) die "Unknown option: $1. Use --help for usage." ;;
  esac
done

# =============================================================================
# Load environment
# =============================================================================
if [[ ! -f "$ENV_FILE" ]]; then
  warn "No .env found at $ENV_FILE — using compose defaults."
else
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
# Preflight checks
# =============================================================================
info "Running preflight checks..."
command -v docker >/dev/null 2>&1 || die "Docker not found."
docker compose version >/dev/null 2>&1 || die "Docker Compose v2 not found."

if ! docker compose -f "$PROJECT_ROOT/compose.yaml" ps postgres | grep -q "running\|Up"; then
  die "PostgreSQL container is not running. Start the stack first with: docker compose up -d"
fi

HAVE_MC=false
if command -v mc >/dev/null 2>&1; then
  HAVE_MC=true
else
  warn "MinIO Client 'mc' not found. MinIO backup will be SKIPPED."
  warn "Install: brew install minio/stable/mc  (macOS) or see --help for Linux."
fi

# =============================================================================
# Create timestamped backup directory
# =============================================================================
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
BACKUP_DIR="$OUTPUT_DIR/$TIMESTAMP"
mkdir -p "$BACKUP_DIR/minio"

echo -e "\n${BOLD}Starting backup → $BACKUP_DIR${NC}\n"

# =============================================================================
# 1. PostgreSQL backup
# =============================================================================
info "Backing up PostgreSQL database '$POSTGRES_DB'..."
PG_DUMP_FILE="$BACKUP_DIR/backup.sql.gz"

docker compose -f "$PROJECT_ROOT/compose.yaml" exec -T postgres \
  pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip > "$PG_DUMP_FILE"

PG_SIZE=$(du -sh "$PG_DUMP_FILE" | cut -f1)
success "PostgreSQL dump saved: backup.sql.gz ($PG_SIZE)"

# =============================================================================
# 2. MinIO backup (per-bucket via mc)
# =============================================================================
MINIO_STATUS="skipped (mc not installed)"
if [[ "$HAVE_MC" == true ]]; then
  info "Configuring MinIO Client alias..."
  mc alias set cvx-backup "http://127.0.0.1:$MINIO_API_PORT" \
    "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" --quiet

  MINIO_STATUS="success"
  for BUCKET in "${BUCKETS[@]}"; do
    BUCKET_DIR="$BACKUP_DIR/minio/$BUCKET"
    mkdir -p "$BUCKET_DIR"

    info "Mirroring bucket: $BUCKET..."
    if mc mirror --quiet "cvx-backup/$BUCKET" "$BUCKET_DIR" 2>/dev/null; then
      # Tar + compress
      tar -czf "$BACKUP_DIR/minio/${BUCKET}.tar.gz" -C "$BACKUP_DIR/minio" "$BUCKET"
      rm -rf "$BUCKET_DIR"
      SZ=$(du -sh "$BACKUP_DIR/minio/${BUCKET}.tar.gz" | cut -f1)
      success "  $BUCKET → ${BUCKET}.tar.gz ($SZ)"
    else
      warn "  Bucket '$BUCKET' is empty or inaccessible — skipping."
    fi
  done
fi

# =============================================================================
# 3. Write manifest
# =============================================================================
CONVEX_VERSION=$(docker compose -f "$PROJECT_ROOT/compose.yaml" exec cvx_backend \
  ./generate_admin_key.sh 2>/dev/null | head -n 1 || \
  docker inspect --format='{{.Config.Image}}' "$(docker compose -f "$PROJECT_ROOT/compose.yaml" ps -q cvx_backend)" 2>/dev/null || \
  echo "unknown")

BACKEND_IMAGE=$(docker inspect --format='{{.Config.Image}}' \
  "$(docker compose -f "$PROJECT_ROOT/compose.yaml" ps -q cvx_backend 2>/dev/null)" 2>/dev/null || echo "unknown")

cat > "$BACKUP_DIR/manifest.json" <<EOF
{
  "timestamp": "$TIMESTAMP",
  "created_at": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "convex_backend_image": "$BACKEND_IMAGE",
  "postgres_db": "$POSTGRES_DB",
  "postgres_user": "$POSTGRES_USER",
  "minio_status": "$MINIO_STATUS",
  "buckets": $(printf '%s\n' "${BUCKETS[@]}" | jq -R . | jq -s .),
  "files": {
    "postgres": "backup.sql.gz",
    "minio_buckets": "minio/<bucket>.tar.gz"
  }
}
EOF

success "Manifest written: manifest.json"

# =============================================================================
# 4. Retention cleanup
# =============================================================================
if [[ "$RETAIN_DAYS" -gt 0 ]]; then
  info "Cleaning backups older than ${RETAIN_DAYS} days..."
  DELETED=0
  while IFS= read -r -d '' OLD_BACKUP; do
    warn "  Removing old backup: $(basename "$OLD_BACKUP")"
    rm -rf "$OLD_BACKUP"
    DELETED=$((DELETED + 1))
  done < <(find "$OUTPUT_DIR" -maxdepth 1 -mindepth 1 -type d \
    -mtime +"$RETAIN_DAYS" -print0 2>/dev/null)
  if [[ $DELETED -eq 0 ]]; then
    success "No old backups to remove."
  else
    success "Removed $DELETED old backup(s)."
  fi
fi

# =============================================================================
# Done
# =============================================================================
TOTAL_SIZE=$(du -sh "$BACKUP_DIR" | cut -f1)
echo ""
echo -e "${BOLD}${GREEN}══════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}  Backup complete!${NC}"
echo -e "  Location: ${CYAN}$BACKUP_DIR${NC}"
echo -e "  Total size: ${TOTAL_SIZE}"
echo -e "  MinIO: ${MINIO_STATUS}"
echo -e "${BOLD}${GREEN}══════════════════════════════════════════════════════${NC}"
echo ""
echo "To restore this backup, run:"
echo "  ./scripts/restore.sh $TIMESTAMP"
echo ""
