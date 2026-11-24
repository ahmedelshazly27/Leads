"""SQLite reference library with FTS5 search over scenes and techniques."""
from __future__ import annotations

import json
import sqlite3
from pathlib import Path

from ..schemas import VideoProfile
from ..util import fmt_ts, slug

SCHEMA = """
CREATE TABLE IF NOT EXISTS creators (
  slug TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT DEFAULT '', weight REAL DEFAULT 1.0
);
CREATE TABLE IF NOT EXISTS videos (
  video_id TEXT PRIMARY KEY, creator_slug TEXT NOT NULL REFERENCES creators(slug), title TEXT, url TEXT,
  notes TEXT DEFAULT '', duration REAL, analysed_at TEXT, profile_path TEXT, status TEXT DEFAULT 'done', error TEXT
);
CREATE TABLE IF NOT EXISTS items (
  id INTEGER PRIMARY KEY, video_id TEXT, creator_slug TEXT, kind TEXT, start REAL, "end" REAL,
  name TEXT, category TEXT, style_mode TEXT, text TEXT
);
CREATE VIRTUAL TABLE IF NOT EXISTS items_fts USING fts5(name, category, style_mode, text, content='items', content_rowid='id');
CREATE TRIGGER IF NOT EXISTS items_ai AFTER INSERT ON items BEGIN
  INSERT INTO items_fts(rowid, name, category, style_mode, text) VALUES (new.id, new.name, new.category, new.style_mode, new.text);
END;
CREATE TRIGGER IF NOT EXISTS items_ad AFTER DELETE ON items BEGIN
  INSERT INTO items_fts(items_fts, rowid, name, category, style_mode, text) VALUES ('delete', old.id, old.name, old.category, old.style_mode, old.text);
END;
"""


class Library:
    def __init__(self, db_path: Path):
        self.path = db_path
        self.conn = sqlite3.connect(db_path, check_same_thread=False)
        self.conn.row_factory = sqlite3.Row
        self.conn.executescript(SCHEMA)

    # ---------------------------------------------------------- creators
    def upsert_creator(self, name: str, description: str = "", weight: float | None = None) -> str:
        s = slug(name)
        cur = self.conn.execute("SELECT slug FROM creators WHERE slug=?", (s,)).fetchone()
        if cur:
            if description:
                self.conn.execute("UPDATE creators SET description=? WHERE slug=?", (description, s))
            if weight is not None:
                self.conn.execute("UPDATE creators SET weight=? WHERE slug=?", (weight, s))
        else:
            self.conn.execute("INSERT INTO creators(slug,name,description,weight) VALUES (?,?,?,?)",
                              (s, name, description, 1.0 if weight is None else weight))
        self.conn.commit()
        return s

    def creators(self) -> list[dict]:
        rows = self.conn.execute("""SELECT c.*, COUNT(v.video_id) AS videos FROM creators c
                                    LEFT JOIN videos v ON v.creator_slug=c.slug AND v.status='done' GROUP BY c.slug ORDER BY c.name""")
        return [dict(r) for r in rows]

    # ---------------------------------------------------------- videos
    def mark_status(self, video_id: str, creator: str, url: str, status: str, error: str | None = None, notes: str = "") -> None:
        cs = self.upsert_creator(creator)
        self.conn.execute("""INSERT INTO videos(video_id, creator_slug, url, status, error, notes) VALUES (?,?,?,?,?,?)
                             ON CONFLICT(video_id) DO UPDATE SET creator_slug=excluded.creator_slug, status=excluded.status,
                             error=excluded.error, notes=CASE WHEN excluded.notes!='' THEN excluded.notes ELSE videos.notes END""",
                          (video_id, cs, url, status, error, notes))
        self.conn.commit()

    def add_profile(self, profile: VideoProfile, profile_path: Path) -> None:
        cs = self.upsert_creator(profile.creator)
        self.conn.execute("""INSERT OR REPLACE INTO videos(video_id, creator_slug, title, url, notes, duration, analysed_at, profile_path, status, error)
                             VALUES (?,?,?,?,?,?,?,?, 'done', NULL)""",
                          (profile.video_id, cs, profile.title, profile.url, profile.user_notes, profile.duration,
                           profile.analysed_at, str(profile_path)))
        self.conn.execute("DELETE FROM items WHERE video_id=?", (profile.video_id,))
        rows = []
        for s in profile.scenes:
            text = " | ".join([s.shot_type, s.narrative_function, s.audio.description, ", ".join(s.visual_characteristics),
                               ", ".join(s.editing_techniques), s.speech_excerpt])
            rows.append((profile.video_id, cs, "scene", s.start, s.end, s.narrative_function, s.shot_type, s.style_mode, text))
        for t in profile.techniques:
            rows.append((profile.video_id, cs, "technique", t.start, t.end, t.name, t.category, t.style_mode, t.description))
        for k, v in (profile.qualitative or {}).items():
            if isinstance(v, list):
                for obs in v:
                    if isinstance(obs, dict):
                        rows.append((profile.video_id, cs, "observation", obs.get("start") or 0, obs.get("end") or 0,
                                     obs.get("name") or k, k, obs.get("style_mode"), obs.get("description") or json.dumps(obs)))
        self.conn.executemany("""INSERT INTO items(video_id, creator_slug, kind, start, "end", name, category, style_mode, text)
                                 VALUES (?,?,?,?,?,?,?,?,?)""", rows)
        self.conn.commit()

    def videos(self, creator_slug: str | None = None) -> list[dict]:
        q = "SELECT v.*, c.name AS creator FROM videos v JOIN creators c ON c.slug=v.creator_slug"
        args: tuple = ()
        if creator_slug:
            q += " WHERE v.creator_slug=?"
            args = (creator_slug,)
        return [dict(r) for r in self.conn.execute(q + " ORDER BY c.name, v.analysed_at", args)]

    def profiles(self, creator_slug: str | None = None) -> list[VideoProfile]:
        out = []
        for v in self.videos(creator_slug):
            if v["status"] == "done" and v["profile_path"] and Path(v["profile_path"]).is_file():
                out.append(VideoProfile.model_validate_json(Path(v["profile_path"]).read_text(encoding="utf-8")))
        return out

    # ---------------------------------------------------------- search
    def search(self, query: str, creator_slug: str | None = None, style_mode: str | None = None, limit: int = 25) -> list[dict]:
        terms = [t for t in "".join(ch if ch.isalnum() or ch.isspace() else " " for ch in query).split() if len(t) > 1]
        if not terms:
            return []
        fts = " OR ".join(f'"{t}"*' for t in terms)
        q = """SELECT i.*, c.name AS creator, v.title, v.url, bm25(items_fts) AS score FROM items_fts
               JOIN items i ON i.id = items_fts.rowid JOIN creators c ON c.slug=i.creator_slug JOIN videos v ON v.video_id=i.video_id
               WHERE items_fts MATCH ?"""
        args: list = [fts]
        if creator_slug:
            q += " AND i.creator_slug=?"; args.append(creator_slug)
        if style_mode:
            q += " AND i.style_mode=?"; args.append(style_mode)
        q += " ORDER BY score LIMIT ?"; args.append(limit)
        out = []
        for r in self.conn.execute(q, args):
            d = dict(r)
            d["timestamp"] = fmt_ts(d["start"])
            d["link"] = f"{d['url']}&t={int(d['start'])}s" if d.get("url") else None
            out.append(d)
        return out
