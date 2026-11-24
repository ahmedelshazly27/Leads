# AI Travel Film Director: verified research matrix (raw)

Researched 2026-11-24. Target: local, Python-first, Windows 11, DaVinci Resolve preferred.

## How this was verified

- **PyPI**: `https://pypi.org/pypi/<name>/json` for the latest version, upload date, license and Windows wheels.
- **GitHub**: `gh api -X GET search/repositories -f q="repo:<owner>/<name>"` for stars, last push date, SPDX license and archived flag. In this sandbox the github.com HTML pages and `gh api repos/...` returned HTTP 403, so I used the search endpoint and `raw.githubusercontent.com` READMEs instead.
- **Web**: WebSearch and WebFetch for the Blackmagic release notes, the Puget Systems article and the Remotion `LICENSE.md`.

**Legend**

- **V**: verified this session. The date is a GitHub `pushed_at` or a PyPI upload date.
- **U**: not verified. This comes from prior knowledge or is inferred. Treat it as a claim to re-check.
- **Push date**: the last push to any branch. It is not necessarily a release.

---

## Answers to the four specific questions

### (1) Does free DaVinci Resolve allow external Python scripting?

No. External scripting (a separate `python.exe` calling `scriptapp("Resolve")`) has been a Studio-only feature.

- **Free 19.x, 20.x and 21.0.x**: external scripting is refused. In-app scripting still worked: Workspace ▸ Scripts and the Console could run `.py` scripts with access to the `resolve` object.
  - The samuelgursky/davinci-resolve-mcp README (V) says: "Blackmagic gates *external* scripting to Studio: on the free edition `scriptapp("Resolve")` refuses a foreign process, whatever the preference says."
  - The same README reports its in-app bridge, which runs inside Resolve and re-exports the API over a loopback socket, working on free 20.3.2.9 (Linux), free 21.0.1.11 and 21.0.3.7 (Windows 11), and free 21.0.3.7 (macOS).
  - Blackmagic forum posts from 2018 and 2020 say the same: only external or command-line scripting is unsupported in Free. I saw these in search snippets only, not the full pages, so this point is U/V-snippet.
  - **Not tested directly**: no source I found ran *external* scripting on free 19.x or 20.x specifically. Everything above points to "refused".
- **Free 21.1 and later**: Python scripting was removed from Free entirely (V).
  - Puget Systems (2026-09-10) quotes the Blackmagic notes: "We have moved the ability to script in Python to the Studio version." The stated reason was "The Python API was being used to hack studio features into the free version."
  - davinci-resolve-mcp reports that on free 21.1 the Scripts menu no longer lists `.py` files. Lua still listed. Whether the Python Console still works there is unconfirmed.
- **Implication**:
  - Plan for **Resolve Studio** if you want live automation.
  - On Free, the robust path is **file interchange**: generate an `.otio`, FCP7 XML or EDL file in Python and import it by hand through File ▸ Import ▸ Timeline. Running Free 21.0.x pinned with an in-app bridge works, but it is fragile.

### (2) Can Resolve import `.otio` natively, and from which version?

Yes, from **DaVinci Resolve 18.5** (released 2023).

- The free 18.5 readme lists "Import and export timelines using the OpenTimelineIO format." under Media. It is not tagged "in Studio" (V, WebFetch of the Blackmagic readme).
- A scripting API to import and export OTIO also arrived in the 18.5 era: `MediaPool.ImportTimelineFromFile` and `Timeline.Export` with an OTIO type. The exact method names are U. In any case the API needs scripting, so see (1).
- Not verified: which OTIO schema version Resolve 19, 20 or 21 accepts. Test a round trip early with `opentimelineio==0.18.1`, and fall back to FCP7 XML (`otio-fcp-adapter`) if import fails.

### (3) Remotion license terms for individuals

Remotion is source-available, not OSI open source. GitHub reports the license as `NOASSERTION`. The following comes from `LICENSE.md` on `main`, fetched this session (V).

