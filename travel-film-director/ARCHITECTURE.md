# Architecture

```
 YouTube URLs ──► youtube/ingest ──► analysis/{frames,scenes,transcript,style,reference} ──► VideoProfile JSON
   (metadata, captions, storyboards;                                                            │
    never the video)                                                                            ▼
                                                    library/db (SQLite + FTS5) ◄──── library/creators (aggregate, compare, weight)
                                                                │                                │
                                              tfd search / ask / context  ◄── Claude Code or Claude API (llm/claude)
                                                                │
 Your footage folder ──► footage/ingest (read-only) ──► footage.json
                                │
                                ▼
                       director/planner  ──► plan.json (explainable timeline spec)
                                │                    │
                                ▼                    ▼
                    editing/otio_export        editing/render (FFmpeg preview) ──► editing/qa ──► qa_report.json
                    (.otio → Resolve, .fcpxml → Final Cut Pro,
                     .xml → Premiere)
```

Everything is a plain file under `data/` (configurable via `TFD_DATA_DIR`):

```
data/
  library.sqlite3                     search index (rebuildable)
  library/comparison.{json,md}
  library/<creator>/creator_profile.json
  library/<creator>/<video_id>/{source,metadata,transcript,profile}.json, frames/, contact_sheets/
  projects/<name>/{project,footage,plan,qa_report}.json, frames/, contact_sheets/, timelines/, renders/
```

## Modules

| Module | Responsibility |
|---|---|
| `config.py` | Settings from env / `.env` (secrets never in code) |
| `youtube/ingest.py` | yt-dlp extraction with client rotation and cookies; caption tracks (json3), with fallback to youtube-transcript-api or a user SRT/VTT; storyboard sheets sliced into timestamped frames; `source.json` cache |
| `analysis/frames.py` | Per-frame measurements: brightness, contrast, saturation, colourfulness, warmth, sharpness, edge density, faces (Haar), sky fraction, text likelihood, palette, letterbox crop |
| `analysis/scenes.py` | Visual-sequence segmentation (adaptive threshold, chapter-aware) and the Poisson cut-rate estimator |
| `analysis/transcript.py` | Speech coverage, caption markers (`[Music]`), speech gaps, pronoun/fact/reflection/hook vocabulary, dialogue proxy, SRT/VTT parsing |
| `analysis/style.py` | Transparent rules: shot type, visual tags, **style-mode scores** (cinematic / documentary / personal) with evidence; visual-only fallback |
| `analysis/reference.py` | Assembles a `VideoProfile`: scenes, techniques with timestamps, hook, narrative beats, editing / sound / colour / storytelling aggregates, limitations |
| `library/db.py` | SQLite + FTS5 index of scenes, techniques and qualitative observations; creators with weights |
| `library/creators.py` | Creator profiles (means across videos, signature techniques, shot mix, examples) and comparison (metric table + ranked plain-language differences) |
| `llm/claude.py` | Optional: structured qualitative analysis from contact sheets (`messages.parse` + Pydantic) and library Q&A with a cached system prompt |
| `footage/ingest.py` | Skips macOS `._*`/hidden files and library bundles; ffprobe metadata, orientation/rotation, device hints (exact iPhone model from QuickTime tags, DJI, GoPro, Insta360), HDR/Dolby Vision/ProRes flags, sampled frames, optical-flow shake and camera movement, PySceneDetect cuts, optional transcription (mlx-whisper on Apple Silicon, faster-whisper otherwise), near-duplicates, quality score and flags. Refuses to write inside the footage folder |
| `director/planner.py` | Clip classification (establishing, landscape, first-person, conversation, interview, transport, cultural, action, b-roll) → mode per clip → hook → chronological sequences → reference creator per sequence mode → trim to target → titles and narration **only from `trip_notes.md`** → review flags |
| `editing/otio_export.py` | OTIO timeline plus FCPXML (Final Cut Pro) and FCP7 XML (Premiere) via OTIO adapters: V1 picture, A1 sync/ambient, A2 music; per-clip metadata (mode, reference, reason), blue decision markers, yellow title markers, red review markers. Media referenced in place |
| `editing/render.py` | FFmpeg preview (VideoToolbox H.264 on macOS, libx264 elsewhere): conform to 1080p25 with pad, ambient gain, music ducking (sidechain), EBU R128 loudnorm. Never overwrites |
| `editing/qa.py` | Black frames, silence, abrupt short-term loudness jumps, shot repetition, long b-roll, integrated loudness → `qa_report.json` |
| `web/app.py` + `static/index.html` | Local UI on 127.0.0.1, with a native Finder folder picker and Show in Finder on macOS: references, comparison, weighting, ask, projects (create → review storyline → remove items → approve/export → render + QA) |
| `cli.py` | `tfd ref add/batch/rebuild`, `library`, `compare`, `search`, `ask`, `context`, `annotate`, `footage`, `direct`, `render`, `serve` |

## Key design decisions

**Derived observations only.** References store numbers, labels, ≤280-character caption excerpts and timestamps, plus storyboard thumbnails locally for contact sheets. Example exports in `examples/` strip excerpts entirely.

**Per-scene style, not a preset.** Each scene gets three scores that sum to 1:

- **Cinematic:** low speech coverage, music markers, establishing/landscape/night framing, sky, colourfulness.
- **Documentary:** factual and contextual vocabulary, dialogue with people in frame, speech without first-person framing.
- **Personal:** first- and second-person language, reflective vocabulary, face close-ups, scaled by speech.

The director applies the same idea to your clips and picks, per sequence, the reference creator whose profile best expresses that mode (multiplied by your weight). It borrows their pacing (estimated shot length). A sequence never gets a style effect just because a preset says so.

**Cut-rate estimation from sparse samples.** With samples Δ seconds apart and cuts modelled as a Poisson process with rate λ, P(two samples in different shots) = 1 − e^(−λΔ). We measure the fraction p of "changed" sample pairs (histogram + thumbnail distance > 0.22) and estimate λ = −ln(1 − p)/Δ. At p ≥ 0.95 the estimate saturates (≈18 cuts/min at Δ = 10 s) and is flagged. Camera movement within a shot can inflate p, so treat the figure as relative, for comparing creators, not absolute.

**Explainability.** Every scene label carries `evidence`. Every timeline item carries a `reason`. Plan-level `decisions` and `needs_review` travel into the OTIO file as markers, so you see the director's reasoning inside Resolve.

**No fabrication.** The planner never writes narration or location names it was not given. Without `trip_notes.md` it emits review flags instead. Narration lines are taken verbatim from `- narration (N): …` entries, and titles from `- location (N): …`.

**Safety of user files.** Footage is opened read-only. Output directories inside the footage folder are refused. Renders and exports use `safe_output_path` (numbered suffix) and JSON writes are atomic. The test suite verifies originals' hashes are unchanged.

## Claude integration

- **Claude Code (primary, no API cost):** run `tfd context "<question>"` and read the JSON in `data/library/`. Look at contact sheets, write an annotation JSON (see `examples/annotations/`), then run `tfd annotate <video_id> file.json`. You can edit `plan.json` directly before `tfd direct`'s export or the UI's approve step. A project skill in `.claude/skills/travel-film-director/` documents this loop.
- **Claude API (optional):** with `ANTHROPIC_API_KEY` set, `tfd ref add` adds a qualitative analysis automatically (model `TFD_CLAUDE_MODEL`, default `claude-opus-5-5`, effort `TFD_CLAUDE_EFFORT`, default `medium`), and `tfd ask` answers in prose with citations.
