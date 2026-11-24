"""Local web interface (FastAPI). Binds to 127.0.0.1 by default; long jobs run in a worker thread."""
from __future__ import annotations

import threading
import traceback
import uuid
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, HTMLResponse
from pydantic import BaseModel

from ..config import get_settings
from ..log import get_logger
from ..pipeline import analyse_reference, ask_library, open_library, refresh_creator_profiles
from ..util import read_json, slug

log = get_logger("web")
app = FastAPI(title="Travel Film Director")
STATIC = Path(__file__).parent / "static"
JOBS: dict[str, dict] = {}
_LOCK = threading.Lock()  # one heavy job at a time keeps a laptop responsive


def _run(job_id: str, fn, *args, **kw):
    def work():
        with _LOCK:
            JOBS[job_id]["status"] = "running"
            try:
                JOBS[job_id]["result"] = fn(*args, **kw)
                JOBS[job_id]["status"] = "done"
            except Exception as e:
                log.error("job %s failed: %s", job_id, traceback.format_exc())
                JOBS[job_id].update(status="error", error=str(e))
    threading.Thread(target=work, daemon=True).start()


def _job(kind: str, label: str) -> str:
    jid = uuid.uuid4().hex[:8]
    JOBS[jid] = {"id": jid, "kind": kind, "label": label, "status": "queued"}
    return jid


@app.get("/", response_class=HTMLResponse)
def index():
    return (STATIC / "index.html").read_text(encoding="utf-8")


class RefIn(BaseModel):
    urls: list[str]
    creator: str
    notes: str = ""


@app.post("/api/references")
def add_refs(body: RefIn):
    ids = []
    for u in [u.strip() for u in body.urls if u.strip()]:
        jid = _job("reference", f"{body.creator}: {u}")
        _run(jid, lambda url=u: analyse_reference(url, body.creator, body.notes).model_dump(
            include={"video_id", "title", "style_mode_mix"}))
        ids.append(jid)
    return {"jobs": ids}


@app.get("/api/jobs")
def jobs():
    return list(JOBS.values())[-30:]


@app.get("/api/library")
def library():
    s = get_settings()
    lib = open_library(s)
    cmp = s.library_dir / "comparison.json"
    return {"creators": lib.creators(), "videos": lib.videos(), "comparison": read_json(cmp) if cmp.is_file() else None}


class WeightIn(BaseModel):
    weight: float
    description: str = ""


@app.post("/api/creators/{name}")
def set_creator(name: str, body: WeightIn):
    s = get_settings()
    lib = open_library(s)
    lib.upsert_creator(name, body.description, max(0.0, min(3.0, body.weight)))
    refresh_creator_profiles(s, lib)
    return {"ok": True}


@app.get("/api/video/{video_id}")
def video(video_id: str):
    v = next((v for v in open_library().videos() if v["video_id"] == video_id), None)
    if not v or not v["profile_path"]:
        raise HTTPException(404)
    return read_json(Path(v["profile_path"]))


@app.get("/api/search")
def search(q: str, mode: str | None = None):
    return open_library().search(q, style_mode=mode, limit=30)


class AskIn(BaseModel):
    question: str


@app.post("/api/ask")
def ask(body: AskIn):
    return ask_library(body.question)


@app.get("/files/{path:path}")
def files(path: str):
    """Serve derived files (contact sheets, frames, renders) from the data dir only."""
    s = get_settings()
    p = (s.data_dir / path).resolve()
    if s.data_dir not in p.parents or not p.is_file():
        raise HTTPException(404)
    return FileResponse(p)


# ------------------------------------------------------------------ projects
class ProjectIn(BaseModel):
    name: str
    footage: str
    minutes: float = 8
    direction: str = "balanced"
    transcribe: bool = False


def _project_dir(name: str) -> Path:
    return get_settings().projects_dir / slug(name)


@app.get("/api/projects")
def projects():
    d = get_settings().projects_dir
    out = []
    for p in sorted(d.glob("*/project.json")) if d.is_dir() else []:
        meta = read_json(p)
        meta["has_plan"] = (p.parent / "plan.json").is_file()
        meta["has_render"] = any((p.parent / "renders").glob("*.mp4")) if (p.parent / "renders").is_dir() else False
        out.append(meta)
    return out


