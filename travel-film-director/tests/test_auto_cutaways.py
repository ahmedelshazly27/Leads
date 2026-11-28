"""Automatic cutaways: cover talking-head time with nearby, unused, clean b-roll until a presenter-share target."""
from tfd.director.auto_cutaways import auto_cutaways, presenter_share


def _clip(cid, name, dur, face, sharp=50.0, shake=0.5, bright=0.45):
    frames = [{"t": t, "max_face_frac": face, "sharpness": sharp, "brightness": bright} for t in range(1, int(dur), 3)]
    return {"id": cid, "name": name, "path": f"/x/{name}", "meta": {"duration": dur}, "frames": frames,
            "motion": {"shake_px": shake}, "quality": 0.9}


def _setup():
    footage = [
        _clip("talk", "DJI_20261003100000_0001_D.MP4", 60, face=0.08),
        _clip("near", "DJI_20261003101000_0002_D.MP4", 40, face=0.0),      # 10 min later: same scene
        _clip("near2", "DJI_20261003101500_0007_D.MP4", 40, face=0.0),
        _clip("near3", "DJI_20261003102000_0008_D.MP4", 40, face=0.0),
        _clip("far", "DJI_20261006120000_0003_D.MP4", 40, face=0.0),       # 3 days later
        _clip("selfie", "DJI_20261003100500_0004_D.MP4", 40, face=0.09),   # faces: not b-roll
        _clip("blurry", "DJI_20261003100700_0005_D.MP4", 40, face=0.0, sharp=2.0),
    ]
    plan = {"clips": {c["id"]: {"path": c["path"], "duration": c["meta"]["duration"]} for c in footage},
            "timeline": [{"clip": "talk", "src_in": 0.0, "src_out": 40.0, "record_in": 0.0, "record_out": 40.0,
                          "audio": "sync"}],
            "cutaways": []}
    return plan, {c["id"]: c for c in footage}


def test_covers_talk_with_nearest_clean_broll():
    plan, fj = _setup()
    assert presenter_share(plan, fj) > 0.9
    added = auto_cutaways(plan, fj, target_share=0.3)
    assert added and presenter_share(plan, fj) <= 0.35
    used = {c["clip"] for c in plan["cutaways"]}
    assert "near" in used and not used & {"selfie", "blurry", "talk", "far"}
    first = min(c["record_in"] for c in plan["cutaways"])
    assert first >= 2.0  # the speaker is seen before the first insert


def test_never_reuses_footage_or_overlaps_inserts():
    plan, fj = _setup()
    auto_cutaways(plan, fj, target_share=0.1)
    spans = sorted((c["record_in"], c["record_in"] + c["src_out"] - c["src_in"]) for c in plan["cutaways"])
    assert all(b[0] >= a[1] - 1e-6 for a, b in zip(spans, spans[1:]))
    by_clip = {}
    for c in plan["cutaways"]:
        for a, b in by_clip.get(c["clip"], []):
            assert min(b, c["src_out"]) - max(a, c["src_in"]) <= 0.01
        by_clip.setdefault(c["clip"], []).append((c["src_in"], c["src_out"]))


def test_broll_only_from_moments_without_speech():
    """Face detection misses angled selfies; anything with speech in the transcript is not b-roll."""
    plan, fj = _setup()
    fj["near"]["transcript"] = [{"start": 0.0, "end": 40.0, "text": "talking the whole time"}]
    auto_cutaways(plan, fj, target_share=0.3)
    assert "near" not in {c["clip"] for c in plan["cutaways"]}


def test_variety_and_no_selfie_clips():
    """At most three inserts per source clip; clips that are mostly a talking face are never b-roll."""
    plan, fj = _setup()
    sf = _clip("mostly_selfie", "DJI_20261003100200_0006_D.MP4", 40, face=0.09)
    sf["frames"][2]["max_face_frac"] = 0.0  # one frame where the detector misses the face
    fj["mostly_selfie"] = sf
    plan["timeline"][0]["src_out"] = 60.0
    plan["timeline"][0]["record_out"] = 60.0
    auto_cutaways(plan, fj, target_share=0.05)
    from collections import Counter
    uses = Counter(c["clip"] for c in plan["cutaways"])
    assert "mostly_selfie" not in uses and max(uses.values()) <= 3
