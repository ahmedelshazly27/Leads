# Changelog

## 0.8.0 (2026-11-28): documentary layer and a reference-matched look
### Added
- Cutaways (V2 track): picture covers the speaker while their sound and subtitles continue; exported to OTIO/FCPXML.
- Animated route maps from Natural Earth outlines (country -> region camera, eased route, pins, Arabic labels).
- Dated history cards (`history` style), generated clips (never graded), `tfd render --until N` samples.
- Per-clip tone curve matched to the 24 references; editorial typography; mixed Arabic/English subtitle runs.

## 0.7.0 (2026-11-28): first real trip (Afghanistan, 140 clips) on macOS
### Added
- Subtitles from the footage's own speech: `timelines/director_cut.srt` for Resolve/Final Cut, burned into the preview with Pillow PNG overlays (no libass/drawtext needed; Arabic shaped via raqm). Whisper stock phrases, loops and character runs are dropped; `"captions": false` on a timeline item turns them off where the transcript is unreliable.
- Title styles: `title` (upper-left place/time card) and `word` (one big centred word per beat for the hook, a neutral design of our own).
- Camera log footage: the DJI gamma tag (`com.dji.camera.ColorGammaSxS`, e.g. D-Log2) is read at ingest; such clips get an adaptive log->Rec.709 step (clip black/white points, S-curve, saturation) before the look.
- DJI `.LRF` proxies: analysed instead of the 4K original when next to it; ingested as clips when the originals are offline/zipped (`proxy_only`), then `tfd relink <project> <dirs>` points the timeline at the originals.
- `tfd export <project>` re-exports a hand-edited `plan.json` (recomputes positions, adds clips the planner skipped, with their correction).
### Fixed
- `--transcribe` crashed on every clip (keyword shadowed the function).
- `opencv-python` 5.x (pulled in by scenedetect 0.7) replaced the 4.x cv2 and removed Haar cascades; both pinned below 5.
- FFmpeg 8 `colorlevels` returned black frames on 10-bit input (forced 16-bit RGB).
- Graphics deep pass crashed on text boxes at the frame edge.
- The auto planner overshot on talk-heavy trips (194 min for a 15 min target): speech windows now respect the requested length and spoken items are trimmed too.
- Osmo Pocket footage was tagged "possible drone/aerial".
### Performance
- Ingest ~6x faster on 4K HEVC: keyframe-only scene-cut scan, proxy analysis, greedy Whisper decoding (large-v3 on MLX: 34 s per 259 s of speech).

## 0.6.0 (2026-11-27): colour grading
### Added
- `editing/grade.py`: per-clip white balance and exposure normalisation, HDR to SDR tone-mapping, and five looks (four inspired by the reference creators, plus neutral) exported as `.cube` LUTs. The director picks the look and its strength per mode; `trip_notes.md` can override it. The preview render applies it, and the timeline export carries the LUT and per-clip corrections.
- The handoff note (`CLAUDE.md`) now prioritises the user's footage and the grade.
- Tests: 43 (looks, LUT format, skin protection, correction, FFmpeg with spaces in paths, HDR chain).

## 0.5.0 (2026-11-27): deep pass from the video itself
### Changed
- Reference videos may now be downloaded for private analysis (`tfd ref deep --download`). This must run on your own computer, because YouTube refuses cloud servers.
### Added
- `tfd ref deep`: full-rate cuts, transitions and camera moves; measured audio (music share, tempo, cut-on-beat index); motion graphics (pretrained PP-OCRv3 text detector; position, duration, entry animation, review sheets); stock/archival/filler candidates (black and white, grain, pillarbox, corner logo, off-grade; review sheets).
- `tfd stock`: Pexels and Pixabay search and download with a licence manifest. The director suggests stock searches for sequences without an establishing shot.
- `GRAPHICS_AND_STOCK.md`: graphics and filler catalogue per creator (preliminary, from the storyboard review) and free sources.
- Tests: synthetic edit with a fading lower third, a title card, an archival shot, a corner logo and a 120 BPM track (36 tests).

## 0.4.0 (2026-11-27): cuts, transitions and camera moves
### Added
- `analysis/motion.py`: storyboard camera moves (ORB + RANSAC, people masked out) and a held-shot measure (sample pairs still in the same shot after 10 s).
- `analysis/local_video.py` + `tfd ref local`: full-frame-rate shot list, transition types (hard cut, cross-dissolve, dip to black, whip) and per-shot camera move. Merged into profiles and creator comparisons as exact metrics.
- Tests: synthetic camera moves with known geometry, and a synthetic edit with a known cut, dissolve, fade, push-in and pan (32 tests).
### Removed
- Storyboard dissolve and whip-blur detection. Manual review of flagged frames showed mostly false positives (smooth landscapes, unrelated shots).
### Changed
- Missing captions are no longer reported as data gaps.

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
