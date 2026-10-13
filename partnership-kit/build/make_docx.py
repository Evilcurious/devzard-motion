"""
make_docx.py — render a partnership-kit markdown document to a branded .docx
"""

from __future__ import annotations

import sys
from pathlib import Path

from docx import Document
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor

sys.path.insert(0, str(Path(__file__).parent))
from mdkit import BRAND, Block, has_arabic, parse_blocks, tokenize  # noqa: E402


def hexrgb(h: str) -> RGBColor:
    h = h.lstrip("#")
    return RGBColor(int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))


def shade(cell, hex_color: str) -> None:
    tcPr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), hex_color.lstrip("#"))
    tcPr.append(shd)


def set_cell_margins(cell, top=60, start=100, bottom=60, end=100):
    tcPr = cell._tc.get_or_add_tcPr()
    mar = OxmlElement("w:tcMar")
    for tag, val in (("top", top), ("start", start), ("bottom", bottom), ("end", end)):
        e = OxmlElement(f"w:{tag}")
        e.set(qn("w:w"), str(val))
        e.set(qn("w:type"), "dxa")
        mar.append(e)
    tcPr.append(mar)


def add_bottom_border(par, color: str, size: int = 12) -> None:
    pPr = par._p.get_or_add_pPr()
    pbdr = OxmlElement("w:pBdr")
    b = OxmlElement("w:bottom")
    b.set(qn("w:val"), "single")
    b.set(qn("w:sz"), str(size))
    b.set(qn("w:space"), "4")
    b.set(qn("w:color"), color.lstrip("#"))
    pbdr.append(b)
    pPr.append(pbdr)


def set_rtl(par) -> None:
    """Mark a paragraph as right-to-left so Word shapes Urdu correctly."""
    pPr = par._p.get_or_add_pPr()
    bidi = OxmlElement("w:bidi")
    pPr.append(bidi)
    par.alignment = WD_ALIGN_PARAGRAPH.RIGHT


def write_runs(par, text: str, size: int = 10.5, color: str | None = None,
               font: str = "Calibri") -> None:
    for kind, val in tokenize(text):
        run = par.add_run(val)
        run.font.name = font
        run.font.size = Pt(size)
        if kind == "bold":
            run.bold = True
            run.font.color.rgb = hexrgb(color or BRAND["violet_dark"])
        elif kind == "italic":
            run.italic = True
        elif kind == "code":
            run.font.name = "Consolas"
            run.font.size = Pt(size - 1)
            run.font.color.rgb = hexrgb(BRAND["pink"])
        else:
            if color:
                run.font.color.rgb = hexrgb(color)
        # ensure east-asian font mapping so Word doesn't substitute
        rPr = run._element.get_or_add_rPr()
        rFonts = rPr.find(qn("w:rFonts"))
        if rFonts is None:
            rFonts = OxmlElement("w:rFonts")
            rPr.append(rFonts)
        rFonts.set(qn("w:ascii"), run.font.name or font)
        rFonts.set(qn("w:hAnsi"), run.font.name or font)


