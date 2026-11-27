# Motion graphics and stock/filler footage

**Status:** preliminary. This is compiled from the storyboard review of all 24 reference videos (91 contact sheets, timestamps ±10 s; details in `examples/style_notes/`). The deep pass (`tfd ref deep --all --download`, run on your Mac) replaces it with measured data: each graphic's exact timing, position, duration and entry animation; each archival or stock candidate with a review sheet; plus music and beat-sync measurements.

## Motion graphics by creator

| Creator | Graphic | What it looks like | Where it's used | Examples |
|---|---|---|---|---|
| **Joe Hattab** | Route maps | 3D satellite globe with a glowing route line; also parchment relief maps and illustrated maps | Opening "plan", and every move between places (all 6 videos) | `7YobC1Q40M0@1:19`, `@2:18`; `crZDPaE8Wn4@2:58`; `twMvQ64jom8@22:49` |
| | Altitude/terrain labels | 3D terrain map with a label | Sherpa/Everest context | `crZDPaE8Wn4@2:58` |
| | Burned-in subtitles | Arabic (sometimes English) in the frame | All interviews | `twMvQ64jom8@14:03` |
| | Sticker callouts | "TOP!"-style pop graphics | Occasional emphasis (guide says don't copy) | `twMvQ64jom8@31:04` |
| **Omar Farooq** | Vintage-TV frame | Rounded, vignetted CRT frame holding maps, archival clips and illustrations: "context, not what I filmed" | Maps and history (5 of 6 videos) | `A7IAreQ4ZsI@2:19`; `IzSzEglLAcI@1:09`; `BA83kfPOz1w@0:20` |
| | Logo outro | Logo over the last drone shot, then a black logo card | Every ending | `A7IAreQ4ZsI@26:46`; `zB0WvXN6TJ8@22:42` |
| | Subscribe animation | Mid-roll call to action | Around the midpoint | `4UZaeH6A12Y@16:48` |
| | Illustrated fable images | AI-looking illustrations (guide says don't copy) | India video only | `cZRSEPWZa-8@6:06` |
| **Daniel Dalen** | Place/time cards | Bold yellow condensed all-caps: MELBOURNE, FLIGHT DAY, 10:30AM | Arrivals, days, times (4 of 6 videos) | `V7Nzx6u94ug@0:10`; `eVVfWFlvF14@4:28`; `lR7uALsCdoo@8:54` |
| | Rounded "film frame" inserts | B-roll inside a rounded-corner frame | Teasers and b-roll beats | `V7Nzx6u94ug@13:24`; `eVVfWFlvF14@1:39` |
| | Social screenshots | Vertical Instagram story on black | Announcing meetups | `V7Nzx6u94ug@17:51`; `lR7uALsCdoo@13:11` |
| | Captions and name tags | Lowercase white captions; @handle name tags | All talk | `V7Nzx6u94ug@8:46` |
| | Picture-in-picture | Screen recording in a corner | One video | `lR7uALsCdoo@16:19` |
| **Yusufa Sey** | Black text cards | Small white caps on black: series title, "THE NEXT DAY", "NEXT RELEASE dd/mm/yyyy", "SEE YOU NEXT TIME" | Time jumps and every ending | `urdgXDBc_So@3:27`; `dUL-YXeWDQY@19:19` |
| | Time/place labels | Yellow "THE APARTMENT", "11 AM" | Scene starts | `IfAA5Hy-8Zw@3:57` |
| | Stakes counters | "242 DAYS LEFT", "VLOG 60 / CURRENT REVENUE £9M" | Opening hook | `Z6mhiK7E3Sk@0:10`; `dUL-YXeWDQY@0:00` |
| | Subtitles | Small white sentence case, bottom centre | Nearly all dialogue | `NOU9AVeHjhI@0:35` |

**Common to all four:** subtitles burned into the picture, and a consistent system for place and time (maps or cards). Graphics are used sparingly. None of them fills the frame with effects.

## Filler, stock and archival footage

| Creator | What they cut in | Notes |
|---|---|---|
| **Joe Hattab** | Broadcaster archival with logos still visible (BBC, 60 Minutes, Al Jazeera, AP, TV news); black-and-white history footage | Music and sound effects from Epidemic Sound (credited in 3 videos). He says location ambience is sometimes rebuilt from a library (`EBv2H0WjtsI@20:50`) |
| **Omar Farooq** | Archival and show footage inside the vintage-TV frame; museum panels | A sponsor (Noqta) appears in one video |
| **Daniel Dalen** | Almost none. Everything is his own footage, plus screenshots and screen recordings | |
| **Yusufa Sey** | Landmark establishing shots (Big Ben, Burj Al Arab, Museum of the Future); screen-recorded product demos | Landmark shots may be stock or his own; the deep pass will flag grade and logo differences |

## Free sources you can use for filler

| Source | What | Licence (as published by the source) |
|---|---|---|
| **Pexels** (built into `tfd stock`) | HD/4K stock video, strong on aerials, cities and nature | Free, no attribution required |
| **Pixabay** (built into `tfd stock`) | Stock video and music | Free, no attribution required |
| Mixkit | Curated stock clips, music, SFX | Free licence (check per item) |
| Coverr | Stock clips | Free |
| NASA image and video library | Space and Earth-from-orbit footage | Generally public domain |
| Internet Archive / Prelinger Archives | Historical and archival film | Largely public domain (check per item) |
| Wikimedia Commons | Maps, archival video, photos | Per-file licences |
| Epidemic Sound, Artlist/Artgrid (paid) | Music, SFX, stock; what Joe Hattab credits | Subscription |

For your private viewing edits, licences matter less, but `tfd stock` records author and licence for every clip in `<project>/stock/stock_manifest.json` in case you ever publish.

## How the director uses this

- When a sequence has no establishing shot of your own, `plan.json` lists a **stock suggestion** with a ready search (for example `tfd stock search "Almaty aerial drone"`), using place names from `trip_notes.md`.
- Bridges between places follow the map/card grammar above.
- Roadmap item: render your own graphic templates (place card, lower third, route map, text interstitial) into the timeline, in your own style.
