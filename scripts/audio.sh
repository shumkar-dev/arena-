#!/usr/bin/env bash
# ============================================================
# Подготовка озвучки и музыки: обрезать тишину по краям, выровнять громкость, сжать.
#   scripts/audio.sh <папка с исходниками>
# Файлы <голос>_<событие>.mp3 → public/voices/ (моно, 24 кГц, 48 кбит/с, −16 LUFS)
# music_menu.mp3, music_battle.mp3 → public/music/menu.mp3, battle.mp3 (моно, 56 кбит/с, −20 LUFS)
# Нужен ffmpeg (например: pip install imageio-ffmpeg, или apt install ffmpeg).
# ============================================================
set -euo pipefail
SRC="${1:?укажи папку с исходниками}"
FF="${FFMPEG:-ffmpeg}"
cd "$(dirname "$0")/.."
mkdir -p public/voices public/music

TRIM="silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.03,areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.08,areverse"
for f in "$SRC"/*_*.mp3; do
  n=$(basename "$f")
  case "$n" in music_*) continue ;; esac
  "$FF" -hide_banner -loglevel error -y -i "$f" \
    -af "$TRIM,afade=t=in:d=0.005,areverse,afade=t=in:d=0.03,areverse,loudnorm=I=-16:TP=-1.5:LRA=11" \
    -ac 1 -ar 24000 -c:a libmp3lame -b:a 48k "public/voices/$n"
  echo "голос: $n"
done

for n in menu battle; do
  [ -f "$SRC/music_$n.mp3" ] || continue
  "$FF" -hide_banner -loglevel error -y -i "$SRC/music_$n.mp3" \
    -af "silenceremove=start_periods=1:start_threshold=-55dB,areverse,silenceremove=start_periods=1:start_threshold=-55dB,areverse,loudnorm=I=-20:TP=-2:LRA=11" \
    -ac 1 -ar 44100 -c:a libmp3lame -b:a 56k "public/music/$n.mp3"
  echo "музыка: $n"
done
