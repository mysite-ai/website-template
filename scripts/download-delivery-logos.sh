#!/usr/bin/env bash
#
# Download delivery-provider brand logos from logo.dev into
# public/logos/delivery/<slug>.png. Run this once per new provider.
#
# Requires:
#   - LOGO_DEV_PUBLISHABLE_KEY environment variable (pk_...) OR the
#     token hardcoded below for team convenience. Only the publishable
#     key is safe to commit — never the secret key (sk_...).
#
# Usage:
#   bash scripts/download-delivery-logos.sh                  # re-fetch all known providers
#   bash scripts/download-delivery-logos.sh wolt wolt.com    # fetch a single one
#
# The image URL params request:
#   - format=png    (transparent background for our card treatment)
#   - size=128      (rendered at 32x32 with retina 2x pixels)
#   - retina=true   (adds 2x density so display size 32 uses 64 pixels)
#
# Docs: https://www.logo.dev/docs/logo-images/introduction

set -euo pipefail

TOKEN="${LOGO_DEV_PUBLISHABLE_KEY:-pk_ELjo4KSSTHiRGwlaEzKpWQ}"
BASE="https://img.logo.dev"
DEST="public/logos/delivery"

# Ensure we're at the repo root so relative paths resolve.
cd "$(dirname "$0")/.."

mkdir -p "$DEST"

download_one() {
  local slug="$1"
  local domain="$2"
  local out="$DEST/$slug.png"
  local url="$BASE/$domain?token=$TOKEN&size=128&retina=true&format=png"
  printf "  %-10s <- %-20s ... " "$slug" "$domain"
  local code
  code="$(curl -sSL -o "$out" -w "%{http_code}" "$url")"
  if [[ "$code" == "200" ]]; then
    printf "OK (%s bytes)\n" "$(wc -c < "$out" | tr -d ' ')"
  else
    printf "FAIL (HTTP %s)\n" "$code"
    rm -f "$out"
    return 1
  fi
}

if (( $# == 2 )); then
  download_one "$1" "$2"
  exit 0
fi

# Full set — every provider referenced by any tenant seed. Keep this
# list in sync with the LOGO_SLUG map in src/components/sections/Delivery.astro.
declare -a PAIRS=(
  "wolt:wolt.com"
  "glovo:glovoapp.com"
  "pyszne:pyszne.pl"
  "ubereats:ubereats.com"
  "doordash:doordash.com"
  "grubhub:grubhub.com"
  "bolt:bolt.eu"
)

echo "Downloading delivery logos from logo.dev..."
for pair in "${PAIRS[@]}"; do
  slug="${pair%%:*}"
  domain="${pair##*:}"
  download_one "$slug" "$domain"
done
echo
echo "Done. Commit public/logos/delivery/*.png to make them available at build time."
