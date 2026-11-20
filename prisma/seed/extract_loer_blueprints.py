#!/usr/bin/env python3
"""
Extract the per-screen engineering blueprints from the LOER v7.0.0 workbook.

The workbook carries one sheet per screen (S01_Consent .. S80_Save_Atlas_Record),
each a set of "Field | Specification" pairs grouped under numbered sections:

    1. Identity                 Master Screen ID, Canonical Screen ID, Canonical
                                Name, Participant Title, Status, Version
    2. Purpose and Content      Purpose, Allowed Values, Input Type
    3. Observation Mapping      Observation ID, Field, DB
    4. Adaptive Logic           Rule ID + one row per branch condition
    5. Trust, QA and Mappings   Trust Card, QA, Knowledge, Reasoning, Reflection,
                                Technical

Writes prisma/seed/loer-v7-blueprints.json, consumed by
prisma/seed/loer-v7-alignment.mjs.

Re-run after the client issues a new workbook:
    python prisma/seed/extract_loer_blueprints.py "<path to workbook.xlsx>"
"""
import json
import os
import re
import sys

try:
    import openpyxl
except ImportError:
    sys.exit("openpyxl is required:  pip install openpyxl")

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "loer-v7-blueprints.json")
DEFAULT_SRC = os.path.join(
    os.path.expanduser("~"), "Downloads", "LOER_v7.0.0_Production_Candidate1.xlsx"
)

SCREEN_SHEET = re.compile(r"^S(\d{2})_")
SECTION = re.compile(r"^\s*(\d+)\.\s+(.*)$")


def cells(row):
    return [("" if c is None else str(c).strip()) for c in row]


# "S37A / SCR-4002A — Describe Vaginal Discharge"
PANEL_TITLE = re.compile(r"^\s*(S\d{2}[A-Z]?)\s*/\s*(SCR-[\w.-]+)\s*[—–-]\s*(.+?)\s*$")


def parse_panels(ws):
    """
    Parse every screen blueprint on a sheet.

    Most sheets hold one blueprint in columns A/B. Some hold several side by
    side — S37_Body_Changes carries S37 in A/B and S37A then S37B in C/D — so
    reading only the first two columns silently dropped two entire screens and
    the adaptive rule that routes between them.

    Each panel is anchored at the cell holding its "Sxx / SCR-… — Name" title
    and reads key/value pairs from that column and the one beside it, down to
    the next title in the same column.
    """
    grid = [cells(row) for row in ws.iter_rows(values_only=True)]

    anchors = []  # (row, col, screen_id)
    for r, row in enumerate(grid):
        for col, text in enumerate(row):
            m = PANEL_TITLE.match(text or "")
            if m:
                anchors.append((r, col, m.group(1)))
    if not anchors:
        return []

    panels = []
    for i, (r0, col, sid) in enumerate(anchors):
        # Panel ends at the next title in the same column, else the sheet end.
        end = len(grid)
        for r1, c1, _ in anchors[i + 1 :]:
            if c1 == col and r1 > r0:
                end = r1
                break

        out = {"screenId": sid, "sections": {}, "adaptive": []}
        section = None
        for r in range(r0 + 1, end):
            row = grid[r]
            key = row[col] if col < len(row) else ""
            value = next((x for x in row[col + 1 : col + 3] if x), "")
            if not key:
                continue

            m = SECTION.match(key)
            if m:
                section = m.group(2).strip()
                out["sections"].setdefault(section, {})
                continue
            if key.lower() == "field" and value.lower().startswith("spec"):
                continue
            if PANEL_TITLE.match(key) or section is None:
                continue

            if section.lower().startswith("adaptive"):
                if key.lower() in ("rule id", "critical rule"):
                    out["sections"][section][key] = value
                else:
                    out["adaptive"].append({"condition": key, "action": value})
            else:
                out["sections"][section][key] = value
        panels.append(out)
    return panels


def get(bp, *names, section=None):
    """Fetch the first matching field, optionally within one section."""
    for sec, fields in bp["sections"].items():
        if section and section.lower() not in sec.lower():
            continue
        for n in names:
            for k, v in fields.items():
                if k.strip().lower() == n.lower():
                    return v
    return ""


ACK_ROW = re.compile(r"^required acknowledgement\s*(\d+)$", re.I)

