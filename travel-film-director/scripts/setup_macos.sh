#!/usr/bin/env bash
# One-time setup on macOS (Apple Silicon or Intel). Safe to re-run.
set -euo pipefail
cd "$(dirname "$0")/.."

if ! command -v brew >/dev/null 2>&1; then
  echo "Homebrew is required: https://brew.sh  (then re-run this script)"; exit 1
fi
brew list python@3.12 >/dev/null 2>&1 || brew install python@3.12
brew list ffmpeg >/dev/null 2>&1 || brew install ffmpeg

PY="$(brew --prefix python@3.12)/bin/python3.12"
[ -d .venv ] || "$PY" -m venv .venv
# shellcheck disable=SC1091
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -e ".[claude,transcribe,dev]"
[ -f .env ] || cp .env.example .env

echo "--- checks"
ffmpeg -hide_banner -encoders 2>/dev/null | grep -q h264_videotoolbox && echo "VideoToolbox H.264: available" || echo "VideoToolbox H.264: not found (libx264 will be used)"
python -c "import platform; print('Machine:', platform.machine())"
python -c "import mlx_whisper; print('Transcription: mlx-whisper (Apple GPU)')" 2>/dev/null || echo "Transcription: faster-whisper (CPU)"
python -m pytest -q
echo
echo "Done. Start with:  source .venv/bin/activate && tfd serve"
echo "Or double-click scripts/Travel Film Director.command"
