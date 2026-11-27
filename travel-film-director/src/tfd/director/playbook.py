"""Scene playbook distilled from the 24-video reference study (see STYLE_SYNTHESIS.md).

Maps the kind of footage in a sequence to an editing approach and the creator(s) it is borrowed from.
Rules are deliberately small and readable; every applied rule is written into plan.json and the timeline.
"""
from __future__ import annotations

# category (from planner.classify) -> (technique, borrowed from, editing guidance)
SCENE_RULES: dict[str, tuple[str, str, str]] = {
    "establishing": ("drone/top-down establishing before eye level", "Joe Hattab, Omar Farooq",
                     "open the place on the widest aerial, then cut to ground level"),
    "landscape": ("speech-free montage on music", "Joe Hattab",
                  "12-40 s, up to ~90 s to close a chapter; no narration over it"),
    "cinematic b-roll": ("breather / cutaway", "Joe Hattab", "short, covers cuts in talk"),
    "conversation": ("host two-shot + detail inserts + burned-in subtitles", "Joe Hattab, Omar Farooq",
                     "intercut close-ups of hands/objects every few lines"),
    "interview": ("locked-off sit-down, subtitled", "Joe Hattab, Yusufa Sey",
                  "keep it short; reframe or cut to inserts if it runs past ~50 s"),
    "first-person / to-camera": ("short to-camera beat, covered with b-roll", "Daniel Dalen (shortened)",
                                 "use the best line; save one reflection for the ending"),
    "transport / journey": ("ride-along as connective tissue", "Yusufa Sey, Daniel Dalen",
                            "car/train talk bridges places; follow with a place card"),
    "cultural / street life": ("observational coverage", "Omar Farooq, Joe Hattab",
                               "let the scene play; detail inserts at the moment something is explained"),
    "action": ("participation beat", "Omar Farooq", "you trying it; tease this in the hook"),
}

HOOK_FORMULAS = {
    "joe": ("Joe Hattab", "strangest image first (no presenter) -> one fact or question -> 6-10 shot sizzle incl. "
                          "a finale tease -> map + plan"),
    "omar": ("Omar Farooq", "speech in first seconds mid-action -> flash-forward of you inside the experience -> "
                            "premise as contrast/doubt -> reset to arrival"),
    "yusufa": ("Yusufa Sey", "visual lead-in without context -> title on black -> piece to camera stating stakes"),
    "daniel": ("Daniel Dalen", "10-30 s music teaser whose shots return later as payoffs -> casual spoken premise"),
}


def choose_hook(categories: list[str], has_speech: bool, direction: str) -> str:
    n = max(1, len(categories))
    share = lambda *cats: sum(c in cats for c in categories) / n  # noqa: E731
    if direction == "cinematic":
        return "joe"
    if direction == "personal":
        return "daniel"
    if direction == "documentary":
        return "omar" if share("action", "conversation", "cultural / street life") >= 0.2 else "joe"
    scores = {
        "joe": share("establishing", "landscape", "cinematic b-roll") * 1.2,
        "omar": share("action", "conversation", "cultural / street life") + (0.1 if has_speech else 0),
        "yusufa": share("interview", "transport / journey"),
        "daniel": share("first-person / to-camera") * 1.3,
    }
    return max(scores, key=scores.get)


def bridge_for(prev_seq_categories: list[str] | None, seq_categories: list[str], new_location: bool) -> tuple[str, str]:
    """How to get into a sequence: map bridge for a new region, place/time card for a new day or city."""
    if prev_seq_categories is None:
        return "map bridge + statement of the plan", "Joe Hattab, Omar Farooq"
    if new_location:
        return "map bridge with route line + top-down drone", "Joe Hattab, Omar Farooq"
    return "bold place/time card (your own design)", "Daniel Dalen, Yusufa Sey"
