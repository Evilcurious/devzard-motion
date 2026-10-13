"""
mdkit.py — a small markdown parser shared by the Devzard document builders.

Parses the subset of markdown used across the partnership kit into a list of
blocks, plus an inline tokeniser, so that every output format (DOCX, PDF, HTML)
renders the same source consistently.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

# ----------------------------------------------------------------------------
# Brand
# ----------------------------------------------------------------------------

BRAND = {
    "violet": "#6D28D9",
    "violet_dark": "#4C1D95",
    "pink": "#EC4899",
    "cyan": "#0891B2",
    "ink": "#120B2E",
    "slate": "#4B5563",
    "line": "#E5E1F5",
    "tint": "#F5F3FF",
    "tint2": "#FDF2F8",
    "white": "#FFFFFF",
}


# ----------------------------------------------------------------------------
# Block model
# ----------------------------------------------------------------------------


@dataclass
class Block:
    kind: str  # h, p, ul, ol, table, quote, code, hr
    level: int = 0
    text: str = ""
    items: list = field(default_factory=list)
    headers: list = field(default_factory=list)
    rows: list = field(default_factory=list)
    aligns: list = field(default_factory=list)


SEP_RE = re.compile(r"^\|[\s:\-|]+\|$")
FENCE_RE = re.compile(r"^```")
OL_RE = re.compile(r"^(\d+)[.)]\s+(.*)$")
UL_RE = re.compile(r"^(\s*)[-*+]\s+(.*)$")


def _split_row(line: str) -> list[str]:
    line = line.strip()
    if line.startswith("|"):
        line = line[1:]
    if line.endswith("|"):
        line = line[:-1]
    return [c.strip() for c in line.split("|")]


def _align_of(cell: str) -> str:
    left = cell.startswith(":")
    right = cell.endswith(":")
    if left and right:
        return "center"
    if right:
        return "right"
    return "left"


def parse_blocks(md: str) -> list[Block]:
    lines = md.replace("\r\n", "\n").split("\n")
    blocks: list[Block] = []
    i = 0
    n = len(lines)

    while i < n:
        line = lines[i]
        stripped = line.strip()

        # blank
        if not stripped:
            i += 1
            continue

        # horizontal rule
        if re.fullmatch(r"(-{3,}|\*{3,}|_{3,})", stripped):
            blocks.append(Block("hr"))
            i += 1
            continue

        # code fence
        if FENCE_RE.match(stripped):
            i += 1
            buf = []
            while i < n and not FENCE_RE.match(lines[i].strip()):
                buf.append(lines[i])
                i += 1
            i += 1  # closing fence
            blocks.append(Block("code", text="\n".join(buf).strip("\n")))
            continue

        # heading
        m = re.match(r"^(#{1,6})\s+(.*)$", stripped)
        if m:
            blocks.append(Block("h", level=len(m.group(1)), text=m.group(2).strip()))
            i += 1
            continue

        # table
        if stripped.startswith("|") and i + 1 < n and SEP_RE.match(lines[i + 1].strip()):
            headers = _split_row(stripped)
            aligns = [_align_of(c) for c in _split_row(lines[i + 1].strip())]
            i += 2
            rows = []
            while i < n and lines[i].strip().startswith("|"):
                rows.append(_split_row(lines[i]))
                i += 1
            blocks.append(Block("table", headers=headers, rows=rows, aligns=aligns))
            continue

        # blockquote (may span lines)
        if stripped.startswith(">"):
            buf = []
            while i < n and lines[i].strip().startswith(">"):
                buf.append(re.sub(r"^\s*>\s?", "", lines[i]))
                i += 1
            text = "\n".join(buf).strip()
            blocks.append(Block("quote", text=text))
            continue

        # ordered list
        m = OL_RE.match(stripped)
        if m:
            items = []
            while i < n:
                mm = OL_RE.match(lines[i].strip())
                if not mm:
                    # continuation line
                    if items and lines[i].strip() and not lines[i].strip().startswith(("#", "|", ">")) \
                            and not UL_RE.match(lines[i]) and not re.fullmatch(r"(-{3,})", lines[i].strip()):
                        items[-1] = (items[-1][0], items[-1][1] + " " + lines[i].strip())
                        i += 1
                        continue
                    break
                items.append((int(mm.group(1)), mm.group(2).strip()))
                i += 1
            blocks.append(Block("ol", items=items))
            continue

        # unordered list
        m = UL_RE.match(line)
        if m:
            items = []
            while i < n:
                mm = UL_RE.match(lines[i])
                if not mm:
                    if items and lines[i].strip() and not lines[i].strip().startswith(("#", "|", ">")) \
                            and not OL_RE.match(lines[i].strip()) and not re.fullmatch(r"(-{3,})", lines[i].strip()):
                        items[-1] = (items[-1][0], items[-1][1] + " " + lines[i].strip())
                        i += 1
                        continue
                    break
                indent = len(mm.group(1).replace("\t", "  "))
                level = min(indent // 2, 2)
                items.append((level, mm.group(2).strip()))
                i += 1
            blocks.append(Block("ul", items=items))
            continue

        # paragraph (join until blank / structural line)
        buf = [stripped]
        i += 1
        while i < n:
            nxt = lines[i].strip()
            if (not nxt or nxt.startswith(("#", "|", ">")) or UL_RE.match(lines[i])
                    or OL_RE.match(nxt) or FENCE_RE.match(nxt)
                    or re.fullmatch(r"(-{3,}|\*{3,}|_{3,})", nxt)):
                break
            buf.append(nxt)
            i += 1
        blocks.append(Block("p", text=" ".join(buf)))

    return blocks


# ----------------------------------------------------------------------------
# Inline tokeniser
# ----------------------------------------------------------------------------

INLINE_RE = re.compile(
    r"(\*\*.+?\*\*"          # bold
    r"|__.+?__"              # bold alt
    r"|`[^`]+?`"             # code
    r"|(?<![\w*])\*[^*\n]+?\*(?![\w*])"  # italic
    r"|\[[^\]]+\]\([^)]+\)"  # link
    r")"
)


def tokenize(text: str) -> list[tuple[str, str]]:
    """Return a list of (kind, text) where kind is text|bold|italic|code|link."""
    out: list[tuple[str, str]] = []
    pos = 0
    for m in INLINE_RE.finditer(text):
        if m.start() > pos:
            out.append(("text", text[pos:m.start()]))
        tok = m.group(0)
        if tok.startswith("**") or tok.startswith("__"):
            out.append(("bold", tok[2:-2]))
        elif tok.startswith("`"):
            out.append(("code", tok[1:-1]))
        elif tok.startswith("["):
            label, url = re.match(r"\[([^\]]+)\]\(([^)]+)\)", tok).groups()
            out.append(("link", f"{label}|{url}"))
        else:
            out.append(("italic", tok[1:-1]))
        pos = m.end()
    if pos < len(text):
        out.append(("text", text[pos:]))
    return out or [("text", text)]


def plain(text: str) -> str:
    return "".join(t for _, t in tokenize(text)).replace("|", "|")


# ----------------------------------------------------------------------------
# HTML helper for inline rendering
# ----------------------------------------------------------------------------

def inline_html(text: str) -> str:
    if has_arabic(text):
        # let the browser do shaping + bidi; just strip inline markup
        esc = (_plain_text(text).replace("&", "&amp;")
               .replace("<", "&lt;").replace(">", "&gt;"))
        return esc
    parts = []
    for kind, val in tokenize(text):
        esc = (
            val.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        )
        if kind == "bold":
            parts.append(f"<strong>{esc}</strong>")
        elif kind == "italic":
            parts.append(f"<em>{esc}</em>")
        elif kind == "code":
            parts.append(f"<code>{esc}</code>")
        elif kind == "link":
            label, url = val.split("|", 1)
            parts.append(
                f'<a href="{url.replace("&", "&amp;")}">'
                f'{label.replace("&", "&amp;").replace("<", "&lt;")}</a>'
            )
        else:
            parts.append(esc)
    return "".join(parts)


# ----------------------------------------------------------------------------
# ReportLab helper for inline rendering
# ----------------------------------------------------------------------------

def _rl_escape(s: str) -> str:
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


ARABIC_RE = re.compile(r"[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]")
ARABIC_FONT = "NotoNaskhArabic"


def has_arabic(text: str) -> bool:
    return bool(ARABIC_RE.search(text))


def shape_arabic(text: str) -> str:
    """Reshape Arabic/Urdu text into presentation forms and reorder for LTR drawing."""
    try:
        import arabic_reshaper
        from bidi.algorithm import get_display
    except ImportError:  # pragma: no cover - shaping libs are optional
        return text
    try:
        return get_display(arabic_reshaper.reshape(text))
    except Exception:  # pragma: no cover
        return text


def _plain_text(text: str) -> str:
    """Strip inline markup; links collapse to their label."""
    out = []
    for kind, val in tokenize(text):
        if kind == "link":
            out.append(val.split("|", 1)[0])
        else:
            out.append(val)
    return "".join(out)


def inline_rl(text: str, bold_color: str | None = None, base_font: str = "Helvetica",
              arabic_size: float | None = None) -> str:
    # Arabic/Urdu needs shaping AND bidi reordering across the whole line, not
    # per-token — otherwise mixed Urdu + Latin sentences come out scrambled.
    if has_arabic(text):
        sz = f' size="{arabic_size:.1f}"' if arabic_size else ""
        shaped = _rl_escape(shape_arabic(_plain_text(text)))
        for kind, val in tokenize(text):
            if kind == "bold" and val and val in shaped:
                shaped = shaped.replace(val, f"<b>{val}</b>", 1)
        return f'<font name="{ARABIC_FONT}"{sz}>{shaped}</font>'

    parts = []
    for kind, val in tokenize(text):
        esc = _rl_escape(val)
        if kind == "bold":
            if bold_color:
                parts.append(f'<font color="{bold_color}"><b>{esc}</b></font>')
            else:
                parts.append(f"<b>{esc}</b>")
        elif kind == "italic":
            parts.append(f"<i>{esc}</i>")
        elif kind == "code":
            parts.append(f'<font face="Courier" size="9">{esc}</font>')
        elif kind == "link":
            label, url = val.split("|", 1)
            parts.append(f'<link href="{_rl_escape(url)}"><font color="#6D28D9">{_rl_escape(label)}</font></link>')
        else:
            parts.append(esc)
    return "".join(parts)


def num_pages_placeholder() -> str:
    return ""


def heading_plain(text: str) -> str:
    """Heading text with inline markup stripped, for PDF bookmarks."""
    return "".join(v for _, v in tokenize(text))
