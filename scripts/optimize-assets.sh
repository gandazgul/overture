#!/usr/bin/env bash
# ==============================================================================
# Asset Optimization Script
# Copies originals to assets-original/ at project root, then resizes/compresses
# assets in public/assets/ to their actual rendered sizes.
# Requires: ImageMagick 7 (magick command)
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
SRC="$PROJECT_ROOT/public/assets"
ARCHIVE="$PROJECT_ROOT/assets-original"

echo "=== Asset Optimization ==="
echo "Source:  $SRC"
echo "Archive: $ARCHIVE"
echo ""

# ── Step 1: Archive originals ────────────────────────────────────────
if [ -d "$ARCHIVE" ]; then
  echo "Archive exists, syncing new assets..."
  # Copy any new PNGs from source that aren't already archived
  for f in "$SRC"/*.png; do
    [ -f "$f" ] || continue
    base=$(basename "$f")
    if [ ! -f "$ARCHIVE/$base" ]; then
      cp "$f" "$ARCHIVE/$base"
      echo "  Archived new asset: $base"
    fi
  done
else
  echo "Copying originals to $ARCHIVE..."
  cp -r "$SRC" "$ARCHIVE"
  # Remove .DS_Store from archive
  find "$ARCHIVE" -name '.DS_Store' -delete 2>/dev/null || true
  echo "Done."
fi
echo ""

# ── Step 2: Resize assets ───────────────────────────────────────────

echo "--- Backgrounds (game: 800px wide JPEG, thumbnails: 320px wide JPEG) ---"
for bg in "$ARCHIVE"/bg_*.png; do
  name=$(basename "$bg" .png)
  # Full-size for game scenes (800px wide, JPEG 85%)
  magick "$bg" -resize 800x -quality 85 "$SRC/${name}.jpg"
  # Remove old PNG
  rm -f "$SRC/${name}.png"
  # Thumbnail for theater selection cards (320px covers 300×164 card + 1.04× zoom)
  magick "$bg" -resize 320x -quality 80 "$SRC/${name}_thumb.jpg"
  echo "  $name: $(du -h "$SRC/${name}.jpg" | cut -f1) (full), $(du -h "$SRC/${name}_thumb.jpg" | cut -f1) (thumb)"
done
echo ""

echo "--- Card Back (128px wide) ---"
magick "$ARCHIVE/card_back.png" -resize 128x -strip "$SRC/card_back.png"
echo "  card_back: $(du -h "$SRC/card_back.png" | cut -f1)"
echo ""

echo "--- UI Logo (600px wide) ---"
magick "$ARCHIVE/ui_logo.png" -resize 600x -strip "$SRC/ui_logo.png"
echo "  ui_logo: $(du -h "$SRC/ui_logo.png" | cut -f1)"
echo ""

echo "--- UI Button Frame (256px wide) ---"
magick "$ARCHIVE/ui_button_frame.png" -resize 256x -strip "$SRC/ui_button_frame.png"
echo "  ui_button_frame: $(du -h "$SRC/ui_button_frame.png" | cut -f1)"
echo ""

echo "--- UI Stage (640px wide) ---"
magick "$ARCHIVE/ui_stage.png" -resize 640x -strip "$SRC/ui_stage.png"
echo "  ui_stage: $(du -h "$SRC/ui_stage.png" | cut -f1)"
echo ""

echo "--- Patron Cards (168px wide) ---"
for patron in "$ARCHIVE"/patron_*.png; do
  name=$(basename "$patron" .png)
  magick "$patron" -resize 168x -strip "$SRC/${name}.png"
  echo "  $name: $(du -h "$SRC/${name}.png" | cut -f1)"
done
echo ""

echo "--- Ushers (160px wide) ---"
for usher in "$ARCHIVE"/usher_*.png; do
  name=$(basename "$usher" .png)
  magick "$usher" -resize 160x -strip "$SRC/${name}.png"
  echo "  $name: $(du -h "$SRC/${name}.png" | cut -f1)"
done
echo ""

echo "--- Badges (64px) ---"
for badge in "$ARCHIVE"/badge_*.png; do
  name=$(basename "$badge" .png)
  magick "$badge" -resize 64x64 -strip "$SRC/${name}.png"
  echo "  $name: $(du -h "$SRC/${name}.png" | cut -f1)"
done
echo ""

# Clean up .DS_Store
find "$SRC" -name '.DS_Store' -delete 2>/dev/null || true

echo "=== Summary ==="
echo "Original: $(du -sh "$ARCHIVE" | cut -f1)"
echo "Optimized: $(du -sh "$SRC" | cut -f1)"
echo ""
echo "Done! Originals preserved in $ARCHIVE"
