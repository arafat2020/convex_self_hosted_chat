#!/usr/bin/env bash
# =============================================================================
# setup.sh — First-run setup helper for cvx-chat self-hosted stack
#
# Usage:
#   ./scripts/setup.sh
#
# What it does:
#   1. Checks Docker and Docker Compose are available
#   2. Creates .env from .env.example if it doesn't exist
#   3. Auto-generates INSTANCE_SECRET if blank in .env
#   4. Starts the full stack
#   5. Waits for services to become healthy
#   6. Generates and prints the Convex admin key
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$PROJECT_ROOT/.env"
ENV_EXAMPLE="$PROJECT_ROOT/.env.example"

# ---- Colors ----
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

info()    { echo -e "${CYAN}[INFO]${NC} $*"; }
success() { echo -e "${GREEN}[OK]${NC}   $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $*"; }
error()   { echo -e "${RED}[ERR]${NC}  $*" >&2; }
die()     { error "$*"; exit 1; }

echo -e "${BOLD}"
echo "╔══════════════════════════════════════════════════╗"
echo "║   cvx-chat — Self-Hosted Setup                  ║"
echo "╚══════════════════════════════════════════════════╝"
echo -e "${NC}"

# =============================================================================
# 1. Prerequisites
# =============================================================================
info "Checking prerequisites..."

command -v docker  >/dev/null 2>&1 || die "Docker is not installed. See https://docs.docker.com/get-docker/"
command -v docker compose >/dev/null 2>&1 || \
  docker compose version >/dev/null 2>&1   || \
  die "Docker Compose v2 is required. See https://docs.docker.com/compose/install/"

success "Docker $(docker --version | awk '{print $3}' | tr -d ',')"
success "Docker Compose $(docker compose version --short)"

# =============================================================================
# 2. Create .env from .env.example
# =============================================================================
if [[ ! -f "$ENV_FILE" ]]; then
  info "No .env found — copying from .env.example..."
  cp "$ENV_EXAMPLE" "$ENV_FILE"
  success ".env created. Please review it before continuing."
else
  success ".env already exists."
fi

# =============================================================================
# 3. Auto-generate INSTANCE_SECRET if blank
# =============================================================================
# shellcheck source=/dev/null
source "$ENV_FILE"

if [[ -z "${INSTANCE_SECRET:-}" ]]; then
  info "Generating INSTANCE_SECRET..."
  if command -v openssl >/dev/null 2>&1; then
    SECRET=$(openssl rand -hex 32)
  else
    SECRET=$(head -c 32 /dev/urandom | xxd -p | tr -d '\n')
  fi

  # Replace the empty INSTANCE_SECRET= line in .env
  if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s/^INSTANCE_SECRET=$/INSTANCE_SECRET=$SECRET/" "$ENV_FILE"
  else
    sed -i "s/^INSTANCE_SECRET=$/INSTANCE_SECRET=$SECRET/" "$ENV_FILE"
  fi
  success "INSTANCE_SECRET generated and saved to .env"
else
  success "INSTANCE_SECRET is already set."
fi

# Reload .env to pick up changes
set -a
source "$ENV_FILE"
set +a

# =============================================================================
# 4. Start the stack
# =============================================================================
info "Starting Docker Compose stack..."
cd "$PROJECT_ROOT"
docker compose up -d --remove-orphans

# =============================================================================
# 5. Wait for cvx_backend to be healthy
# =============================================================================
info "Waiting for Convex backend to become healthy (this may take ~30s on first run)..."
TIMEOUT=120
ELAPSED=0
while ! docker compose ps cvx_backend | grep -q "(healthy)"; do
  if [[ $ELAPSED -ge $TIMEOUT ]]; then
    error "Timed out waiting for cvx_backend. Check logs with: docker compose logs cvx_backend"
    exit 1
  fi
  printf "."
  sleep 3
  ELAPSED=$((ELAPSED + 3))
done
echo ""
success "Convex backend is healthy!"

# =============================================================================
# 6. Generate admin key
# =============================================================================
info "Generating Convex admin key..."
ADMIN_KEY=$(docker compose exec cvx_backend ./generate_admin_key.sh 2>/dev/null | tail -n1)

# =============================================================================
# 7. Configure Convex Auth Keys (JWT_PRIVATE_KEY, JWKS, SITE_URL)
# =============================================================================
info "Configuring Convex Auth environment variables..."
if [[ -d "$PROJECT_ROOT/cvx_client" ]]; then
  (
    cd "$PROJECT_ROOT/cvx_client"
    CONVEX_SELF_HOSTED_URL="http://127.0.0.1:${PORT:-3210}" \
    CONVEX_SELF_HOSTED_ADMIN_KEY="$ADMIN_KEY" \
    node -e '
      const { generateKeyPair, exportPKCS8, exportJWK } = require("jose");
      const { execFileSync } = require("child_process");
      (async () => {
        const keys = await generateKeyPair("RS256", { extractable: true });
        const privateKey = await exportPKCS8(keys.privateKey);
        const publicKey = await exportJWK(keys.publicKey);
        const jwtPrivateKey = privateKey.trimEnd().replace(/\n/g, " ");
        const jwks = JSON.stringify({ keys: [{ use: "sig", ...publicKey }] });

        execFileSync("npx", ["convex", "env", "set", "JWT_PRIVATE_KEY", "--", jwtPrivateKey], { stdio: "ignore" });
        execFileSync("npx", ["convex", "env", "set", "JWKS", "--", jwks], { stdio: "ignore" });
        execFileSync("npx", ["convex", "env", "set", "SITE_URL", "--", "http://localhost:3000"], { stdio: "ignore" });
      })();
    ' 2>/dev/null || true
  )
  success "Convex Auth keys configured (JWT_PRIVATE_KEY, JWKS, SITE_URL)"
fi

echo ""
echo -e "${BOLD}${GREEN}══════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}  Setup complete! Here are your details:${NC}"
echo -e "${BOLD}${GREEN}══════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  ${BOLD}Convex Backend:${NC}    http://127.0.0.1:${PORT:-3210}"
echo -e "  ${BOLD}Convex Dashboard:${NC}  http://127.0.0.1:${DASHBOARD_PORT:-6791}"
echo -e "  ${BOLD}MinIO Console:${NC}     http://127.0.0.1:${MINIO_CONSOLE_PORT:-9001}"
echo -e "  ${BOLD}MinIO Credentials:${NC} ${MINIO_ROOT_USER:-minioadmin} / ${MINIO_ROOT_PASSWORD:-minioadmin}"
echo ""
echo -e "  ${BOLD}Admin Key:${NC}"
echo -e "  ${YELLOW}${ADMIN_KEY}${NC}"
echo ""
echo -e "  ${BOLD}Add to cvx_client/.env.local:${NC}"
echo -e "  ${CYAN}CONVEX_SELF_HOSTED_URL=http://127.0.0.1:${PORT:-3210}"
echo -e "  CONVEX_SELF_HOSTED_ADMIN_KEY=${ADMIN_KEY}"
echo -e "  NEXT_PUBLIC_CONVEX_URL=http://127.0.0.1:${PORT:-3210}"
echo -e "  NEXT_PUBLIC_CONVEX_SITE_URL=http://127.0.0.1:${SITE_PROXY_PORT:-3211}${NC}"
echo ""
echo -e "${BOLD}${GREEN}══════════════════════════════════════════════════════${NC}"
echo ""
info "To start the frontend:"
echo "  cd cvx_client && npm install && npm run dev"
echo ""
info "To stop everything:"
echo "  docker compose down"
echo ""
