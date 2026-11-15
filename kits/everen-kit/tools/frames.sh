#!/usr/bin/env bash
# Made By Everen — frames.sh
# Turn a video into a WebP frame sequence for scroll/drag animation (+ a half-count mobile set).
#
# Usage:  bash tools/frames.sh <video.mp4> <name> [frames=120] [width=1920]
# Result: assets/frames/<name>/0001.webp ...        (desktop)
#         assets/frames/<name>-m/0001.webp ...      (mobile: half frames, 1080w)
# Loop video instead of frames:
#         bash tools/frames.sh <video.mp4> <name> loop   → assets/video/<name>.mp4 (web-ready, muted)
set -euo pipefail
IN="${1:?video file}"; NAME="${2:?name}"; N="${3:-120}"; W="${4:-1920}"
command -v ffmpeg >/dev/null || { echo "ffmpeg not found — install it first (winget install ffmpeg / brew install ffmpeg)"; exit 1; }

if [ "$N" = "loop" ]; then
  mkdir -p assets/video
  ffmpeg -loglevel error -y -i "$IN" -an -vf "scale='min(1920,iw)':-2" -c:v libx264 -crf 23 -preset slow -pix_fmt yuv420p -movflags +faststart "assets/video/$NAME.mp4"
  ffmpeg -loglevel error -y -i "assets/video/$NAME.mp4" -frames:v 1 -q:v 80 "assets/video/$NAME-poster.webp"
  echo "Done: assets/video/$NAME.mp4 (+ poster)"; exit 0
fi

DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$IN")
FPS=$(awk "BEGIN{printf \"%.4f\", $N/$DUR}")
FPSM=$(awk "BEGIN{printf \"%.4f\", $N/2/$DUR}")
mkdir -p "assets/frames/$NAME" "assets/frames/$NAME-m"
ffmpeg -loglevel error -y -i "$IN" -vf "fps=$FPS,scale=$W:-2:flags=lanczos" -frames:v "$N" -c:v libwebp -quality 80 "assets/frames/$NAME/%04d.webp"
ffmpeg -loglevel error -y -i "$IN" -vf "fps=$FPSM,scale=1080:-2:flags=lanczos" -frames:v "$((N/2))" -c:v libwebp -quality 75 "assets/frames/$NAME-m/%04d.webp"
echo "Done: $(ls assets/frames/$NAME | wc -l) desktop frames, $(ls assets/frames/$NAME-m | wc -l) mobile frames."
echo "Check seamlessness: compare assets/frames/$NAME/0001.webp with the last frame."