# Rows in the participant-facing section that are metadata rather than body copy.
NOT_BODY = {
    "question",
    "participant title",
    "allowed values",
    "primary action",
    "secondary actions",
    "support copy",
    "opening copy",
    "none option",
    "input type",
    "field",
    "placeholder",
    "validation",
    # Navigation rows that sit in the participant section on some sheets.
    "next screen",
    "previous screen",
    "route",
    "secondary action",
}


def body_copy(bp):
    """
    Ordered participant-facing paragraphs.

    Information screens carry their content as several labelled rows in the
    "Participant-Facing Content" section (Core Message, Atlas Record
    Explanation, Reflection Explanation, Contribution Message, ...). Reading
    only Purpose/Participant Title loses all of it and renders a screen whose
    heading and body are the same sentence.
    """
    out = []
    for section, fields in bp["sections"].items():
        if "participant" not in section.lower():
            continue
        for key, value in fields.items():
            k = key.strip().lower()
            if k in NOT_BODY or ACK_ROW.match(k) or not value:
                continue
            # Route rows ("S06 — Age") sometimes sit in this section; they are
            # navigation, not participant copy.
            if re.match(r"^S\d{2}", value.strip()):
                continue
            out.append(value.strip())
    return out


def acknowledgements(bp):
    """Ordered 'Required Acknowledgement N' rows — S01 states four of them."""
    found = []
    for fields in bp["sections"].values():
        for k, v in fields.items():
            m = ACK_ROW.match(k.strip())
            if m and v:
                found.append((int(m.group(1)), v.strip()))
    return [text for _, text in sorted(found)]


def split_values(raw):
    """'Yes, currently; Yes, but not currently; No' -> list (semicolon-delimited)."""
    if not raw:
        return []
    parts = [p.strip() for p in raw.split(";")]
    return [p for p in parts if p and p.lower() not in ("n/a", "none", "not applicable")]


VARIANT_QUESTION = re.compile(r"^(S\d{2}[A-Z])\s+question$", re.I)


def variant_questions(bp):
    """
    Per-variant question wording for adaptive A/B screens.

    S40 states one Participant Title plus "S40A Question" and "S40B Question"
    rows — the cycling and non-cycling phrasings. Reading only Participant Title
    gave both variants the same cycle-assuming text, which is the thing the B
    variant exists to avoid.
    """
    out = {}
    for fields in bp["sections"].values():
        for key, value in fields.items():
            m = VARIANT_QUESTION.match(key.strip())
            if m and value:
                out[m.group(1).upper()] = value.strip()
    return out


# Content-section rows that are prose or metadata, never an option list.
NOT_AN_OPTION_LIST = {
    "purpose",
    "scope",
    "exclusions",
    "input type",
    "participant title",
    "question",
    "opening copy",
    "support copy",
    "primary action",
    "secondary actions",
    "validation",
    "required",
    "none option",
    "core message",
    "core copy",
    "use copy",
}


def option_lists(bp):
    """
    Every governed option list on a screen, in sheet order.

    A screen that captures more than one field states one list per field, and
    the label varies: "Management Values" / "Impact Values" (S34), "Optional
    Barriers" (S61). Matching only on a "… Values" suffix missed S61 entirely
    and rendered its barrier control as nothing at all.

    Any Content-section row holding a semicolon-delimited list of more than one
    item is treated as an option list; prose rows are excluded by name.
    """
    lists = []
    for section, fields in bp["sections"].items():
        # Adaptive Logic uses list-shaped labels ("All Other Values") for
        # routing conditions, and its values are prose, not options.
        if "adaptive" in section.lower() or "content" not in section.lower():
            continue
        for key, raw in fields.items():
            k = key.strip().lower()
            if k in NOT_AN_OPTION_LIST or VARIANT_QUESTION.match(k) or not raw:
                continue
            values = split_values(raw)
            if len(values) > 1:
                label = re.sub(r"\s+values$", "", key.strip(), flags=re.I)
                lists.append({"label": label, "values": values})
    return lists


def value_groups(bp, capture_count):
    """
    Per-field option lists.

    Only grouped when the screen captures several fields AND states exactly one
    list per field. Many later screens list UI spec rows in the same section
    ("Controls", "Progress Stages", "Required Sections", "Prohibited Content") —
    those describe the component, not participant options, and must not become
    questions.
    """
    lists = option_lists(bp)
    if capture_count > 1 and len(lists) == capture_count:
        return lists
    return []


ROUTE_SUFFIX = re.compile(r"\s*(?:→|->|to)\s+S\d{2}\b.*$", re.I)


