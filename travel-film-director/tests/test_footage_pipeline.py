"""End-to-end footage -> plan -> OTIO -> render -> QA on synthetic clips (needs ffmpeg)."""
import hashlib

import opentimelineio as otio
import pytest

from tfd.director.planner import plan_project
from tfd.editing.otio_export import export_timeline
from tfd.editing.qa import run_qa
from tfd.editing.render import render_preview
from tfd.footage.ingest import ingest_folder


def _hashes(d):
    return {p.name: hashlib.md5(p.read_bytes()).hexdigest() for p in d.iterdir()}


def test_refuses_output_inside_footage(footage_dir):
    with pytest.raises(ValueError):
        ingest_folder(footage_dir, footage_dir / "out")


def test_full_footage_pipeline(footage_dir, tmp_path):
    before = _hashes(footage_dir)
    proj = tmp_path / "proj"
    rep = ingest_folder(footage_dir, proj)
    s = rep["summary"]
    assert s["clips"] == 4 and s["duplicates"] == 1 and s["errors"] == 0
    black = next(c for c in rep["clips"] if c["name"] == "GX010003.MP4")
    assert "black / unusable" in black["flags"] and black["meta"]["orientation"] == "vertical"
    plan = plan_project(proj, target_minutes=1)
    used = {plan["clips"][i["clip"]]["path"].split("/")[-1] for i in plan["timeline"]}
    assert "GX010003.MP4" not in used and plan["timeline"]
    assert all(i["reason"] for i in plan["timeline"])
    assert plan["grade"]["look"] in ("joe-teal", "omar-warm-film", "daniel-natural-warm", "yusufa-amber", "neutral")
    assert all(__import__("pathlib").Path(p).is_file() for p in plan["grade"]["luts"].values())
    paths = export_timeline(proj, plan)
    tl = otio.adapters.read_from_file(str(paths["otio"]))
    assert len(tl.video_tracks()[0]) == len(plan["timeline"])
    for key in ("fcp_xml", "fcpxml"):  # Premiere/Resolve fallback and Final Cut Pro
        assert key in paths and paths[key].is_file()
    fcpx = otio.adapters.read_from_file(str(paths["fcpxml"]))
    assert len(fcpx.video_tracks()[0]) == len(plan["timeline"])
    out = render_preview(proj)
    assert out.is_file() and out.stat().st_size > 10_000
    qa = run_qa(proj, out)
    assert not [i for i in qa["issues"] if i["type"] == "black frames"]
    assert _hashes(footage_dir) == before  # originals untouched
    out2 = render_preview(proj)
    assert out2 != out  # never overwrites


def test_playbook_rules():
    from tfd.director import playbook
    assert playbook.choose_hook(["landscape", "establishing", "landscape"], False, "balanced") == "joe"
    assert playbook.choose_hook(["first-person / to-camera"] * 3, True, "balanced") == "daniel"
    assert playbook.choose_hook(["conversation", "action"], True, "balanced") == "omar"
    assert playbook.choose_hook(["interview", "transport / journey"], True, "balanced") == "yusufa"
    assert playbook.choose_hook(["landscape"], False, "personal") == "daniel"
    assert playbook.bridge_for(None, [], False)[0].startswith("map")
    assert "card" in playbook.bridge_for(["landscape"], ["conversation"], False)[0]


def test_plan_carries_playbook(footage_dir, tmp_path):
    proj = tmp_path / "proj"
    ingest_folder(footage_dir, proj)
    plan = plan_project(proj, target_minutes=1)
    assert plan["hook_formula"]["from"] in ("Joe Hattab", "Omar Farooq", "Yusufa Sey", "Daniel Dalen")
    body = [i for i in plan["timeline"] if i["section"] != "hook"]
    assert all(i.get("technique") for i in body)
    assert all(b["borrowed_from"] for b in plan["bridges"])
    if body:  # the tiny fixture can be consumed entirely by the hook
        assert plan["bridges"]


def test_ingest_with_transcription(footage_dir, tmp_path, monkeypatch):
    """Regression: the `transcribe` keyword once shadowed the transcribe() function ("'bool' object is not callable")."""
    import tfd.footage.ingest as ing
    monkeypatch.setattr(ing, "_transcribe_clip", lambda p: [{"start": 0.0, "end": 1.0, "text": "hello"}])
    rep = ingest_folder(footage_dir, tmp_path / "proj_tx", transcribe=True)
    assert rep["summary"]["errors"] == 0
    with_audio = [c for c in rep["clips"] if c["meta"]["has_audio"]]
    assert all(c["transcript"] for c in with_audio)


