# AI Travel Film Director

A local, Python-first system that learns *how* travel filmmakers you admire structure, pace, frame and score their films. It does this from public YouTube references, without downloading them. It then uses that knowledge to plan and assemble an **editable** cut of your own raw footage, for DaVinci Resolve or Final Cut Pro on your Mac, with an explanation for every decision.

Status: **milestone 1 (reference intelligence) works end to end on real videos.** The footage → plan → timeline export → preview render → QA path works on test clips and needs real-trip tuning. See [ROADMAP.md](ROADMAP.md).

- [RESEARCH.md](RESEARCH.md): tool research, comparison matrix, final choices
- [ARCHITECTURE.md](ARCHITECTURE.md): modules, data layout, algorithms
- [CHANGELOG.md](CHANGELOG.md) · [ROADMAP.md](ROADMAP.md)

## Install (macOS)

Target: macOS 14+ on Apple Silicon. Intel Macs should work too, with CPU-only transcription. Not yet run on a real Mac; see ROADMAP item 1.

1. Install [Homebrew](https://brew.sh).
2. Install **DaVinci Resolve 18.5+** (free, from blackmagicdesign.com) and/or **Final Cut Pro**.
3. In Terminal:

```bash
cd travel-film-director
./scripts/setup_macos.sh
```

The script installs Python 3.12 and FFmpeg via Homebrew, creates `.venv`, and installs everything. On Apple Silicon that includes `mlx-whisper`, which runs speech-to-text on the GPU. It then runs the test suite.

Afterwards, double-click **`scripts/Travel Film Director.command`** in Finder to start the app. If macOS blocks it the first time, right-click it and choose Open. You can also run `source .venv/bin/activate && tfd serve`.

**Manual install** (equivalent):

```bash
brew install python@3.12 ffmpeg
python3.12 -m venv .venv && source .venv/bin/activate
pip install -e ".[claude,transcribe,dev]"
cp .env.example .env
pytest -q
```

If YouTube asks you to "confirm you're not a bot", set `TFD_YT_COOKIES_FROM_BROWSER=safari` in `.env` (or `chrome`/`firefox`). This uses your own logged-in browser session. Safari cookies require giving Terminal **Full Disk Access** (System Settings › Privacy & Security).

**Mac specifics**

- **iPhone footage:** clips in the Photos app aren't plain files. Select them, choose File › Export › **Export Unmodified Originals**, and save them into a trip folder. The scanner reads the exact iPhone model from the clip metadata and flags HDR (HLG/Dolby Vision) and ProRes clips.
- **External drives:** macOS `._*` sidecar files, hidden files and library bundles (`.photoslibrary`, `.fcpbundle`) are skipped automatically.
- **Speed:** preview renders use the Apple hardware encoder (VideoToolbox) when available. Set `TFD_VIDEO_ENCODER=libx264` to force software. Transcription uses MLX on Apple Silicon; override with `TFD_WHISPER_BACKEND=faster-whisper` and `TFD_WHISPER_MODEL=small|medium|large-v3`.

## Use

### Web interface

```
tfd serve          # then open http://127.0.0.1:8765
```

- **References:** paste YouTube URLs, assign a creator, add notes. Open a video to see scenes, techniques, contact sheets and limitations.
- **Compare & ask:** see measured differences, set creator weights, and ask questions.
- **Projects:** click **Choose…** to pick your footage folder in a Finder dialog, then set target length and direction. Review the proposed storyline, remove shots, then approve, which exports the timeline (**Show in Finder** reveals it):
  - **DaVinci Resolve:** File › Import › Timeline… › `director_cut.otio`
  - **Final Cut Pro:** File › Import › XML… › `director_cut.fcpxml`
  - **Premiere Pro:** import `director_cut.xml` (FCP7 XML)

  You can also render a preview, which runs automatic QA.

### CLI

```
tfd ref add --creator "Joe Hattab" --notes "strong hooks" https://www.youtube.com/watch?v=twMvQ64jom8
tfd ref batch examples/references.txt          # "creator | url | notes" per line
tfd ref add --creator X --transcript-file my.srt URL   # when YouTube has no captions
tfd compare                                    # rebuild + print the comparison
tfd search "title card" --mode documentary     # timestamped examples with links
tfd ask "How do the three creators open their films?"
tfd annotate <video_id> notes.json             # merge qualitative notes (e.g. written by Claude Code)
tfd ref rebuild                                # recompute profiles offline after upgrades

tfd footage ~/Movies/Trips/Kyrgyzstan/raw --transcribe   # read-only analysis -> data/projects/raw
tfd direct data/projects/raw --minutes 8 --direction balanced
tfd render data/projects/raw                   # preview MP4 + qa_report.json
```

### Asking Claude about the references

- **In Claude Code** (no API key needed), ask in this repo: *"Using the travel film director library, how do Joe Hattab and Daniel Dalen differ in their hooks?"* Claude Code runs `tfd context`, reads the profiles and contact sheets, and answers. A project skill (`.claude/skills/travel-film-director`) tells it how.
- **With `ANTHROPIC_API_KEY`:** `tfd ask` and the web UI answer in prose, citing videos and timestamps. Analysis also gets an automatic qualitative pass. Costs are bounded: about 6 downscaled contact sheets plus a sampled transcript per video.

### Facts, titles and narration

The director **never invents** places, events or dialogue. To get location titles and narration, add `trip_notes.md` to the project folder:

```
- location (1): Almaty, Kazakhstan
- location (2): Kolsai Lakes
- narration (2): We drove six hours east to reach the lakes before sunset.
```

Put licensed music files in `<project>/music/`.

## What is and isn't analysed in references

- **Analysed:** metadata, chapters, the most-replayed heatmap, captions, and YouTube's own storyboard previews (320×180, one frame every ~10 s). From these come timestamped scenes, a per-scene cinematic/documentary/personal mix, hook pattern, narrative beats, estimated pacing, speech/music balance, grade and palette, letterboxing, on-screen text, and signature techniques.
- **Not analysed:** exact cuts, transitions and camera moves (they aren't observable at that sampling rate), and the audio itself. Every profile lists its own `limitations`.

## Example output

`examples/reference_demo/` contains the three demo profiles and comparison (Joe Hattab, Daniel Dalen, Yusufa Sey). These are derived metrics and annotations only; transcript excerpts and images are excluded.
