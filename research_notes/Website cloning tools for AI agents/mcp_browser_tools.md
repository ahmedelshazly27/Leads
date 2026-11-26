# MCP Servers and Browser-Automation Tools for Inspecting and Rebuilding Live Websites (incl. Animations)

Research date: 2026-11-26. Star counts read from the GitHub repo pages on 2026-11-26 unless noted otherwise. The GitHub API was blocked in this environment, so counts are the rounded figures shown on each repo page.

## Q1. Leading browser MCP servers: popularity, features, and cloning strengths and limits

### Takeaway
On 2026-11-26 the two strongest general-purpose options for inspecting a site deeply enough to rebuild it are Google's Chrome DevTools MCP (59.5k stars) and Microsoft's Playwright MCP (40.2k stars). Both can record video, run arbitrary JS (so `document.getAnimations()`), list network requests and take screenshots. Chrome DevTools MCP additionally has a dedicated `get_css_styles` tool and performance traces. Browserbase/Stagehand, Browser Use and Hyperbrowser are "agentic act/extract" tools. They are good for navigation and data extraction but expose little low-level inspection, which makes them weak for pixel or motion fidelity.

### Cited Findings
**Popularity snapshot (stars on 2026-11-26 unless noted)**
- Browser Use (browser-use/browser-use): 122.1k stars, 13.7k forks. This is the Python agent library, not an MCP server alone. — [GitHub](https://github.com/browser-use/browser-use)
- Chrome DevTools MCP (ChromeDevTools/chrome-devtools-mcp): 59.5k stars, 4.9k forks. — [GitHub](https://github.com/ChromeDevTools/chrome-devtools-mcp)
- Playwright MCP (microsoft/playwright-mcp): 40.2k stars, 3.5k forks. — [GitHub](https://github.com/microsoft/playwright-mcp)
- Stagehand (browserbase/stagehand): 26.2k stars, 1.8k forks. The Go SDK install pins v4.0.0. — [GitHub](https://github.com/browserbase/stagehand)
- Firecrawl MCP (firecrawl/firecrawl-mcp-server): 7.9k stars. — [GitHub](https://github.com/firecrawl/firecrawl-mcp-server)
- BrowserMCP (browsermcp/mcp): 7,315 stars, tracked at 7,225 to 7,315 between 26 Oct and 8 Nov 2026 by a third-party directory. This was not verified on GitHub directly. An older AlternativeTo snapshot showed 5,754. — [Enterprise DNA](https://enterprisedna.co/directories/mcp/browsermcp-mcp); [AlternativeTo](https://alternativeto.net/software/browser-mcp/about)
- Browserbase MCP (browserbase/mcp-server-browserbase): 3.4k stars, 374 forks. The repo is now **archived and "no longer maintained"**. Browserbase points users to a hosted MCP instead. — [GitHub](https://github.com/browserbase/mcp-server-browserbase)
- Hyperbrowser MCP (hyperbrowserai/mcp): 795 stars. — [GitHub](https://github.com/hyperbrowserai/mcp)

**Chrome DevTools MCP (Google)**
- The tool reference lists 61 tools. Relevant ones:
  - `take_snapshot`: accessibility tree with element uids.
  - `take_screenshot`: viewport, full page or a single element, as PNG, JPEG or WebP.
  - `screencast_start` / `screencast_stop`: record the page as **.mp4**.
  - `evaluate_script`: runs JS and returns JSON-serializable results.
  - `get_css_styles`: returns computed styles, matched rules (in precedence order, with `[overloaded]` tags), inline, inherited and custom properties for an element uid. Paginated at 10 rules per page.
  - `list_network_requests` and `get_network_request`: request bodies can be returned inline or saved to files.
  - `performance_start_trace` / `performance_stop_trace` / `performance_analyze_insight`: these can save raw trace data.
  - `emulate`: CPU/network throttling, viewport and media preferences such as reduced motion.
  - `lighthouse_audit`, `set_logpoints`, and 14 heap-snapshot tools.
  - Source: [tool-reference.md](https://raw.githubusercontent.com/ChromeDevTools/chrome-devtools-mcp/main/docs/tool-reference.md)
- **No tool is dedicated to animations.** The DevTools Animations panel is not exposed. The only video tool is the screencast pair, and there is no screenshot-sequence tool. — [tool-reference.md](https://raw.githubusercontent.com/ChromeDevTools/chrome-devtools-mcp/main/docs/tool-reference.md)
- The performance trace tools are framed around load and Core Web Vitals insights, not animation authoring. — [tool-reference.md](https://raw.githubusercontent.com/ChromeDevTools/chrome-devtools-mcp/main/docs/tool-reference.md)

**Playwright MCP (Microsoft)**
- `browser_snapshot` captures the accessibility tree, on by default; `--snapshot-mode` takes full or none. `browser_take_screenshot` has a scale option of css or device. — [GitHub](https://github.com/microsoft/playwright-mcp)
- Video tools: `browser_start_video`, `browser_stop_video`, `browser_video_chapter`, `browser_video_show_actions` and `browser_video_hide_actions`. Output is a `video-{timestamp}.webm` file. — [GitHub](https://github.com/microsoft/playwright-mcp)
- `browser_start_tracing` / `browser_stop_tracing` under `--caps=devtools` produce a Playwright trace with DOM snapshots per action. — [GitHub](https://github.com/microsoft/playwright-mcp)
- Other tools:
  - `browser_evaluate` runs JS.
  - `browser_run_code_unsafe` runs arbitrary Playwright code and is described as RCE-equivalent.
  - `browser_network_requests` / `browser_network_request` list and inspect requests.
  - `browser_route` mocks requests under `--caps=network`.
  - `browser_console_messages` reads the console.
  - `--caps=vision` enables coordinate tools.
  - `--save-session` and `--output-dir` save the session.
  - Source: [GitHub](https://github.com/microsoft/playwright-mcp)
- The README is internally inconsistent about `--caps` values. The flag lists vision, pdf and devtools, while the tool list also mentions network, storage, config and testing. — [GitHub](https://github.com/microsoft/playwright-mcp)
- No dedicated computed-style tool was found. Styles must be read with `browser_evaluate` and `getComputedStyle`. — [GitHub](https://github.com/microsoft/playwright-mcp)

**Browserbase / Stagehand**
- The archived local MCP exposes only `start`, `end`, `navigate`, `act`, `observe` and `extract`. There is **no screenshot tool** and no recording. Its default model was google/gemini-2.5-flash-lite. — [GitHub](https://github.com/browserbase/mcp-server-browserbase)
- The hosted Browserbase MCP exposes `navigate`, `act`, `observe` and `extract` and needs an API key. Browserbase the platform has "session recordings", which are replays. That is a platform feature, not part of the SDK. — [Stagehand GitHub](https://github.com/browserbase/stagehand)

**Browser Use**
- Browser Use offers an MCP server and a CLI, plus Browser Use Cloud with stealth browsers at $0.06 per browser-hour. The README does not document MCP tool names or recording features. — [GitHub](https://github.com/browser-use/browser-use)
- A separate community MCP wrapper exists. — [kontext-dev/browser-use-mcp-server](https://github.com/kontext-dev/browser-use-mcp-server)

**Hyperbrowser MCP**
- Tools: `scrape_webpage` (screenshot is one of its output formats), `crawl_webpages`, `extract_structured_data`, `search_with_bing`, the agent tools `browser_use_agent`, `openai_computer_use_agent` and `claude_computer_use_agent`, and profile management. No recording or video features are mentioned. — [GitHub](https://github.com/hyperbrowserai/mcp)

**Firecrawl MCP**
- The full profile has 34 tools, including `firecrawl_scrape`, `firecrawl_map`, `firecrawl_crawl`, `firecrawl_interact` (click, type or navigate by prompt or code) and `firecrawl_agent`. — [GitHub](https://github.com/firecrawl/firecrawl-mcp-server)
- With `CLOUD_SERVICE=true`, scrape is read-only and takes no browser actions. — [GitHub](https://github.com/firecrawl/firecrawl-mcp-server)
- Firecrawl's branding and design extraction is covered in detail under Q3.

**BrowserMCP**
- BrowserMCP drives the user's own Chrome through an extension, so it keeps their logged-in sessions. — [Augment listing](https://www.augmentcode.com/mcp/browser-mcp) (feature detail not deeply verified this session)

### Inferences
- For cloning, Chrome DevTools MCP is the most complete single server. It has computed styles plus matched rules, network bodies (CSS, JS, fonts and images), mp4 screencast, traces and JS evaluation. Playwright MCP is close behind: it has webm video and traces, but styles must be scripted. Both are free and local.
- The agentic tools (Stagehand, Browser Use, Hyperbrowser) suit reaching a page state such as logging in or dismissing modals. For fidelity, pair them with a DevTools or Playwright server.
- Star counts favor Browser Use overall, but that reflects the agent framework, not MCP inspection depth.

### Gaps
- **Puppeteer MCP:** I did not get to verify it this session. From memory (unverified), the `@modelcontextprotocol/server-puppeteer` reference server was moved to the archived servers repo in 2025. It offered only navigate, screenshot, click, fill, select, hover and evaluate.
- Exact release versions and dates for Playwright MCP and Chrome DevTools MCP: the Releases sections did not render in the fetch.
- BrowserMCP's star count comes from a third-party tracker, not GitHub directly.
- Browser Use MCP tool names were not documented on its README.

## Q2. Which tools capture motion: video, frame sequences, document.getAnimations(), computed styles, CSS/JS sources, network assets, traces

### Takeaway
Video recording is native in Chrome DevTools MCP (mp4) and Playwright MCP (webm). Neither server has a built-in frame-sequence or animation-timeline tool. Agents get `document.getAnimations()`, keyframes and timing through JS evaluation tools, or through purpose-built extractors such as designlang's `--motion-runtime`. Computed styles are first-class only in Chrome DevTools MCP (`get_css_styles`).

### Cited Findings
**Capability by tool**

| Capability | Chrome DevTools MCP | Playwright MCP | Browserbase MCP (archived) | Hyperbrowser MCP | Firecrawl MCP |
|---|---|---|---|---|---|
| Video recording | `screencast_start` / `screencast_stop` (.mp4) | `browser_start_video` / `browser_stop_video` (.webm) | None (platform has session replay) | None mentioned | None |
| Frame sequences | None | None | None | None | Only screenshot actions |
| Run JS (`getAnimations`) | `evaluate_script` | `browser_evaluate` / `browser_run_code_unsafe` | Only via `act` | Not direct | `firecrawl_interact` with code |
| Computed styles | `get_css_styles` (computed, matched rules, custom properties) | Via JS only | No | No | `branding` summary only |
| Network assets / bodies | `get_network_request` (bodies inline or saved to file) | `browser_network_request` | No | No | No |
| Traces | `performance_*_trace` (can save raw trace) | `browser_start_tracing` / `browser_stop_tracing` | No | No | No |

Sources: [Chrome DevTools MCP tools](https://raw.githubusercontent.com/ChromeDevTools/chrome-devtools-mcp/main/docs/tool-reference.md); [Playwright MCP](https://github.com/microsoft/playwright-mcp); [Browserbase MCP](https://github.com/browserbase/mcp-server-browserbase); [Hyperbrowser MCP](https://github.com/hyperbrowserai/mcp); [Firecrawl scrape docs](https://docs.firecrawl.dev/features/scrape)

**Purpose-built motion extraction**
- designlang (`--motion-runtime`) drives the page through load, scroll, hover and focus, then reads `document.getAnimations()`. It records observed durations, choreography (stagger sequences) and scroll recipes such as parallax, reveal and pin. — [GitHub](https://github.com/Manavarya09/design-extract)
- designlang's base extraction covers durations, easing families, spring detection, a scroll-linked flag and a "feel" label: springy, smooth, mechanical or mixed. — [GitHub](https://github.com/Manavarya09/design-extract)
- Perfect-Web-Clone-IDE is an MCP server. It claims to pull real HTML and computed CSS and to preserve @keyframes animations. These are the project's own claims and are unverified. — [GitHub](https://github.com/ericshang98/Perfect-Web-Clone-IDE)
- A community "clone website" Claude Code skill uses Chrome MCP or Playwright to extract tokens, assets and animations. It dispatches parallel agents per section and generates React, Tailwind and Motion code. This was described in a search summary and not verified in depth. — [getclaudeskills](https://www.getclaudeskills.com/skills/clone-website-jcodesmore); [Mood-Global-Services skills repo](https://github.com/Mood-Global-Services/How-to-Clone-Website---Claude-Skills)

### Inferences
- A practical motion-capture recipe using either major server:
  1. `evaluate_script` with `document.getAnimations().map(a => ({target, keyframes: a.effect.getKeyframes(), timing: a.effect.getComputedTiming()}))`.
  2. Read `getComputedStyle` for transition and animation properties.
  3. Pull JS bundles from the network tools to find GSAP, Framer Motion or Lenis configs.
  4. Record a screencast for human or model reference.
  5. Use emulate or throttle to slow the page down.
- `getAnimations()` only sees CSS animations, CSS transitions and the Web Animations API. JS-driven animation such as GSAP tweens on rAF, canvas or WebGL will not appear there. For those, video or frames plus source reading are needed. This is inference from how the API works, not from a cited source here.

### Gaps
- I found no MCP server that exposes the DevTools Animations panel (animation groups, timeline scrubbing) directly.
- I did not test the quality of mp4 versus webm outputs or their frame rates.

## Q3. Design-extraction-specific MCP servers (tokens, dembrandt, design-extractor, superdesign, Figma-from-URL)

### Takeaway
A distinct category of design-token extractors has emerged, all built on Playwright and computed styles:
- dembrandt, 4.1k stars
- designlang (design-extract), about 5.2k stars
- Firecrawl's `branding` format

These output DTCG, Tailwind or shadcn tokens, plus some motion tokens. For Figma-from-URL, html.to.design has a hosted MCP (mcp.to.design) with `import-url`, and Figma's own MCP has a web-page capture feature.

### Cited Findings
**dembrandt**
- 4.1k stars, about 348 forks. It uses Playwright through `playwright-core` and reads computed styles from the DOM. — [GitHub](https://github.com/dembrandt/dembrandt)
- It extracts:
  - logo
  - colors
  - typography
  - spacing
  - borders
  - shadows
  - **motion**: a duration scale, easing curves and hover patterns per component
  - components
  - breakpoints
  - icons and frameworks
  - Source: [GitHub](https://github.com/dembrandt/dembrandt)
- Outputs: W3C DTCG (`--dtcg`), DESIGN.md, Tailwind v4 `@theme`, a shadcn theme, an HTML report, a PDF brand guide and JSON. The version seen is v0.41.0. — [GitHub](https://github.com/dembrandt/dembrandt)
- MCP: `claude mcp add --transport stdio dembrandt -- npx -y dembrandt mcp`, with tools such as `get_design_tokens`, `get_color_palette` and `export_dtcg`. It is in the MCP Registry as `io.github.dembrandt/dembrandt`. — [GitHub](https://github.com/dembrandt/dembrandt)

**designlang / design-extract (Manavarya09)**
- About 5.2k stars and 430 forks. — [GitHub](https://github.com/Manavarya09/design-extract)
- How it works: a single `page.evaluate` walks up to 5,000 elements and collects 25+ computed properties. It writes 17+ files, including DTCG tokens, Tailwind, shadcn and Figma variables, `*-motion-tokens.json`, `*-anatomy.tsx` React stubs and prompt files for v0, Lovable, Cursor and Claude. — [GitHub](https://github.com/Manavarya09/design-extract)
- MCP: `npx designlang mcp`, with tools `extract_design`, `get_job_status`, `get_tokens`, `get_colors`, `get_typography`, `get_components`, `get_findings`, `compute_drift` and `export`. — [GitHub](https://github.com/Manavarya09/design-extract)

**Firecrawl `branding` format**
- `formats: ['branding']` returns:
  - colorScheme
  - logo
  - colors: primary, secondary, accent, background, text, and semantic colors
  - fonts
  - typography: families, sizes, weights and line heights
  - spacing: baseUnit, borderRadius, padding and margins
  - components: buttonPrimary, buttonSecondary and input
  - icons
  - images: logo, favicon and ogImage
  - **animations**: animation and transition settings
  - layout: grid, header and footer heights
  - personality
  - Source: [Firecrawl docs](https://docs.firecrawl.dev/features/scrape)
- It can be combined with markdown and screenshot formats. Screenshot URLs expire in 24 hours. — [Firecrawl docs](https://docs.firecrawl.dev/features/scrape)

**Hosted and other servers**
- MiroMiro is a hosted HTTP MCP that reads site code, tokens, colors, fonts and assets. — [MiroMiro](https://miromiro.app/api/agents/claude-code)
- AnimatedWebs is a hosted MCP with 15 tools, including a style extractor. — [ai-powered.com](https://ai-powered.com/mcp/animatedwebs)
- Both of these are vendor claims and unverified.

**Figma from a URL**
- html.to.design runs a hosted MCP at `https://mcp.to.design` with tools including `import-html` and `import-url`. It connects to Claude Code over HTTP or as a claude.ai custom connector, and it pairs with the Figma plugin's MCP tab. — [html.to.design docs](https://html.to.design/docs/mcp-tab)
- Figma's own MCP at `https://mcp.figma.com/mcp` reportedly includes web-page capture. This comes from a search summary and is unverified. — [Figma docs](https://developers.figma.com/docs/figma-mcp-server/remote-server-installation)

### Inferences
- The token extractors give excellent static design systems and coarse motion tokens (durations and easings). They do not reproduce bespoke choreography. Combine them with a DevTools or Playwright server for per-element animation detail.
- Figma importers turn a URL into static layers. Motion is lost, so they help with layout and visuals, not transitions.

### Gaps
- Superdesign (superdesigndev/superdesign): not researched this session, so I have no star count or capability data.
- code.to.design and Builder.io's Figma/URL import MCP: not verified.
- I could not verify the claims made by Perfect-Web-Clone-IDE, MiroMiro or AnimatedWebs.

## Q4. Can Claude and other LLMs consume video, or must motion become frames plus timing data? Best practices

### Takeaway
Claude's API does **not** accept video. It takes JPEG, PNG, GIF and WebP, and for animated GIFs only the first frame is used. Motion must therefore be converted to still frames, which can number up to 600 images per request on the API, combined with structured timing data. Community practice is FFmpeg frame extraction plus reading the real source and CSS from the live URL.

### Cited Findings
- Supported formats are JPEG, PNG, GIF and WebP. The docs state: "Animations are unsupported, and only the first frame is used." — [Claude vision docs](https://platform.claude.com/docs/en/build-with-claude/vision)
- Image limits:
  - Up to 600 images per API request, or 100 for models with a 200k context window. The limit is 20 per turn on claude.ai.
  - Above 20 images in one request, a stricter per-image dimension limit applies. Keeping images at or under 3,000 px per side avoids it.
  - Total request size is capped at 128 MB, and the Files API is recommended for many images.
  - Source: [Claude vision docs](https://platform.claude.com/docs/en/build-with-claude/vision)
- Image token cost is ⌈w/28⌉ × ⌈h/28⌉ visual tokens. Large images are downscaled; for example, 1920×1080 becomes 1456×819 on the standard tier. — [Claude vision docs](https://platform.claude.com/docs/en/build-with-claude/vision)
- Community workflow: have Claude Code extract about 180 frames from an MP4 with FFmpeg, convert them to WebP and build scroll-driven sequences. These are third-party blogs. — [chaseai.io](https://chaseai.io/blog/how-to-build-animated-websites-with-ai); [Medium](https://medium.com/write-a-catalyst/how-i-built-a-high-end-animated-website-in-10-minutes-using-claude-code-7e48ab8b0974)
- Guides report that cloning from the live URL beats screenshots, because the agent can read the code and recreate animations. This relies on community skills, not an official feature. — [search summary of community guides](https://www.getclaudeskills.com/skills/clone-website-jcodesmore)

### Inferences
Best-practice pipeline for motion:
1. Read the declarative data first: `getAnimations()`, `getKeyframes()`, computed transition and animation properties, and JS bundles with library configs.
2. Capture video with `screencast_start` or `browser_start_video`.
3. Run FFmpeg to produce a small number of keyframes at known timestamps, and annotate them with timing.
4. Compare the rebuild against the original side by side, frame by frame.
5. Slowing animations through the CDP `Animation.setPlaybackRate` or CPU throttling helps capture more frames. This is inference and was not verified as exposed by either MCP server.

### Gaps
- Native video input support in Gemini and OpenAI models for this use case was not researched this session.
- I found no rigorous benchmark comparing frame-based versus code-based motion reproduction quality.
