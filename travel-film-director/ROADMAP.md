# Roadmap

## Done
- [x] Phase 1: research, comparison matrix, architecture (RESEARCH.md)
- [x] Phase 2: YouTube ingestion (metadata, captions, storyboards), frames, sequence detection, contact sheets
- [x] Phase 3: video profiles, creator profiles, comparison, SQLite/FTS search, weights, ask (offline, Claude API or Claude Code)
- [x] Milestone 1 demo on real videos from Joe Hattab, Daniel Dalen and Yusufa Sey
- [x] Phase 4 (v0): footage ingest: metadata, orientation, device hints, blur/shake/exposure, duplicates, cuts, contact sheets, optional transcription, ranking
- [x] Phase 5 (v0): rule-based director with per-sequence mode choice and explainable plan
- [x] Phase 6 (v0): OTIO export, FFmpeg preview render with ducking and loudnorm, QA report
- [x] Phase 7 (v0): local web UI covering the whole flow

## Next (in order)
1. **Resolve round-trip on your machine:** import `director_cut.otio` into Resolve 20/21 Free, confirm clip paths, ranges and markers. Add `otio-fcp-adapter` (FCP7 XML) as a fallback if needed.
2. **Run on a real trip folder** (hundreds of clips): profile runtime, tune quality thresholds per device (iPhone HDR/HLG, DJI D-Log, GoPro), parallelise ingest.
3. **Semantic understanding of footage:** CLIP/SigLIP embeddings for scene and activity labels (market, temple, hike, food, transport), near-duplicate search, and matching your shots to reference techniques. Optional Claude pass on footage contact sheets to label people, places and activities and to propose the story.
4. **Claude-as-director pass:** feed footage contact sheets, transcripts and the reference library to Claude (API or Claude Code) to rewrite `plan.json` (story arc, hook choice, narration slots), keeping the no-fabrication rule.
5. **Music:** beat tracking (beat_this or librosa) and snapping cinematic-sequence cuts to beats; music selection by energy curve.
6. **Audio:** speech-aware ducking keyframes in OTIO, ambient layering from non-speech clips, dialogue loudness per clip.
7. **Speed ramps, match cuts and transitions** as OTIO effects and transitions. Only where a sequence's mode and reference justify them.
8. **Titles and subtitles:** SRT export from transcripts, location cards from trip notes; QA subtitle sync.
9. **Resolve Studio integration (optional):** create the project, apply LUTs/CST and render presets through the scripting API or davinci-resolve-mcp.
10. Replace Haar faces with YuNet (OpenCV 5-compatible); move pinned dependencies to a lock file per OS.
