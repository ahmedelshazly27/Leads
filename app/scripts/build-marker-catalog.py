"""Build app/src/lib/markers/catalog.json from research_notes/marker_catalogue/*.md.

Every marker row keeps the catalogue's own wording; nothing is invented here.
Run: python3 scripts/build-marker-catalog.py  (from app/)
"""
import json, re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2] / "research_notes" / "marker_catalogue"
OUT = Path(__file__).resolve().parents[1] / "src" / "lib" / "markers" / "catalog.json"

KEYMAP = {
    "id": "id", "region": "region", "group": "region", "name": "name", "definition": "definition",
    "photo needed": "photo", "photo": "photo", "photo needed & capture": "photo",
    "landmarks (anthro; mediapipe)": "landmarks", "landmarks": "landmarks", "method": "method",
    "formula": "formula", "norm male": "normMale", "norm female": "normFemale",
    "ethnic norms": "ethnicNorms", "ethnic norms (arab / me / other)": "ethnicNorms",
    "scale / units & published norms": "norms", "perception evidence": "perception",
    "perception evidence (as reported)": "perception", "sources": "sources", "automatable": "automatable",
}

def cells(line):
    line = line.strip().strip("|")
    parts = re.split(r"(?<!\\)\|", line)
    return [p.strip().replace("\\|", "|") for p in parts]

def clean(t):
    t = re.sub(r"\*\*(.+?)\*\*", r"\1", t)
    t = re.sub(r"`([^`]+)`", r"\1", t)
    return t.replace("<br>", " ").strip()

def section_region(heading):
    h = heading.lower()
    if "convexity" in h:
        return "profile"
    for k in ["eye appearance", "global", "skin", "jaw", "45", "smile", "neck", "chin", "ears", "ear", "nose", "lips", "cheeks", "eyebrows", "eyes", "general", "profile"]:
        if k in h:
            return {"45": "45° view", "ear": "ears", "eye appearance": "eye appearance", "global": "global constructs", "jaw": "jaw & chin", "chin": "jaw & chin"}.get(k, k)
    return None

def method_of(auto):
    a = auto.lower()
    if a.startswith("out"):
        return "auto"
    if a.startswith("lmk"):
        return "semi"
    if a.startswith("rev"):
        return "review"
    if "ccc" in a:
        return "semi"  # no colour card: relative measure or reviewer grade
    if "review" in a or "grade" in a or "judg" in a:
        return "review" if "auto" not in a.split("review")[0] else "semi"
    if "semi" in a:
        return "semi"
    if "auto" in a:
        return "auto"
    return "review"

def parse(path, source_key):
    text = path.read_text()
    lines = text.splitlines()
    markers, header, region = [], None, None
    for ln in lines:
        if ln.startswith("## "):
            region = section_region(ln)
            header = None
            continue
        if ln.startswith("| ") and header is None and "id" in ln.lower() and "name" in ln.lower():
            header = [KEYMAP.get(h.lower().strip(), h.lower().strip()) for h in cells(ln)]
            continue
        if ln.startswith("|---"):
            continue
        if header and ln.startswith("| "):
            c = cells(ln)
            if len(c) < len(header) - 1 or not re.match(r"^[a-z0-9][a-z0-9-]+$", clean(c[0])):
                continue
            row = {header[i]: clean(c[i]) for i in range(min(len(header), len(c)))}
            r = (row.get("region") or region or "").strip().lower()
            row["region"] = {"jaw": "jaw & chin", "chin": "jaw & chin", "ear": "ears", "global construct": "global constructs", "general": "proportions", "profile": "profile"}.get(r, r)
            row["catalogue"] = source_key
            auto = row.get("automatable", "")
            row["methodKind"] = method_of(auto)
            row["needsScale"] = "[mm]" in auto or "auto-mm" in auto
            row["needsLevel"] = "TV" in auto
            row["needsColourCard"] = "CCC" in auto
            row["outlineOnly"] = auto.startswith("OUT")
            markers.append(row)
        elif header and not ln.startswith("|"):
            header = None if ln.startswith("#") else header
    # references
    refs = []
    m = re.search(r"\n## Reference[s]?[^\n]*\n(.*)", text, re.S)
    if m:
        for ln in m.group(1).splitlines():
            ln = ln.strip()
            if ln.startswith("### "):
                break
            mm = re.match(r"^(?:-\s*\*\*(R\d+)\*\*|(\d+)\.)\s+(.*)", ln)
            if mm:
                refs.append({"key": mm.group(1) or mm.group(2), "text": clean(mm.group(3))})
    return markers, refs

