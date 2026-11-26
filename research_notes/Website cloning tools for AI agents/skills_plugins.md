# Community Claude Code skills, plugins and agent workflows for cloning or reverse-engineering websites

Research date: 2026-11-26. Star counts marked "(live, 2026-11-26)" were read from the GitHub repo page through WebFetch on that date. The GitHub API was blocked in this session, so the counts are as rendered on the page and rounded by GitHub (for example "39.8k"). Counts taken from third-party articles carry those articles' dates.

## 1. Which Claude Code skills and plugins target website cloning, design extraction or screenshot-to-code? Stars and adoption?

### Takeaway
JCodesMore's `ai-website-cloner-template` (`/clone-website`, about 39.8k stars) is the most-adopted Claude Code clone skill. It works with Claude Code, Codex CLI, OpenCode and Cursor. The biggest standalone apps in this space are abi/screenshot-to-code (about 81.5k stars) and Firecrawl's open-lovable (about 29k stars). A second group of tools extracts a site's design system rather than cloning it: VoltAgent/awesome-design-md (about 129k stars), dembrandt (about 2.1k stars), and senlindesign/taste-skill (525 stars). Many small skills (single- or low-double-digit stars) are spread across marketplaces such as mcpmarket, skills.sh, skillsmp and claudemarketplace.

### Cited Findings

