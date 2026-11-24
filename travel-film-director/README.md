# AI Travel Film Director

A local, Python-first system that learns *how* travel filmmakers you admire structure, pace, frame and score their films. It does this from public YouTube references, without downloading them. It then uses that knowledge to plan and assemble an **editable** cut of your own raw footage, for DaVinci Resolve, with an explanation for every decision.

Status: **milestone 1 (reference intelligence) works end to end on real videos.** The footage → plan → OTIO → preview render → QA path works on test clips and needs real-trip tuning. See [ROADMAP.md](ROADMAP.md).

- [RESEARCH.md](RESEARCH.md): tool research, comparison matrix, final choices
- [ARCHITECTURE.md](ARCHITECTURE.md): modules, data layout, algorithms
- [CHANGELOG.md](CHANGELOG.md) · [ROADMAP.md](ROADMAP.md)

## Install (Windows 11)

1. Install **Python 3.11–3.13** (python.org, tick "Add to PATH").
2. Install **FFmpeg** and make sure `ffmpeg` and `ffprobe` are on PATH: `winget install Gyan.FFmpeg`.
3. Install **DaVinci Resolve 18.5+** (Free is fine; it imports `.otio` timelines).
4. In PowerShell:

```powershell
cd travel-film-director
py -m venv .venv
.venv\Scripts\Activate.ps1
pip install -e ".[claude,transcribe,dev]"
copy .env.example .env    # optional: add ANTHROPIC_API_KEY, cookies settings
pytest -q
```

macOS and Linux work the same way, with `python3 -m venv .venv && source .venv/bin/activate`. GPU is optional: faster-whisper uses CUDA 12 and cuDNN 9 when present, and otherwise runs on CPU (int8).

If YouTube asks you to "confirm you're not a bot", set `TFD_YT_COOKIES_FROM_BROWSER=firefox` (or `chrome`) in `.env`. This uses your own logged-in browser session.

## Use

### Web interface

```
tfd serve          # then open http://127.0.0.1:8765
```

- **References:** paste YouTube URLs, assign a creator, add notes. Open a video to see scenes, techniques, contact sheets and limitations.
- **Compare & ask:** see measured differences, set creator weights, and ask questions.
- **Projects:** pick your footage folder, target length and direction. Review the proposed storyline, remove shots, then approve, which exports `.otio`. In Resolve, choose **File › Import › Timeline…** and pick the `.otio`. You can also render a preview, which runs automatic QA.

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

tfd footage "D:\Trips\Kyrgyzstan\raw" --transcribe   # read-only analysis -> data/projects/raw
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
