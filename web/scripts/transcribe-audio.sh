#!/usr/bin/env bash
# Inbound audio transcription — local Whisper CLI, OpenAI API fallback (same as OpenClaw)
# Usage: transcribe-audio.sh <media-path>
set -euo pipefail

INPUT="${1:?usage: transcribe-audio.sh <media-path>}"

if [[ ! -f "$INPUT" ]]; then
  echo "transcribe-audio: file not found: $INPUT" >&2
  exit 1
fi

work_dir="$(mktemp -d)"
trap 'rm -rf "$work_dir"' EXIT

WHISPER_MODEL="${WHISPER_MODEL:-tiny}"
WHISPER_BIN="${WHISPER_BIN:-/usr/local/bin/whisper}"

transcribe_local() {
  if [[ ! -x "$WHISPER_BIN" ]]; then
    return 1
  fi

  "$WHISPER_BIN" "$INPUT" \
    --model "$WHISPER_MODEL" \
    --language French \
    --output_format txt \
    --output_dir "$work_dir" \
    --fp16 False \
    >/dev/null 2>&1

  local base
  base="$(basename "$INPUT")"
  base="${base%.*}.txt"
  if [[ -f "$work_dir/$base" ]]; then
    cat "$work_dir/$base"
    return 0
  fi
  return 1
}

transcribe_openai() {
  if [[ -f /root/.openclaw-secrets.env ]]; then
    # shellcheck disable=SC1091
    source /root/.openclaw-secrets.env
  fi

  if [[ -z "${OPENAI_API_KEY:-}" ]]; then
    return 1
  fi

  local ext="${INPUT##*.}"
  local audio_file="$INPUT"

  if [[ "$ext" == "ogg" || "$ext" == "opus" ]]; then
    audio_file="$work_dir/audio.mp3"
    ffmpeg -hide_banner -loglevel error -y -i "$INPUT" -ar 16000 -ac 1 "$audio_file" 2>/dev/null
  fi

  local response
  response=$(curl -s -X POST "https://api.openai.com/v1/audio/transcriptions" \
    -H "Authorization: Bearer $OPENAI_API_KEY" \
    -F "file=@${audio_file}" \
    -F "model=whisper-1" \
    -F "language=fr" \
    -F "response_format=text")

  if [[ -n "$response" ]]; then
    echo "$response"
    return 0
  fi
  return 1
}

if transcribe_local; then
  exit 0
fi

if transcribe_openai; then
  exit 0
fi

echo "transcribe-audio: local Whisper and OpenAI API both failed" >&2
exit 1
