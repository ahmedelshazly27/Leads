# Research

Date: 2026-11-24. **Target platform: macOS (Apple Silicon first).** The project originally targeted Windows 11 and was retargeted the same day; section 6 covers what changed. Two sources feed this document:

1. **Hands-on findings** from building and running the pipeline in this session (marked **tested**).
2. **A verified tool matrix** (repos, licenses, activity) in [`docs/research_raw.md`](docs/research_raw.md). It was written while the target was Windows; its tool verdicts still apply, and section 6 covers macOS specifics. Each claim there is marked V (verified this session via PyPI JSON, GitHub search API, vendor pages) or U (unverified).

Nothing below is assumed from a README alone. Where something was not run, it says so.

## 1. Hands-on findings (tested)

| Finding | Evidence | Consequence |
|---|---|---|
| yt-dlp 2026.11.23 with the default client hit `429` then "Sign in to confirm you're not a bot" from this datacenter IP. | Ran `yt-dlp -F` | The tool rotates player clients and supports your own browser cookies (`TFD_YT_COOKIES[_FROM_BROWSER]`). |
| The `mweb,web_embedded` clients returned full metadata, chapters, the "most replayed" heatmap, **storyboard sprite sheets (320×180, one frame every ~10 s)** and caption tracks, with no media download. | All 3 reference videos ingested | Storyboards are the frame source for references, so we never download a video. |
| Caption downloads are flaky: the same track URL sometimes returns an empty body (PO-token experiments). A fresh extraction with another client usually works. | Observed on twMvQ64jom8 | Built in retries plus a fresh-session re-resolve. |
| `youtube-transcript-api` 1.2 is IP-blocked from this host. | `IpBlocked` exception | Kept only as a fallback (it normally works on residential IPs). |
| Some videos have **no caption tracks at all**, e.g. Yusufa Sey's travel films. | Checked 3 of his videos | Profile falls back to **visual-only** style scoring, flagged low-confidence. You can supply your own SRT/VTT with `--transcript-file`. Downloading the audio to transcribe it was deliberately not done (no-download rule). |
| OpenCV 5.1 removed `CascadeClassifier` (Haar). | `AttributeError` at runtime | Pinned `opencv-python-headless<5`. Migrating to YuNet (`FaceDetectorYN`) is on the roadmap. |
| Storyboard frames are clear enough to judge composition, subject, grade, title cards, letterboxing and burned-in captions. | Viewed contact sheets | Claude (API or Claude Code) can do the qualitative pass from contact sheets alone. |
| Individual cuts are **not** observable at 10 s sampling. | By construction | Cut rate is estimated statistically (Poisson model, see ARCHITECTURE.md) and capped/flagged when saturated. |
| OTIO 0.18.1 writes `.otio` fine. The FCP7 XML adapter is **not** bundled (`NotSupportedError`). | Ran export | `.otio` is the primary deliverable. FCP XML is written when `otio-fcp-adapter` is installed. |
| FFmpeg 6 filters `blackdetect`, `silencedetect`, `ebur128`, `loudnorm` and `sidechaincompress` work for QA, normalisation and ducking. | Test suite renders and QAs synthetic footage | Used for preview render and QA. |
| faster-whisper 1.2.1 installs (CPU, int8). | `pip install` | Used only on **your own** footage. |

## 2. Key verified facts from the matrix