**JCodesMore/ai-website-cloner-template (`/clone-website`). The category leader.**
- 39.8k stars, 5.9k forks, 89 commits on master; MIT license (live, 2026-11-26). — [GitHub](https://github.com/JCodesMore/ai-website-cloner-template)
- Star counts in other sources lag behind: a multi-language article series headlines "13,000 stars" (2026), and one search-result summary cited more than 26,000. This shows fast growth through 2026. — [pasqualepillitteri.it](https://pasqualepillitteri.it/en/news/1528/ai-website-cloner-claude-code-skill-13000-stars-2026); [GitHub](https://github.com/JCodesMore/ai-website-cloner-template)
- It is a "Use this template" Next.js 16 scaffold with shadcn/ui and Tailwind v4. It contains a `clone-website/` skill folder, a `.claude/commands/` bridge and an `AGENTS.md`. The README recommends running `claude --chrome`. — [README (raw)](https://raw.githubusercontent.com/JCodesMore/ai-website-cloner-template/master/README.md); [jsDelivr README mirror](https://cdn.jsdelivr.net/gh/JCodesMore/ai-website-cloner-template@master/README.md)
- The current pipeline has four steps:
  1. Map: source URLs to local routes.
  2. Observe: desktop and mobile; extract assets and fonts; exercise alternate states.
  3. Build: editable components and working interactions; independent sections can be delegated to parallel agents.
  4. Compare: source and clone at matched sizes and states; repair differences; run a production check.

  Deliverables are route mappings, comparison screenshots and a "remaining gaps" list. Supported agents are Claude Code (recommended), Codex CLI, OpenCode and Cursor. — [GitHub](https://github.com/JCodesMore/ai-website-cloner-template)
- An earlier description: it uses Chrome MCP to inspect the live site, extracts design tokens and assets, writes component specs and dispatches parallel builder agents. It reads computed CSS from the browser instead of guessing from screenshots. Node.js 24+ is required. — [pasqualepillitteri.it (via search snippet)](https://pasqualepillitteri.it/en/news/1528/ai-website-cloner-claude-code-skill-13000-stars-2026); [pyshine](https://pyshine.com/AI-Website-Cloner-Clone-Any-Website-With-One-Command/)
- Its README warns against phishing and impersonation, and notes that logos, brand assets and copy belong to their owners. — [GitHub](https://github.com/JCodesMore/ai-website-cloner-template)
- It is mirrored and listed widely: skillsmp, SourceForge mirror, codekk. — [skillsmp](https://skillsmp.com/creators/jcodesmore/ai-website-cloner-template); [SourceForge](https://sourceforge.net/projects/ai-website-cloner.mirror/)

**abi/screenshot-to-code. A standalone app, not a skill.**
- 81.5k stars, 10.0k forks, 1,461 commits; MIT license (live, 2026-11-26). — [GitHub](https://github.com/abi/screenshot-to-code)
- Turns screenshots, mockups, Figma designs and screen recordings into code. Output stacks are HTML+Tailwind, HTML+CSS, React, Vue, Bootstrap and Ionic. It needs an OpenAI, Anthropic or Gemini key. Video mode requires Gemini. The project calls Ollama models "not recommended due to poor-quality results". — [GitHub](https://github.com/abi/screenshot-to-code)
- Animation handling is not documented beyond "recordings become functional prototypes". The model list in its README is internally inconsistent. — [GitHub](https://github.com/abi/screenshot-to-code)

**firecrawl/open-lovable. A standalone example app.**
- 29.0k stars, 5.5k forks, 61 commits; MIT license (live, 2026-11-26). — [GitHub](https://github.com/firecrawl/open-lovable)
- It is described as "Clone and recreate any website as a modern React app in seconds". It requires FIRECRAWL_API_KEY, an LLM key (Gemini, Anthropic, OpenAI or Groq) and a sandbox (Vercel or E2B). It is positioned as an example app, with Lovable.dev as the full product. The README does not document what gets extracted. — [GitHub](https://github.com/firecrawl/open-lovable)
- There is also a Firecrawl-branded "Website Design Clone" skill listed on mcpmarket. It outputs a DESIGN.md of tokens and screenshots for other agents to use, explicitly does not copy source code, and needs a Firecrawl key. — [mcpmarket](https://mcpmarket.com/tools/skills/firecrawl-website-design-clone)

**VoltAgent/awesome-design-md. A design-system extraction library.**
- About 129.2k stars, 14.2k forks, 84 DESIGN.md files (live, 2026-11-26). This count is unusually high and worth re-verifying. — [GitHub](https://github.com/VoltAgent/awesome-design-md)
- It is a library of DESIGN.md files in the Google Stitch format, extracted from public sites. Sections cover visual theme, colour roles, typography hierarchy, component states, spacing and grid, elevation, do's and don'ts, responsive behaviour and an agent prompt guide. There is no motion section. Each site also ships a `preview.html`. The extraction process is not documented, and the contribution guide asks for fixes to "wrong colors, missing tokens". — [GitHub](https://github.com/VoltAgent/awesome-design-md)

**dembrandt. A design-token extraction CLI plus skills.**
- About 2,133 stars and 210 forks (blog, September 2026). Earlier snapshots: 1,882 stars (ecosyste.ms) and 1,579 (March 2026). The companion `dembrandt/dembrandt-skills` repo shows about 169–195 stars. It is a TypeScript CLI under the MIT license. — [brightcoding blog](https://blog.brightcoding.dev/2026/09/20/dembrandtdembrandt-extract-design-tokens-from-any-website); [ecosyste.ms](https://awesome.ecosyste.ms/projects/github.com%2Fdembrandt%2Fdembrandt); [skills.sh](https://skills.sh/dembrandt/dembrandt-skills/extract-design)

**senlindesign/taste-skill (`/taste`).**
- 525 stars, 49 forks; MIT license (live, 2026-11-26). — [GitHub](https://github.com/senlindesign/taste-skill)
- Uses Playwright MCP to capture a 1440×900 viewport, a full-page screenshot and a DOM scan of 1–3 pages. From these it extracts colours, font families, weights and sizes, radii, depth and transition timing. It also writes "taste principles", each with a trigger, decision, reason, evidence and trade-off. Output is `{domain}.md` and `{domain}.json`, exportable to Cursor, Windsurf or CLAUDE.md. It is not a code cloner and is explicitly "not for animation work". It shows computed values only, not CSS variable names. It fails on login pages and Cloudflare challenges, and heavy SPAs can still be loading after its roughly 6-second wait. — [GitHub](https://github.com/senlindesign/taste-skill)

**bienhoang/design-clone (`/design:clone`, `/design:clone-px`).**
- 6 stars, 1 fork, 69 commits (live, 2026-11-26), so low adoption. Install with `npm i -g design-clone`. — [GitHub](https://github.com/bienhoang/design-clone)
- Uses Playwright and Chromium. Captures screenshots at 1920, 768 and 375px, cleaned HTML, CSS with unused selectors removed plus the original CSS, `@keyframes` and transition metadata, `tokens.json`, images, fonts and icons, and a Claude-generated `structure.md`. Hover capture (`--capture-hover`) is labelled "phase 2". — [GitHub](https://github.com/bienhoang/design-clone)

**azeembuilds/website-cloner. A Claude Code plugin.**
- 2 stars, 1 fork, 12 commits (live, 2026-11-26). — [GitHub](https://github.com/azeembuilds/website-cloner)
- Runs three sub-agents:
  1. Extractor: screenshots at each breakpoint, assets and fonts, writes `site-dna.json`.
  2. Reconstructor: builds section by section and generates tokens.
  3. Comparator: pixel diff per section.

  Its demo claims a "96.6% pixel match", but the method is not described. It claims hover, focus and "subtle animation" states, with no mention of scroll. Auth-gated content is out of scope, heavy SPAs need a longer pass, and video is not rebuilt. — [GitHub](https://github.com/azeembuilds/website-cloner)

**Other long-tail clone skills (stars not verified):**
- julianromli/ai-skills `clone-website`. — [claudeskills.info](https://claudeskills.info/skills/julianromli/ai-skills/clone-website/); [awesomeskill.ai](https://awesomeskill.ai/skill/julianromli-ai-skills-clone-website)
- A shreyjoshi2004 gist, "Claude Code skill for reverse-engineering and pixel-perfect cloning". — [Gist](https://gist.github.com/shreyjoshi2004/150557a59571f0a07aefa9743650f44d)
- Mood-Global-Services "How-to-Clone-Website---Claude-Skills". — [GitHub](https://github.com/Mood-Global-Services/How-to-Clone-Website---Claude-Skills)
- Marketplace listings: mcpmarket "pixel-perfect-website-cloner", "website-clone-replicate" and "website-cloner-reverse-engineer"; terminalskills `clone-website`; getclaudeskills "clone-website-jcodesmore". — [mcpmarket 1](https://mcpmarket.com/tools/skills/pixel-perfect-website-cloner); [mcpmarket 2](https://mcpmarket.com/tools/skills/website-clone-replicate); [mcpmarket 3](https://mcpmarket.com/tools/skills/website-cloner-reverse-engineer-2); [terminalskills](https://terminalskills.io/skills/clone-website); [getclaudeskills](https://www.getclaudeskills.com/skills/clone-website-jcodesmore); [claudemarketplace.net](https://www.claudemarketplace.net/skills/clone-website)

**Anthropic `frontend-design` skill (anthropics/skills). Not a cloner.**
- It covers designing new UI: distinctive typography, layout concepts with ASCII wireframes, avoiding the "SaaS-card kit". On motion it favours "one orchestrated moment" (such as a page-load sequence) over scattered entrance and hover effects, and requires reduced-motion support. It contains nothing about extracting or cloning sites. — [SKILL.md](https://raw.githubusercontent.com/anthropics/skills/main/skills/frontend-design/SKILL.md)

### Inferences
- Adoption is heavily concentrated. JCodesMore's template is the de facto "clone this site" skill, and its star count roughly tripled in 2026. The other clone skills sit at fewer than 10 stars, apart from taste-skill (525) and dembrandt (about 2.1k), which extract design systems rather than code.
- There are three families:
  1. Full-code cloners: JCodesMore, azeembuilds, design-clone, open-lovable.
  2. Design-spec extractors producing DESIGN.md, tokens or taste notes: awesome-design-md, dembrandt, taste-skill, the Firecrawl design-clone skill.
  3. Image or video-to-code apps: screenshot-to-code.

  Families 2 and 3 have essentially no motion fidelity.
- The JCodesMore template runs on Codex CLI, OpenCode and Cursor, so the leading Claude Code skill also covers the Cursor and Codex question.

### Gaps
- Exact live star counts could not be pulled through the GitHub API in this session. The "k" figures are GitHub's rounded display. The 129.2k for awesome-design-md and 81.5k for screenshot-to-code should be re-checked.
- I could not get the star count of anthropics/skills, or verify listings on skillsmp, awesome-claude-code or awesome-claude-skills specifically for clone skills.
- I found no same.new-style open-source cloner beyond open-lovable with meaningful adoption.

## 2. Which tools handle motion (CSS animations, transitions, GSAP, Framer Motion or Lenis detection, scroll-triggered effects, hover states)?

### Takeaway
Few tools capture motion from a live site. The standout is NiazMorshed2007/reanimate (about 2.6k stars), a dedicated record, spec, rebuild and diff loop for animations. JCodesMore's cloner has added guidance for scroll- and time-driven motion and alternate states. Most other cloners only capture static CSS (`@keyframes` or transition values via getComputedStyle), which misses JS-driven motion such as GSAP or Lenis.

### Cited Findings

**NiazMorshed2007/reanimate. A motion-specific skill.**
- About 2.6k stars, 235 forks; MIT license (live, 2026-11-26). Install with `npx skills add NiazMorshed2007/reanimate -g`. It requires Bun 1.1+ and no API keys. It was covered on Nov 1, 2026 with a "0.03% pixel error" headline, but the method behind that number is not explained. — [GitHub](https://github.com/NiazMorshed2007/reanimate); [hermes-ai.net](https://hermes-ai.net/news/reanimate-gives-claude-a-ruler-to-clone-web-animations-within-0-03-pixel-error/)
- Inputs are a live URL, mp4, gif, screen recording or Lottie file.
- How it works:
  - Records in headless Playwright at a fixed viewport and frame rate.
  - Uses a virtual clock with seeded randomness, so frames are byte-identical.
  - Captures CSS and Web Animations API data and element positions.
  - Traces canvas, WebGL and WebGPU scenes through GPU calls (three.js, Pixi, PlayCanvas, Babylon, OGL).
  - Records triggers for load, scroll, hover, leave, pointer path, drag and click.
  - Fits physics springs from overshoot and settle time.
  - Writes a spec with one row per element per property: timing, from/to values, easing, stagger.
  - Rebuilds in CSS, Framer Motion, GSAP or three.js to match the project's stack.
  - Repeats compare-and-fix for 2–5 rounds.
  - Has two matching modes: "moves the same" (default) and "looks the same" (≤2% mean pixel mismatch).

  — [GitHub](https://github.com/NiazMorshed2007/reanimate); [hermes-ai.net](https://hermes-ai.net/news/reanimate-gives-claude-a-ruler-to-clone-web-animations-within-0-03-pixel-error/)
- Limitations:
  - Login-gated pages, YouTube and Loom cannot be recorded; use a screen recording instead.
  - Springs are approximated.
  - Worker clocks run in real time, and iframe canvases need the iframe's own URL.
  - Random particle systems are compared with a blurred metric.
  - Supported on macOS and Linux only.
  - It records which libraries a page uses, but does not document specific GSAP, Lenis or Framer Motion detection.

  — [GitHub](https://github.com/NiazMorshed2007/reanimate)

**Schmandarine/web-motion-skill. Verifies your own animations rather than cloning.**
- 19 stars, 1 fork (live, 2026-11-26). Headless Chromium auto-scrolls a running dev server for about 9 seconds and records video. It extracts about 220 frames at 25fps and builds a 24-frame labelled contact sheet that the agent "looks at". It covers GSAP timing, eases, stagger and ScrollTrigger, and pairs with the official GSAP skills. Hover and click recording is manual. Lenis and Framer Motion are not mentioned. — [GitHub](https://github.com/Schmandarine/web-motion-skill)

**JCodesMore `/clone-website`.**
- The Observe step "exercises alternate states". There is guidance for Framer-built and animated sites covering responsive variants, sticky scenes and "scroll- or time-driven motion". The README does not name hover, transition or library detection explicitly. — [GitHub](https://github.com/JCodesMore/ai-website-cloner-template)

**Static-CSS-level motion capture:**
- design-clone: `@keyframes` and transition and timing metadata; hover is "phase 2". — [GitHub](https://github.com/bienhoang/design-clone)
- azeembuilds: claims hover, focus and subtle animation states; no scroll. — [GitHub](https://github.com/azeembuilds/website-cloner)
- taste-skill: transition timing only; "not for animation work". — [GitHub](https://github.com/senlindesign/taste-skill)
- awesome-design-md: no motion section. — [GitHub](https://github.com/VoltAgent/awesome-design-md)

**Clone-skill instructions that address motion (from search snippets, unverified in full):**
- Some skills tell the agent to scroll slowly from top to bottom so scroll-dependent states get captured.
- Others record each transition's trigger, before and after states, and timing.

— [mcpmarket](https://mcpmarket.com/tools/skills/website-cloner-reverse-engineer-2); [terminalskills](https://terminalskills.io/skills/clone-website); [Gist](https://gist.github.com/shreyjoshi2004/150557a59571f0a07aefa9743650f44d)

**Build-side motion skills (author new motion; do not extract it):**
- Official greensock/gsap-skills covers core, timeline, ScrollTrigger, plugins, React and performance. It installs via `/plugin marketplace add greensock/gsap-skills` and is also on the Cursor marketplace. — [GitHub](https://github.com/greensock/gsap-skills); [Cursor marketplace](https://cursor.com/marketplace/gsap)
- Community skills: gsap-scrolltrigger (claudedesignskills), gsap-awwwards-website, scroll-animations, and animation-library (Framer Motion and GSAP patterns). — [skills.sh](https://www.skills.sh/freshtechbro/claudedesignskills/gsap-scrolltrigger); [claudemarketplaces](https://claudemarketplaces.com/skills/eng0ai/eng0-template-skills/gsap-awwwards-website); [mcpmarket](https://mcpmarket.com/tools/skills/scroll-animations); [skills.lc](https://skills.lc/deomiarn/website-os/deomiarn-website-os-claude-skills-animation-library-skill-md)
- A Codrops tutorial (2026-10-26) builds a kinetic type site with GSAP and the "Animaxxing" skills. — [Codrops](https://tympanus.net/codrops/2026/10/26/animating-agents-gsap-animaxxing/)
- neonwatty/css-animation-skill generates demo HTML/CSS animations. — [GitHub](https://github.com/neonwatty/css-animation-skill)

### Inferences
- A practical high-motion workflow combines three tools:
  1. JCodesMore `/clone-website` for structure, assets and fonts.
  2. reanimate to capture and diff the motion of specific elements.
  3. The official GSAP skills, or web-motion-skill, for implementing and verifying the motion.
- No tool documents explicit detection of GSAP, Lenis or Framer Motion from page JavaScript. Detection depends on behavioural recording (reanimate) or on the agent's own inspection.

### Gaps
- I found no verified skill that statically reads ScrollTrigger configs, Lenis settings or Framer Motion variants from bundled JS.

## 3. What do users say about which tools actually work for animations?

### Takeaway
Community evidence is thin. The one detailed hands-on report found says a Claude Code clone of an Awwwards-level site was visually close, but the animations were not reproduced, because getComputedStyle-based extraction misses JS-driven motion such as Lenis. Animation-specific tools like reanimate exist because of this gap, but independent user reviews of them were not found.

### Cited Findings
- A Japanese developer (note.com, about March 2026) cloned an Awwwards-level site with Claude Code. Visual reproduction was close but animations were not replicated. They attributed this to the skill relying on getComputedStyle() (one moment in time) and not parsing minified JS (for example Lenis smooth scroll), calling it built for CSS extraction rather than animation logic. This comes from a search-result summary only; the page returned 404 on direct fetch. — [note.com](https://note.com/st_dev0/n/nff1f0622b93b?hl=en)
- A Show HN post claiming Claude Code can produce production Lottie animations published no code or demo. — [DEV/gentic.news](https://dev.to/gentic_news/claude-code-generates-production-lottie-animations-via-show-hn-165n)
- web-motion-skill's stated motivation is that the agent "can write animation code but never actually sees it run". This is the core failure mode that frame-capture skills address. — [GitHub](https://github.com/Schmandarine/web-motion-skill)

### Inferences
- The consistent theme across READMEs and the one user report is that screenshot-plus-computed-style cloners handle static layout, tokens and fonts well. Scroll-linked and JS-driven motion needs time-based capture (video or frame capture with a controlled clock), which only reanimate and web-motion-skill provide.

### Gaps
- I found no Reddit r/ClaudeAI, HN or X threads comparing clone skills on animation fidelity. Searches returned unrelated Webflow, Figma and Adobe threads.
- No independent benchmarks exist. The 96.6% (azeembuilds) and 0.03% (reanimate) pixel figures are self-reported with methods not explained.
