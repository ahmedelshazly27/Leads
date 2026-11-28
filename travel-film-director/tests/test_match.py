"""Reference grade matching: a LUT that moves our footage's Lab statistics onto a reference creator's."""
import numpy as np

from tfd.editing.match import lab_stats, match_lut_fn


def _rgb(n, base, spread, seed):
    rng = np.random.default_rng(seed)
    return np.clip(rng.normal(base, spread, (n, 3)), 0, 1)


def test_match_moves_means_and_saturation_toward_reference():
    ours = _rgb(4000, [0.5, 0.5, 0.48], 0.08, 1)      # flat, neutral
    ref = _rgb(4000, [0.42, 0.5, 0.58], 0.16, 2)      # cooler, punchier
    fn = match_lut_fn(lab_stats(ours), lab_stats(ref), strength=1.0)
    out = fn(ours)
    s_ours, s_ref, s_out = lab_stats(ours), lab_stats(ref), lab_stats(out)
    for band in ("mid",):
        da_before = abs(s_ours[band]["b"] - s_ref[band]["b"])
        da_after = abs(s_out[band]["b"] - s_ref[band]["b"])
        assert da_after < da_before * 0.5            # tint moved most of the way
    assert s_out["chroma"] > s_ours["chroma"] * 1.15  # more colour, like the reference
    assert np.all((out >= 0) & (out <= 1))


def test_identity_when_stats_match():
    ours = _rgb(3000, [0.4, 0.45, 0.5], 0.12, 3)
    fn = match_lut_fn(lab_stats(ours), lab_stats(ours), strength=1.0)
    assert np.abs(fn(ours) - ours).max() < 0.02


def test_apply_reference_grade_writes_luts_and_intensities(tmp_path):
    from tfd.editing.match import apply_reference_grade
    ours, ref = lab_stats(_rgb(2000, [0.5, 0.5, 0.5], 0.1, 4)), lab_stats(_rgb(2000, [0.4, 0.5, 0.6], 0.15, 5))
    plan = {"timeline": [{"mode": "cinematic"}, {"mode": "personal"}]}
    g = apply_reference_grade(plan, tmp_path, ours, ref, "joe-match")
    assert g["look"] == "joe-match" and set(g["luts"]) == {"0.8", "1.0"}
    assert [i["grade_intensity"] for i in plan["timeline"]] == [1.0, 0.8]