- **DaVinci Resolve Free does not allow external Python scripting**, and from 21.1 Python scripting moved to Studio entirely (Blackmagic, quoted by Puget Systems on 2026-09-10). Resolve **imports `.otio` natively since 18.5**, Free included, via File › Import › Timeline.
- **Remotion** is source-available (free for individuals and companies of ≤3 people), not OSI open source, and JavaScript. It isn't needed for this project.
- **faster-whisper** has no Apple GPU support (CUDA only), but it runs on CPU int8 on any Mac (`ctranslate2` 4.9.1 ships macOS arm64 and x86_64 wheels). On Apple Silicon, **mlx-whisper** (MIT, 0.4.3) runs Whisper on the GPU through MLX and is used automatically.
- **"Claude Video"** most likely refers to `bradautomates/claude-video`, a Claude Code skill (MIT) that turns videos into frames plus a transcript. It **downloads the video**, so it's incompatible with the reference no-download rule. It is fine for your own footage, but our pipeline already does that part.
- **davinci-resolve-mcp** (samuelgursky) is the most complete Resolve MCP. It is useful only with Resolve Studio (or Free ≤21.0 with an in-app bridge).
- AGPL projects (OpenMontage and others) are study-only. Video-LLaVA is unmaintained since 2024. madmom's models are non-commercial.

## 3. Comparison matrix (condensed; full detail in docs/research_raw.md)

| Area | Candidate | License | Local / cost | macOS | Verdict |
|---|---|---|---|---|---|
| YouTube ingest | **yt-dlp** (metadata, captions, storyboards; `--skip-download`) | Unlicense | local, free | yes | **Use**, tested |
| Transcripts | **youtube-transcript-api** | MIT | local, free | yes | Fallback, IP-blocked here |
| YouTube MCP servers | various transcript MCPs | mostly MIT | free | yes | Skip. They wrap the same APIs, and MCP adds nothing for batch ingest. |
| Scene detection | **PySceneDetect** 0.6.7 | BSD-3 | CPU | yes | **Use** on own footage |
| Vision primitives | **OpenCV** 4.x | Apache-2.0 | CPU | yes | **Use** (pin <5) |
| Embeddings | open_clip / SigLIP | MIT / Apache | GPU optional | yes | Next phase: semantic search and matching footage to references |
| VLM | Qwen2.5/3-VL (local via MLX-VLM), Claude (API) | Apache / paid | 16 GB+ unified memory / API | yes | Claude for qualitative passes now. Local Qwen-VL is optional later. |
| Speech | **mlx-whisper** (Apple Silicon) / **faster-whisper** (fallback) | MIT | Apple GPU / CPU | yes | **Use** (own footage) |
| Diarization | pyannote.audio | MIT (gated models) | GPU recommended | partial | Later, for interviews |
| Audio events / beats | PANNs, beat_this, librosa | MIT/ISC | CPU | yes | Later, for music sync. YAMNet rejected (TF). madmom rejected (license). |
| Editing interchange | **OpenTimelineIO** 0.18.1 | Apache-2.0 | free | yes | **Use**, primary editable output |
| NLE | **DaVinci Resolve** (OTIO import) | proprietary, free tier | free | yes | **Use** via import. Studio scripting optional. |
| NLE | **Final Cut Pro** (FCPXML via `otio-fcpx-xml-adapter` 1.0, Apache-2.0) | proprietary, paid | — | macOS only | **Use** as alternative target. Export tested; FCP import not yet tested. |
| NLE automation | davinci-resolve-mcp | MIT | needs Studio | yes | Optional (Studio users) |
| Rendering | **FFmpeg** | LGPL/GPL | free | yes | **Use** for preview render and QA |
| Programmatic video | MoviePy 2 | MIT | free | yes | Not needed. FFmpeg filtergraphs are faster and more controllable. |
| Programmatic video | Remotion | source-available | free (individual) | yes | Reject (JS stack, license). |
| Silence/cut automation | auto-editor | Unlicense | free | yes | Optional pre-pass for talky clips |
| Orchestration | **Claude Code** + this repo's CLI | — | subscription | yes | **Use**: Claude Code drives `tfd` and reads the JSON library |
| Orchestration | Claude API (`anthropic`) | MIT SDK | pay per use | yes | **Optional**: qualitative analysis and answers |
| Orchestration | Claude Agent SDK, MCP SDK | MIT | — | yes | Later: an MCP server over the library, if multi-client use appears |

## 4. Final architecture choices (why)