def build(md_path: Path, out_path: Path, title: str, subtitle: str) -> None:
    md = md_path.read_text(encoding="utf-8")
    blocks = parse_blocks(md)

    doc = Document()

    # base style
    normal = doc.styles["Normal"]
    normal.font.name = "Calibri"
    normal.font.size = Pt(10.5)
    normal.font.color.rgb = hexrgb("#1F2937")
    normal.paragraph_format.space_after = Pt(8)
    normal.paragraph_format.line_spacing = 1.12
    for sec in doc.sections:
        sec.top_margin = Inches(0.85)
        sec.bottom_margin = Inches(0.8)
        sec.left_margin = Inches(0.85)
        sec.right_margin = Inches(0.85)

    # ---------------- cover ----------------
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(90)
    r = p.add_run("DEVZARD")
    r.font.size = Pt(13)
    r.bold = True
    r.font.color.rgb = hexrgb(BRAND["pink"])

    p = doc.add_paragraph()
    r = p.add_run(title)
    r.font.size = Pt(38)
    r.bold = True
    r.font.color.rgb = hexrgb(BRAND["violet_dark"])

    p = doc.add_paragraph()
    r = p.add_run(subtitle)
    r.font.size = Pt(13)
    r.font.color.rgb = hexrgb(BRAND["slate"])
    add_bottom_border(p, BRAND["violet"], 18)

    p = doc.add_paragraph()
    r = p.add_run("Sales Partnership Program  ·  70 / 30 profit sharing")
    r.font.size = Pt(11)
    r.bold = True
    r.font.color.rgb = hexrgb(BRAND["cyan"])

    p = doc.add_paragraph()
    r = p.add_run("Devzard — Let's Build Together.")
    r.font.size = Pt(11)
    r.italic = True
    r.font.color.rgb = hexrgb(BRAND["slate"])

    doc.add_paragraph().add_run().add_break(WD_BREAK.PAGE)

    # ---------------- body ----------------
    for b in blocks:
        if b.kind == "hr":
            p = doc.add_paragraph()
            p.paragraph_format.space_before = Pt(2)
            p.paragraph_format.space_after = Pt(6)
            add_bottom_border(p, BRAND["line"], 8)
            continue

        if b.kind == "h":
            if b.level == 1:
                # top-level heading → start a new page (except the very first)
                if len(doc.paragraphs) > 8:
                    doc.add_paragraph().add_run().add_break(WD_BREAK.PAGE)
                p = doc.add_paragraph()
                p.paragraph_format.space_before = Pt(16)
                p.paragraph_format.space_after = Pt(4)
                r = p.add_run(b.text)
                r.font.size = Pt(22)
                r.bold = True
                r.font.color.rgb = hexrgb(BRAND["violet_dark"])
                add_bottom_border(p, BRAND["pink"], 14)
            elif b.level == 2:
                p = doc.add_paragraph()
                p.paragraph_format.space_before = Pt(16)
                p.paragraph_format.space_after = Pt(4)
                r = p.add_run(b.text)
                r.font.size = Pt(15)
                r.bold = True
                r.font.color.rgb = hexrgb(BRAND["violet"])
            elif b.level == 3:
                p = doc.add_paragraph()
                p.paragraph_format.space_before = Pt(11)
                p.paragraph_format.space_after = Pt(3)
                r = p.add_run(b.text)
                r.font.size = Pt(12)
                r.bold = True
                r.font.color.rgb = hexrgb(BRAND["ink"])
            else:
                p = doc.add_paragraph()
                p.paragraph_format.space_before = Pt(9)
                r = p.add_run(b.text)
                r.font.size = Pt(11)
                r.bold = True
                r.font.color.rgb = hexrgb(BRAND["cyan"])
            continue

        if b.kind == "p":
            p = doc.add_paragraph()
            if has_arabic(b.text):
                set_rtl(p)
            write_runs(p, b.text)
            continue

        if b.kind == "quote":
            tbl = doc.add_table(rows=1, cols=1)
            tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
            cell = tbl.rows[0].cells[0]
            shade(cell, BRAND["tint"])
            set_cell_margins(cell, 120, 160, 120, 160)
            cell.text = ""
            first = True
            for line in b.text.split("\n"):
                line = line.strip()
                if not line:
                    continue
                par = cell.paragraphs[0] if first else cell.add_paragraph()
                first = False
                par.paragraph_format.space_after = Pt(4)
                if has_arabic(line):
                    set_rtl(par)
                write_runs(par, line, size=10)
            doc.add_paragraph().paragraph_format.space_after = Pt(2)
            continue

        if b.kind == "code":
            tbl = doc.add_table(rows=1, cols=1)
            cell = tbl.rows[0].cells[0]
            shade(cell, "#0F172A")
            set_cell_margins(cell, 120, 160, 120, 160)
            cell.text = ""
            for idx, line in enumerate(b.text.split("\n")):
                par = cell.paragraphs[0] if idx == 0 else cell.add_paragraph()
                par.paragraph_format.space_after = Pt(0)
                r = par.add_run(line if line else " ")
                r.font.name = "Consolas"
                r.font.size = Pt(9.5)
                r.font.color.rgb = hexrgb("#A5F3FC")
            doc.add_paragraph().paragraph_format.space_after = Pt(2)
            continue

        if b.kind in ("ul", "ol"):
            for idx, item in enumerate(b.items):
                if b.kind == "ul":
                    level, text = item
                    bullet = ["\u2022", "\u25E6", "\u25AA"][level]
                else:
                    level = 0
                    num, text = item
                    bullet = f"{num}."
                p = doc.add_paragraph()
                p.paragraph_format.left_indent = Inches(0.22 + 0.24 * level)
                p.paragraph_format.first_line_indent = Inches(-0.22)
                p.paragraph_format.space_after = Pt(3)
                r = p.add_run(f"{bullet}  ")
                r.font.color.rgb = hexrgb(BRAND["violet"])
                r.bold = True
                r.font.size = Pt(10.5)
                if has_arabic(text):
                    set_rtl(p)
                write_runs(p, text)
            doc.add_paragraph().paragraph_format.space_after = Pt(2)
            continue

        if b.kind == "table":
            ncols = len(b.headers)
            headless = all(not str(h).strip() for h in b.headers)
            tbl = doc.add_table(rows=0, cols=ncols)
            tbl.style = "Table Grid"
            tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
            if headless:
                tbl.rows  # no header row
            else:
                hdr = tbl.add_row()
                for j, h in enumerate(b.headers):
                    cell = hdr.cells[j]
                    shade(cell, BRAND["violet_dark"])
                    set_cell_margins(cell)
                    cell.text = ""
                    par = cell.paragraphs[0]
                    par.paragraph_format.space_after = Pt(0)
                    r = par.add_run(h)
                    r.bold = True
                    r.font.size = Pt(9.5)
                    r.font.color.rgb = hexrgb(BRAND["white"])
                    if (b.aligns[j] if j < len(b.aligns) else "left") == "right":
                        par.alignment = WD_ALIGN_PARAGRAPH.RIGHT
            for k, row in enumerate(b.rows):
                cells = tbl.add_row().cells
                for j in range(ncols):
                    cell = cells[j]
                    if k % 2 == 1:
                        shade(cell, BRAND["tint"])
                    set_cell_margins(cell)
                    cell.text = ""
                    par = cell.paragraphs[0]
                    par.paragraph_format.space_after = Pt(0)
                    val = row[j] if j < len(row) else ""
                    if has_arabic(val):
                        set_rtl(par)
                    write_runs(par, val, size=9.5)
                    if (b.aligns[j] if j < len(b.aligns) else "left") == "right":
                        par.alignment = WD_ALIGN_PARAGRAPH.RIGHT
            doc.add_paragraph().paragraph_format.space_after = Pt(2)
            continue

    out_path.parent.mkdir(parents=True, exist_ok=True)
    doc.save(str(out_path))
    print(f"  docx  → {out_path.name}")


if __name__ == "__main__":
    build(Path(sys.argv[1]), Path(sys.argv[2]), sys.argv[3], sys.argv[4])
