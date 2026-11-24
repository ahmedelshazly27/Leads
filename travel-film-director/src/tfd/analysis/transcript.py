"""Transcript-derived storytelling signals (language: English heuristics; other languages degrade gracefully)."""
from __future__ import annotations

import re
from collections import Counter

from ..schemas import TranscriptSegment

MARKER_RE = re.compile(r"\[([^\]]+)\]")
WORD_RE = re.compile(r"[A-Za-z']+|\d[\d,.]*")
FIRST_SING = {"i", "i'm", "im", "i've", "i'll", "i'd", "me", "my", "mine", "myself"}
FIRST_PLUR = {"we", "we're", "we've", "we'll", "us", "our", "ours"}
SECOND = {"you", "you're", "your", "yourself", "guys"}
REFLECTION = {"feel", "felt", "honestly", "realised", "realized", "think", "thought", "remember", "lesson",
              "grateful", "emotional", "never", "forget", "changed", "learned", "learnt", "life"}
CONTEXT = {"population", "capital", "century", "history", "historic", "founded", "government", "million", "billion",
           "percent", "%", "km", "kilometers", "kilometres", "miles", "largest", "biggest", "oldest", "built",
           "empire", "soviet", "war", "economy", "country", "city", "region", "tribe", "culture", "religion",
           "language", "border", "president", "official", "people", "years"}
HOOK_WORDS = {"most", "never", "strangest", "dangerous", "craziest", "biggest", "secret", "illegal", "forbidden",
              "insane", "crazy", "unbelievable", "worst", "best", "only", "first", "last", "shocking", "why", "how"}
QUESTION_STARTS = {"what", "why", "how", "where", "who", "is", "are", "do", "does", "did", "can", "could", "would"}


def words(text: str) -> list[str]:
    text = MARKER_RE.sub(" ", text).replace("\u2019", "'").replace("\u2018", "'")
    return [w.lower() for w in WORD_RE.findall(text)]


def segments_in(segs: list[TranscriptSegment], start: float, end: float) -> list[TranscriptSegment]:
    return [s for s in segs if s.end > start and s.start < end]


def text_in(segs: list[TranscriptSegment], start: float, end: float) -> str:
    return " ".join(MARKER_RE.sub("", s.text).strip() for s in segments_in(segs, start, end)).strip()


def is_marker_only(seg: TranscriptSegment) -> bool:
    return not words(seg.text) and bool(MARKER_RE.search(seg.text))


def coverage(segs: list[TranscriptSegment], start: float, end: float, *, speech: bool = True) -> float:
    """Fraction of [start, end) covered by speech cues (or by marker-only cues if speech=False)."""
    if end <= start:
        return 0.0
    covered = 0.0
    for s in segments_in(segs, start, end):
        if is_marker_only(s) == speech:
            continue
        covered += max(0.0, min(end, s.end) - max(start, s.start))
    return min(1.0, covered / (end - start))


def markers_in(segs: list[TranscriptSegment], start: float, end: float) -> Counter:
    c: Counter = Counter()
    for s in segments_in(segs, start, end):
        for m in MARKER_RE.findall(s.text):
            c[m.strip().lower()] += 1
    return c


def speech_gaps(segs: list[TranscriptSegment], duration: float, min_gap: float = 6.0) -> list[tuple[float, float]]:
    """Intervals with no spoken caption (music/ambience/montage candidates)."""
    speech = sorted((s.start, s.end) for s in segs if not is_marker_only(s))
    gaps, cursor = [], 0.0
    for a, b in speech:
        if a - cursor >= min_gap:
            gaps.append((cursor, a))
        cursor = max(cursor, b)
    if duration - cursor >= min_gap:
        gaps.append((cursor, duration))
    return gaps


def language_stats(text: str) -> dict:
    ws = words(text)
    n = max(1, len(ws))
    cnt = Counter(ws)
    numbers = sum(1 for w in ws if w[0].isdigit())
    return {
        "words": len(ws),
        "first_person_singular": round(sum(cnt[w] for w in FIRST_SING) / n, 4),
        "first_person_plural": round(sum(cnt[w] for w in FIRST_PLUR) / n, 4),
        "second_person": round(sum(cnt[w] for w in SECOND) / n, 4),
        "reflection": round(sum(cnt[w] for w in REFLECTION) / n, 4),
        "context_facts": round((sum(cnt[w] for w in CONTEXT) + numbers) / n, 4),
        "hook_words": round(sum(cnt[w] for w in HOOK_WORDS) / n, 4),
        "questions": text.count("?"),
    }


def dialogue_score(segs: list[TranscriptSegment]) -> float:
    """Rough proxy for conversation: many short cues, '>>' speaker-change marks, questions."""
    spoken = [s for s in segs if not is_marker_only(s)]
    if not spoken:
        return 0.0
    speaker_changes = sum(s.text.count(">>") for s in spoken)
    qs = sum(1 for s in spoken if "?" in s.text or (words(s.text)[:1] and words(s.text)[0] in QUESTION_STARTS))
    return round(min(1.0, (speaker_changes * 2 + qs) / max(4, len(spoken))), 3)


_TS = re.compile(r"(\d+):(\d{2}):(\d{2})[,.](\d{1,3})|(\d+):(\d{2})[,.](\d{1,3})")


def _ts(m: re.Match) -> float:
    if m.group(1) is not None:
        h, mi, se, ms = m.group(1), m.group(2), m.group(3), m.group(4)
    else:
        h, mi, se, ms = "0", m.group(5), m.group(6), m.group(7)
    return int(h) * 3600 + int(mi) * 60 + int(se) + int(ms.ljust(3, "0")) / 1000


def parse_subtitle_text(text: str) -> list[TranscriptSegment]:
    """Parse SRT or WebVTT text into segments (used for transcripts the user supplies)."""
    segs: list[TranscriptSegment] = []
    blocks = re.split(r"\n\s*\n", text.replace("\r", ""))
    for b in blocks:
        lines = [l for l in b.strip().split("\n") if l.strip()]
        for i, line in enumerate(lines):
            if "-->" in line:
                a, _, c = line.partition("-->")
                ma, mc = _TS.search(a), _TS.search(c)
                if ma and mc:
                    body = " ".join(re.sub(r"<[^>]+>", "", l) for l in lines[i + 1:]).strip()
                    if body:
                        segs.append(TranscriptSegment(start=_ts(ma), end=_ts(mc), text=body))
                break
    return segs
