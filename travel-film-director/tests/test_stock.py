"""Stock search/download with mocked provider responses (no network, no keys)."""
import io
import json

import pytest

from tfd.stock import search as st


class _Resp(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


def test_pexels_and_pixabay_parsing_and_download(monkeypatch, tmp_path):
    monkeypatch.setenv("PEXELS_API_KEY", "x")
    monkeypatch.setenv("PIXABAY_API_KEY", "y")
    pexels = {"videos": [{"id": 1, "url": "https://pexels.com/v/1", "duration": 12, "image": "i.jpg", "user": {"name": "Ana"},
                          "video_files": [{"width": 1920, "height": 1080, "link": "https://dl/1080.mp4"},
                                          {"width": 3840, "height": 2160, "link": "https://dl/4k.mp4"}]},
                         {"id": 2, "url": "u", "duration": 2, "image": "", "user": {}, "video_files": [{"width": 640, "height": 360, "link": "s"}]}]}
    pixabay = {"hits": [{"id": 9, "pageURL": "https://pixabay.com/v/9", "duration": 20, "user": "Bo", "tags": "desert, aerial",
                         "videos": {"large": {"url": "https://dl/p9.mp4", "width": 1920, "height": 1080, "thumbnail": "t"}}}]}
    seen = []

    def fake_urlopen(req, timeout=0):
        url = req.full_url
        seen.append((url, dict(req.headers)))
        if "api.pexels.com" in url:
            return _Resp(json.dumps(pexels).encode())
        if "pixabay.com/api" in url:
            return _Resp(json.dumps(pixabay).encode())
        return _Resp(b"\x00" * 2048)

    monkeypatch.setattr(st.urllib.request, "urlopen", fake_urlopen)
    res = st.search("kazakhstan steppe aerial", min_duration=4)
    assert [(r.provider, r.id) for r in res] == [("pexels", "1"), ("pixabay", "9")]  # 2 s clip filtered out
    assert res[0].height == 2160 and res[0].author == "Ana"
    assert any(h.get("Authorization") == "x" for u, h in seen if "pexels" in u)
    p1 = st.download(res[0], tmp_path)
    p2 = st.download(res[0], tmp_path)
    assert p1.is_file() and p2 != p1  # never overwrite
    man = json.loads((tmp_path / "stock" / "stock_manifest.json").read_text())
    assert len(man) == 2 and man[0]["license"].startswith("Pexels")


def test_missing_keys_message(monkeypatch):
    monkeypatch.delenv("PEXELS_API_KEY", raising=False)
    monkeypatch.delenv("PIXABAY_API_KEY", raising=False)
    with pytest.raises(RuntimeError, match="PEXELS_API_KEY"):
        st.search("x")
