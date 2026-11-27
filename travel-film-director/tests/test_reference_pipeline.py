"""Offline tests of the reference-intelligence pipeline using a synthetic ReferenceSource."""
import json
from pathlib import Path

import numpy as np
from PIL import Image

from tfd.analysis.reference import build_profile
from tfd.analysis.scenes import poisson_cut_rate, segment_sequences
from tfd.analysis.transcript import coverage, language_stats, parse_subtitle_text, speech_gaps
from tfd.config import get_settings
from tfd.library.creators import compare, creator_profile
from tfd.library.db import Library
from tfd.schemas import Chapter, TranscriptSegment, VideoProfile
from tfd.util import safe_output_path, youtube_id
from tfd.youtube.ingest import ReferenceSource, parse_json3


def test_youtube_id_variants():
    for u in ["https://www.youtube.com/watch?v=twMvQ64jom8", "https://youtu.be/twMvQ64jom8?t=3",
              "https://www.youtube.com/shorts/twMvQ64jom8", "twMvQ64jom8"]:
        assert youtube_id(u) == "twMvQ64jom8"


def test_parse_json3_clips_overlaps():
    data = {"events": [{"tStartMs": 0, "dDurationMs": 4000, "segs": [{"utf8": "[Music]"}]},
                       {"tStartMs": 2000, "dDurationMs": 3000, "segs": [{"utf8": "hello "}, {"utf8": "world"}]},
                       {"tStartMs": 2500, "aAppend": 1, "segs": [{"utf8": "\n"}]}]}
    segs = parse_json3(data)
    assert [s.text for s in segs] == ["[Music]", "hello world"]
    assert segs[0].end == 2.0


def test_srt_parse():
    srt = "1\n00:00:01,000 --> 00:00:03,500\nHello there\n\n2\n00:00:04,000 --> 00:00:05,000\n<i>Bye</i>\n"
    segs = parse_subtitle_text(srt)
    assert len(segs) == 2 and segs[0].start == 1.0 and segs[1].text == "Bye"


def test_language_stats_first_person_and_curly_quotes():
    st = language_stats("I’m here and I love it. We went to the capital city.")
    assert st["first_person_singular"] > 0.1 and st["first_person_plural"] > 0 and st["context_facts"] > 0


def test_coverage_and_gaps():
    segs = [TranscriptSegment(start=0, end=10, text="talk"), TranscriptSegment(start=30, end=40, text="[Music]")]
    assert coverage(segs, 0, 20) == 0.5
    assert coverage(segs, 30, 40, speech=False) == 1.0
    assert speech_gaps(segs, 60, min_gap=6) == [(10, 60)]


def test_poisson_estimator():
    cpm, sat = poisson_cut_rate(0.5, 10.0)
    assert abs(cpm - 60 * np.log(2) / 10) < 1e-6 and not sat
    assert poisson_cut_rate(0.99, 10.0)[1] is True


def test_segment_sequences_respects_chapters():
    times = [0, 10, 20, 30, 40, 50]
    dists = [0.05, 0.05, 0.05, 0.05, 0.05]
    seqs = segment_sequences(times, dists, 60, boundaries=[25])
    assert len(seqs) == 2 and seqs[1][2] == 3


def _synthetic_source(tmp: Path, vid="AAAAAAAAAAA") -> ReferenceSource:
    fdir = tmp / "frames"
    fdir.mkdir(parents=True)
    frames = []
    rng = np.random.default_rng(0)
    for i in range(18):
        t = i * 10.0
        if i < 6:   # sky-blue landscape
            arr = np.zeros((180, 320, 3), np.uint8); arr[:60] = (110, 170, 230); arr[60:] = (40, 120, 40)
        elif i < 12:  # noisy street
            arr = rng.integers(0, 255, (180, 320, 3), dtype=np.uint8)
        else:  # dark
            arr = np.full((180, 320, 3), 20, np.uint8); arr[80:100, 100:220] = 200
        p = fdir / f"f{i:04d}.jpg"
        Image.fromarray(arr).save(p)
        frames.append((t, p))
    segs = [TranscriptSegment(start=0, end=2, text="[Music]")]
    segs += [TranscriptSegment(start=60 + k * 4, end=63 + k * 4, text="I think we arrived in the capital, 2 million people live here")
             for k in range(10)]
    return ReferenceSource(vid, f"https://www.youtube.com/watch?v={vid}", {"title": "Test film", "duration": 180, "channel": "x"},
                           [Chapter(start=0, end=60, title="Intro"), Chapter(start=60, end=180, title="City")],
                           [{"start": 70, "end": 80, "value": 1.0}, {"start": 0, "end": 10, "value": 0.2}],
                           segs, "manual", "en", frames, 10.0, "synthetic")


def test_build_profile_and_library(tmp_path):
    src = _synthetic_source(tmp_path / "v1")
    prof = build_profile(src, "Tester", tmp_path / "v1", notes="n")
    assert isinstance(prof, VideoProfile) and prof.scenes
    assert prof.scenes[0].narrative_function == "opening hook"
    assert abs(sum(prof.style_mode_mix.values()) - 1) < 0.02
    assert prof.hook["first_speech_at_s"] == 60
    assert any(t.name == "chapter" for t in prof.techniques)
    assert prof.contact_sheets and Path(prof.contact_sheets[0]).is_file()
    json.loads(prof.model_dump_json())  # serialisable
    s = get_settings()
    lib = Library(s.db_path)
    path = tmp_path / "v1" / "profile.json"
    path.write_text(prof.model_dump_json(), encoding="utf-8")
    lib.add_profile(prof, path)
    assert lib.search("capital") or lib.search("hook")
    cp = creator_profile("Tester", lib.profiles())
    other = dict(cp, creator="Other", metrics={k: dict(v, mean=v["mean"] * 3 + 0.5) for k, v in cp["metrics"].items()})
    cmp = compare([cp, other])
    assert cmp["key_differences"] and set(cmp["dominant_mode"]) == {"Tester", "Other"}


def test_profile_without_transcript_is_visual_only(tmp_path):
    src = _synthetic_source(tmp_path / "v2", "BBBBBBBBBBB")
    src.transcript = []
    prof = build_profile(src, "T", tmp_path / "v2")
    assert prof.style_mode_basis.startswith("visual-only")
    assert prof.sound_design["available"] is False


def test_safe_output_path(tmp_path):
    p = tmp_path / "a.mp4"
    p.write_text("x")
    assert safe_output_path(p).name == "a_2.mp4"


def test_transcript_timing_health():
    from tfd.analysis.transcript import timing_health
    good = [TranscriptSegment(start=i * 3, end=i * 3 + 2, text="hi") for i in range(400)]
    assert timing_health(good, 1200)[0] == "ok"
    piled = [TranscriptSegment(start=i * 0.5, end=i * 0.5 + 0.4, text="x") for i in range(150)] + good[50:]
    assert timing_health(piled, 1200)[0] == "suspect"
    assert timing_health([], 100)[0] == "none"