1. **Python CLI plus local FastAPI UI**, no agent framework. Claude Code is the agent. Every operation is a deterministic `tfd` command that writes inspectable JSON, so Claude Code (or you) can read, edit and re-run any stage.
2. **References: metadata + captions + storyboards only.** This respects YouTube's terms and your instruction, never touches DRM or private videos, and turned out rich enough for style analysis.
3. **Hybrid editing output.** **OpenTimelineIO is the editable master.** It imports into Resolve Free and Studio, and is converted to FCPXML for Final Cut Pro and FCP7 XML for Premiere, references originals in place, and carries every decision as clip metadata and markers. The **FFmpeg preview render** is for automated QA and quick review. Live Resolve control (Studio) is an optional later layer, not a dependency.
4. **MCP only where it adds value.** Today nothing needs it: the CLI and files serve Claude Code directly. A library MCP server becomes worthwhile if you want Claude Desktop or other clients to query the reference library.
5. **Claude API optional and bounded.** It is used only for qualitative analysis (contact sheets at ≤1400 px plus a sampled transcript) and Q&A. With no key, the same qualitative step is done from Claude Code via `tfd annotate`.

## 5. Technical risks

| Risk | Mitigation |
|---|---|
| YouTube changes (PO tokens, SABR, bot checks) break ingestion | Pin and upgrade yt-dlp, rotate clients, use your own cookies, keep cached sources (`tfd ref rebuild` needs no network) |
| Storyboard sampling hides cuts, transitions and camera moves | Statistical estimates flagged as such, qualitative pass by Claude. For deep study, analyse a film you own locally with the footage analyser (`--transcript-file` + local file) |
| Heuristic shot types are approximate | Evidence attached to every label. Next step: CLIP/SigLIP zero-shot classification |
| Resolve OTIO import quirks by version | Round-trip test on your machine (roadmap item 1). FCP7 XML fallback via `otio-fcp-adapter` |
| Apple GPU acceleration varies by tool | MLX for Whisper, VideoToolbox for encoding; everything else runs on CPU, which is fast on Apple Silicon |
| FCPXML version drift (adapter writes FCPXML 1.8) | Final Cut Pro imports older FCPXML versions; verify on your FCP version (roadmap item 1) |

## 6. macOS retarget (2026-11-24)

| Item | Finding | Status |
|---|---|---|
| Wheels | opencv-python-headless 4.13 (macOS 13+ arm64, macOS 14+ x86_64), ctranslate2 4.9.1, numpy/pillow/pydantic all publish macOS wheels | Checked on PyPI |
| Transcription | mlx-whisper 0.4.3 (MIT, pure-Python wheel, needs Apple Silicon) is preferred automatically; faster-whisper on CPU otherwise | Code tested only on Linux (falls back correctly); MLX path untested |
| Encoding | Homebrew FFmpeg includes `h264_videotoolbox`; preview render uses it when present (`-allow_sw 1` for safety) | Selection logic tested; actual VideoToolbox encode untested |
| Final Cut Pro | `otio-fcpx-xml-adapter` writes FCPXML 1.8; OTIO reads it back with all clips intact | Export and round-trip tested; FCP import untested |
| Premiere / Resolve fallback | `otio-fcp-adapter` writes FCP7 XML | Export tested |
| Filesystem | exFAT/SMB drives create `._*` AppleDouble files that look like videos; Photos libraries are bundles | Skipped automatically (tested) |
| iPhone metadata | `com.apple.quicktime.model` gives the exact model; HLG/Dolby Vision and ProRes are flagged | Tag parsing tested with synthetic tags |
| UI | Native Finder folder picker (`osascript choose folder`) and "Show in Finder" (`open -R`) | macOS-only endpoints; return 501 elsewhere (tested) |
| Resolve on Mac | Same rules as other platforms: Free imports `.otio`; Python scripting is Studio-only from 21.1 | From matrix (V) |
