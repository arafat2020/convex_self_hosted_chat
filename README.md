# cvx-chat — Self-Hosted Convex Chat

A full-featured, self-hosted chat application built on [Convex](https://convex.dev), running entirely on your own infrastructure via Docker Compose. No external cloud services required.

```
┌─────────────────────────────────────────────────────────────┐
│                      Your Infrastructure                    │
│                                                             │
│   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐  │
│   │  Next.js App │   │  Convex      │   │  Convex      │  │
│   │  (Frontend)  │◄──│  Backend     │   │  Dashboard   │  │
│   │  :3000       │   │  :3210/:3211 │   │  :6791       │  │
│   └──────────────┘   └──────┬───────┘   └──────────────┘  │
│                              │                              │
│                    ┌─────────┴──────────┐                   │
│                    │                    │                   │
│             ┌──────▼──────┐    ┌────────▼──────┐           │
│             │  PostgreSQL  │    │    MinIO       │           │
│             │  :5432       │    │    :9000/:9001 │           │
│             │  (database)  │    │  (file store)  │           │
│             └─────────────┘    └───────────────┘           │
└─────────────────────────────────────────────────────────────┘
```

## Features

- 🚀 **Servers & Channels** — Discord-style workspace organization
- 💬 **Real-time messaging** — Powered by Convex live queries
- 📎 **File attachments** — Stored in MinIO (S3-compatible)
- 😀 **Emoji reactions** — Per-message reactions
- 👥 **Role-based access** — Admin, Moderator, Member roles
- 🔐 **Authentication** — Built-in with `@convex-dev/auth`
- 🗄️ **PostgreSQL** — Production-grade persistent database
- 📦 **MinIO** — Self-hosted S3-compatible object storage
- 💾 **Backup & Restore** — One-command backups with retention

---

## Prerequisites

| Tool | Minimum Version | Install |
|------|----------------|---------|
| Docker | 24.x | [docs.docker.com](https://docs.docker.com/get-docker/) |
| Docker Compose | v2.x | [docs.docker.com/compose](https://docs.docker.com/compose/install/) |
| Node.js | 18.x | [nodejs.org](https://nodejs.org) |
| npm | 9.x | (bundled with Node.js) |
| `mc` (MinIO Client) | latest | [min.io/docs/minio/linux/reference/minio-mc](https://min.io/docs/minio/linux/reference/minio-mc.html) *(for backups only)* |

### Install MinIO Client

```bash
# macOS
brew install minio/stable/mc

# Linux (x86_64)
curl -O https://dl.min.io/client/mc/release/linux-amd64/mc
chmod +x mc
sudo mv mc /usr/local/bin/

# Verify
mc --version
```

---

## Quick Start

### 1. Clone the repository

```bash
git clone <your-repo-url> cvx-chat
cd cvx-chat
```

### 2. Run the automated setup (recommended)

```bash
chmod +x scripts/setup.sh scripts/backup.sh scripts/restore.sh
./scripts/setup.sh
```

This single command will:
- Create `.env` from `.env.example`
- Auto-generate a secure `INSTANCE_SECRET`
- Start all Docker services
- Wait for health checks to pass
- Generate and print your **admin key**

> After setup, add the printed admin key to `cvx_client/.env.local`.

---

### Manual Setup (step-by-step)

If you prefer to set things up manually:

#### Step 1 — Create your `.env` file

```bash
cp .env.example .env
```

Open `.env` and set these **required** values:

```bash
# Generate a strong secret:
openssl rand -hex 32

# Paste the output as:
INSTANCE_SECRET=<your-generated-secret>

# Change default passwords for production:
POSTGRES_PASSWORD=<strong-password>
MINIO_ROOT_PASSWORD=<strong-password>
```

#### Step 2 — Start the stack

```bash
docker compose up -d
```

Wait for all services to start (~30 seconds on first run):

```bash
docker compose ps
```

All services should show `(healthy)`.

#### Step 3 — Generate the admin key

```bash
docker compose exec cvx_backend ./generate_admin_key.sh
```

Copy the output — it looks like:
```
convex-self-hosted|<long-hex-string>
```

#### Step 4 — Configure the frontend

Edit `cvx_client/.env.local`:

```bash
CONVEX_SELF_HOSTED_URL=http://127.0.0.1:3210
CONVEX_SELF_HOSTED_ADMIN_KEY=cvx-chat|<your-admin-key>
NEXT_PUBLIC_CONVEX_URL=http://127.0.0.1:3210
NEXT_PUBLIC_CONVEX_SITE_URL=http://127.0.0.1:3211
```

#### Step 5 — Configure Convex Auth Keys

Generate and set the required JWT private key and JWKS for `@convex-dev/auth`:

```bash
cd cvx_client
npx convex env set SITE_URL http://localhost:3000
# Generate RS256 private key & JWKS (or run ./scripts/setup.sh)
```

#### Step 6 — Run the frontend

```bash
cd cvx_client
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Service URLs

| Service | URL | Description |
|---------|-----|-------------|
| **Frontend** | http://localhost:3000 | Next.js chat application |
| **Convex Backend** | http://localhost:3210 | Convex API endpoint |
| **Convex HTTP Actions** | http://localhost:3211 | HTTP action proxy |
| **Convex Dashboard** | http://localhost:6791 | Admin dashboard |
| **MinIO API** | http://localhost:9000 | S3-compatible API |
| **MinIO Console** | http://localhost:9001 | MinIO web UI |
| **PostgreSQL** | localhost:5432 | Direct DB access |

---

## Configuration Reference

All configuration is done via the `.env` file in the project root.

### Instance Identity

| Variable | Default | Description |
|----------|---------|-------------|
| `INSTANCE_NAME` | `cvx-chat` | Human-readable name for this deployment |
| `INSTANCE_SECRET` | *(required)* | Long random secret for signing admin keys. Never share this. Generate with `openssl rand -hex 32` |

### PostgreSQL

| Variable | Default | Description |
|----------|---------|-------------|
| `POSTGRES_DB` | `convex` | Database name |
| `POSTGRES_USER` | `convex` | Database user |
| `POSTGRES_PASSWORD` | `convexsecret` | **Change this in production!** |
| `POSTGRES_PORT` | `5432` | Port exposed on the host |

### MinIO

| Variable | Default | Description |
|----------|---------|-------------|
| `MINIO_ROOT_USER` | `minioadmin` | MinIO root username (used as AWS Access Key) |
| `MINIO_ROOT_PASSWORD` | `minioadmin` | **Change this in production!** |
| `MINIO_API_PORT` | `9000` | S3 API port |
| `MINIO_CONSOLE_PORT` | `9001` | MinIO web console port |
| `AWS_REGION` | `us-east-1` | S3 region (value doesn't matter for MinIO) |

### Storage Buckets

These buckets are **auto-created** by the `minio-init` container on first start.

| Variable | Default | Purpose |
|----------|---------|---------|
| `S3_STORAGE_FILES_BUCKET` | `convex-files` | User uploaded files and attachments |
| `S3_STORAGE_MODULES_BUCKET` | `convex-modules` | Deployed Convex function code |
| `S3_STORAGE_EXPORTS_BUCKET` | `convex-exports` | Database export snapshots |
| `S3_STORAGE_SEARCH_BUCKET` | `convex-search` | Search index data |
| `S3_STORAGE_SNAPSHOT_IMPORTS_BUCKET` | `convex-snapshot-imports` | Snapshot import staging |

### Convex Ports

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3210` | Convex backend API port |
| `SITE_PROXY_PORT` | `3211` | Convex HTTP actions port |
| `DASHBOARD_PORT` | `6791` | Convex dashboard port |

---

## Backup & Restore

### Create a backup

```bash
./scripts/backup.sh
```

Backups are saved to `./backups/<timestamp>/` and contain:
- `backup.sql.gz` — Full PostgreSQL dump
- `minio/<bucket>.tar.gz` — All MinIO bucket data
- `manifest.json` — Backup metadata

**Options:**
```bash
# Custom output directory
./scripts/backup.sh --output /mnt/external/backups

# Keep only the last 14 days of backups (default: 7)
./scripts/backup.sh --retain 14

# Keep all backups (no retention)
./scripts/backup.sh --retain 0
```

### Restore a backup

```bash
# Interactive — shows a numbered list of available backups
./scripts/restore.sh

# Direct — restore a specific backup
./scripts/restore.sh 2024-07-24_10-30-00
```

> ⚠️ Restore will **stop the Convex backend**, drop and recreate the database, restore all buckets, then restart everything automatically.

### Automate backups with cron

Add to your crontab (`crontab -e`) to run daily at 2 AM:

```cron
0 2 * * * cd /path/to/cvx-chat && ./scripts/backup.sh --retain 14 >> ./logs/backup.log 2>&1
```

---

## Common Operations

### View service logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f cvx_backend
docker compose logs -f postgres
docker compose logs -f minio
```

### Stop / start the stack

```bash
# Stop (preserves data in volumes)
docker compose down

# Stop and remove volumes (DESTROYS ALL DATA)
docker compose down -v

# Restart a single service
docker compose restart cvx_backend
```

### Connect to PostgreSQL directly

```bash
docker compose exec postgres psql -U convex -d convex
```

### Access MinIO Console

Open [http://localhost:9001](http://localhost:9001) and log in with your `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD`.

### Regenerate the admin key

```bash
docker compose exec cvx_backend ./generate_admin_key.sh
```

Update `cvx_client/.env.local` with the new key and restart the frontend.

---

## Upgrading Convex

1. **Back up your data first:**
   ```bash
   ./scripts/backup.sh
   ```

2. **Pull the latest images:**
   ```bash
   docker compose pull
   ```

3. **Restart:**
   ```bash
   docker compose up -d
   ```

4. **Check logs** for any migration messages:
   ```bash
   docker compose logs -f cvx_backend
   ```

---

## Troubleshooting

### Backend won't start — `postgres not healthy`

PostgreSQL takes ~10s on first run to initialize the data directory. Wait and retry:
```bash
docker compose logs postgres
docker compose restart cvx_backend
```

### MinIO buckets not created

Check the `minio-init` container logs:
```bash
docker compose logs minio-init
```

If it exited with an error, run it again:
```bash
docker compose up minio-init
```

### Frontend can't connect to Convex

Ensure `cvx_client/.env.local` has the correct values:
```bash
CONVEX_SELF_HOSTED_URL=http://127.0.0.1:3210
NEXT_PUBLIC_CONVEX_URL=http://127.0.0.1:3210
```

And that the backend is healthy:
```bash
curl http://localhost:3210/version
```

### Port conflicts

Edit `.env` to change conflicting ports, e.g.:
```bash
MINIO_API_PORT=9010
MINIO_CONSOLE_PORT=9011
POSTGRES_PORT=5433
```

Then restart: `docker compose up -d`

### "INSTANCE_SECRET not set" error

Make sure `.env` exists and has `INSTANCE_SECRET` set:
```bash
grep INSTANCE_SECRET .env
# Should show: INSTANCE_SECRET=<long-hex>
# If blank, run: ./scripts/setup.sh
```

---

## Project Structure

```
cvx-chat/
├── compose.yaml          # Docker Compose — all services
├── .env.example          # Environment variable template (copy → .env)
├── .env                  # Your local config (git-ignored, contains secrets)
├── scripts/
│   ├── setup.sh          # First-run setup helper
│   ├── backup.sh         # Backup PostgreSQL + MinIO
│   └── restore.sh        # Restore from backup
├── backups/              # Auto-created by backup.sh
│   └── YYYY-MM-DD_HH-MM-SS/
│       ├── backup.sql.gz
│       ├── minio/
│       └── manifest.json
└── cvx_client/           # Next.js frontend
    ├── app/              # Next.js App Router pages
    ├── components/       # UI components
    ├── convex/           # Convex schema + functions
    └── .env.local        # Frontend env (git-ignored)
```

---

## Security Notes for Production

- **Change all default passwords** in `.env` before exposing to the internet
- **Do not expose** PostgreSQL (port 5432) or MinIO API (9000) directly to the internet — use a reverse proxy (nginx, Caddy) with TLS
- **Keep `.env` out of source control** — it's in `.gitignore` already
- **Rotate `INSTANCE_SECRET` carefully** — changing it invalidates all existing admin keys; you'll need to regenerate them
- **Regular backups** — use the cron job approach described above

---

## License

MIT — see [LICENSE](./LICENSE) for details.
