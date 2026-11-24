"""Optional Claude layer. Everything works without it; with ANTHROPIC_API_KEY set you get
(1) qualitative scene/technique annotations from contact sheets + transcript, and (2) natural-language
answers about the reference library. Costs are bounded: contact sheets are downscaled JPEGs and the
transcript is sampled.
"""
from __future__ import annotations

import base64
import io
import json
from pathlib import Path

from PIL import Image
from pydantic import BaseModel, Field

from ..config import Settings
from ..log import get_logger

log = get_logger("claude")


class ClaudeUnavailable(RuntimeError):
    pass


def _client():
    try:
        import anthropic
    except ImportError as e:
        raise ClaudeUnavailable("Install the optional extra: pip install -e .[claude]") from e
    return anthropic.Anthropic()


def _img_block(path: str, max_w: int = 1400) -> dict:
    im = Image.open(path).convert("RGB")
    if im.width > max_w:
        im = im.resize((max_w, int(im.height * max_w / im.width)))
    buf = io.BytesIO()
    im.save(buf, "JPEG", quality=80)
    return {"type": "image", "source": {"type": "base64", "media_type": "image/jpeg",
                                         "data": base64.standard_b64encode(buf.getvalue()).decode()}}


class Observation(BaseModel):
    start: float
    end: float
    name: str = Field(description="short technique name, e.g. 'match cut on motion', 'drone reveal'")
    description: str
    style_mode: str = Field(description="cinematic | documentary | personal")


class QualitativeAnalysis(BaseModel):
    summary: str = Field(description="3-5 sentences on this creator's editing approach in THIS video")
    hook_analysis: str
    narrative_arc: str
    camera_and_composition: str
    color_and_grade: str
    sound_and_music: str
    what_to_borrow: list[str]
    what_to_avoid_copying: list[str]
    observations: list[Observation]


SYSTEM = ("You are a documentary film editor analysing a reference travel film to learn its *craft* - structure, "
          "pacing, framing, sound, grade. You only see low-resolution storyboard frames (timestamped) and captions, "
          "plus computed metrics. Be concrete and timestamped. Say when something is not observable at this resolution "
          "(e.g. exact transitions, camera moves). Never reproduce long transcript passages.")


def qualitative_analysis(profile_json: dict, contact_sheets: list[str], transcript_sample: str, settings: Settings) -> dict:
    if not settings.has_claude:
        raise ClaudeUnavailable("ANTHROPIC_API_KEY not set")
    client = _client()
    slim = {k: profile_json[k] for k in ("creator", "title", "duration", "hook", "editing_characteristics", "sound_design",
                                         "color_characteristics", "storytelling", "style_mode_mix", "narrative_structure")}
    slim["editing_characteristics"] = {k: v for k, v in slim["editing_characteristics"].items() if k != "pacing_curve"}
    content: list[dict] = [_img_block(p) for p in contact_sheets[:6]]
    content.append({"type": "text", "text": (
        "Computed metrics:\n" + json.dumps(slim, indent=1, default=str)[:15000] +
        "\n\nTimestamped caption sample:\n" + transcript_sample[:12000] +
        "\n\nAnalyse this reference video's filmmaking approach.")})
    resp = client.messages.parse(
        model=settings.claude_model, max_tokens=16000, system=SYSTEM,
        output_config={"effort": settings.claude_effort},
        messages=[{"role": "user", "content": content}], output_format=QualitativeAnalysis)
    if resp.stop_reason == "refusal":
        raise ClaudeUnavailable("Claude declined this request")
    log.info("claude usage: in=%s out=%s", resp.usage.input_tokens, resp.usage.output_tokens)
    data = resp.parsed_output.model_dump()
    for o in data["observations"]:
        o["source"] = "claude"
    data["model"] = settings.claude_model
    return data


def ask(question: str, context: str, settings: Settings) -> str:
    if not settings.has_claude:
        raise ClaudeUnavailable("ANTHROPIC_API_KEY not set")
    client = _client()
    resp = client.messages.create(
        model=settings.claude_model, max_tokens=8000,
        output_config={"effort": settings.claude_effort},
        system=[{"type": "text", "text": "You are a film-editing mentor. Answer using ONLY the reference library data below; "
                 "cite creators, video titles and timestamps; say when the data cannot answer the question.\n\n" + context,
                 "cache_control": {"type": "ephemeral"}}],
        messages=[{"role": "user", "content": question}])
    if resp.stop_reason == "refusal":
        raise ClaudeUnavailable("Claude declined this request")
    return "".join(b.text for b in resp.content if b.type == "text")
