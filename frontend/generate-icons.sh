#!/bin/bash
# Save as generate-icons.sh

SOURCE="public/icon-source.png"
OUTPUT_DIR="public/icons"

# Generate all sizes
convert $SOURCE -resize 72x72 $OUTPUT_DIR/icon-72x72.png
convert $SOURCE -resize 96x96 $OUTPUT_DIR/icon-96x96.png
convert $SOURCE -resize 128x128 $OUTPUT_DIR/icon-128x128.png
convert $SOURCE -resize 144x144 $OUTPUT_DIR/icon-144x144.png
convert $SOURCE -resize 152x152 $OUTPUT_DIR/icon-152x152.png
convert $SOURCE -resize 192x192 $OUTPUT_DIR/icon-192x192.png
convert $SOURCE -resize 384x384 $OUTPUT_DIR/icon-384x384.png
convert $SOURCE -resize 512x512 $OUTPUT_DIR/icon-512x512.png

# Generate favicon
convert $SOURCE -resize 32x32 public/favicon.ico

echo "Icons generated successfully!"