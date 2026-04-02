#!/usr/bin/env bash
# reset-chains.sh
# Kills any running Anvil instances, clears deploy state, and starts fresh.
# Usage: bash Bridge/reset-chains.sh  (run from project root)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
BRIDGE_DIR="$SCRIPT_DIR"

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║           Stopping Anvil chains...               ║"
echo "╚══════════════════════════════════════════════════╝"

# Kill all anvil processes (ignore errors if none running)
pkill -f "anvil --chain-id" 2>/dev/null && echo ">> Killed existing Anvil instances" || echo ">> No Anvil instances were running"

sleep 1

# Remove stale address files
rm -f "$BRIDGE_DIR/.deploy-addresses"
echo ">> Cleared stale address files"

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║      Starting fresh deployment...                ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""

cd "$BRIDGE_DIR"
make deploy-local-all

echo ""
echo ">> Copying addresses to Bridge-BE/.env ..."
ADDR_FILE="$BRIDGE_DIR/.deploy-addresses"

# Update Bridge-BE/.env with new addresses
BE_ENV="$ROOT_DIR/Bridge-BE/.env"
if [ -f "$BE_ENV" ] && [ -f "$ADDR_FILE" ]; then
  while IFS='=' read -r key value; do
    # Skip empty lines and comments
    [[ -z "$key" || "$key" == \#* ]] && continue
    # Replace the value in BE .env if the key exists, else skip
    if grep -q "^${key}=" "$BE_ENV"; then
      sed -i "s|^${key}=.*|${key}=${value}|" "$BE_ENV"
    fi
  done < "$ADDR_FILE"
  echo ">> Bridge-BE/.env updated"
fi

# Update Bridge-FE/.env.local with new addresses
FE_ENV="$ROOT_DIR/Bridge-FE/.env.local"
if [ -f "$FE_ENV" ] && [ -f "$ADDR_FILE" ]; then
  while IFS='=' read -r key value; do
    [[ -z "$key" || "$key" == \#* ]] && continue
    FE_KEY="NEXT_PUBLIC_${key}"
    if grep -q "^${FE_KEY}=" "$FE_ENV"; then
      sed -i "s|^${FE_KEY}=.*|${FE_KEY}=${value}|" "$FE_ENV"
    fi
  done < "$ADDR_FILE"
  echo ">> Bridge-FE/.env.local updated"
fi

echo ""
echo "Done! All chains running with fresh state."
echo "Deployed addresses:"
cat "$ADDR_FILE"
