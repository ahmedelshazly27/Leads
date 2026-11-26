# Motion extraction: tools and techniques for capturing animations, transitions, scroll effects and interactions from existing websites (non-MCP / standalone)

Researched 2026-11-26. Popularity numbers are Chrome Web Store snapshots that vary between listings and over time, so read them as rough figures. Claims marked **[unverified]** came from a single secondary source or could not be confirmed.

## Q1. Tools for capturing and inspecting web animations (DevTools, WAAPI, GSAP, Framer Motion, Lottie, WebGL, smooth-scroll libraries)

### Takeaway
Browser-native tools are reliable for CSS animations and transitions, the Web Animations API (WAAPI) and View Transitions:
- the Chrome DevTools Animations panel
- `document.getAnimations()`
- the CDP Animation domain

They cannot see JavaScript animations driven by `requestAnimationFrame`, which covers most GSAP, Framer Motion (JS mode), Lenis and WebGL work. Those need library-specific hooks such as `gsap.globalTimeline.getChildren()`, Motion DevTools, Lottie JSON interception, or Spector.js / three.js inspectors.

### Cited Findings
**Chrome DevTools Animations panel**
- Captures CSS transitions, CSS animations, Web Animations and the View Transitions API. JavaScript `requestAnimationFrame` animations are "not yet supported" — [Chrome for Developers](https://developer.chrome.com/docs/devtools/css/animations)
- It only records animations that run while the panel is open. Animations that play on page load or have already finished need a reload with the panel open — [Chrome for Developers](https://developer.chrome.com/docs/devtools/css/animations)
- Features:
  - preview speed control
  - pause, replay and scrubbing with the playhead
  - hover-to-highlight, and click to select the element in Elements
  - dragging to change duration, keyframe offsets and delay (applied as inline styles)

  — [Chrome for Developers](https://developer.chrome.com/docs/devtools/css/animations)
- Supports scroll-driven animations. The overview marks scroll-driven groups separately, and their timeline is measured in pixels rather than time — [Chrome for Developers](https://developer.chrome.com/docs/devtools/css/animations)
- Limitations:
  - no keyframe or Bezier editing in the panel (use the Easing Editor in Elements > Styles)
  - groups are inferred from start time, so related async animations can land in different groups

  — [Chrome for Developers](https://developer.chrome.com/docs/devtools/css/animations)

**Web Animations API**
- `document.getAnimations()` returns `Animation` objects for every CSS animation, CSS transition and WAAPI animation currently in effect on elements in the document. It has been Baseline "widely available" since September 2020 — [MDN](https://developer.mozilla.org/en-US/docs/Web/API/Document/getAnimations)
- MDN's own example slows the whole page down: `document.getAnimations().forEach(a => a.playbackRate *= 0.5)`. `Element.getAnimations()` scopes the call to one subtree — [MDN](https://developer.mozilla.org/en-US/docs/Web/API/Document/getAnimations)
- Keyframes can be read with `animation.effect.getKeyframes()` on the `KeyframeEffect` — [MDN getAnimations page (reference only)](https://developer.mozilla.org/en-US/docs/Web/API/Document/getAnimations). The MDN KeyframeEffect page was not fetched to confirm the details.

**GSAP**
- `gsap.globalTimeline` is the root timeline. `getChildren(nested, tweens, timelines, ignoreBeforeTime)` returns all nested tweens and timelines — [GSAP docs: getChildren](https://gsap.com/docs/v3/GSAP/Timeline/getChildren()), [GSAP docs: globalTimeline](https://gsap.com/docs/v3/GSAP/gsap.globalTimeline())
- GreenSock's forum confirms that `gsap.globalTimeline.getChildren()` is the way to list live tweens. Completed tweens are dropped from the global timeline, which also limits `exportRoot()` — [GreenSock forum](https://greensock.com/forums/topic/32592-is-there-a-method-to-view-all-currently-alive-tweens/), [gsap.exportRoot docs](https://gsap.com/docs/v3/GSAP/gsap.exportRoot())
- GSDevTools gives a visual scrubber and timeline UI, set up with `GSDevTools.create()` — [GSAP docs: GSDevTools](https://gsap.com/docs/v3/Plugins/GSDevTools)
- Since April 30, 2025 (after the Webflow acquisition), GSAP and all its formerly paid plugins are free. GSAP's GSDevTools page still describes a CodePen-only trial, so the sources conflict on whether GSDevTools is free outside CodePen — [Webflow blog](https://webflow.com/blog/gsap-becomes-free), [Webflow Help](https://help.webflow.com/hc/en-us/articles/40538857574419-Use-GSAP-in-Webflow); conflicting: [gsap.com/gsdevtools](https://gsap.com/gsdevtools)
- Webflow's February 2026 update lets you copy and paste elements between Webflow sites without losing their GSAP-based Interactions — [Webflow updates](https://webflow.com/updates/copy-paste-new-interactions-between-sites)

**Motion (Framer Motion / Motion One)**
- Motion DevTools is a free, open-source Chrome extension from Motion.dev. It adds a "Motion" tab to DevTools that:
  - listens for CSS and Motion One animations
  - plots them on a timeline
  - exports them as CSS transitions, CSS animations or Motion One code

  — [motion.dev/tools/inspect](https://motion.dev/tools/inspect)
- The Chrome Web Store shows about 4.4 stars from 57 ratings. One reviewer said the Motion tab never appeared — [Chrome Web Store](https://chromewebstore.google.com/detail/motion-devtools/mnbliiaiiflhmnndmoidhddombbmgcdk)
- **[unverified]** No source said whether Motion DevTools sees Framer Motion React components that animate through JS/rAF.

**Lottie**
- Lottie is an open, JSON-based format. A `.lottie` (dotLottie) file is a deflate-compressed zip — [LottieFiles docs](https://docs.lottiefiles.com/en/format/lottie-json), [Wikipedia](https://www.Wikipedia.org/wiki/DotLottie)
- The "Lottie Preview" Chrome extension intercepts and previews the Lottie JSON a page loads — [Chrome Web Store](https://chromewebstore.google.com/detail/lottie-preview/dbfhpeehlgibfdjmpiajafkogoglkahj)
- The `crawl-lottie-files` npm package exists to crawl Lottie files — [npm](https://www.npmjs.com/package/crawl-lottie-files)
- Downloading an animation gives you no right to reuse it. Check the license — [LottieFiles forum](https://forum.lottiefiles.com/t/how-to-get-lottie-json-into-after-effects-without-access-to-original-files/664)

**WebGL / three.js / Spline**
- Spector.js (BabylonJS) is a WebGL and WebGL2 frame-capture debugger that works with any engine. It records the command list, GL state and shaders, and is available as an extension for Chrome and Firefox — [GitHub BabylonJS/Spector.js](https://github.com/BabylonJS/Spector.js/blob/release/documentation/extension.md), [Chrome Web Store](https://chromewebstore.google.com/detail/spectorjs/denbgaamihkadbghdceggmchnflmhpmk)
- Spector.js reportedly ships an MCP server for headless frame capture **[unverified, from search snippet]** — [Spector.js readme](https://raw.githubusercontent.com/BabylonJS/Spector.js/master/readme.md)
- threejs-inspector is a DevTools extension that only works if the page exposes `window.scene` and `THREE` as globals. Production sites rarely do this — [GitHub jeromeetienne/threejs-inspector](https://github.com/jeromeetienne/threejs-inspector)
- "Ispettore" (2025–26) is a newer DevTools extension for WebGL and WebGPU frame capture. It can filter draw calls by three.js object or material, and it reuses Spector's capture mode — [three.js forum](https://discourse.threejs.org/t/ispettore-a-chrome-extension-to-debug-webgl-and-webgpu-website/94939.md)

**Lenis / Locomotive Scroll**
- Lenis adds the classes `html.lenis`, `.lenis-smooth` and `.lenis-stopped`. Checking for these classes is a practical fingerprint (my inference; the selectors vary by version) — [Lenis README](https://raw.githubusercontent.com/darkroomengineering/lenis/main/README.md)
- Locomotive Scroll v5 is built on top of Lenis — [Locomotive Scroll docs](https://docsearch.algolia.com/mcp/docs/repo/locomotivemtl/locomotive-scroll)
- **[unverified]** No source documented a `window.lenis` global.

### Inferences
- A practical agent "motion probe" script, run through Playwright `page.evaluate`, combines several checks:
  - `document.getAnimations()`, mapped to `{target selector, keyframes, timing (duration/easing/delay/iterations), timeline type}`
  - detection of `window.gsap` / `window.ScrollTrigger` and a dump of `getChildren(true,true,true)` with each tween's `vars` and targets, plus `ScrollTrigger.getAll()` (not verified in sources; it is part of the public GSAP API)
  - Lenis class detection
  - logging network requests for `.json` / `.lottie` / `.glb` / `.riv`
- GSAP tweens that have already finished drop off the global timeline. Run the probe early, by injecting it with an init script, or call it repeatedly while scrolling.
- Sites that bundle GSAP as an ES module may not expose `window.gsap`. You would then need to hook the bundle or add a breakpoint in the bundle (unverified).

### Gaps
- No primary source on detecting Framer-built (framer.com) sites' internal animation config. Framer sites serialize appear/scroll effects in their JS bundles; this was not confirmed.
- The CDP `Animation` domain page could not be fetched (it redirects). Its method list (e.g. `Animation.enable`, `setPlaybackRate`, `animationStarted` events) is not confirmed here.
- No popularity data was found for GSAP-detector extensions (e.g. "GSAP Inspector" style tools). Spline/Rive extraction was not researched in depth.

## Q2. Site downloaders and cloners (HTTrack, SingleFile, website-scraper, "Save as"): how well do they preserve JS animations?

### Takeaway
None of them reliably preserve JS-driven motion:
- HTTrack does not execute JavaScript.
- SingleFile is designed to save a static rendered snapshot that works without scripts.
- No dedicated cloner verifiably carries over Framer or Webflow interactions to another platform.

They are useful for capturing the CSS (which includes `@keyframes` and transitions) and the assets, not for capturing the JS animation logic.

### Cited Findings
- HTTrack parses HTML and CSS but does not run JS, so URLs that scripts build at runtime can be missed. Its single-file mode embeds assets with a default 10 MB per-asset limit **[secondary sources]** — [itechguides](https://www.itechguides.com/?p=873663), [umatechnology](https://umatechnology.org/how-to-save-an-html-page-with-images-and-css/)
- SingleFile's output is meant to be viewed without scripts. Folding sections, maps and carousels that need JS break. Keeping scripts is an option, but rendering can still fail offline — [GitHub SingleFile fork readme](https://github.com/baloe/SingleFile), [Zotero forum](https://forums.zotero.org/discussion/comment/513192/), [umatechnology](https://umatechnology.org/does-singlefile-save-dynamic-content-loaded-while-scrolling/)
- Wikipedia keeps a feature comparison of offline page-saving tools — [Wikipedia](https://en.wikipedia.org/wiki/Comparison_of_software_saving_web_pages_for_offline_use)
- There is no automated way to convert a Framer site into a Webflow site. Some Framer animations "may not translate directly" — [Webflow Help](https://help.webflow.com/hc/en-us/articles/48246102456083-Migrate-your-site-from-Framer-to-Webflow)
- The CloneFlow (HTML to Webflow) extension says that as of v0.1.1 beta it "does not copy over interactions or animations" — [Chrome Web Store](https://chromewebstore.google.com/detail/cloneflow-html-to-webflow/kgajffhnckomggppfflkilngojaijkpd)
- A Product Hunt "Replicate" site replicator claims "animations are copied too" **[unverified marketing claim]** — [Product Hunt](https://producthunt.com/products/replicate-10)
- Anima's Chrome extension ("Clone website & capture elements") is also listed — [Chrome Web Store](https://chromewebstore.google.com/detail/anima-clone-website-captu/paddhneaanoeljlmdepnheehdkaegblo)
- Beyond that, "Framer/Webflow cloner" search results are dominated by Fiverr freelancer listings, which suggests the job is still mostly done by hand — [Fiverr example](https://www.fiverr.com/stephen_1012/clone-framer-clone-webflow-website-duplicate-framer-website-figma-to-framer)

### Inferences
- Of the "download the site" approaches, saving the live JS bundles (via HAR or a website-scraper with a headless browser) and running them locally best preserves motion: the original JS runs and reproduces it. This is a different act from rebuilding, and it carries more legal risk.
- For rebuilding, downloaders still matter because the CSS they capture holds the `@keyframes`, transition and `animation-timeline` declarations.

### Gaps
- No primary test results on website-scraper (npm) with puppeteer plugin, or on Chrome "Save as: Webpage, Complete", for animated sites.
- No HTTrack primary docs fetched.

## Q3. Browser extensions popular with designers for extracting styles and animations: users and ratings

### Takeaway
The style extractors (CSS Peeper, VisBug, SnipCSS, DivMagic, CSS Used) mostly capture static computed styles. Only Motion DevTools, Lottie Preview and the WebGL inspectors are aimed at motion. Ratings are mixed:
- CSS Peeper has a large user base but a low rating.
- VisBug is highly rated, but its repository has reportedly been archived.

### Cited Findings
- **CSS Peeper:** about 400k users (another snapshot says 500k), 2.6 stars from about 477 ratings. AppSumo shows 4.5/5 from 24 buyers — [Chrome Web Store](https://chromewebstore.google.com/detail/css-peeper/mbnbehikldjhnfehhnaidhjhoofhpehk), [AppSumo](https://appsumo.com/products/css-peeper/reviews/)
- **VisBug (Google):** about 200k users, 4.8 stars from 277 ratings. Sitepeel reports the GitHub repo was archived on 2026-09-15 **[single source]** — [Chrome Web Store](https://chromewebstore.google.com/detail/visbug/cdockenadnadldjbbgcallicgledbeoc), [sitepeel.dev](https://sitepeel.dev/compare/best-css-inspector-chrome-extensions/)
- **SnipCSS:** about 20k users, 3.8 stars from 35 ratings — [Chrome Web Store](https://chromewebstore.google.com/detail/snipcss/hbdnoadcmapfbngbodpppofgagiclicf)
- **DivMagic:** about 3.3 stars. Copies elements as HTML/CSS/React/JSX/Tailwind **[snippet only]** — [sitepeel.dev](https://sitepeel.dev/compare/best-css-inspector-chrome-extensions/)
- **CSS Used:** extracts the CSS rules an element actually uses — [Chrome Web Store](https://chromewebstore.google.com/detail/css-used/cdopjfddjlonogibjahpnmjpoangjfff)
- **Motion DevTools:** 4.4 stars from 57 ratings. Exports CSS and Motion One animations — [Chrome Web Store](https://chromewebstore.google.com/detail/motion-devtools/mnbliiaiiflhmnndmoidhddombbmgcdk), [motion.dev](https://motion.dev/tools/inspect)
- **Spector.js:** available on Chrome and Firefox. A "Spector.js Plus" Firefox fork also exists — [Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/spector-js-plus)

### Inferences
- An agent pipeline gets little from these GUI extensions; it gains more by calling the underlying APIs directly (`getComputedStyle`, `getAnimations`, CSSOM rule walking). The extensions are mainly useful to humans checking the agent's output.
- Snippet-copiers like DivMagic and SnipCSS copy `@keyframes` only when those keyframes are tied to the selected element. They do not copy JS triggers. This is based on what they describe, not on testing.

### Gaps
- User counts for DivMagic, Lottie Preview and Spector.js were not retrieved.
- No source found for a dedicated "GSAP/ScrollTrigger inspector" extension with meaningful adoption.

## Q4. Agent workflows for rebuilding animated sites (video recording, ffmpeg frames, timeline capture, slow-down) and what works vs. fails

### Takeaway
The pipeline that works best has four steps:
1. Fingerprint the libraries.
2. Dump declarative data (CSS keyframes, WAAPI timings, GSAP tween vars, Lottie JSON).
3. Record deterministic video or frames under a controlled clock or slowed `playbackRate`.
4. Compare the rebuild visually against the recording.

Agents mostly fail on scroll-triggered and scroll-scrubbed JS motion, because easing, duration and trigger rules are not in computed styles. Canvas and WebGL can only be imitated from video, not extracted.

### Cited Findings
**Recording**
- Playwright's built-in video recording exposes no quality parameters. A feature request asks for them — [GitHub microsoft/playwright #31424](https://github.com/microsoft/playwright/issues/31424)
- The `playwright-video` package (Chromium only) uses CDP `Page.startScreencast` frames joined with ffmpeg — [npm playwright-video](https://npmjs.com/package/playwright-video)
- `record-page` captures a URL's animation as frames at a set fps (default 30) and renders them to video with ffmpeg — [GitHub lnawrot/record-page](https://github.com/lnawrot/record-page)
- There is a deep dive on replacing Playwright's hard-coded VP8 encoder by working with page screencast — [DEV](https://dev.to/mutsuntsai/replacing-playwrights-hardcoded-vp8-encoder-a-deep-dive-into-pagescreencast-43ee)
- Scripting the same clicks and timing and post-processing with ffmpeg gives repeatable captures — [flaviocopes](https://flaviocopes.com/record-demo-video-playwright/)
- `html5-animation-video-renderer` renders frame by frame by calling a page-level seek function and then taking a screenshot, instead of screen-recording. It says this works for canvas and WebGL — [npm](https://npmjs.com/package/html5-animation-video-renderer)

**Deterministic time**
- Playwright's Clock API (`clock.install`, `pauseAt`, `runFor`, `fastForward`) overrides timers, `Date`, `performance` and `requestAnimationFrame`. `runFor` fires animation frames, so JS/rAF animations (GSAP, Lenis, three.js loops) can be stepped deterministically. The docs do not say whether CSS animations follow the fake clock — [Playwright docs](https://playwright.dev/docs/clock)
- `document.getAnimations().forEach(a => a.playbackRate *= 0.5)` slows every CSS and WAAPI animation — [MDN](https://developer.mozilla.org/en-US/docs/Web/API/Document/getAnimations)
- The DevTools Animations panel also offers speed presets — [Chrome for Developers](https://developer.chrome.com/docs/devtools/css/animations)

**WebGL and canvas pitfalls**
- With `preserveDrawingBuffer: false` (the default), reading the canvas after the render tick is undefined behavior. The attribute is set when the context is created and cannot be changed afterwards — [WebGL Fundamentals](https://webglfundamentals.org/webgl/lessons/webgl-tips.html)
- Screenshot tools often capture WebGL canvases blank — [Userback support](https://support.userback.io/en/articles/5233475-troubleshoot-screenshots-not-capturing-on-webgl-or-3d-canvas), [Mozilla bug 1661869](https://bugzilla.mozilla.org/show_bug.cgi?id=1661869)

**Scroll capture pitfalls**
- Scrolling too fast skips IntersectionObserver callbacks and lazy content — [DEV: Puppeteer full-page screenshots](https://dev.to/dennis-ddev/puppeteer-full-page-screenshots-why-they-break-and-how-to-fix-them-40je)
- Puppeteer caps screenshot height at about 16,384px by default — [same source](https://dev.to/dennis-ddev/puppeteer-full-page-screenshots-why-they-break-and-how-to-fix-them-40je)
- There is a step-scroll-then-screenshot approach for making GIFs of page scrolls — [DEV](https://dev.to/aimerib/using-puppeteer-to-make-animated-gifs-of-page-scrolls-1lko)

**What fails in practice**
- A Japanese case study (note.com) cloned an Awwwards-level site with Claude Code. The clone lost the scroll-triggered text fades, the header shrink transition and the parallax, so content showed from the start. The author's explanation: easing, duration and trigger conditions cannot be read from computed styles, and the logic lives in JS the clone tool did not parse. **[Search-snippet summary; the page returned 404 when fetched]** — [note.com](https://note.com/st_dev0/n/nff1f0622b93b?hl=en)
- Common GSAP rebuild bugs:
  - scripts that run before the DOM is ready and silently animate nothing
  - ScrollTrigger not firing because of trigger sizing or overflow containers
  - missing `ScrollTrigger.refresh()` after images load
  - leaked ScrollTriggers on route changes in React/SPAs

  — [uxdev.org](https://uxdev.org/lessons/vibe-gsap-debug/), [skillsclaude.org GSAP skill](https://skillsclaude.org/skills/gsap), [skillselion.com](https://skillselion.com/guides/awwwards-website-skills-claude-code)
- Prompts that name the library and the exact scroll behavior get much better results than vague "make it animated" prompts. These are opinion pieces — [Medium](https://medium.com/@ssuoshri/how-to-build-3d-animated-websites-with-claude-and-why-your-prompts-are-failing-e062ead1fdf8), [MindStudio](https://www.mindstudio.ai/blog/animated-3d-websites-claude-code-ai-video-generation)

### Inferences
- **What works:**
  - CSS and WAAPI motion: extract it exactly with `getAnimations()` + `getKeyframes()` + `getTiming()`, or walk CSSOM `@keyframes` rules.
  - Lottie: reuse the JSON (license permitting).
  - GSAP: if exposed, dump tween `vars` (duration, ease, from/to values, scrollTrigger start/end/scrub) and port them nearly 1:1.
- **What half-works:**
  - Scroll-scrubbed effects can be captured by stepping `window.scrollTo` in fixed pixel increments, settling each step (`clock.runFor`), and screenshotting. This yields a "scroll position → frame" map an agent can compare against.
  - Smooth-scroll libraries (Lenis) intercept wheel events and lerp, so programmatic `scrollTo` may need `lenis.scrollTo(y, {immediate:true})` or Lenis disabled to stay deterministic (unverified).
- **What fails:**
  - Canvas/WebGL shaders and particle systems: the agent can only imitate them from video. Spector gives draw calls and shaders, but turning those back into three.js source is hard.
  - Physics and spring motion (Framer Motion springs), when only computed styles are visible.
  - Hover and cursor-follow effects, unless the capture script triggers the input events.
- **Frames for a vision model:** extract keyframes from video with ffmpeg at a low fps (e.g. `ffmpeg -i rec.webm -vf fps=10 frames/%04d.png`) or with scene-change detection. Pair them with the dumped timing data rather than relying on the frames alone (general practice; not sourced).

### Gaps
- No Reddit or HN threads with first-hand agent-cloning reports were retrieved. The one case study could only be read from a search snippet.
- The CDP Animation domain docs were not confirmed. Whether Playwright's clock affects CSS animations was not confirmed (likely not, since CSS animations run on the compositor clock; unverified).
- No benchmark comparing frame-capture methods (screencast vs. screenshot loop vs. `recordVideo`) on animation fidelity.

## Q5. Legal and ethical notes on cloning sites (brief)

### Takeaway
Extracting motion techniques to learn from or re-implement is generally lower risk than copying assets or code wholesale. Copying creative content, templates, code or Lottie/3D assets, or imitating look-and-feel in a way that confuses users, creates real copyright, trade dress and contract (ToS) exposure. Impersonation clones are the most serious case.

### Cited Findings
- In the UK, copying another site's content or template without permission is usually copyright infringement — [LegalVision UK](https://legalvision.co.uk/intellectual-property/is-it-legal-to-copy-a-website-template/)
- Copyright protects photos, video, artwork and writing on a site, not the whole website — [LegalVision AU](https://legalvision.com.au/can-i-copy-another-websites-design)
- In the US, trade dress can protect website look-and-feel. A claimant must show distinctiveness (secondary meaning), non-functionality and likelihood of confusion, and functional UI conventions are hard to protect — [AFS Law (2025)](https://www.afslaw.com/perspectives/alerts/ai-software-clones-raise-trademark-and-trade-dress-issues-not-just-copyright), [NYU JIPEL](https://jipel.law.nyu.edu/vol-3-no-2-3-brown/)
- AI-generated software clones raise trademark and trade dress issues, not just copyright. Open-source licensing does not shield against these claims — [AFS Law](https://www.afslaw.com/perspectives/alerts/ai-software-clones-raise-trademark-and-trade-dress-issues-not-just-copyright)
- Cloning to impersonate a brand (phishing or scam clones) is a known abuse pattern — [Red Points](https://www.redpoints.com/blog/website-cloning)
- Downloaded Lottie animations still need a license to reuse — [LottieFiles forum](https://forum.lottiefiles.com/t/how-to-get-lottie-json-into-after-effects-without-access-to-original-files/664)

### Inferences
- An ethical default for agents:
  - Treat timing, easing and choreography as "technique" to re-implement.
  - Do not reuse brand assets, copy, Lottie/GLB files or minified JS without permission.
  - Respect robots.txt and the site's ToS.
  - Never produce pixel-perfect clones of a live brand that could pass as the real site.
- GSAP is now free, but its "standard no-charge license" has terms of its own (e.g. restrictions on use in tools that compete with Webflow). This is reported in the community but was not verified here.

### Gaps
- No 2025–26 case law found specifically on scraping or ToS enforcement against site cloning. Not legal advice.
