"""Audio analysis of a local video: loudness curve, music presence, tempo/beats, and cut-to-beat sync."""
from __future__ import annotations

import shutil
import subprocess
import tempfile
from pathlib import Path

import numpy as np

from ..log import get_logger

log = get_logger("audio")
SR = 22050


def _extract_wav(video: Path, out: Path) -> None:
    exe = shutil.which("ffmpeg") or "ffmpeg"
    r = subprocess.run([exe, "-hide_banner", "-loglevel", "error", "-y", "-i", str(video), "-vn", "-ac", "1",
                        "-ar", str(SR), str(out)], capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(r.stderr.strip()[-300:] or "ffmpeg audio extraction failed")


def analyse_audio(video: Path, cuts_s: list[float] | None = None, speech_intervals: list[tuple[float, float]] | None = None,
                  window_s: float = 5.0) -> dict:
    import librosa
    with tempfile.TemporaryDirectory() as tmp:
        wav = Path(tmp) / "a.wav"
        _extract_wav(video, wav)
        y, sr = librosa.load(str(wav), sr=SR, mono=True)
    if len(y) < sr:
        raise ValueError("audio too short")
    duration = len(y) / sr
    hop = 512
    rms = librosa.feature.rms(y=y, hop_length=hop)[0]
    db = 20 * np.log10(rms + 1e-6)
    onset = librosa.onset.onset_strength(y=y, sr=sr, hop_length=hop)
    flat = librosa.feature.spectral_flatness(y=y, hop_length=hop)[0]
    times = librosa.frames_to_time(np.arange(len(rms)), sr=sr, hop_length=hop)
    # music presence per window: rhythmic regularity (onset autocorrelation peak in 60-180 BPM) and tonal content
    windows = []
    fpw = int(window_s * sr / hop)
    for w0 in range(0, len(onset) - fpw + 1, fpw):
        seg = onset[w0:w0 + fpw] - onset[w0:w0 + fpw].mean()
        ac = np.correlate(seg, seg, mode="full")[len(seg) - 1:]
        ac = ac / (ac[0] + 1e-9)
        lags = np.arange(len(ac)) * hop / sr
        band = (lags > 60 / 180) & (lags < 60 / 60)
        rhythm = float(ac[band].max()) if band.any() else 0.0
        tonal = float(1 - np.clip(np.median(flat[w0:w0 + fpw]) * 10, 0, 1))
        level = float(np.median(db[w0:w0 + fpw]))
        windows.append({"start": round(times[w0], 2), "end": round(times[min(len(times) - 1, w0 + fpw)], 2),
                        "rhythm": round(rhythm, 3), "tonal": round(tonal, 3), "level_db": round(level, 1)})
    speech = speech_intervals or []

    def speech_cov(a, b):
        return sum(max(0, min(b, e) - max(a, s)) for s, e in speech) / max(1e-6, b - a)

    for w in windows:
        w["speech"] = round(speech_cov(w["start"], w["end"]), 2) if speech else None
        w["music_likely"] = w["rhythm"] > 0.35 and w["level_db"] > -45
        w["silence"] = w["level_db"] < -50
    tempo, beats = librosa.beat.beat_track(y=y, sr=sr, hop_length=hop)
    tempo = float(np.atleast_1d(tempo)[0])
    beat_t = librosa.frames_to_time(beats, sr=sr, hop_length=hop)
    sync = None
    if cuts_s and len(beat_t) > 8:
        music_windows = [(w["start"], w["end"]) for w in windows if w["music_likely"]]
        in_music = [c for c in cuts_s if any(a <= c < b for a, b in music_windows)]
        tol = 0.08
        if len(in_music) >= 5:
            hits = sum(1 for c in in_music if np.min(np.abs(beat_t - c)) <= tol)
            beat_period = 60 / tempo if tempo else 0.5
            chance = min(1.0, 2 * tol / beat_period)
            ratio = hits / len(in_music)
            sync = {"cuts_in_music": len(in_music), "on_beat": hits, "on_beat_ratio": round(ratio, 3),
                    "chance_ratio": round(chance, 3), "beat_sync_index": round(ratio / chance, 2) if chance else None,
                    "note": "index ~1 = cuts land on beats no more than chance; >1.5 = deliberate cutting to the beat"}
    music_share = float(np.mean([w["music_likely"] for w in windows])) if windows else 0.0
    lufs_like = float(np.percentile(db, 90))
    return {
        "duration": round(duration, 2),
        "tempo_bpm": round(tempo, 1),
        "beats": len(beat_t),
        "music_share": round(music_share, 3),
        "music_under_speech_share": round(float(np.mean([w["music_likely"] and (w["speech"] or 0) > 0.5 for w in windows])), 3)
        if speech else None,
        "music_only_share": round(float(np.mean([w["music_likely"] and (w["speech"] or 0) < 0.2 for w in windows])), 3)
        if speech else None,
        "silence_share": round(float(np.mean([w["silence"] for w in windows])), 3) if windows else 0,
        "dynamic_range_db": round(float(np.percentile(db, 95) - np.percentile(db, 10)), 1),
        "loud_level_db": round(lufs_like, 1),
        "beat_sync": sync,
        "windows": windows,
        "beat_times": [round(float(t), 3) for t in beat_t],
    }