- **Free License**: covers individuals, for-profit organizations with up to 3 employees, non-profits, and evaluation. For these users it is free "non-commercially or commercially for the purpose of creating videos and images", and they may modify it for their own use.
- **Disallowed**: copying or modifying Remotion "for the purpose of selling, renting, licensing, relicensing, or sublicensing your own derivate of Remotion."
- **Company License**: a paid license is required for larger for-profit companies (pricing at remotion.dev).
- The file says "In Remotion 5.0, the license will slightly change" (PR #3750). The details of that change were **not verified**.
- **For this project**: an individual using it personally is fine. If you ever ship the Director as a product or service to others, re-read the license, because that may count as a derivative.

### (4) faster-whisper on Windows with CUDA

The following comes from the `SYSTRAN/faster-whisper` README (V).

- **Python**: 3.9 or later. No system FFmpeg is needed, because decoding uses PyAV, which bundles FFmpeg.
- **GPU**: needs **cuBLAS for CUDA 12** and **cuDNN 9 for CUDA 12**. Current `ctranslate2` supports only CUDA 12 with cuDNN 9.
  - For CUDA 11 with cuDNN 8, pin `ctranslate2==3.24.0`.
  - For CUDA 12 with cuDNN 8, pin `ctranslate2==4.4.0`.
- **Windows install**: the `pip install nvidia-cublas-cu12 nvidia-cudnn-cu12` route is documented as **Linux only**. On Windows, use either:
  - the NVIDIA installers, or
  - Purfview's `whisper-standalone-win` "libs" archive, unpacked into a directory on `PATH`.
- **Wheels**: `ctranslate2` 4.9.1 (2026-11-22) ships `win_amd64` wheels for cp39 through cp315 (V), so the pip install itself is easy on Windows.
- **VRAM**: about 3–5 GB for `large-v3` in fp16, and less with int8 or int8_float16 (U, prior knowledge).
- **Latest release**: faster-whisper 1.2.1 (2025-10-31, V). The repo was pushed 2026-11-23 (V).

---

## Comparison table

Column notes:

- **API cost**: "local" means no per-call fee.
- **GPU**: VRAM figures are U unless stated.
- **Win**: Windows compatibility.

### Ingestion (reference films: metadata, subtitles, storyboards; no video download)

| Candidate | URL | License | Last release / push (V) | Key deps | Install | API cost | GPU | Win | Limitations | Verdict |
|---|---|---|---|---|---|---|---|---|---|---|
| yt-dlp | github.com/yt-dlp/yt-dlp | Unlicense | PyPI 2026.11.23; push 2026-11-24 | Python 3.11 or later (V); for YouTube, a JS runtime such as Deno plus EJS (per the claude-video README, V) | Easy (pip or winget) | Free | No | Yes | YouTube breaks old versions, so keep it updated. `--skip-download --write-info-json --write-subs --write-auto-subs` gets metadata and subtitles. Storyboard (`sb*`) formats are listable via `-F`, but how reliably storyboard images download is **U**. YouTube terms of service apply. | **Use** |
| youtube-transcript-api | github.com/jdepoix/youtube-transcript-api | MIT | PyPI 1.2.5 (2026-11-05); push 2026-11-09 | requests | Easy | Free | No | Yes | Cloud and data-center IPs are often blocked, so proxies are needed. It only fetches captions. | **Use** (as a fallback to yt-dlp subtitles) |
| anaisbetts/mcp-youtube | github.com/anaisbetts/mcp-youtube | MIT | push 2026-08-16 | Node (npx); system yt-dlp | Easy | Free | No | Yes (README mentions WinGet) | Subtitles only. | Optional |
| kimtaeyoon83/mcp-server-youtube-transcript | github.com/kimtaeyoon83/mcp-server-youtube-transcript | MIT | push 2026-11-21 | Node (npx or Smithery) | Easy | Free | No | Yes (U) | Transcripts only. Has `lang` fallback and `strip_ads` using chapter markers. | Optional |
| jkawamoto/mcp-youtube-transcript | github.com/jkawamoto/mcp-youtube-transcript | MIT | push 2026-11-14 | Python, uvx | Easy | Free (paid proxies optional) | No | Yes (U) | Transcripts only. Proxy support for Webshare and ScrapingAnt. | Optional (the Python-native pick) |
| guimatheus92/mcp-video-analyzer | github.com/guimatheus92/mcp-video-analyzer | MIT | push 2026-11-23 | Node, bundled ffmpeg-static; yt-dlp required for YouTube | Easy–Med | Free | No | Yes (documents `%LOCALAPPDATA%` paths) | Combines transcript, key frames, OCR and metadata. Getting frames from YouTube **downloads video**, which conflicts with the no-download constraint. | Optional (reference design) |
| **"Claude Video"** = bradautomates/claude-video (`/watch` skill) | github.com/bradautomates/claude-video | MIT | push 2026-09-25; about 21.7k stars | Python 3.10 or later, FFmpeg/ffprobe, latest yt-dlp, Deno; optional WhisperX, Groq or OpenAI | Easy (Claude Code plugin marketplace) | Free locally; Groq or OpenAI transcription is paid | Optional (WhisperX) | Yes (README gives winget commands) | A Claude Code skill: a URL or file becomes timestamped frames plus transcript. It **downloads the video** to extract frames. It does not run in Claude Chat or Cowork. | Optional (good pattern to borrow; violates the no-download rule as-is) |
| coah80/youtube-mcp | github.com/coah80/youtube-mcp | MIT | push 2026-04-13; 7 stars | Gemini (per description) | ? | Gemini API | No | U | Small project. Interleaves frames with the transcript. | Reject (immature) |
| JazerJu/video-miner | github.com/JazerJu/video-miner | none listed | push 2026-11-12; 40 stars | GPU | ? | Local | Yes | U | No license, so it cannot be legally reused. | Reject |
| NVIDIA VSS blueprint | github.com/NVIDIA-AI-Blueprints/video-search-and-summarization | Apache-2.0 | push 2026-11-24 | Docker, NIMs | Hard | Local or NIM | Large (U) | Poor (Linux and Docker oriented, U) | Enterprise-scale. | Reject (overkill) |
| vcsi | github.com/amietn/vcsi | MIT | PyPI 7.0.17 (2026-03-22); push 2026-07-21 | FFmpeg on PATH, Pillow | Easy | Free | No | Yes (U) | Works on local files, so use it on *your own* footage. For reference films, use YouTube storyboards instead. | **Use** (for own footage) |

### Vision and audio analysis

| Candidate | URL | License | Last release / push (V) | Key deps | Install | API cost | GPU | Win | Limitations | Verdict |
|---|---|---|---|---|---|---|---|---|---|---|
| FFmpeg | github.com/FFmpeg/FFmpeg (mirror) | LGPL/GPL depending on build (U; GitHub says NOASSERTION) | push 2026-11-24 | none | Easy (`winget install Gyan.FFmpeg`) | Free | Optional NVENC/NVDEC | Yes | GPL builds affect redistribution. | **Use** (core) |
| openai-whisper | github.com/openai/whisper | MIT | PyPI 20250625; push 2026-08-31 | PyTorch, system FFmpeg | Med | Free | about 10 GB for large (U) | Yes | Slower than faster-whisper. | Reject (superseded) |
| faster-whisper | github.com/SYSTRAN/faster-whisper | MIT | PyPI 1.2.1 (2025-10-31); push 2026-11-23 | ctranslate2 4.9.1 (has Windows wheels), PyAV | Easy on CPU; Med for CUDA on Windows | Free | 3–5 GB for large-v3 (U) | Yes (see answer 4) | Word timestamps are less precise than whisperX alignment. | **Use** |
| whisperX | github.com/m-bain/whisperX | BSD-2-Clause | PyPI 3.8.6 (2026-05-25); push 2026-11-21 | faster-whisper, PyTorch, pyannote; Python 3.10–3.13 (V) | Med–Hard | Free; HF token needed for diarization | about 8 GB or more (U) | Yes (README gives Windows CUDA 12.8 toolkit steps) | Heavy torch stack. Diarization needs a gated HF model. | Optional (only if word-level alignment is needed) |
| PySceneDetect | github.com/Breakthrough/PySceneDetect | BSD-3-Clause | PyPI `scenedetect` 0.7.3 (2026-11-08); push 2026-11-24 | OpenCV or PyAV | Easy | Free | No | Yes | Detects hard cuts well; dissolves less well. | **Use** |
| OpenCV | github.com/opencv/opencv | Apache-2.0 | PyPI opencv-python 5.1.0.95 (2026-11-17) | numpy | Easy | Free | No (the pip wheel is CPU-only) | Yes | **OpenCV 5.x is new**, so check PySceneDetect compatibility; pin 4.x if needed (U). | **Use** |
| Video-LLaVA | github.com/PKU-YuanGroup/Video-LLaVA | Apache-2.0 | push 2024-12-03 (stale) | Old torch and transformers | Hard | Free | about 16 GB or more (U) | Poor (U) | Unmaintained for about 2 years. | **Reject** |
| Qwen2.5-VL | the `QwenLM/Qwen2.5-VL` repo did not resolve in search; its README content now lives in QwenLM/Qwen3-VL (inferred) | Apache-2.0 (most sizes; the 3B/72B weights have Qwen license terms, U) | HF models released 2025-01-28 (V, Qwen3-VL README) | transformers, qwen-vl-utils 0.0.14 | Med | Free locally | 3B: about 8 GB; 7B: about 16 GB in bf16, less with AWQ (U) | Yes via transformers (U) | Superseded by Qwen3-VL. | Optional (fallback) |
| Qwen3-VL | github.com/QwenLM/Qwen3-VL | Apache-2.0 | push 2026-01-30; 2B/4B/8B/32B/30B-A3B/235B released 2025-09 to 10 (V) | transformers 5.x, qwen-vl-utils | Med | Free locally, or the Alibaba API (paid) | 2B–8B fits 8–24 GB, more with FP8 or quantization (U) | Yes via transformers (U); vLLM is weak on Windows (U) | Local VLMs are slow on long videos, so feed them keyframes. | **Use** (local shot captioning or tagging; or send frames to Claude instead) |
| CLIP (OpenAI) | github.com/openai/CLIP | MIT | push 2026-03-25 | torch | Easy | Free | Small (under 2 GB) | Yes | Superseded by open_clip and SigLIP. | Reject (use open_clip) |
| open_clip | github.com/mlfoundations/open_clip | MIT (PyPI; GitHub says NOASSERTION) | PyPI open_clip_torch 4.2.2 (2026-11-10) | torch, timm | Easy | Free | 1–4 GB | Yes | Also loads SigLIP and SigLIP2 checkpoints via HF hub (U). | **Use** (shot embeddings, matching reference shots to your footage) |
| SigLIP (big_vision) | github.com/google-research/big_vision | Apache-2.0 | push 2025-05-19 | JAX | Hard on Windows | Free | — | Poor (JAX on Windows, U) | Use SigLIP via transformers or open_clip instead. | Use the weights, not the repo |
| PANNs (panns_inference) | github.com/qiuqiangkong/panns_inference | MIT | PyPI 0.1.1 (2023-03-26); push 2024-03-05 | torch, librosa | Easy | Free | Optional | Yes (U) | Stale but simple: 527 AudioSet classes. | Optional |
| YAMNet | tensorflow/models › research/audioset/yamnet (page not fetchable here, U) | Apache-2.0 (U) | tensorflow-hub 0.16.1 (2024-01-30) | TensorFlow | Med (TF on native Windows is CPU-only since TF 2.11, U) | Free | — | CPU only (U) | Adds a whole TF stack. | Reject (prefer a torch-based model) |
| BEATs | github.com/microsoft/unilm (`beats/` subfolder; page not fetched, U) | MIT (repo) | unilm push 2026-09-21 | torch; checkpoints by manual download | Med | Free | Small | Yes (U) | Research code, not pip-packaged. | Optional (better accuracy than PANNs) |
| pyannote.audio | github.com/pyannote/pyannote-audio | MIT (code) | PyPI 4.1.1 (2026-11-19); push 2026-11-24 | torch; Python 3.11 or later (V); gated HF model `speaker-diarization-community-1` plus an HF token (V) | Med | Free (community-1); `precision-2` is a paid pyannoteAI API (V) | Recommended | Yes (U) | Travel vlogs rarely need diarization. | Optional |
| librosa | github.com/librosa/librosa | ISC | PyPI 1.0.1 (2026-11-12); Python 3.12 or later (V) | numpy, scipy, soundfile | Easy | Free | No | Yes | Basic beat tracker. **1.0 is a new major release**, so check the API changes (U). | **Use** (onset, RMS, tempo features) |
| madmom | github.com/CPJKU/madmom | Code BSD; **models CC BY-NC-SA 4.0** (V) | PyPI 0.16.1 (**2018**); push 2026-03-20 | Cython, old numpy | Hard (no modern wheels, U) | Free | No | Poor (U) | Models are non-commercial. | **Reject** |
| beat_this | github.com/CPJKU/beat_this | MIT | PyPI beat-this 1.1.0 (2026-04-14); push 2026-05-28 | torch | Easy | Free | Optional | Yes (U) | State-of-the-art beats and downbeats. | **Use** (music beat grid for cuts) |

### Editing and timeline output

| Candidate | URL | License | Last release / push (V) | Key deps | Install | API cost | GPU | Win | Limitations | Verdict |
|---|---|---|---|---|---|---|---|---|---|---|
| DaVinci Resolve scripting API | Blackmagic (bundled `DaVinciResolveScript`) | Proprietary | Resolve 21.1 current (V via Puget) | Resolve's embedded Python 3 | Med | Free edition, or Studio (about $295, U) | Resolve GPU requirements | Yes | External scripting is Studio-only, and Free 21.1 removed Python scripting entirely (see answer 1). | **Use with Studio**; otherwise use file interchange |
| samuelgursky/davinci-resolve-mcp | github.com/samuelgursky/davinci-resolve-mcp | MIT | push 2026-11-24; v5.4.3 badge; about 4.3k stars | Python 3.10–3.12 recommended, Resolve 18.5 or later | Med (universal installer) | Free | — | Yes (Windows 11 confirmed by user reports) | Studio for external use; Free only through the in-app bridge on 21.0.x or earlier. Tested on Studio 19.1.3, 20.3.2 and 21.0.2. | **Use** (if Studio); Optional otherwise |
| Other Resolve MCPs: barckley75/resolve-claude-mcp, hiteshK03/davinci-resolve-mcp, flamexnreal/davinci-resolve-ai-bridge-mcp ("Free and Studio"), wassermanproductions/unofficial-davinci-mcp | github.com/... | MIT / MIT / MIT / Apache-2.0 | pushes 2026-05-14 / 2026-03-28 / 2026-11-24 / 2026-07-20 | — | — | Free | — | U | Their "Free" support presumably uses the same in-app trick, so it is subject to the 21.1 removal (U). | Reject (prefer samuelgursky) |
| Premiere MCPs: hetpatel-11/Adobe_Premiere_Pro_MCP, leancoderkavy/premiere-pro-mcp | github.com/... | MIT | pushes 2026-11-19 / 2026-11-24 | Premiere Pro (paid subscription), UXP or CEP plugin | Med | Adobe subscription | — | Yes | Resolve is the preferred NLE. | Reject (unless switching NLE) |
| MoviePy v2 | github.com/Zulko/moviepy | MIT | PyPI 2.2.1 (2025-05-21); push 2026-08-26 | FFmpeg (imageio-ffmpeg), numpy | Easy | Free | No | Yes | Slow renders. The v2 API breaks v1 code. It outputs a flattened MP4, not an editable timeline. | Optional (quick proxy previews only) |
| Remotion | github.com/remotion-dev/remotion | Remotion License (source-available; see answer 3) | push 2026-11-24 | Node, React, Chromium | Med | Free for individuals | Optional | Yes | JS, not Python. Renders to MP4, not an editable NLE timeline. | Reject for the core (Optional for motion-graphics titles) |
| OpenTimelineIO | github.com/AcademySoftwareFoundation/OpenTimelineIO | Apache-2.0 | PyPI 0.18.1 (2025-11-09); push 2026-11-23 | C++ core, prebuilt wheels | Easy | Free | No | Yes (U: wheels) | Since 0.17 the adapters are split out. `opentimelineio-plugins` 0.18.1 bundles aaf, ale, burnins, cmx3600 (EDL), fcp (FCP7 XML), maya, svg and xges. It does **not** include FCPX XML (V, requires_dist). | **Use** (the canonical timeline model) |
| otio-fcp-adapter (FCP7 XML) | github.com/OpenTimelineIO/otio-fcp-adapter | Apache-2.0 | PyPI 1.0.0 (2023-07-07); push 2026-04-08 | otio | Easy | Free | — | Yes | Resolve imports FCP7 XML well (U, widely reported). | **Use** (fallback interchange) |
| otio-fcpx-xml-adapter | github.com/OpenTimelineIO/otio-fcpx-xml-adapter | Apache-2.0 | PyPI 1.0.0 (2023-07-07); push 2024-06-25 | otio | Easy | Free | — | Yes | Stale. | Optional |
| otio-cmx3600-adapter (EDL) | github.com/OpenTimelineIO/otio-cmx3600-adapter | Apache-2.0 | PyPI 1.0.0 (2023-07-07); push 2025-12-12 | otio | Easy | Free | — | Yes | An EDL holds a single video track with no effects. | Optional |
| auto-editor | github.com/WyattBlue/auto-editor | Unlicense | PyPI 29.3.1 (2025-11-04); push 2026-11-24 | **Written in Nim now** (V); the PyPI wheel is `py3-none-any`, so it probably fetches a binary (U) | Easy | Free | No | Yes (U) | Silence and motion-based cutting. Exports `--export resolve`, premiere, final-cut-pro and shotcut (V). | Optional (silence-trim pre-pass, or reference its exporter) |
| heygen-com/hyperframes | github.com/heygen-com/hyperframes | Apache-2.0 | push 2026-11-24; about 89k stars | Node 22 or later; HTML/CSS to MP4 | Med | Free OSS (HeyGen cloud optional) | — | U | HTML-based renders, not a Resolve timeline. | Optional (inspiration and titles) |
| OpenMontageInc/OpenMontage | github.com/OpenMontageInc/OpenMontage | **AGPL-3.0** | push 2026-11-16 | Python, Remotion, FFmpeg, gen-AI APIs | Hard | Pay-per-generation APIs | — | U | Aimed at generative video, and the AGPL is restrictive. | Reject (study its architecture) |
| openfilm/openfilm | github.com/openfilm/openfilm | MIT | push 2026-11-23; about 9.3k stars | — | U | — | — | U | "Turns any coding agent into a video agent". Exports timelines to FCP, Premiere and Resolve (V, README). | Optional (closest existing agent; evaluate) |
| FireRed-OpenStoryline | github.com/FireRedTeam/FireRed-OpenStoryline | Apache-2.0 | push 2026-07-31 | U | U | U | U | U | An AI video-editing agent; details not read. | Optional (evaluate) |
| poseljacob/agentic-video-editor | github.com/poseljacob/agentic-video-editor | MIT | push 2026-04-14 | U | U | U | U | U | Raw footage plus a brief becomes an ad. | Optional (reference) |
| pireel/pireel | github.com/pireel/pireel | AGPL-3.0 | push 2026-11-18 | U | U | — | — | U | Exports timelines to Premiere and Resolve (V). | Reject (AGPL) |
| nexu-io/openmotion | github.com/nexu-io/openmotion | Apache-2.0 | push 2026-11-24 | U | U | U | U | U | "Turn a reference video into editable motion" (V, description). Conceptually close to the reference-film idea. | Optional (evaluate) |
| Egnatia-OC/otio-kit | github.com/Egnatia-OC/otio-kit | AGPL-3.0 | push 2026-09-22; 1 star | — | — | — | — | U | Compiles LLM output to OTIO for Resolve. | Reject (AGPL, immature); same idea as this project's core |

### Orchestration

| Candidate | URL | License | Last release / push (V) | Key deps | Install | API cost | GPU | Win | Limitations | Verdict |
|---|---|---|---|---|---|---|---|---|---|---|
| Claude Agent SDK (Python) | github.com/anthropics/claude-agent-sdk-python | MIT | PyPI `claude-agent-sdk` 0.2.188 (2026-11-23); push 2026-11-23 | Python 3.10 or later; **bundles the Claude Code CLI** (V) | Easy | Anthropic API usage, or a Claude plan (pricing not checked) | No | Yes (U) | Fast-moving 0.x API, so pin the version. | **Use** |
| MCP Python SDK | github.com/modelcontextprotocol/python-sdk | MIT | PyPI `mcp` 2.3.0 (2026-10-02); push 2026-11-17 | Python 3.10 or later | Easy | Free | No | Yes | Version 2.x may differ from older tutorials (U). | **Use** (wrap the local tools as MCP servers) |
| Claude Code skills | github.com/anthropics/skills | none on GitHub | push 2026-11-16 | Claude Code | Easy | Claude usage | — | Yes | — | **Use** (package workflows, such as the claude-video `/watch` pattern) |

---

## Notes by category

### Ingestion

- **Recommended stack**:
  - `yt-dlp --skip-download` for info.json, chapters and subtitles (manual and auto).
  - `youtube-transcript-api` as a fallback for captions.
  - YouTube storyboard sprite sheets for visual rhythm without downloading the video.
- **Storyboard check**: yt-dlp lists storyboard formats (`sb0`–`sb3`). Whether the current version downloads and assembles storyboard mhtml or images reliably is **unverified**. Test it in the first spike.
- **Existing tools download video**: claude-video and mcp-video-analyzer both download video to get frames. Their architecture (a transcript plus timestamped frames handed to Claude) is the right one, but they break the no-download constraint as shipped.
- **"Claude Video"** most likely refers to **bradautomates/claude-video**, the `/watch` Agent Skill and Claude Code plugin (about 21.7k stars, MIT). Related projects showed up in search but were not investigated: `lemo-opuscar` and `video-shotcraft`, both Remotion/Claude film-style skills. No Anthropic first-party "Claude Video" product was found.
- **Rate limits**: YouTube rate-limits caption scraping. Run locally from a home IP on Windows, which is better than running from the cloud.

### Vision and audio

- **Core pipeline**:
  - FFmpeg for decoding and proxies.
  - PySceneDetect for shots.
  - open_clip or SigLIP for embeddings and matching.
  - faster-whisper for voice-over and ambient speech.
  - beat_this for music downbeats.
  - librosa for energy and onsets.
- **Video LLMs**:
  - **Reject Video-LLaVA** (stale).
  - **Prefer Qwen3-VL 4B or 8B** on keyframes locally.
  - Alternatively, send keyframes to Claude through the Agent SDK. This is simpler and needs no VRAM, but costs API usage.
- **Audio tagging**: PANNs is easy but stale, and BEATs is more accurate but research-grade. YAMNet drags in TensorFlow, which is CPU-only on native Windows (U). Skip madmom: it has no modern wheels and non-commercial models.
- **Diarization**: pyannote 4.x is only worth it if you need it, and it needs an HF token plus gated-model acceptance.
- **New major versions** need version-pinning tests: OpenCV 5.x and librosa 1.0 (both 2026-11).

### Editing

- **Primary output**: an **OTIO timeline** generated in Python. Import it into Resolve 18.5 or later (Free or Studio) through File ▸ Import ▸ Timeline. Fall back to FCP7 XML through `otio-fcp-adapter`.
  - This works on **free Resolve without any scripting**, so it is the safest baseline.
- **Live automation**:
  - **Resolve Studio**: use the scripting API or samuelgursky/davinci-resolve-mcp.
  - **Free Resolve**: avoid. External scripting is blocked, and 21.1 removed in-app Python scripting.
- **Rendering libraries**: Remotion, HyperFrames and MoviePy render flat MP4s. None of them gives an editable Resolve timeline, so use them only for previews or titles.
- **Existing agents worth a look**: openfilm (MIT, exports to Resolve), nexu-io/openmotion (Apache-2.0, reference video to editable output) and FireRed-OpenStoryline (Apache-2.0). AGPL projects (OpenMontage, pireel, otio-kit) are only for study if you may ever distribute.

### Orchestration

- Claude Agent SDK 0.2.188 (Python 3.10 or later, bundled CLI) plus MCP Python SDK 2.3.0 are both MIT and current.
- Wrap each local tool (ingest, analyse, build timeline) as an MCP server or tool, and ship repeatable flows as Claude Code skills.

---

## Unverified items to check first

1. Exact Resolve scripting method names for OTIO import and export, and which OTIO schema version Resolve 20 and 21 accept.
2. Whether external scripting is refused on free Resolve 19.x and 20.x. This is consistent with every source found, but no direct test was found.
3. Whether the Python Console still works in free 21.1.
4. yt-dlp storyboard download reliability.
5. VRAM figures for every model.
6. Windows behaviour of the Node-based MCP servers.
7. The Remotion 5.0 license changes (PR #3750).
8. auto-editor's Nim binary distribution on Windows.
9. Details of openfilm, OpenStoryline and openmotion. Their READMEs were not fully read.
10. The Resolve Studio price.
11. Claude API pricing.