def action_label(raw):
    """
    Button label without the route notation.

    Several sheets write the primary action as "Continue → S14", which is the
    author telling the reader where the button goes. Rendered verbatim it puts a
    screen id on the participant's button.
    """
    return ROUTE_SUFFIX.sub("", (raw or "").strip()).strip() or "Continue"


def slug(label):
    s = label.strip().lower()
    s = s.replace("&", " and ")
    s = re.sub(r"[^a-z0-9]+", "_", s)
    return re.sub(r"_+", "_", s).strip("_")


def main():
    src = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_SRC
    if not os.path.exists(src):
        sys.exit(f"workbook not found: {src}")

    wb = openpyxl.load_workbook(src, data_only=True)
    screens = {}

    for ws in wb.worksheets:
        if not SCREEN_SHEET.match(ws.title):
            continue
        for bp in parse_panels(ws):
            sid = get(bp, "Master Screen ID") or bp["screenId"]
            allowed = get(bp, "Allowed Values")

            # Sheets follow one of two conventions: the richer v6.1 layout
            # ("Field ID", "DB Mapping", "Question", "Trust Card ID") or the
            # terser v6.3 one ("Field", "DB", "Participant Title", "Trust Card").
            db = get(bp, "DB Mapping", "DB")
            # "Fields" (plural) on multi-capture sheets; missing it dropped the
            # "[]" array markers and made every grouped list a single-select.
            field_raw = get(bp, "Field ID", "Fields") or get(bp, "Field", section="Observation")

            fields = [f.strip() for f in field_raw.split(";") if f.strip()]
            dbs = [d.strip() for d in db.split(";") if d.strip()]
            captures = []
            for i, target in enumerate(dbs or [""]):
                table, _, column = target.partition(".")
                fid = fields[i] if i < len(fields) else (column or "")
                captures.append({
                    "fieldId": fid.strip().lower(),
                    "dbTable": table.strip(),
                    "dbColumn": column.strip(),
                })
            captures = [c for c in captures if c["fieldId"] or c["dbColumn"]]

            options = split_values(allowed)
            screens[sid] = {
                "loerScreenId": sid,
                "sheet": ws.title,
                "scrId": get(bp, "Canonical Screen ID"),
                "canonicalName": get(bp, "Canonical Name"),
                "participantTitle": get(bp, "Question", "Participant Title"),
                "openingCopy": get(bp, "Opening Copy"),
                "acknowledgements": acknowledgements(bp),
                "variantQuestions": variant_questions(bp),
                "bodyCopy": body_copy(bp),
                "supportCopy": get(bp, "Support Copy"),
                "primaryAction": action_label(get(bp, "Primary Action")),
                "status": get(bp, "Status"),
                "version": get(bp, "Version"),
                "purpose": get(bp, "Purpose"),
                "inputType": get(bp, "Input Type"),
                "required": get(bp, "Required"),
                "validation": get(bp, "Validation"),
                "allowedValuesRaw": allowed,
                "options": [{"value": slug(o), "label": o} for o in options],
                "valueGroups": [
                    {"label": g["label"], "options": [{"value": slug(o), "label": o} for o in g["values"]]}
                    for g in value_groups(bp, len(captures))
                ],
                "observationId": get(bp, "Observation ID"),
                "captures": captures,
                "adaptiveRuleId": get(bp, "Rule ID"),
                "criticalRule": get(bp, "Critical Rule", "Important Boundary"),
                "route": get(bp, "Route"),
                "adaptive": bp["adaptive"],
                "trustCard": get(bp, "Trust Card ID", "Trust Card"),
                "aiDisclosure": get(bp, "AI Disclosure"),
                "qa": get(bp, "QA", "QA Focus"),
                "knowledge": get(bp, "Knowledge Assets", "Knowledge"),
                "reasoning": get(bp, "Reasoning Capabilities", "Reasoning"),
                "reflection": get(bp, "Reflection Types", "Reflection"),
                "technical": get(bp, "Technical Components", "Technical"),
            }

    payload = {
        "source": os.path.basename(src),
        "screenCount": len(screens),
        "screens": screens,
    }
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=1, ensure_ascii=False)
        f.write("\n")

    withopts = sum(1 for s in screens.values() if s["options"])
    withfield = sum(1 for s in screens.values() if s["captures"])
    withrules = sum(1 for s in screens.values() if s["adaptive"])
    print(f"parsed {len(screens)} screen sheets from {os.path.basename(src)}")
    print(f"  with capture fields  : {withfield}")
    print(f"  with allowed values  : {withopts}")
    print(f"  with adaptive rules  : {withrules}")
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()
