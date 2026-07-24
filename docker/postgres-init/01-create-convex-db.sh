#!/bin/bash
# =============================================================================
# 01-create-convex-db.sh
#
# PostgreSQL init script — runs automatically on first container start.
# Creates the database that Convex will use.
#
# Convex derives its database name from INSTANCE_NAME by replacing hyphens
# with underscores. E.g. INSTANCE_NAME=cvx-chat → database "cvx_chat".
#
# This script reads INSTANCE_NAME and creates the correct database.
# =============================================================================

set -e

# Derive the db name the same way Convex does: replace hyphens with underscores
CONVEX_DB="${INSTANCE_NAME//-/_}"

if [ -z "$CONVEX_DB" ]; then
  echo "INSTANCE_NAME is not set — skipping Convex database creation."
  exit 0
fi

echo "Creating Convex database: $CONVEX_DB (from INSTANCE_NAME=$INSTANCE_NAME)"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
  SELECT 'CREATE DATABASE "$CONVEX_DB" OWNER "$POSTGRES_USER"'
  WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '$CONVEX_DB')
  \gexec
EOSQL

echo "Database '$CONVEX_DB' is ready."