@app.post("/api/projects")
def create_project(body: ProjectIn):
    from ..director.planner import plan_project
    from ..footage.ingest import ingest_folder
    from ..util import write_json
    folder = Path(body.footage).expanduser()
    if not folder.is_dir():
        raise HTTPException(400, f"Footage folder not found: {folder}")
    pd = _project_dir(body.name)
    pd.mkdir(parents=True, exist_ok=True)
    write_json(pd / "project.json", {**body.model_dump(), "slug": pd.name})

    def work():
        ingest_folder(folder, pd, transcribe=body.transcribe)
        return {"plan_items": len(plan_project(pd, body.minutes, body.direction)["timeline"])}
    jid = _job("project", f"Analyse footage: {body.name}")
    _run(jid, work)
    return {"job": jid, "slug": pd.name}


@app.get("/api/platform")
def platform_info():
    import platform
    return {"system": platform.system(), "machine": platform.machine()}


@app.post("/api/pick-folder")
def pick_folder():
    """Native macOS folder chooser (Finder dialog) via AppleScript. The dialog opens on the machine running tfd."""
    import platform
    import subprocess
    if platform.system() != "Darwin":
        raise HTTPException(501, "Folder picker is only available on macOS - type the path instead.")
    r = subprocess.run(["osascript", "-e", 'POSIX path of (choose folder with prompt "Choose your raw footage folder")'],
                       capture_output=True, text=True, timeout=300)
    if r.returncode != 0:  # user cancelled
        return {"path": None}
    return {"path": r.stdout.strip().rstrip("/")}


class RevealIn(BaseModel):
    path: str


@app.post("/api/reveal")
def reveal(body: RevealIn):
    """Show an exported file in Finder (macOS only, data directory only)."""
    import platform
    import subprocess
    s = get_settings()
    p = Path(body.path).resolve()
    if s.data_dir not in p.parents or not p.exists():
        raise HTTPException(404)
    if platform.system() != "Darwin":
        raise HTTPException(501, "Reveal is only available on macOS")
    subprocess.run(["open", "-R", str(p)], check=False)
    return {"ok": True}


@app.get("/api/projects/{name}/plan")
def get_plan(name: str):
    p = _project_dir(name) / "plan.json"
    if not p.is_file():
        raise HTTPException(404)
    plan = read_json(p)
    fp = _project_dir(name) / "footage.json"
    plan["footage_summary"] = read_json(fp)["summary"] if fp.is_file() else {}
    qa = _project_dir(name) / "qa_report.json"
    plan["qa"] = read_json(qa) if qa.is_file() else None
    return plan


class PlanEdit(BaseModel):
    remove: list[int] = []
    order: list[int] | None = None


@app.post("/api/projects/{name}/plan")
def edit_plan(name: str, body: PlanEdit):
    from ..util import write_json
    p = _project_dir(name) / "plan.json"
    plan = read_json(p)
    items = plan["timeline"]
    if body.order:
        items = [items[i] for i in body.order if 0 <= i < len(items)]
    items = [it for i, it in enumerate(items) if i not in set(body.remove)]
    rec = 0.0
    for it in items:
        it["record_in"] = round(rec, 2); rec += it["src_out"] - it["src_in"]; it["record_out"] = round(rec, 2)
    plan["timeline"], plan["planned_seconds"] = items, round(rec, 2)
    plan.setdefault("decisions", []).append("User edited the timeline in the UI.")
    write_json(p, plan)
    return {"ok": True, "items": len(items)}


@app.post("/api/projects/{name}/approve")
def approve(name: str):
    from ..editing.otio_export import export_timeline
    pd = _project_dir(name)
    paths = export_timeline(pd, read_json(pd / "plan.json"))
    return {k: str(v) for k, v in paths.items()}


@app.post("/api/projects/{name}/render")
def render(name: str):
    from ..editing.qa import run_qa
    from ..editing.render import render_preview
    pd = _project_dir(name)

    def work():
        out = render_preview(pd)
        return {"render": str(out.relative_to(get_settings().data_dir)), "qa": run_qa(pd, out)}
    jid = _job("render", f"Render: {name}")
    _run(jid, work)
    return {"job": jid}
