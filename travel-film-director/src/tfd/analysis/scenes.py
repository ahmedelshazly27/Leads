"""Scene segmentation and cut-rate estimation from sparsely sampled frames.

Storyboard frames are ~10 s apart, so individual cuts are not observable. We therefore
(1) segment into *visual sequences* (runs of visually similar frames), and
(2) estimate the cut rate statistically: if cuts follow a Poisson process with rate L, the
    probability that two samples D seconds apart belong to different shots is 1 - exp(-L*D),
    so L = -ln(1 - p) / D, where p is the observed fraction of changed sample pairs.
This is an *estimate* with an explicit saturation ceiling, and is reported as such.
"""
from __future__ import annotations

import math

import numpy as np

CHANGE_THRESHOLD = 0.22   # frame_distance above which two samples are treated as different shots
P_CAP = 0.95              # beyond this the estimator saturates


def changed_pairs(dists: list[float], threshold: float = CHANGE_THRESHOLD) -> list[bool]:
    return [d > threshold for d in dists]


def poisson_cut_rate(p_changed: float, interval_s: float) -> tuple[float, bool]:
    """Return (cuts per minute, saturated?)."""
    if interval_s <= 0:
        return 0.0, False
    saturated = p_changed >= P_CAP
    p = min(p_changed, P_CAP)
    lam = -math.log(1 - p) / interval_s
    return lam * 60.0, saturated


def segment_sequences(times: list[float], dists: list[float], duration: float,
                      boundaries: list[float] | None = None, min_len: float = 0.0) -> list[tuple[float, float, int, int]]:
    """Group consecutive frames into sequences. Returns (start, end, first_idx, last_idx).

    A new sequence starts where the inter-frame distance exceeds an adaptive threshold
    (median + 1.5*MAD, at least CHANGE_THRESHOLD*1.6) or at an explicit boundary (chapter start).
    With fast-cutting edits most pairs differ; the adaptive threshold then picks the *largest*
    visual jumps, which correspond to location/sequence changes rather than single cuts.
    """
    if not times:
        return []
    d = np.array(dists) if dists else np.array([0.0])
    med = float(np.median(d))
    mad = float(np.median(np.abs(d - med))) or 0.05
    thr = max(CHANGE_THRESHOLD * 1.6, med + 1.5 * mad)
    bset = sorted(boundaries or [])
    starts = [0]
    for i in range(1, len(times)):
        crossed = any(times[i - 1] < b <= times[i] for b in bset)
        if dists[i - 1] > thr or crossed:
            starts.append(i)
    seqs = []
    for k, s in enumerate(starts):
        e_idx = (starts[k + 1] - 1) if k + 1 < len(starts) else len(times) - 1
        start_t = 0.0 if k == 0 else (times[s - 1] + times[s]) / 2
        end_t = duration if k + 1 == len(starts) else (times[e_idx] + times[e_idx + 1]) / 2
        seqs.append([start_t, end_t, s, e_idx])
    # merge sequences shorter than min_len into their predecessor
    if min_len > 0 and len(seqs) > 1:
        merged = [seqs[0]]
        for sq in seqs[1:]:
            if sq[1] - sq[0] < min_len:
                merged[-1][1], merged[-1][3] = sq[1], sq[3]
            else:
                merged.append(sq)
        seqs = merged
    return [tuple(s) for s in seqs]
