# Layer three tools to clone animated websites

The best stack for an AI agent that needs to take a website apart and rebuild it has three parts. **JCodesMore's `ai-website-cloner-template` (`/clone-website`, about 39.8k stars)** handles structure, assets and fonts. **Chrome DevTools MCP (59.5k stars)** or **Playwright MCP (40.2k stars)** handle deep inspection and video. **NiazMorshed2007/reanimate (about 2.6k stars)** is the only widely adopted skill built to record, specify and diff animations, so it covers motion. For design tokens, add **dembrandt (about 4.1k stars)** or **designlang (about 5.2k stars)**. No single tool does the whole job. Adoption is concentrated in a few projects. The largest numbers belong to adjacent tools: screenshot-to-code (81.5k), awesome-design-md (about 129k) and Browser Use (122k). None of those three captures real motion. Most tools that call themselves cloners read `getComputedStyle()` at one moment in time. That works well for layout, colour and type. It misses the JavaScript-driven motion that defines award-winning sites: GSAP ScrollTrigger timelines, Lenis smooth scroll, Framer Motion springs, and WebGL. The one detailed user report found confirms this: a Claude Code clone of an Awwwards-level site came out visually close but lost every scroll animation. All star counts are GitHub's rounded display figures as of 2026-11-26. All fidelity claims ("96.6% pixel match", "0.03% pixel error") are self-reported and have not been independently benchmarked.

## One clone skill dominates, and the big numbers sit elsewhere

The tools in this space fall into three families, and stars alone mislead because the families do different jobs.

### Family 1: full-code cloners