def test_render_burns_in_titles_and_subtitles(footage_dir, tmp_path):
    """Title cards and subtitles from real transcripts are overlaid in the preview and exported as SRT."""
    import json
    import subprocess
    import numpy as np
    proj = tmp_path / "proj_burn"
    rep = ingest_folder(footage_dir, proj)
    speaking = next(c for c in rep["clips"] if c["name"] == "DJI_0001.MP4")
    speaking["transcript"] = [{"start": 0.0, "end": 3.0, "text": "We made it to the pass"}]
    (proj / "footage.json").write_text(json.dumps(rep), encoding="utf-8")
    plan = plan_project(proj, target_minutes=1)
    first = plan["timeline"][0]
    first.update(clip=speaking["id"], src_in=0.0, src_out=3.0, audio="sync")
    plan["clips"].setdefault(speaking["id"], {"path": speaking["path"], "fps": 25, "duration": 4,
                                               "width": 1280, "height": 720, "category": "x"})
    plan["timeline"] = [first]
    first["record_in"], first["record_out"] = 0.0, 3.0
    plan["titles"] = [{"at": 0.0, "duration": 3.0, "text": "THE PASS"}]
    (proj / "plan.json").write_text(json.dumps(plan), encoding="utf-8")
    assert "srt" in export_timeline(proj, plan)
    out = render_preview(proj)
    frame = tmp_path / "f.png"
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-ss", "1.5", "-i", str(out), "-frames:v", "1", str(frame)],
                   check=True)
    import cv2
    img = cv2.imread(str(frame))
    title_box = img[int(1080 * 0.06):int(1080 * 0.12), int(1920 * 0.04):int(1920 * 0.10)]
    assert title_box.mean() < 60  # dark card behind the title
    subtitle_band = img[int(1080 * 0.80):int(1080 * 0.90), :]
    assert (subtitle_band > 240).all(axis=2).sum() > 500  # white subtitle text pixels


def test_dji_proxy_used_for_analysis(footage_dir, tmp_path, monkeypatch):
    """A DJI .LRF next to the original is analysed (and transcribed) instead of the 4K file; the timeline keeps the original."""
    import shutil
    import tfd.footage.ingest as ing
    orig = footage_dir / "DJI_0001.MP4"
    shutil.copy(orig, footage_dir / "DJI_0001.LRF")
    seen = []
    monkeypatch.setattr(ing, "_transcribe_clip", lambda p: seen.append(p.suffix) or [])
    rep = ingest_folder(footage_dir, tmp_path / "proj_proxy", transcribe=True)
    rec = next(c for c in rep["clips"] if c["name"] == "DJI_0001.MP4")
    assert rec["path"] == str(orig.resolve()) and rec["analysis_proxy"].endswith("DJI_0001.LRF")
    assert ".LRF" in seen
    assert not any(c["name"].endswith(".LRF") for c in rep["clips"])  # the proxy is not a clip of its own


def test_proxy_only_folder_and_relink(footage_dir, tmp_path):
    """Originals still zipped/offline: ingest the DJI .LRF proxies as clips, then relink the 4K originals by name."""
    import json
    import shutil
    from tfd.footage.ingest import relink_originals
    proxies = tmp_path / "proxies"
    proxies.mkdir()
    shutil.copy(footage_dir / "DJI_0001.MP4", proxies / "DJI_0001.LRF")
    proj = tmp_path / "proj_lrf"
    rep = ingest_folder(proxies, proj)
    (rec,) = rep["clips"]
    assert rec["name"] == "DJI_0001.LRF" and rec["proxy_only"] and "error" not in rec
    originals = tmp_path / "T7" / "card A"
    originals.mkdir(parents=True)
    shutil.copy(footage_dir / "DJI_0001.MP4", originals / "DJI_0001.MP4")
    plan = plan_project(proj, target_minutes=1)
    n = relink_originals(proj, [tmp_path / "T7"])
    assert n == 1
    fj = json.loads((proj / "footage.json").read_text())
    assert fj["clips"][0]["original_path"] == str((originals / "DJI_0001.MP4").resolve())
    plan = json.loads((proj / "plan.json").read_text())
    assert plan["clips"][rec["id"]]["original_path"].endswith("DJI_0001.MP4")
    paths = export_timeline(proj, plan)
    tl = otio.adapters.read_from_file(str(paths["otio"]))
    assert tl.video_tracks()[0][0].media_reference.target_url.endswith("DJI_0001.MP4")


def test_lrf_next_to_original_is_not_a_clip(footage_dir, tmp_path):
    import shutil
    shutil.copy(footage_dir / "DJI_0001.MP4", footage_dir / "DJI_0001.LRF")
    rep = ingest_folder(footage_dir, tmp_path / "p2")
    assert not any(c["name"].endswith(".LRF") for c in rep["clips"])


def test_osmo_pocket_is_not_a_drone():
    from tfd.footage.ingest import is_drone
    assert not is_drone("DJI Osmo Pocket")
    assert is_drone("DJI Mavic 3")


def test_scene_cuts_keyframe_fast_path(tmp_path):
    """Hard cut at 2 s between two different sources is found from keyframes alone (no full decode)."""
    import subprocess
    from tfd.footage.ingest import scene_cuts
    out = tmp_path / "cut.mp4"
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-f", "lavfi", "-i", "testsrc2=s=320x180:d=2:r=25",
                    "-f", "lavfi", "-i", "color=c=0x202060:s=320x180:d=2:r=25", "-filter_complex",
                    "[0:v][1:v]concat=n=2:v=1[v]", "-map", "[v]", "-c:v", "libx264", "-g", "25", "-pix_fmt", "yuv420p",
                    str(out)], check=True)
    cuts = scene_cuts(out)
    assert len(cuts) == 1 and 1.0 <= cuts[0] <= 2.05
