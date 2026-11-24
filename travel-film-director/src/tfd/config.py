"""Runtime configuration. Everything comes from environment variables (or a local .env file)."""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]


def _load_dotenv(path: Path) -> None:
    """Minimal .env loader (no extra dependency). Existing env vars always win."""
    if not path.is_file():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key, value = key.strip(), value.strip().strip('"').strip("'")
        if value and key not in os.environ:
            os.environ[key] = value


@dataclass
class Settings:
    data_dir: Path
    claude_model: str = "claude-opus-5-5"
    claude_effort: str = "medium"
    yt_cookies: str | None = None
    yt_cookies_from_browser: str | None = None
    # yt-dlp player clients tried in order. "mweb,web_embedded" returned metadata, storyboards and
    # subtitles from a datacenter IP during development; plain defaults are tried as fallback.
    yt_player_clients: list[str] = field(default_factory=lambda: ["mweb,web_embedded", "default"])

    @property
    def library_dir(self) -> Path:
        return self.data_dir / "library"

    @property
    def projects_dir(self) -> Path:
        return self.data_dir / "projects"

    @property
    def db_path(self) -> Path:
        return self.data_dir / "library.sqlite3"

    @property
    def has_claude(self) -> bool:
        return bool(os.environ.get("ANTHROPIC_API_KEY") or os.environ.get("ANTHROPIC_AUTH_TOKEN"))


def get_settings() -> Settings:
    _load_dotenv(PROJECT_ROOT / ".env")
    data_dir = Path(os.environ.get("TFD_DATA_DIR") or PROJECT_ROOT / "data").expanduser().resolve()
    data_dir.mkdir(parents=True, exist_ok=True)
    return Settings(
        data_dir=data_dir,
        claude_model=os.environ.get("TFD_CLAUDE_MODEL", "claude-opus-5-5"),
        claude_effort=os.environ.get("TFD_CLAUDE_EFFORT", "medium"),
        yt_cookies=os.environ.get("TFD_YT_COOKIES") or None,
        yt_cookies_from_browser=os.environ.get("TFD_YT_COOKIES_FROM_BROWSER") or None,
    )