**JCodesMore/ai-website-cloner-template** is the de facto Claude Code clone skill. On 2026-11-26 it had **39.8k stars and 5.9k forks** under the MIT license ([GitHub](https://github.com/JCodesMore/ai-website-cloner-template)). Its star count grew roughly threefold during 2026: articles from earlier in the year headlined "13,000 stars" ([pasqualepillitteri.it](https://pasqualepillitteri.it/en/news/1528/ai-website-cloner-claude-code-skill-13000-stars-2026)).

- **What it is.** A Next.js 16, shadcn/ui and Tailwind v4 scaffold with a `clone-website` skill. The README recommends running `claude --chrome`.
- **How it works.** It runs a Map → Observe → Build → Compare loop. It inspects the live site through Chrome, reads computed CSS rather than guessing from screenshots, and extracts assets and fonts. It sends independent sections to parallel builder agents, then compares the source and the clone at matched viewports and states.
- **Outputs.** Route mappings, comparison screenshots and a "remaining gaps" list ([README](https://raw.githubusercontent.com/JCodesMore/ai-website-cloner-template/master/README.md)).
- **Agent support.** It runs on Claude Code, Codex CLI, OpenCode and Cursor.

The other code cloners have almost no adoption:

- **bienhoang/design-clone** has **6 stars**. It captures three breakpoints, cleaned HTML and CSS, `@keyframes`, transition metadata and `tokens.json`. Hover capture is still listed as "phase 2" ([GitHub](https://github.com/bienhoang/design-clone)).
- **azeembuilds/website-cloner** has **2 stars**. It runs extractor, reconstructor and comparator sub-agents and claims a "96.6% pixel match" without describing how that was measured ([GitHub](https://github.com/azeembuilds/website-cloner)).
- **firecrawl/open-lovable** has **29.0k stars** but is a hosted-style example app, not a skill. It needs Firecrawl, LLM and sandbox keys, and it does not document what it extracts ([GitHub](https://github.com/firecrawl/open-lovable)).

### Family 2: design-spec extractors

These tools produce a DESIGN.md file or a token set rather than code.

- **VoltAgent/awesome-design-md** shows about **129.2k stars**. That figure is unusually high and worth re-checking. It is a library of 84 pre-extracted DESIGN.md files with **no motion section**. It does not document an extraction pipeline you can run yourself ([GitHub](https://github.com/VoltAgent/awesome-design-md)).
- **senlindesign/taste-skill** has **525 stars**. It uses Playwright MCP to extract colours, type, radii and transition timing into "taste principles". Its README says it is explicitly "not for animation work" ([GitHub](https://github.com/senlindesign/taste-skill)).

### Family 3: image-to-code apps

**abi/screenshot-to-code** has **81.5k stars** and turns screenshots and recordings into HTML/Tailwind, React or Vue. It does not document how it handles animation ([GitHub](https://github.com/abi/screenshot-to-code)).

### Why the stars mislead

The rough skill marketplaces are full of single-digit-star clone skills: mcpmarket, skills.sh and terminalskills ([mcpmarket](https://mcpmarket.com/tools/skills/website-cloner-reverse-engineer-2); [terminalskills](https://terminalskills.io/skills/clone-website)). The practical conclusion is that JCodesMore is the only clone skill with real adoption. The projects with bigger star counts solve neighbouring problems: a library of finished design specs, and image-to-code generation.

## Chrome DevTools MCP gives the deepest view of a live page

An agent can only rebuild what it can see. Browser MCP servers set that limit, and they differ a great deal in how much they expose.

**Chrome DevTools MCP** (Google, **59.5k stars**) is the most complete single server for cloning. Its 61 tools include:

- `get_css_styles`: computed styles, matched rules in precedence order, and custom properties for each element.
- `get_network_request`: full CSS, JS, font and image bodies, returned inline or saved to disk.
- `screencast_start` / `screencast_stop`: record the page as **.mp4**.
- `evaluate_script`: run arbitrary JavaScript.
- Performance traces.
- `emulate`: CPU and network throttling, and reduced-motion emulation.

Source: [tool reference](https://raw.githubusercontent.com/ChromeDevTools/chrome-devtools-mcp/main/docs/tool-reference.md). Its main gap matters for motion: **it does not expose the DevTools Animations panel**, and it has no tool for frame sequences.

**Playwright MCP** (Microsoft, **40.2k stars**) is close behind. It records **.webm video**, produces Playwright traces with DOM snapshots for each action, and offers `browser_evaluate` and `browser_run_code_unsafe` for scripting. Computed styles have to be read through scripted `getComputedStyle` calls ([GitHub](https://github.com/microsoft/playwright-mcp)). Both servers are free and run locally.

The "agentic" browser tools score high on stars but low on inspection depth:

- **Browser Use** (122.1k stars): its stars reflect the Python agent framework, not inspection depth ([GitHub](https://github.com/browser-use/browser-use)).
- **Stagehand** (26.2k stars): exposes act, observe and extract steps ([GitHub](https://github.com/browserbase/stagehand)).
- **Browserbase MCP**: now **archived**, and had **no screenshot tool** ([GitHub](https://github.com/browserbase/mcp-server-browserbase)).
- **Hyperbrowser MCP** (795 stars): scrape, crawl and extract only ([GitHub](https://github.com/hyperbrowserai/mcp)).

These tools are useful for reaching a page state, such as logging in or dismissing modals. They are poor choices for capturing fidelity.

| Capability | Chrome DevTools MCP | Playwright MCP | Firecrawl MCP | Browserbase / Hyperbrowser |
|---|---|---|---|---|
| Stars (2026-11-26) | 59.5k | 40.2k | 7.9k | 3.4k (archived) / 795 |
| Video | .mp4 screencast | .webm | None | None |
| Computed styles | First-class (`get_css_styles`) | Via JS | `branding` summary | No |
| Network bodies (CSS/JS/fonts) | Yes, saved to file | Yes | No | No |
| Run JS (`getAnimations()`) | Yes | Yes | Via `interact` | Indirect |
| Traces | Performance traces | Playwright traces | No | No |

Sources: [Chrome DevTools MCP](https://raw.githubusercontent.com/ChromeDevTools/chrome-devtools-mcp/main/docs/tool-reference.md), [Playwright MCP](https://github.com/microsoft/playwright-mcp), [Firecrawl MCP](https://github.com/firecrawl/firecrawl-mcp-server), [Firecrawl scrape docs](https://docs.firecrawl.dev/features/scrape).

### Token extractors

A separate group of MCP servers specialises in design tokens:

- **designlang / design-extract** (about **5.2k stars**) walks up to 5,000 elements and writes 17+ files. These include DTCG tokens, Tailwind, shadcn and Figma variables, a `motion-tokens.json`, and React "anatomy" stubs. Its `--motion-runtime` mode drives the page through load, scroll, hover and focus. It then reads `document.getAnimations()` to record stagger choreography and scroll recipes such as parallax, reveal and pin ([GitHub](https://github.com/Manavarya09/design-extract)).
- **dembrandt** (about **4.1k stars** on GitHub, up from about 2.1k in a September 2026 write-up) extracts colours, type, spacing, shadows, breakpoints and a **motion scale of durations, easings and hover patterns**. It exports DTCG, DESIGN.md, Tailwind v4 `@theme` and shadcn themes. It is listed in the MCP Registry ([GitHub](https://github.com/dembrandt/dembrandt); [brightcoding](https://blog.brightcoding.dev/2026/09/20/dembrandtdembrandt-extract-design-tokens-from-any-website)).
- **Firecrawl's `branding` format** returns a comparable token summary that includes animation and transition settings ([Firecrawl docs](https://docs.firecrawl.dev/features/scrape)).

All three produce excellent static design systems but only coarse motion tokens. They do not reproduce bespoke choreography.

### Figma import

For a URL-to-Figma path, html.to.design runs a hosted MCP with an `import-url` tool ([docs](https://html.to.design/docs/mcp-tab)). All motion is lost in the import.

## Motion breaks most cloners because JavaScript animations are invisible to computed styles

The core technical constraint explains why almost every cloner fails on animation.

### What browser-native tools can see

The browser's own animation tools see CSS animations, CSS transitions, the Web Animations API and View Transitions. That covers the Chrome DevTools Animations panel and `document.getAnimations()`. The Animations panel also handles scroll-driven animations, measured on a pixel-based timeline. But **`requestAnimationFrame` animations are "not yet supported"** ([Chrome for Developers](https://developer.chrome.com/docs/devtools/css/animations); [MDN](https://developer.mozilla.org/en-US/docs/Web/API/Document/getAnimations)). That rules out most GSAP, JS-mode Framer Motion, Lenis and WebGL work.

### What the failure looks like in practice

The one detailed case found is a Japanese developer's Claude Code clone of an Awwwards-level site. The clone lost the scroll-triggered text fades, the header-shrink transition and the parallax. The author's explanation was that easing, duration and trigger conditions live in minified JavaScript, not in computed styles ([note.com](https://note.com/st_dev0/n/nff1f0622b93b?hl=en)). This report is known only from a search summary, because the page returned 404 when fetched directly.

### Reanimate is the exception

**reanimate** (about **2.6k stars**, MIT license, no API keys, installed with `npx skills add NiazMorshed2007/reanimate -g`) was built to close exactly this gap ([GitHub](https://github.com/NiazMorshed2007/reanimate)).

**Inputs:** a live URL, an mp4, a gif, a screen recording or a Lottie file.

**How it captures motion:**

- It records in headless Playwright under a **virtual clock with seeded randomness**, so repeated frames are byte-identical.
- It captures CSS and Web Animations API data and element positions.
- It traces canvas, WebGL and WebGPU scenes through GPU calls (three.js, Pixi, Babylon, OGL).
- It records load, scroll, hover, pointer-path, drag and click triggers.
- It fits physics springs from overshoot and settle time.

**What it produces:** a spec with one row per element per property, covering timing, from/to values, easing and stagger. It rebuilds the motion in CSS, Framer Motion, GSAP or three.js, then runs 2–5 compare-and-fix rounds. Coverage of the tool repeats its "0.03% pixel error" headline without explaining how that was measured ([hermes-ai.net](https://hermes-ai.net/news/reanimate-gives-claude-a-ruler-to-clone-web-animations-within-0-03-pixel-error/)).

**Limitations:**

- It cannot record login-gated pages, YouTube or Loom.
- Springs are approximations.
- It runs only on macOS and Linux.
- It does not document that it detects GSAP, Lenis or Framer Motion specifically.

### Other motion tools

- **Schmandarine/web-motion-skill** (19 stars) checks *your own* GSAP and ScrollTrigger build. It auto-scrolls a dev server, records about 9 seconds of video and gives the agent a contact sheet of 24 frames. Its stated motivation is that agents "can write animation code but never actually see it run" ([GitHub](https://github.com/Schmandarine/web-motion-skill)).
- **JCodesMore's cloner** has added guidance for "scroll- or time-driven motion" and for exercising alternate states. It does not name library detection ([GitHub](https://github.com/JCodesMore/ai-website-cloner-template)).
- **Build-side skills** such as the official **greensock/gsap-skills** (core, timeline, ScrollTrigger and React) help the agent *implement* motion well once it is specified. They do not extract motion from a site ([GitHub](https://github.com/greensock/gsap-skills)).

### Why video alone does not work

Claude cannot take in video directly. Its API accepts only JPEG, PNG, GIF and WebP, and for an animated GIF "only the first frame is used". A request can carry up to 600 images ([Claude vision docs](https://platform.claude.com/docs/en/build-with-claude/vision)). So motion has to reach the model as frames plus timing data. That is why time-controlled capture beats a screenshot plus `getComputedStyle()`.

## The recommended stack layers structure, inspection, tokens and motion

Put together, the evidence points to a four-layer pipeline.

| Layer | Recommended tool | Why | Main limitation |
|---|---|---|---|
| Orchestration and structure | JCodesMore `/clone-website` (39.8k stars) | Only clone skill with real adoption; Map → Observe → Build → Compare loop with parallel agents | Motion handled only through prose guidance; relies on computed styles |
| Live inspection | Chrome DevTools MCP (59.5k); Playwright MCP (40.2k) as an alternative | `get_css_styles`, network bodies, mp4 video, JS evaluation | No Animations-panel tool and no frame sequences |
| Design tokens | designlang (about 5.2k) or dembrandt (about 4.1k) | DTCG, Tailwind and shadcn tokens plus coarse motion tokens; MCP-ready | Durations and easings only, not choreography |
| Motion capture and diff | reanimate (about 2.6k) | Deterministic clock, trigger recording, WebGL tracing, spec → rebuild → diff | Self-reported accuracy; no login pages; macOS and Linux only |
| Motion implementation | greensock/gsap-skills; web-motion-skill for verification | Correct ScrollTrigger patterns; the agent "sees" its own output | Authoring only, not extraction |

### Gaps the stack does not close

Even this stack leaves gaps, and the agent has to fill them with direct probes through `evaluate_script`:

- **Detecting libraries in the page's JavaScript.** No tool reads ScrollTrigger configurations, Lenis settings or Framer Motion variants out of the bundled JavaScript.
- **GSAP probing.** When GSAP is exposed as a global, `gsap.globalTimeline.getChildren()` lists live tweens. Finished tweens drop off that timeline, so the probe has to run early or repeatedly while scrolling ([GSAP docs](https://gsap.com/docs/v3/GSAP/Timeline/getChildren()); [GreenSock forum](https://greensock.com/forums/topic/32592-is-there-a-method-to-view-all-currently-alive-tweens/)).
- **Lenis fingerprinting.** The `html.lenis` class marks a site that uses Lenis ([Lenis README](https://raw.githubusercontent.com/darkroomengineering/lenis/main/README.md)).
- **Deterministic stepping.** Playwright's Clock API (`clock.install`, `runFor`) overrides `requestAnimationFrame`, so JavaScript animation loops can be stepped deterministically ([Playwright docs](https://playwright.dev/docs/clock)).
- **Slowing CSS motion.** `document.getAnimations().forEach(a => a.playbackRate *= 0.5)` slows all CSS animations and Web Animations API animations for capture ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/Document/getAnimations)).
- **WebGL capture.** WebGL is the hardest case. Screenshots often capture these canvases blank, because with the default `preserveDrawingBuffer: false`, reading the canvas after the render tick is undefined ([WebGL Fundamentals](https://webglfundamentals.org/webgl/lessons/webgl-tips.html)). Shaders can at best be imitated from video, unless reanimate's GPU tracing works for that scene.

### Tools to skip for motion

- **Site downloaders.** HTTrack does not execute JavaScript, and SingleFile saves a snapshot designed to work without scripts. Both are useful only for collecting CSS `@keyframes` and assets ([SingleFile](https://github.com/baloe/SingleFile)).
- **Webflow migration tools.** CloneFlow states that it "does not copy over interactions or animations" ([Chrome Web Store](https://chromewebstore.google.com/detail/cloneflow-html-to-webflow/kgajffhnckomggppfflkilngojaijkpd)).

### Legal and ethical guardrails

Treat timing, easing and choreography as technique to re-implement. Do not reuse brand assets, copy, Lottie or GLB files, or minified JavaScript without permission. Downloaded Lottie files still need a license ([LottieFiles forum](https://forum.lottiefiles.com/t/how-to-get-lottie-json-into-after-effects-without-access-to-original-files/664)). Copying a site's look closely enough to confuse users can also create US trade-dress exposure ([AFS Law](https://www.afslaw.com/perspectives/alerts/ai-software-clones-raise-trademark-and-trade-dress-issues-not-just-copyright)). JCodesMore's README itself warns against phishing and impersonation.

## Conclusion

The field has split along the line between static and temporal information. Extracting layout, tokens and assets is effectively solved, and solved redundantly. Extracting motion is a young, single-project niche. Reanimate is about two orders of magnitude less starred than the browser servers it depends on, and no one has published an independent benchmark of it. Building on this stack is therefore a bet on deterministic capture: a virtual clock, recorded triggers, and frame-level comparison against a spec. More screenshot-based vision will not get there, because Claude cannot watch video and computed styles do not contain JavaScript timelines.

The missing piece is now clear. It is a tool that statically recovers ScrollTrigger, Lenis and Framer Motion configurations from bundles, or a browser MCP that exposes the CDP Animation domain and the Animations panel. Neither exists in verified form today. Until one does, the agent's own `evaluate_script` probes are the bridge. Teams should expect to hand-verify scroll-scrubbed and WebGL effects. They should treat every published pixel-accuracy figure as marketing until someone measures it against a shared benchmark.
