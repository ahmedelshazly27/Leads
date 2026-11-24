---
name: travel-film-director
description: Query and extend the travel-film reference library (Joe Hattab, Daniel Dalen, Yusufa Sey, ...), annotate reference videos from contact sheets, and direct edits of the user's own footage with the `tfd` CLI in travel-film-director/. Use for questions about creators' editing styles or for planning/editing a travel film.
---

# Travel Film Director

The project lives in `travel-film-director/`. Activate its venv first, then use the `tfd` CLI. Data is under `travel-film-director/data/` (or `$TFD_DATA_DIR`).

## Answering questions about the references
1. Run `tfd context "<the question>"`. It prints the comparison, creator profiles, per-scene summaries and search hits.
2. For specifics, read `data/library/<creator>/<video_id>/profile.json` (scenes, techniques, hook, limitations) and look at `contact_sheets/*.jpg` (timestamped storyboard frames).
3. Cite creator, video title and timestamps (`https://www.youtube.com/watch?v=ID&t=SECONDSs`). State the measurement limits: storyboard frames are ~10 s apart, and the cut rate is an estimate.

## Adding a qualitative analysis (no API key needed)
1. View the video's contact sheets and read its `profile.json`.
2. Write JSON in the shape of `examples/annotations/twMvQ64jom8.json`: summary, hook_analysis, narrative_arc, camera_and_composition, color_and_grade, sound_and_music, what_to_borrow, what_to_avoid_copying, and observations[{start,end,name,description,style_mode}].
3. Run `tfd annotate <video_id> <file>`. Only describe what is visible or measured.

## Directing the user's footage
1. Run `tfd footage <folder>`, then read `footage.json` and the contact sheets.
2. Run `tfd direct <project> --minutes N`, then review `plan.json` (timeline items have `reason`; `needs_review` lists gaps).
3. You may rewrite `plan.json` to improve the story (order, hook, trims). Never invent events, places or dialogue. Narration and titles come only from `trip_notes.md` or user statements.
4. Re-export with the web UI's Approve button, or in Python: `from tfd.editing.otio_export import export_timeline`. Then run `tfd render <project>` and read `qa_report.json`.

Never download reference videos or their audio. Never write into the user's footage folder.
