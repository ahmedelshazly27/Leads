from fastapi.testclient import TestClient

from tfd.web.app import app


def test_index_and_library_endpoints(tmp_path):
    c = TestClient(app)
    assert "Travel Film Director" in c.get("/").text
    lib = c.get("/api/library").json()
    assert lib["creators"] == [] and lib["comparison"] is None
    assert c.post("/api/creators/Joe Hattab", json={"weight": 2.5}).json()["ok"]
    assert c.get("/api/library").json()["creators"][0]["weight"] == 2.5
    assert c.post("/api/ask", json={"question": "hooks"}).json()["mode"] == "offline"
    assert c.get("/files/../../etc/passwd").status_code == 404
    r = c.post("/api/projects", json={"name": "x", "footage": str(tmp_path / "missing")})
    assert r.status_code == 400
