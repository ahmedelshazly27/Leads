# Changelog

## 0.3.0 (2026-11-27): deep reference study
### Added
- Reference library expanded to 24 videos: 6 each from Joe Hattab, Daniel Dalen, Yusufa Sey and Omar Farooq.
- Every contact sheet (91) reviewed. 351 timestamped observations, one style guide per creator, and `STYLE_SYNTHESIS.md` comparing all four.
- Scene playbook (`director/playbook.py`): the director picks a hook formula (Joe / Omar / Yusufa / Daniel), a bridge for each sequence (map or place card), and a technique for each shot, recording which creator it borrows from.
- Transcript timing health check: corrupted caption timing is flagged and kept out of creator averages.
- Caption picker prefers English (machine-translated tracks are flagged); re-analysis keeps annotations; the comparison shows per-video ranges.

## 0.2.0 (2026-11-24): retarget to macOS
### Added
- `scripts/setup_macos.sh` (Homebrew Python 3.12 + FFmpeg, venv, install, tests) and a double-clickable `scripts/Travel Film Director.command`.
- Final Cut Pro export (`director_cut.fcpxml`) and FCP7 XML (`director_cut.xml`) alongside `.otio`.
- Apple Silicon transcription via mlx-whisper (auto-selected; `TFD_WHISPER_BACKEND` / `TFD_WHISPER_MODEL`).
- VideoToolbox hardware H.264 for preview renders on macOS (`TFD_VIDEO_ENCODER`).
- Footage: skip `._*` AppleDouble/hidden files and Photos/FCP library bundles; exact iPhone model from QuickTime tags; HDR, Dolby Vision and ProRes flags.
- Web UI: native Finder folder picker, Show in Finder, Final Cut/Premiere import instructions; macOS paths.
- Tests: 18 (adds macOS behaviour and the FCPXML round-trip).
### Changed
- Docs, install instructions and research updated from Windows 11 to macOS. Safari cookies supported for YouTube sign-in checks.

## 0.1.0 (2026-11-24)
### Added
- YouTube reference ingestion without downloading the video: metadata, chapters, replay heatmap, captions (json3, retries, client rotation, youtube-transcript-api fallback, user SRT/VTT), storyboard frames.
- Frame analysis (exposure, colour, palette, sharpness, faces, sky, on-screen text, letterbox crop), visual-sequence segmentation, Poisson cut-rate estimator, contact sheets.
- `VideoProfile` schema v1.0: scenes with per-scene cinematic/documentary/personal scores and evidence, techniques with timestamps, hook, narrative beats, editing/sound/colour/storytelling aggregates, limitations.
- Reference library (SQLite + FTS5), creator profiles, weighted comparison with ranked plain-language differences, `ask` (offline, Claude API or Claude Code), `annotate`, offline `ref rebuild`.
- Footage ingest (read-only), rule-based director, OTIO export, FFmpeg preview render with ducking and loudness normalisation, QA report.
- Local web UI (FastAPI + single page) and `tfd` CLI.
- Tests: 13 (reference pipeline, footage → plan → OTIO → render → QA on synthetic clips, web API).
### Fixed during development
- OpenCV 5 removed Haar cascades: pinned `opencv-python-headless<5`.
- Videos without captions skewed style mixes: added visual-only scoring with a low-confidence flag.
- Black clips passed the quality gate (caught by QA): added a hard "black / unusable" flag.
