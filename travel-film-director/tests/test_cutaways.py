"""Cutaways (V2): picture from another clip covers the main shot while its sound and subtitles continue."""
import json
import subprocess

import cv2
import opentimelineio as otio
import pytest

from tfd.director.planner import plan_project
from tfd.editing.cutaways import windows_for
from tfd.editing.otio_export import reexport
from tfd.editing.render import render_preview
from tfd.footage.ingest import ingest_folder


def test_windows_clip_to_item_and_offset_source():
    item = {"record_in": 10.0, "record_out": 20.0}
    cuts = [{"clip": "b", "src_in": 100.0, "src_out": 106.0, "record_in": 8.0},   # starts before the item
            {"clip": "c", "src_in": 5.0, "src_out": 8.0, "record_in": 15.0},     # inside
            {"clip": "d", "src_in": 0.0, "src_out": 4.0, "record_in": 30.0}]     # outside
    w = windows_for(item, cuts)
    assert w == [{"clip": "b", "a": 0.0, "b": 4.0, "src_in": 102.0},
                 {"clip": "c", "a": 5.0, "b": 8.0, "src_in": 5.0}]


def _frame(video, t, out):
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-ss", str(t), "-i", str(video), "-frames:v", "1", str(out)],
                   check=True)
    return cv2.imread(str(out))


def test_cutaway_renders_and_exports(footage_dir, tmp_path):
    proj = tmp_path / "proj_cut"
    rep = ingest_folder(footage_dir, proj)
    plan_project(proj, target_minutes=1)
    plan = json.loads((proj / "plan.json").read_text())
    main = next(c for c in rep["clips"] if c["name"] == "DJI_0001.MP4")
    other = next(c for c in rep["clips"] if c["name"] == "IMG_0002.MOV")
    plan["timeline"] = [{"clip": main["id"], "src_in": 0.0, "src_out": 3.0, "section": "body", "audio": "sync",
                         "mode": "personal", "reason": "talk"}]
    plan["titles"] = []
    plan["cutaways"] = [{"clip": other["id"], "src_in": 0.5, "src_out": 1.5, "record_in": 1.0, "reason": "insert"}]
    (proj / "plan.json").write_text(json.dumps(plan), encoding="utf-8")
    paths = reexport(proj)
    tl = otio.adapters.read_from_file(str(paths["otio"]))
    assert len(tl.video_tracks()) == 2
    v2 = [c for c in tl.video_tracks()[1] if isinstance(c, otio.schema.Clip)]
    assert len(v2) == 1 and abs(v2[0].range_in_parent().start_time.to_seconds() - 1.0) < 0.05
    out = render_preview(proj)
    a, b, c = _frame(out, 0.4, tmp_path / "a.png"), _frame(out, 1.5, tmp_path / "b.png"), _frame(out, 2.6, tmp_path / "c.png")
    diff = lambda x, y: float(abs(x.astype(int) - y.astype(int)).mean())  # noqa: E731
    assert diff(a, b) > 3 * diff(a, c) or diff(c, b) > 3 * diff(a, c)  # the middle frame shows other footage
    dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(out)],
                               capture_output=True, text=True).stdout)
    assert abs(dur - 3.0) < 0.2  # cutaways never change the cut's length


def test_generated_clip_as_cutaway_is_not_graded(footage_dir, tmp_path):
    """Generated media (maps) register in the plan, export to V2, and skip the colour grade."""
    from tfd.editing.grade import ffmpeg_filters  # noqa: F401
    from tfd.editing.cutaways import add_generated_clip
    proj = tmp_path / "proj_gen"
    rep = ingest_folder(footage_dir, proj)
    plan_project(proj, target_minutes=1)
    plan = json.loads((proj / "plan.json").read_text())
    main = next(c for c in rep["clips"] if c["name"] == "DJI_0001.MP4")
    plan["timeline"] = [{"clip": main["id"], "src_in": 0.0, "src_out": 3.0, "section": "body", "audio": "sync",
                         "mode": "personal", "reason": "talk"}]
    plan["titles"] = []
    gid = add_generated_clip(plan, footage_dir / "IMG_0002.MOV", "map: test")
    plan["cutaways"] = [{"clip": gid, "src_in": 0.0, "src_out": 1.0, "record_in": 1.0, "reason": "map"}]
    (proj / "plan.json").write_text(json.dumps(plan), encoding="utf-8")
    reexport(proj)
    plan2 = json.loads((proj / "plan.json").read_text())
    assert plan2["clips"][gid]["generated"] and plan2["grade"]["corrections"].get(gid) in (None, {})
    assert render_preview(proj).is_file()
