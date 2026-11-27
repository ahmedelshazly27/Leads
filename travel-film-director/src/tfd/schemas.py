"""Structured data contracts shared by every stage.

`VideoProfile` is the reference-intelligence output for one YouTube video. It stores *derived
observations* (numbers, labels, short excerpts, timestamps) - never the video itself.
"""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

SCHEMA_VERSION = "1.0"

StyleMode = Literal["cinematic", "documentary", "personal"]


class TranscriptSegment(BaseModel):
    start: float
    end: float
    text: str


class Chapter(BaseModel):
    start: float
    end: float
    title: str


class FrameObs(BaseModel):
    """One sampled frame plus the measurements taken from it."""
    t: float
    path: str
    brightness: float          # 0-1 mean luma
    contrast: float            # std of luma, 0-1
    saturation: float          # mean HSV saturation 0-1
    colorfulness: float        # Hasler-Suesstrunk metric (unnormalised)
    warmth: float              # (R-B)/255 mean, -1..1
    sharpness: float           # variance of Laplacian (resolution dependent)
    edge_density: float        # fraction of Canny edge pixels
    faces: int = 0
    max_face_frac: float = 0.0 # largest face height / frame height
    sky_frac: float = 0.0      # fraction of top third that looks like sky
    text_like: float = 0.0     # rough score for overlaid text / titles
    palette: list[str] = Field(default_factory=list)
    letterbox: float = 0.0     # fraction of frame height that is black bars


class SceneAudio(BaseModel):
    words_per_minute: float = 0.0
    speech_coverage: float = 0.0     # fraction of scene covered by caption cues
    music_marker: bool = False       # auto-captions contain [Music]
    other_markers: list[str] = Field(default_factory=list)
    description: str = ""


class Scene(BaseModel):
    index: int
    start: float
    end: float
    duration: float
    representative_frame: str | None = None
    shot_type: str = "unknown"
    shot_type_confidence: float = 0.0
    camera_movement: str = "not measurable from storyboard sampling"
    pacing: Literal["slow", "medium", "fast", "unknown"] = "unknown"
    audio: SceneAudio = Field(default_factory=SceneAudio)
    narrative_function: str = "unknown"
    style_mode: StyleMode | None = None
    style_scores: dict[str, float] = Field(default_factory=dict)
    visual_characteristics: list[str] = Field(default_factory=list)
    editing_techniques: list[str] = Field(default_factory=list)
    speech_excerpt: str = ""
    evidence: list[str] = Field(default_factory=list)


class Technique(BaseModel):
    start: float
    end: float
    name: str
    description: str
    category: Literal["structure", "pacing", "visual", "sound", "narration", "transition", "graphics"]
    style_mode: StyleMode | None = None
    confidence: float = 0.5
    source: Literal["heuristic", "claude", "user"] = "heuristic"


class NarrativeBeat(BaseModel):
    start: float
    end: float
    label: str
    description: str = ""
    evidence: list[str] = Field(default_factory=list)


class SourceInfo(BaseModel):
    metadata: bool = False
    transcript: Literal["manual", "auto", "auto-translated", "whisper", "none"] = "none"
    transcript_language: str | None = None
    frames: str = "none"
    frame_interval_s: float | None = None
    chapters: int = 0
    heatmap: bool = False


class VideoProfile(BaseModel):
    schema_version: str = SCHEMA_VERSION
    video_id: str
    url: str
    creator: str
    title: str = ""
    channel: str = ""
    upload_date: str | None = None
    duration: float = 0.0
    view_count: int | None = None
    user_notes: str = ""
    analysed_at: str = ""
    sources: SourceInfo = Field(default_factory=SourceInfo)
    chapters: list[Chapter] = Field(default_factory=list)
    replay_peaks: list[dict] = Field(default_factory=list)
    scenes: list[Scene] = Field(default_factory=list)
    narrative_structure: list[NarrativeBeat] = Field(default_factory=list)
    hook: dict = Field(default_factory=dict)
    editing_characteristics: dict = Field(default_factory=dict)
    sound_design: dict = Field(default_factory=dict)
    color_characteristics: dict = Field(default_factory=dict)
    storytelling: dict = Field(default_factory=dict)
    style_mode_mix: dict[str, float] = Field(default_factory=dict)
    style_mode_basis: str = "transcript+visual"
    techniques: list[Technique] = Field(default_factory=list)
    qualitative: dict = Field(default_factory=dict)
    contact_sheets: list[str] = Field(default_factory=list)
    limitations: list[str] = Field(default_factory=list)
