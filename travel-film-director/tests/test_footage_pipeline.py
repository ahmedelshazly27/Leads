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