out = {"markers": [], "references": {}}
for fname, key in [("frontal.md", "frontal"), ("profile_smile_neck_ear.md", "profile"), ("skin_eyes_constructs.md", "skin")]:
    ms, refs = parse(ROOT / fname, key)
    out["markers"] += ms
    out["references"][key] = refs
# client-facing clean-up: internal notes, reference codes, abbreviations
def short_ref(text):
    authors = text.split(".")[0]
    toks = authors.split(",")[0].strip().split(" ")
    first = " ".join(toks[:-1]) if len(toks) > 1 and re.fullmatch(r"[A-Z]{1,3}", toks[-1]) else toks[0]
    yr = re.search(r"(19|20)\d\d", text)
    etal = " et al." if "," in authors else ""
    return f"{first}{etal} {yr.group(0) if yr else ''}".strip()

frontal_refs = {r["key"]: short_ref(r["text"]) for r in out["references"]["frontal"]}
ABBR = [(r"\bNAW\b", "North American white"), (r"\(RoM\)", "(ratio of group means)"), (r"\bRoM\b", "ratio of group means"),
        (r"\bceleb\b", "celebrities"), (r"\bMSI\b", "Malaysian South Indian"), (r"\bHK\b", "Hong Kong"), (r"\bSA F\b", "South African women")]
def tidy(t):
    for a, b in ABBR:
        t = re.sub(a, b, t)
    return t
for m in out["markers"]:
    m["name"] = re.sub(r"\s*\((existing[^)]*|infrastructure)\)", "", m["name"]).strip()
    if m["catalogue"] == "frontal" and m.get("sources"):
        m["sources"] = re.sub(r"\bR(\d+)\b", lambda x: frontal_refs.get("R" + x.group(1), x.group(0)), m["sources"])
    for k in ("normMale", "normFemale", "ethnicNorms", "norms", "perception"):
        if m.get(k):
            m[k] = re.sub(r"\s*\[R\d+(?:,\s*R\d+)*\]", "", tidy(m[k]))

seen = set()
for m in out["markers"]:
    if m["id"] in seen:
        m["id"] = m["id"] + "-" + m["catalogue"]
    seen.add(m["id"])
ids = [m["id"] for m in out["markers"]]
dups = {i for i in ids if ids.count(i) > 1}
OUT.write_text(json.dumps(out, ensure_ascii=False, indent=1))
from collections import Counter
print("markers", len(ids), "dups", dups)
print(Counter((m["catalogue"], m["region"]) for m in out["markers"]))
print(Counter(m["methodKind"] for m in out["markers"]))
print({k: len(v) for k, v in out["references"].items()})

# small summary for the capture flow: markers unlocked by each photo
def needs(photo):
    p = photo.lower(); out = set()
    if "profile" in p and "45" not in p: out.add("profile")
    if "45" in p or "three-quarter" in p or "oblique" in p: out.add("face45")
    if "smile" in p: out.add("smile")
    if "frown" in p: out.add("frown")
    if "raise" in p: out.add("browRaise")
    if not out: out.add("front")
    return out
summary = Counter(k for m in out["markers"] for k in needs(m.get("photo", "")))
summary["total"] = len(out["markers"])
(OUT.parent / "summary.json").write_text(json.dumps(dict(summary), indent=1))
print("summary", dict(summary))
