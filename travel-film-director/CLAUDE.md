# AI Travel Film Director: handoff for Claude Code

You're continuing a project started in a cloud session. This file carries the context from that conversation.
Read README.md, ARCHITECTURE.md, STYLE_SYNTHESIS.md, GRAPHICS_AND_STOCK.md and ROADMAP.md for detail.
(The repo-root CLAUDE.md is about an unrelated Clay/leads setup. Ignore it for this project.)

## The user and their goals
- Wants to edit **their own raw travel footage** into travel documentaries in the style of four creators:
  **Joe Hattab, Omar Farooq (عمر فاروق, #OmarTries), Yusufa Sey, Daniel Dalen**.
  A fifth name, "Arab", is a streamer: skip it.
- **Platform: macOS** (Apple Silicon first). Not Windows.
- **Personal use only** (edits for their own viewing). They explicitly removed the earlier "don't download
  reference videos" rule: downloading references for private analysis is fine. Keep downloads in data/ and never commit them.
- **Ignore Yusufa Sey's missing captions**; don't flag or chase them.
- Wants an **editable timeline** (DaVinci Resolve via .otio, Final Cut Pro via .fcpxml), deliberate editing over flashy effects,
  and **no invented events, dialogue or facts**. Narration and place names come only from their trip_notes.md.
- Prefers you act autonomously with sensible defaults, report honestly, and verify detectors by eye before trusting them.

## Where things stand (end of cloud session, 2026-11-27)
- 24 reference videos studied (6 per creator, list in examples/references.txt). Every storyboard contact sheet
  was reviewed: per-video notes in examples/annotations/ (351 observations), style guides in examples/style_notes/,
  synthesis in STYLE_SYNTHESIS.md. The director uses a scene playbook distilled from it (src/tfd/director/playbook.py).
- Built and tested (36 tests), **not yet run on real reference videos**, because YouTube refuses video downloads from cloud servers:
  `tfd ref deep` = full-rate cuts/transitions/camera moves, audio (music, tempo, beat sync), motion graphics, stock/filler.
- Storyboard-level dissolve/whip detection was removed after manual review showed false positives. Full-rate analysis replaces it.
- Footage → plan → OTIO/FCPXML → preview render → QA works on synthetic clips. Not yet on the user's real footage.

## First steps on this Mac
1. `./scripts/setup_macos.sh` (Homebrew Python 3.12 + FFmpeg, venv, install, tests).
2. `source .venv/bin/activate && tfd ref batch examples/references.txt --no-claude` (rebuilds the library, ~25 min).
3. `tfd annotate examples/annotations` (re-attaches all qualitative notes).
4. `tfd ref deep --all --download` (downloads 720p, analyses; add `--delete-media` to save disk).
5. Review each video's graphics_sheets/ and filler_sheets/ by eye. Update GRAPHICS_AND_STOCK.md and examples/style_notes/
   with the measured results (exact cut rates, transition types, camera moves, beat sync, graphics animation).
6. Then the user's footage: `tfd footage <trip folder>` → `tfd direct <project>` → review → export → `tfd render`.

Commit to branch claude/wizardly-allen-cd58aw and push.
