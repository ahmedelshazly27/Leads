"""macOS-specific behaviour that can be verified on any OS."""
import platform

from fastapi.testclient import TestClient

from tfd.editing import render
from tfd.footage.ingest import _skip, device_guess, ingest_folder
from tfd.web.app import app


def test_skips_appledouble_hidden_and_library_bundles(tmp_path):
    root = tmp_path
    cases = {"._IMG_0001.MOV": True, ".hidden/a.mov": True, "Photos Library.photoslibrary/originals/a.mov": True,
             "Trip.fcpbundle/x.mov": True, "day1/IMG_0001.MOV": False}
    for rel, expected in cases.items():
        assert _skip(root / rel, root) is expected, rel


def test_appledouble_not_ingested(footage_dir, tmp_path):
    (footage_dir / "._DJI_0001.MP4").write_bytes(b"\x00\x05\x16\x07AppleDouble")
    rep = ingest_folder(footage_dir, tmp_path / "p")
    assert rep["summary"]["errors"] == 0
    assert not any(c["name"].startswith("._") for c in rep["clips"])


def test_iphone_model_from_quicktime_tags():
    tags = {"com.apple.quicktime.make": "Apple", "com.apple.quicktime.model": "iPhone 16 Pro"}
    assert device_guess(tags, {}, "IMG_1234.MOV") == "iPhone 16 Pro"
    assert device_guess({"encoder": "DJI OsmoPocket3"}, {}, "DJI_20260101.MP4") == "DJI Osmo Pocket"


def test_encoder_selection(monkeypatch):
    monkeypatch.setenv("TFD_VIDEO_ENCODER", "libx264")
    assert render.video_encoder()[1] == "libx264"
    monkeypatch.delenv("TFD_VIDEO_ENCODER")
    enc = render.video_encoder()[1]
    assert enc in ("libx264", "h264_videotoolbox")
    if platform.system() != "Darwin":
        assert enc == "libx264"


def test_mac_only_endpoints():
    c = TestClient(app)
    info = c.get("/api/platform").json()
    assert "system" in info
    if info["system"] != "Darwin":
        assert c.post("/api/pick-folder").status_code == 501
    assert c.post("/api/reveal", json={"path": "/etc/passwd"}).status_code == 404
