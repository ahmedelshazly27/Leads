"""Reference inserts: a trimmed, muted, credited shot from another film (private study cuts)."""
import json
import subprocess

from tfd.editing.inserts import reference_insert


def test_reference_insert_is_muted_trimmed_and_sized(tmp_path):
    src = tmp_path / "ref.mp4"
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-f", "lavfi", "-i", "testsrc2=s=1280x720:d=6:r=25",
                    "-f", "lavfi", "-i", "sine=d=6", "-shortest", "-c:v", "libx264", "-pix_fmt", "yuv420p", str(src)],
                   check=True)
    out = reference_insert(src, 1.0, 3.5, tmp_path / "ins.mp4", "Footage: Test", width=640, height=360)
    info = json.loads(subprocess.run(["ffprobe", "-v", "error", "-print_format", "json", "-show_streams",
                                      "-show_format", str(out)], capture_output=True, text=True).stdout)
    assert [s["codec_type"] for s in info["streams"]] == ["video"]  # no audio: the original's voice/music stay out
    assert (info["streams"][0]["width"], info["streams"][0]["height"]) == (640, 360)
    assert abs(float(info["format"]["duration"]) - 2.5) < 0.15
