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
- Colour grading added (per-clip normalisation, HDR tone-map, creator-inspired LUT looks), tested on synthetic clips and checked by eye on real frames.
- Built and tested (43 tests), **not yet run on real reference videos**, because YouTube refuses video downloads from cloud servers:
  `tfd ref deep` = full-rate cuts/transitions/camera moves, audio (music, tempo, beat sync), motion graphics, stock/filler.
- Storyboard-level dissolve/whip detection was removed after manual review showed false positives. Full-rate analysis replaces it.
- Footage → plan → OTIO/FCPXML → preview render → QA works on synthetic clips. Not yet on the user's real footage.

## Update 2026-11-28 (first Mac session)
- Setup works on this Mac (Apple Silicon, Homebrew FFmpeg 8 without drawtext/zscale/libass: tests that need them skip).
- **Afghanistan trip (2-7 Oct 2026) is edited**: `data/projects/Afghanistan Oct 2026/` (not committed).
  140 Osmo Pocket clips ingested from the DJI .LRF proxies extracted from the zips in
  `~/Desktop/Projects/AI Travel Film Director/Footage/Afghanistan Oct 2026/` (4K originals: same zips, and on the T7
  drive; run `tfd relink` when T7 is plugged in). 81 clips are D-Log2, 59 Rec.709; the grade converts per clip.
  Director's cut 14:57, 84 shots, cold open + 5 day chapters, joe-teal look, burned-in subtitles, SRT, OTIO/FCPXML in
  `timelines/`, preview in `renders/preview.mp4`. Every on-screen place name is cited in `trip_notes.md` (draft for
  the user to confirm). Open items: no music yet (user must supply a licensed track), the user should watch the
  preview and say what to change; the auto plan from before the hand edit is in `timelines/auto_plan/`.
- 2026-11-28 later: user said colour looked "toasted" and text "cheap". Fixed by measuring against the references:
  per-clip tone curve (mid ~0.36, white 0.90, soft shoulder), daniel-natural-warm look at 50-70%, new typography
  (typography.py). User approved the 79 s sample ("looks good, do all").
- Documentary layer (user asked for Joe/Omar-style filler): cutaways over talk (plan["cutaways"], V2 track),
  animated route maps (maps.py, Natural Earth 110m in data/assets/), dated history cards (style "history").
  History card facts are researched with sources in trip_notes.md and are PENDING the user's approval.
  Archival/stock: a shortlist (Wikimedia Commons PD/CC, US Army PD, NASA) awaits the user's download approval;
  CC BY/BY-SA items need an end-credits card. Music: the user approved "Atlas • Afghanistan" (Pixabay) but it is
  NOT downloaded: curl to the Pixabay CDN was blocked by the sandbox and the in-app browser can't save files;
  the user should download it and drop it in <project>/music/.
- Reference deep pass (`tfd ref deep --all --download`) is running/ran in the background; check `data/deep_all.log`,
  then do step 5 below (graphics/filler sheet review, update GRAPHICS_AND_STOCK.md and style notes).

## Priority: the user's own footage
The user wants their footage edited as soon as possible. **At the start, ask which trip folder to use** (e.g. one day or
one location first, 30-80 clips). Start the footage work while the reference deep pass runs in the background.
For the edit:
- `tfd footage <trip folder>` (read-only; add `--transcribe` for speech, MLX on Apple Silicon)
- `tfd direct <project> --minutes N --direction balanced` builds the story, playbook techniques and **colour grade**:
  per-clip white balance/exposure normalisation, HDR (iPhone HLG/Dolby Vision) tone-mapping, and a creator-inspired look
  (joe-teal / omar-warm-film / daniel-natural-warm / yusufa-amber / neutral) exported as .cube LUTs in <project>/grade/.
  The user can override with `- grade: <look>` in trip_notes.md.
- Review plan.json yourself (story, hook, order, trims) and improve it before exporting. Never invent facts.
- Export (.otio for Resolve, .fcpxml for Final Cut) and `tfd render <project>` for a graded preview + QA report.
  In Resolve, apply the 100% LUT on a timeline node; in Final Cut, use a Custom LUT effect on an adjustment layer.
- Show the user the preview and the QA issues, and ask what to change.

## First steps on this Mac
1. `./scripts/setup_macos.sh` (Homebrew Python 3.12 + FFmpeg, venv, install, tests).
2. `source .venv/bin/activate && tfd ref batch examples/references.txt --no-claude` (rebuilds the library, ~25 min).
3. `tfd annotate examples/annotations` (re-attaches all qualitative notes).
4. `tfd ref deep --all --download` (downloads 720p, analyses; add `--delete-media` to save disk).
5. Review each video's graphics_sheets/ and filler_sheets/ by eye. Update GRAPHICS_AND_STOCK.md and examples/style_notes/
   with the measured results (exact cut rates, transition types, camera moves, beat sync, graphics animation).
6. The user's footage (see "Priority" above). Do this as early as possible, in parallel with steps 2-5.

Commit to branch claude/wizardly-allen-cd58aw and push.
