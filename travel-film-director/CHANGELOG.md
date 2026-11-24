# Changelog

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
