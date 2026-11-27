"""Turn a fetched ReferenceSource into a structured VideoProfile."""
from __future__ import annotations

import datetime as dt
from collections import Counter
from pathlib import Path

import numpy as np

from ..log import get_logger
from ..schemas import FrameObs, NarrativeBeat, Scene, SceneAudio, SourceInfo, Technique, VideoProfile
from ..util import fmt_ts
from ..youtube.ingest import ReferenceSource
from . import style
from . import transcript as tx
from .contact_sheet import build_contact_sheets
from .frames import analyse_frame, frame_distance, hist_signature
from .scenes import changed_pairs, poisson_cut_rate, segment_sequences

log = get_logger("analysis")


def _mean(xs) -> float:
    xs = list(xs)
    return float(sum(xs) / len(xs)) if xs else 0.0


def _local_cut_rate(changed: list[bool], times: list[float], start: float, end: float, interval: float) -> float:
    pairs = [c for c, t in zip(changed, times[1:]) if start <= t <= end]
    if len(pairs) < 2:
        return 0.0
    return poisson_cut_rate(sum(pairs) / len(pairs), interval)[0]


def build_profile(src: ReferenceSource, creator: str, out_dir: Path, notes: str = "") -> VideoProfile:
    meta, segs = src.meta, src.transcript
    duration = float(meta.get("duration") or 0)
    interval = src.frame_interval_s or 10.0

    # ---- frames
    frames: list[FrameObs] = [analyse_frame(p, t) for t, p in src.frames]
    sigs = [hist_signature(f.path) for f in frames]
    dists = [frame_distance(a, b) for a, b in zip(sigs, sigs[1:])]
    times = [f.t for f in frames]
    changed = changed_pairs(dists)
    sheets = build_contact_sheets(src.frames, out_dir / "contact_sheets", title=f"{creator} - {meta.get('title', '')}")

    # ---- global cut-rate estimate
    p_changed = (sum(changed) / len(changed)) if changed else 0.0
    cpm, saturated = poisson_cut_rate(p_changed, interval)
    pacing_curve = []
    step = 60.0
    t0 = 0.0
    while t0 < duration:
        pacing_curve.append({"start": t0, "end": min(duration, t0 + step),
                             "est_cuts_per_min": round(_local_cut_rate(changed, times, t0, t0 + step, interval), 2),
                             "speech_coverage": round(tx.coverage(segs, t0, min(duration, t0 + step)), 2)})
        t0 += step

    # ---- sequences ("scenes")
    chapter_starts = [c.start for c in src.chapters if c.start > 0]
    seqs = segment_sequences(times, dists, duration, chapter_starts, min_len=max(2 * interval, 15.0))
    heat = src.heatmap
    heat_vals = [h["value"] for h in heat]
    heat_thr = float(np.percentile(heat_vals, 90)) if heat_vals else 2.0

    scenes: list[Scene] = []
    for i, (s, e, a, b) in enumerate(seqs):
        fr = frames[a:b + 1]
        seg_text = tx.text_in(segs, s, e)
        lang = tx.language_stats(seg_text)
        sp_cov = tx.coverage(segs, s, e)
        markers = tx.markers_in(segs, s, e)
        music = "music" in markers or tx.coverage(segs, s, e, speech=False) > 0.2
        wpm = lang["words"] / max(1e-6, (e - s) / 60)
        dialogue = tx.dialogue_score(tx.segments_in(segs, s, e))
        shot, conf, shot_ev = style.shot_type(fr)
        face_share = _mean(1.0 if f.faces else 0.0 for f in fr)
        scores, style_ev = style.style_scores(
            speech_cov=sp_cov, music=music, wpm=wpm, lang=lang, dialogue=dialogue, shot=shot,
            face_share=face_share, sky=_mean(f.sky_frac for f in fr), colorfulness=_mean(f.colorfulness for f in fr),
            has_transcript=bool(segs))
        local_cpm = _local_cut_rate(changed, times, s, e, interval)
        rep = fr[len(fr) // 2].path if fr else None
        audio_desc = []
        if not segs:
            audio_desc.append("unknown (no transcript)")
        elif sp_cov > 0.6:
            audio_desc.append("continuous speech")
        elif sp_cov > 0.2:
            audio_desc.append("intermittent speech")
        else:
            audio_desc.append("mostly non-speech")
        if music:
            audio_desc.append("music present (caption marker)")
        scenes.append(Scene(
            index=i, start=round(s, 2), end=round(e, 2), duration=round(e - s, 2), representative_frame=rep,
            shot_type=shot, shot_type_confidence=conf, pacing=style.pacing_label(local_cpm),
            audio=SceneAudio(words_per_minute=round(wpm, 1), speech_coverage=round(sp_cov, 3), music_marker=music,
                             other_markers=[m for m in markers if m != "music"], description=", ".join(audio_desc)),
            style_mode=max(scores, key=scores.get), style_scores=scores,
            visual_characteristics=style.visual_tags(fr),
            speech_excerpt=(seg_text[:280] + "...") if len(seg_text) > 280 else seg_text,
            evidence=shot_ev + style_ev + [f"est. {local_cpm:.1f} cuts/min in this sequence"],
        ))
        sc = scenes[-1]
        # narrative function (position + content)
        if s < min(60.0, 0.08 * duration) and i == 0:
            sc.narrative_function = "opening hook"
        elif e >= duration * 0.93:
            sc.narrative_function = "resolution / outro"
        elif any(abs(s - c) < interval * 1.5 for c in chapter_starts) and scores["cinematic"] >= 0.45:
            sc.narrative_function = "chapter opener / establishing"
        elif lang["reflection"] > 0.03 and scores["personal"] >= 0.4:
            sc.narrative_function = "personal reflection"
        elif dialogue > 0.35:
            sc.narrative_function = "interaction / conversation"
        elif lang["context_facts"] > 0.05:
            sc.narrative_function = "context / exposition"
        elif scores["cinematic"] >= 0.5:
            sc.narrative_function = "atmosphere / montage"
        else:
            sc.narrative_function = "journey / progression"
        top_peaks = sorted(heat, key=lambda h: -h["value"])[:3]
        if any(h["start"] < e and h["end"] > s for h in top_peaks):
            sc.editing_techniques.append("audience replay peak (most-replayed)")
        if music and sp_cov > 0.4:
            sc.editing_techniques.append("music bed under speech")
        if not segs:
            pass
        elif sp_cov < 0.15 and local_cpm >= 8:
            sc.editing_techniques.append("speech-free fast montage")
        elif sp_cov < 0.15:
            sc.editing_techniques.append("breathing room: non-speech atmospheric sequence")
        if "on-screen text or title" in sc.visual_characteristics:
            sc.editing_techniques.append("on-screen text / title card")

    # ---- techniques with timestamps
    techniques: list[Technique] = []
    first_speech = next((x.start for x in segs if not tx.is_marker_only(x)), None)
    for g0, g1 in (tx.speech_gaps(segs, duration, min_gap=12.0) if segs else []):
        lc = _local_cut_rate(changed, times, g0, g1, interval)
        fast = lc >= 8
        techniques.append(Technique(start=g0, end=g1, category="pacing", style_mode="cinematic",
            name="speech-free montage" if fast else "atmospheric non-speech sequence",
            description=f"{g1 - g0:.0f}s without dialogue/narration, est. {lc:.1f} cuts/min" +
                        (" - music-driven montage" if tx.markers_in(segs, g0, g1).get("music") else ""),
            confidence=0.6))
    for f in frames:
        if f.text_like > 0.5:
            techniques.append(Technique(start=f.t, end=f.t + interval, category="graphics", name="on-screen text",
                                        description="title, location label or caption overlay detected", confidence=0.4))
    for c in src.chapters:
        techniques.append(Technique(start=c.start, end=c.end, category="structure", name="chapter",
                                    description=f"chapter: {c.title}", confidence=1.0))
    for h in sorted(heat, key=lambda h: -h["value"])[:3]:
        if heat_vals and h["value"] >= heat_thr:
            techniques.append(Technique(start=h["start"], end=h["end"], category="structure", name="replay peak",
                                        description=f"most-replayed moment (heat {h['value']:.2f}) - audience-proven highlight",
                                        confidence=0.9))
    # to-camera blocks
    for sc in scenes:
        if "close-up" in sc.shot_type and sc.audio.speech_coverage > 0.5 and sc.duration >= 20:
            techniques.append(Technique(start=sc.start, end=sc.end, category="narration", style_mode="personal",
                name="talking to camera", description="presenter speaks directly to camera / selfie framing", confidence=0.5))
    techniques.sort(key=lambda t: t.start)

    # ---- hook
    hook_end = min(60.0, duration)
    hook_text = tx.text_in(segs, 0, 30)
    hook_lang = tx.language_stats(hook_text)
    title_words = tx.words(meta.get("title") or "")
    hook = {
        "first_speech_at_s": first_speech,
        "words_first_30s": hook_lang["words"],
        "hook_vocabulary_first_30s": hook_lang["hook_words"],
        "title_uses_superlative_or_intrigue": any(w in tx.HOOK_WORDS for w in title_words),
        "cold_open": first_speech is not None and first_speech < 3.0,
        "est_cuts_per_min_first_60s": round(_local_cut_rate(changed, times, 0, hook_end, interval), 2),
        "opening_text": hook_text[:400],
        "pattern": "",
    }
    if hook["cold_open"] and hook["words_first_30s"] > 50:
        hook["pattern"] = "spoken cold open: narration/claim starts immediately"
    elif first_speech is not None and first_speech > 15:
        hook["pattern"] = f"visual/musical opening - first words only at {fmt_ts(first_speech)}"
    else:
        hook["pattern"] = "short visual lead-in followed by speech"

    # ---- narrative structure
    beats: list[NarrativeBeat] = [NarrativeBeat(start=0, end=hook_end, label="hook", description=hook["pattern"])]
    if src.chapters:
        for c in src.chapters:
            if c.end <= hook_end:
                continue
            ctext = tx.text_in(segs, c.start, c.end)
            cl = tx.language_stats(ctext)
            mode = max(("context", cl["context_facts"]), ("personal", cl["first_person_singular"] + cl["reflection"]),
                       key=lambda x: x[1])[0]
            beats.append(NarrativeBeat(start=max(c.start, hook_end), end=c.end, label=c.title or "chapter",
                                       description=f"{fmt_ts(c.end - c.start)} chapter, leans {mode}",
                                       evidence=[f"{cl['words']} words"]))
    else:
        thirds = [(hook_end, duration * 0.25, "setup / arrival"), (duration * 0.25, duration * 0.75, "exploration / development"),
                  (duration * 0.75, duration * 0.93, "climax / key experience"), (duration * 0.93, duration, "resolution / outro")]
        for a, b, label in thirds:
            if b > a:
                beats.append(NarrativeBeat(start=a, end=b, label=label, description="position-based (no chapters available)"))
    if heat_vals:
        peak = max(heat, key=lambda h: h["value"])
        beats.append(NarrativeBeat(start=peak["start"], end=peak["end"], label="audience peak",
                                   description="highest replay density - likely emotional or visual climax",
                                   evidence=[f"heat {peak['value']:.2f}"]))
    beats.sort(key=lambda b: b.start)

    # ---- aggregates
    total_dur = sum(s.duration for s in scenes) or 1.0
    mix = {m: round(sum(s.style_scores.get(m, 0) * s.duration for s in scenes) / total_dur, 3)
           for m in ("cinematic", "documentary", "personal")}
    all_text = " ".join(x.text for x in segs)
    lang_all = tx.language_stats(all_text)
    speech_cov_all = tx.coverage(segs, 0, duration)
    gaps = tx.speech_gaps(segs, duration, min_gap=6.0)
    marker_counts = tx.markers_in(segs, 0, duration)
    seq_lengths = [s.duration for s in scenes]
    pal = Counter(c for f in frames for c in f.palette[:2])

    editing = {
        "est_cuts_per_min": round(cpm, 2),
        "est_avg_shot_length_s": round(60 / cpm, 2) if cpm > 0 else None,
        "estimator_saturated": saturated,
        "changed_sample_fraction": round(p_changed, 3),
        "sample_interval_s": round(interval, 2),
        "visual_sequences": len(scenes),
        "median_sequence_s": round(float(np.median(seq_lengths)), 1) if seq_lengths else None,
        "pacing_curve": pacing_curve,
        "pacing_variability": round(float(np.std([p["est_cuts_per_min"] for p in pacing_curve])), 2) if pacing_curve else 0,
        "on_screen_text_frames": sum(1 for f in frames if f.text_like > 0.5),
        "chapters": len(src.chapters),
        "measurement_note": ("Cut rate is a Poisson estimate from storyboard samples; individual cuts, transitions "
                             "and camera moves are not observable at this sampling rate."),
    }
    if not segs:
        gaps = []
    sound = {
        "available": bool(segs),
        "speech_coverage": round(speech_cov_all, 3),
        "non_speech_fraction": round(sum(b - a for a, b in gaps) / max(1, duration), 3),
        "longest_non_speech_s": round(max((b - a for a, b in gaps), default=0), 1),
        "words_per_minute_overall": round(lang_all["words"] / max(1e-6, duration / 60), 1),
        "caption_markers": dict(marker_counts.most_common(8)),
        "music_marked_scenes": sum(1 for s in scenes if s.audio.music_marker),
        "note": "Music/ambience inferred from caption markers and speech gaps; audio itself is not downloaded.",
    }
    color = {
        "mean_brightness": round(_mean(f.brightness for f in frames), 3),
        "mean_contrast": round(_mean(f.contrast for f in frames), 3),
        "mean_saturation": round(_mean(f.saturation for f in frames), 3),
        "mean_colorfulness": round(_mean(f.colorfulness for f in frames), 1),
        "mean_warmth": round(_mean(f.warmth for f in frames), 3),
        "saturation_spread": round(float(np.std([f.saturation for f in frames])), 3) if frames else 0,
        "brightness_spread": round(float(np.std([f.brightness for f in frames])), 3) if frames else 0,
        "letterboxed_frame_fraction": round(_mean(1.0 if f.letterbox > 0.06 else 0.0 for f in frames), 3),
        "night_or_lowkey_fraction": round(_mean(1.0 if f.brightness < 0.2 else 0.0 for f in frames), 3),
        "dominant_palette": [c for c, _ in pal.most_common(8)],
        "grading_tags": style.visual_tags(frames),
    }
    shots = Counter(s.shot_type for s in scenes)
    storytelling = {
        **{k: v for k, v in lang_all.items() if k != "words"},
        "total_words": lang_all["words"],
        "dialogue_score": tx.dialogue_score(segs),
        "face_frame_fraction": round(_mean(1.0 if f.faces else 0.0 for f in frames), 3),
        "closeup_frame_fraction": round(_mean(1.0 if f.max_face_frac >= 0.33 else 0.0 for f in frames), 3),
        "shot_type_distribution": dict(shots.most_common()),
        "narrative_functions": dict(Counter(s.narrative_function for s in scenes).most_common()),
    }
    limitations = [
        f"Frames are YouTube storyboard previews ({src.storyboard_label}); fine detail, exact cuts, transitions "
        "and camera movement are not measured.",
        "Shot types use face/sky/edge heuristics on low-resolution frames - treat as approximate.",
    ]
    if src.transcript_kind == "auto":
        limitations.append("Transcript is YouTube auto-captions (no punctuation, occasional errors, speaker changes not marked).")
    tq, tq_note = tx.timing_health(segs, duration)
    if tq == "suspect":
        limitations.append("Transcript timing suspect: " + tq_note)
    if src.transcript_kind == "auto-translated":
        limitations.append(f"Transcript is YouTube's machine translation into English from {src.meta.get('language') or 'the original language'}; "
                           "vocabulary metrics are approximate and wording is not the creator's own.")
    if src.transcript_kind == "none":
        limitations.append("No transcript available - speech/story metrics are empty.")

    return VideoProfile(
        video_id=src.video_id, url=src.url, creator=creator, title=meta.get("title") or "",
        channel=meta.get("channel") or "", upload_date=meta.get("upload_date"), duration=duration,
        view_count=meta.get("view_count"), user_notes=notes,
        analysed_at=dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        sources=SourceInfo(metadata=True, transcript=src.transcript_kind, transcript_language=src.transcript_language,
                           frames=src.storyboard_label, frame_interval_s=src.frame_interval_s,
                           transcript_quality=tq, transcript_quality_note=tq_note,
                           chapters=len(src.chapters), heatmap=bool(heat)),
        chapters=src.chapters,
        replay_peaks=sorted(heat, key=lambda h: -h["value"])[:5],
        scenes=scenes, narrative_structure=beats, hook=hook, editing_characteristics=editing,
        sound_design=sound, color_characteristics=color, storytelling=storytelling, style_mode_mix=mix, style_mode_basis="transcript+visual" if segs else "visual-only (low confidence)",
        techniques=techniques, contact_sheets=[str(p) for p in sheets], limitations=limitations,
    )
