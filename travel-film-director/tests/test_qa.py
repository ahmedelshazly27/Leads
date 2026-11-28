"""QA rules that don't need a render."""
from tfd.editing.qa import repeated_shots


def test_same_clip_different_moments_is_not_a_repeat():
    """Flash-forwards and a conversation split into trims reuse a clip without repeating footage."""
    tl = [{"clip": "c1", "src_in": 0, "src_out": 2, "record_in": 0},
          {"clip": "c1", "src_in": 30, "src_out": 40, "record_in": 2},
          {"clip": "c2", "src_in": 5, "src_out": 9, "record_in": 12},
          {"clip": "c2", "src_in": 8, "src_out": 12, "record_in": 16}]
    issues = repeated_shots(tl)
    assert [(i["at"], i["detail"]) for i in issues] == [(16, "c2 5.0-9.0 overlaps 8.0-12.0 (same footage shown twice)")]


def test_brief_overlap_is_tolerated():
    tl = [{"clip": "c1", "src_in": 0, "src_out": 2.2, "record_in": 0},
          {"clip": "c1", "src_in": 2.0, "src_out": 5, "record_in": 2.2}]
    assert repeated_shots(tl) == []
