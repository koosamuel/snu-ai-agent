#!/bin/sh
set -eu

PROJECT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
STAGING_DIR=$(mktemp -d "$PROJECT_DIR/.dist-staging.XXXXXX")
OUTPUT_DIR="$PROJECT_DIR/dist"

cleanup() {
  rm -rf "$STAGING_DIR"
}
trap cleanup EXIT INT TERM

for file in index.html styles.css app.js rag-assistant.js config.js menu.json manifest.webmanifest sw.js .nojekyll; do
  cp "$PROJECT_DIR/$file" "$STAGING_DIR/$file"
done

mkdir -p "$STAGING_DIR/assets"
cp "$PROJECT_DIR/assets/featured-cafe.png" "$STAGING_DIR/assets/featured-cafe.png"
cp "$PROJECT_DIR/assets/og-cafe-kiosk.png" "$STAGING_DIR/assets/og-cafe-kiosk.png"

rm -rf "$OUTPUT_DIR"
mv "$STAGING_DIR" "$OUTPUT_DIR"
trap - EXIT INT TERM

printf 'Static site ready: %s\n' "$OUTPUT_DIR"
