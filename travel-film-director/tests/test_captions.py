"""Captions: transcript segments -> timeline cues -> SRT and burn-in images. Only real speech, never invented."""
from __future__ import annotations

from PIL import Image

from tfd.editing.captions import caption_cues, is_hallucination, render_text_png, split_lines, write_srt


def _plan():
    return {"timeline": [
        {"clip": "c0", "src_in": 10.0, "src_out": 20.0, "record_in": 0.0, "record_out": 10.0, "audio": "sync"},
        {"clip": "c1", "src_in": 0.0, "src_out": 5.0, "record_in": 10.0, "record_out": 15.0, "audio": "ambient+music"},
        {"clip": "c0", "src_in": 30.0, "src_out": 34.0, "record_in": 15.0, "record_out": 19.0, "audio": "sync"},
    ]}


TRANSCRIPTS = {
    "c0": [{"start": 8.0, "end": 12.0, "text": "We just landed"},          # starts before the trim
           {"start": 15.0, "end": 17.0, "text": "and the road is closed"},
           {"start": 19.0, "end": 25.0, "text": "so we wait"},             # runs past the trim
           {"start": 31.0, "end": 33.0, "text": "Thank you for watching!"}],  # Whisper hallucination
    "c1": [{"start": 1.0, "end": 2.0, "text": "background chatter"}],      # ambient item: not captioned
}


def test_cues_map_to_record_time_and_clip_to_trim():
    cues = caption_cues(_plan(), TRANSCRIPTS)
    assert [c["text"] for c in cues] == ["We just landed", "and the road is closed", "so we wait"]
    assert cues[0]["start"] == 0.0 and cues[0]["end"] == 2.0
    assert cues[1]["start"] == 5.0 and cues[1]["end"] == 7.0
    assert cues[2]["start"] == 9.0 and cues[2]["end"] == 10.0


def test_hallucinations_filtered():
    assert is_hallucination("Thank you for watching!")
    assert is_hallucination("Subtitles by the Amara.org community")
    assert is_hallucination("you you you you you you")
    assert is_hallucination("ف" + "ا" * 60)  # Whisper stretching a drawn-out vowel into a run
    assert is_hallucination("...")
    assert not is_hallucination("Thank you so much, brother")
    assert not is_hallucination("وااااو")  # a short stretched "wow" is real speech


def test_split_lines():
    assert split_lines("short") == ["short"]
    lines = split_lines("this is a rather long caption line that has to wrap onto two lines nicely", 42)
    assert len(lines) == 2 and all(len(x) <= 42 for x in lines)


def test_srt(tmp_path):
    p = write_srt([{"start": 1.5, "end": 3.25, "text": "hello"}], tmp_path / "c.srt")
    assert p.read_text(encoding="utf-8") == "1\n00:00:01,500 --> 00:00:03,250\nhello\n\n"


def test_png_latin_and_arabic(tmp_path):
    for i, text in enumerate(["Hello Kabul", "مرحبا بكم"]):
        out = render_text_png(text, tmp_path / f"{i}.png", 1920, 1080, kind="subtitle")
        im = Image.open(out)
        assert im.size == (1920, 1080) and im.mode == "RGBA"
        assert im.getextrema()[3][1] == 255  # some opaque text pixels
    title = render_text_png("DAY 2", tmp_path / "t.png", 1920, 1080, kind="title")
    assert Image.open(title).getbbox() is not None


def test_overlays_for_window():
    from tfd.editing.captions import overlays_for
    cues = [{"start": 1.0, "end": 3.0, "text": "a"}, {"start": 9.5, "end": 12.0, "text": "b"}]
    titles = [{"at": 10.5, "duration": 3.0, "text": "KABUL"}]
    ev = overlays_for(10.0, 15.0, cues, titles)
    assert ev == [{"text": "b", "kind": "subtitle", "a": 0.0, "b": 2.0},
                  {"text": "KABUL", "kind": "title", "a": 0.5, "b": 3.5}]


def test_word_title_style(tmp_path):
    """Kinetic one-word titles for the hook: big, centred, own design (not a creator's branded template)."""
    from tfd.editing.captions import overlays_for
    ev = overlays_for(0.0, 5.0, [], [{"at": 0.2, "duration": 0.6, "text": "AFGHANISTAN", "style": "word"}])
    assert ev[0]["kind"] == "word"
    out = render_text_png("AFGHANISTAN", tmp_path / "w.png", 1920, 1080, kind="word")
    x0, y0, x1, y1 = Image.open(out).getbbox()
    assert abs((x0 + x1) / 2 - 960) < 40 and abs((y0 + y1) / 2 - 540) < 80 and x1 - x0 > 900


def test_item_can_switch_captions_off():
    """Where the transcript is unreliable, the editor turns captions off per timeline item."""
    plan = _plan()
    plan["timeline"][0]["captions"] = False
    assert [c["text"] for c in caption_cues(plan, TRANSCRIPTS)] == []  # item 2 only has the hallucination


def test_history_card_sits_above_subtitles(tmp_path):
    """'DATE · caption' history cards: big date over a caption, lower left, clear of the subtitle zone."""
    out = render_text_png("MARCH 2001 · Taliban destroy the Buddhas", tmp_path / "h.png", 1920, 1080, kind="history")
    x0, y0, x1, y1 = Image.open(out).getbbox()
    assert x0 < 200 and y1 < 1080 * 0.80 and y0 > 1080 * 0.45


def test_mixed_script_runs_in_visual_order():
    """English inside an Arabic line is set in a Latin font, in right-to-left visual order (no tofu boxes)."""
    from tfd.editing.typography import script_runs
    runs = script_runs("ومعروفة انها City of screams")
    assert [(t.strip(), ar) for t, ar in runs] == [("City of screams", False), ("ومعروفة انها", True)]
    assert script_runs("plain English") == [("plain English", False)]


def test_mixed_line_draws_latin_glyphs(tmp_path):
    """The Latin run renders with real glyphs: its pixels differ from what the Arabic-only font would draw."""
    import numpy as np
    out = render_text_png("ومعروفة انها City of screams", tmp_path / "m.png", 1920, 1080, kind="subtitle")
    a = np.array(Image.open(out))[..., 3]
    cols = np.nonzero(a.max(axis=0) > 200)[0]
    assert cols.size and (cols.max() - cols.min()) > 300  # both runs drawn side by side
