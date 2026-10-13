"""
make_pdf.py — render a partnership-kit markdown document to a branded PDF
"""

from __future__ import annotations

import sys
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (BaseDocTemplate, Frame, KeepTogether, PageBreak,
                                PageTemplate, Paragraph, Spacer, Table, TableStyle)

sys.path.insert(0, str(Path(__file__).parent))
from mdkit import BRAND, ARABIC_FONT, has_arabic, inline_rl, parse_blocks  # noqa: E402

PAGE_W, PAGE_H = A4
MARGIN = 18 * mm
FONT_DIR = Path(__file__).resolve().parent / "fonts"

# --------------------------------------------------------------- fonts
# Noto Naskh Arabic (SIL Open Font License) gives the PDF real Urdu glyphs.
_ARABIC_OK = False
try:
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont

    _ttf = FONT_DIR / "NotoNaskhArabic.ttf"
    if _ttf.exists():
        pdfmetrics.registerFont(TTFont(ARABIC_FONT, str(_ttf)))
        _ARABIC_OK = True
except Exception as exc:  # pragma: no cover
    print(f"  !! urdu font unavailable: {exc}")


def rl(text: str, size: float, bold_color: str | None = None) -> str:
    """Inline-render markdown, sizing Urdu text so it matches the Latin size."""
    return inline_rl(text, bold_color=bold_color,
                     arabic_size=(size * 1.06) if _ARABIC_OK else None)


def urdu_lines(text: str, size: float, max_w: float) -> list[str]:
    """Wrap Urdu/ RTL text ourselves, then shape each finished line.

    ReportLab wraps left-to-right, which reverses the reading order of a wrapped
    RTL paragraph. So we break the *logical* text into lines by measured width,
    then apply reshaping + bidi per finished line — which is what a browser or
    Word would show.
    """
    from reportlab.pdfbase import pdfmetrics
    from mdkit import _plain_text, shape_arabic

    plain = _plain_text(text)
    if not _ARABIC_OK:
        return [plain]

    font_size = size * 1.06
    words = plain.split()
    lines: list[str] = []
    cur: list[str] = []
    for w in words:
        trial = " ".join(cur + [w])
        try:
            width = pdfmetrics.stringWidth(shape_arabic(trial), ARABIC_FONT, font_size)
        except Exception:
            width = 0
        if cur and width > max_w:
            lines.append(shape_arabic(" ".join(cur)))
            cur = [w]
        else:
            cur.append(w)
    if cur:
        lines.append(shape_arabic(" ".join(cur)))
    return lines


def urdu_flow(text: str, style, size: float, max_w: float, gap: float = 3.0) -> list:
    """Build the platypus elements for one Urdu paragraph."""
    out = []
    lines = urdu_lines(text, size, max_w)
    for i, line in enumerate(lines):
        last = i == len(lines) - 1
        sty = ParagraphStyle(
            f"urtl{i}", parent=style,
            fontName=ARABIC_FONT if _ARABIC_OK else style.fontName,
            fontSize=size * 1.06 if _ARABIC_OK else size,
            leading=(size * 1.06) * 1.55,
            spaceAfter=style.spaceAfter if last else gap,
        )
        out.append(Paragraph(line, sty))
    return out


def c(h: str) -> colors.Color:
    return colors.HexColor(h)


def lerp(a: colors.Color, b: colors.Color, t: float) -> colors.Color:
    return colors.Color(
        a.red + (b.red - a.red) * t,
        a.green + (b.green - a.green) * t,
        a.blue + (b.blue - a.blue) * t,
    )


class Doc:
    def __init__(self, title: str, subtitle: str, tag: str):
        self.title = title
        self.subtitle = subtitle
        self.tag = tag
        self.flow: list = []

    # -------------------------------------------------------------- page art
    def cover(self, canv, doc) -> None:
        canv.saveState()
        # gradient band, top third
        steps = 90
        band_h = PAGE_H * 0.62
        for i in range(steps):
            t = i / (steps - 1)
            col = lerp(c(BRAND["violet_dark"]), c(BRAND["pink"]), t ** 1.25)
            canv.setFillColor(col)
            y = PAGE_H - band_h + (band_h * i / steps)
            canv.rect(0, y, PAGE_W, band_h / steps + 1, stroke=0, fill=1)
        # ink block bottom
        canv.setFillColor(c(BRAND["white"]))
        canv.rect(0, 0, PAGE_W, PAGE_H - band_h, stroke=0, fill=1)

        # brand mark
        canv.setFillColor(colors.Color(1, 1, 1, 0.16))
        canv.circle(PAGE_W - 34 * mm, PAGE_H - 40 * mm, 26 * mm, stroke=0, fill=1)
        canv.circle(PAGE_W - 14 * mm, PAGE_H - 24 * mm, 14 * mm, stroke=0, fill=1)

        canv.setFillColor(c(BRAND["white"]))
        canv.setFont("Helvetica-Bold", 13)
        canv.drawString(MARGIN, PAGE_H - 32 * mm, "DEVZARD")

        # title
        canv.setFont("Helvetica-Bold", 40)
        y = PAGE_H - 78 * mm
        for line in _wrap(self.title, 20):
            canv.drawString(MARGIN, y, line)
            y -= 14 * mm

        # subtitle
        canv.setFillColor(colors.Color(1, 1, 1, 0.92))
        canv.setFont("Helvetica", 13)
        y -= 2 * mm
        for line in _wrap(self.subtitle, 58):
            canv.drawString(MARGIN, y, line)
            y -= 7 * mm

        # white area content
        canv.setFillColor(c(BRAND["ink"]))
        canv.setFont("Helvetica-Bold", 12)
        canv.drawString(MARGIN, PAGE_H - band_h - 20 * mm, "Sales Partnership Program  ·  70 / 30 profit sharing")
        canv.setFillColor(c(BRAND["slate"]))
        canv.setFont("Helvetica-Oblique", 11)
        canv.drawString(MARGIN, PAGE_H - band_h - 28 * mm, "Devzard — Let's Build Together.")

        canv.setFillColor(c(BRAND["violet"]))
        canv.setFont("Helvetica-Bold", 10)
        canv.drawString(MARGIN, 24 * mm, self.tag.upper())
        canv.setStrokeColor(c(BRAND["line"]))
        canv.setLineWidth(1)
        canv.line(MARGIN, 34 * mm, PAGE_W - MARGIN, 34 * mm)
        canv.restoreState()

    def footer(self, canv, doc) -> None:
        canv.saveState()
        # top hairline + brand square
        canv.setFillColor(c(BRAND["violet"]))
        canv.rect(0, PAGE_H - 9 * mm, 24 * mm, 2.2 * mm, stroke=0, fill=1)
        canv.setFillColor(c(BRAND["pink"]))
        canv.rect(24 * mm, PAGE_H - 9 * mm, 12 * mm, 2.2 * mm, stroke=0, fill=1)
        # footer text
        canv.setFillColor(c(BRAND["slate"]))
        canv.setFont("Helvetica", 8)
        canv.drawString(MARGIN, 12 * mm, f"Devzard  ·  {self.tag}")
        canv.setFillColor(c(BRAND["violet"]))
        canv.setFont("Helvetica-Bold", 9)
        canv.drawRightString(PAGE_W - MARGIN, 12 * mm, f"{doc.page}")
        canv.restoreState()


def _wrap(text: str, width: int) -> list[str]:
    words = text.split()
    lines, cur = [], ""
    for w in words:
        if len(cur) + len(w) + 1 <= width:
            cur = f"{cur} {w}".strip()
        else:
            lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


def styles() -> dict:
    S = {}
    S["p"] = ParagraphStyle(
        "p", fontName="Helvetica", fontSize=9.8, leading=14.4,
        textColor=c("#1F2937"), spaceAfter=5, alignment=TA_LEFT,
    )
    S["h1"] = ParagraphStyle(
        "h1", fontName="Helvetica-Bold", fontSize=20, leading=24,
        textColor=c(BRAND["violet_dark"]), spaceBefore=6, spaceAfter=8,
    )
    S["h2"] = ParagraphStyle(
        "h2", fontName="Helvetica-Bold", fontSize=13.5, leading=17,
        textColor=c(BRAND["violet"]), spaceBefore=12, spaceAfter=5,
    )
    S["h3"] = ParagraphStyle(
        "h3", fontName="Helvetica-Bold", fontSize=11, leading=14,
        textColor=c(BRAND["ink"]), spaceBefore=9, spaceAfter=4,
    )
    S["h4"] = ParagraphStyle(
        "h4", fontName="Helvetica-Bold", fontSize=10, leading=13,
        textColor=c(BRAND["cyan"]), spaceBefore=8, spaceAfter=3,
    )
    S["quote"] = ParagraphStyle(
        "quote", fontName="Helvetica", fontSize=9.4, leading=13.6,
        textColor=c(BRAND["violet_dark"]), spaceAfter=3,
    )
    S["code"] = ParagraphStyle(
        "code", fontName="Courier", fontSize=8.4, leading=11.6,
        textColor=c("#A5F3FC"), spaceAfter=0,
    )
    S["cell"] = ParagraphStyle(
        "cell", fontName="Helvetica", fontSize=8.6, leading=11.6,
        textColor=c("#1F2937"), spaceAfter=0,
    )
    S["cellr"] = ParagraphStyle(
        "cellr", parent=S["cell"], alignment=2,
    )
    S["head"] = ParagraphStyle(
        "head", fontName="Helvetica-Bold", fontSize=8.8, leading=11.6,
        textColor=c(BRAND["white"]), spaceAfter=0,
    )
    S["headr"] = ParagraphStyle("headr", parent=S["head"], alignment=2)
    S["prtl"] = ParagraphStyle("prtl", parent=S["p"], alignment=2)
    S["quotertl"] = ParagraphStyle("quotertl", parent=S["quote"], alignment=2)
    S["bullet"] = ParagraphStyle(
        "bullet", parent=S["p"], leftIndent=12, bulletIndent=2, spaceAfter=3,
    )
    return S


def build_doc(md_path: Path, out_path: Path, title: str, subtitle: str, tag: str) -> None:
    blocks = parse_blocks(md_path.read_text(encoding="utf-8"))
    S = styles()
    d = Doc(title, subtitle, tag)

    doc = BaseDocTemplate(
        str(out_path), pagesize=A4,
        leftMargin=MARGIN, rightMargin=MARGIN, topMargin=16 * mm, bottomMargin=20 * mm,
        title=title, author="Devzard", subject="Sales Partnership Program",
    )
    frame = Frame(MARGIN, 20 * mm, PAGE_W - 2 * MARGIN, PAGE_H - 36 * mm, id="body",
                  leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
    doc.addPageTemplates([
        PageTemplate(id="cover", frames=[frame], onPage=d.cover),
        PageTemplate(id="body", frames=[frame], onPage=d.footer),
    ])

    flow: list = []
    avail = PAGE_W - 2 * MARGIN
    prev_h1 = False

    for b in blocks:
        if b.kind == "hr":
            flow.append(Spacer(1, 3))
            flow.append(Table([[""]], colWidths=[avail], rowHeights=[0.6],
                              style=TableStyle([("BACKGROUND", (0, 0), (-1, -1), c(BRAND["line"]))])))
            flow.append(Spacer(1, 6))
            prev_h1 = False
            continue

        if b.kind == "h":
            if b.level == 1 and prev_h1 is not None and len(flow) > 4:
                flow.append(PageBreak())
            sty = S["h1"] if b.level == 1 else S["h2"] if b.level == 2 else S["h3"] if b.level == 3 else S["h4"]
            txt = rl(b.text, sty.fontSize, bold_color=BRAND["pink"] if b.level == 1 else None)
            if b.level == 1:
                inner = Table(
                    [[Paragraph(txt, sty)]], colWidths=[avail],
                    style=TableStyle([
                        ("LEFTPADDING", (0, 0), (-1, -1), 0),
                        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                        ("TOPPADDING", (0, 0), (-1, -1), 0),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                        ("LINEBELOW", (0, 0), (-1, -1), 1.6, c(BRAND["pink"])),
                        ("LINEABOVE", (0, 0), (-1, -1), 0.8, c(BRAND["line"])),
                        ("TOPPADDING", (0, 0), (-1, -1), 8),
                    ]),
                )
                flow.append(Spacer(1, 4))
                flow.append(inner)
                flow.append(Spacer(1, 6))
                prev_h1 = True
            else:
                flow.append(Paragraph(txt, sty))
                prev_h1 = False
            continue

        if b.kind == "p":
            if has_arabic(b.text):
                flow.extend(urdu_flow(b.text, S["prtl"], S["p"].fontSize, avail))
            else:
                flow.append(Paragraph(rl(b.text, S["p"].fontSize), S["p"]))
            prev_h1 = False
            continue

        if b.kind == "quote":
            rows = []
            for line in b.text.split("\n"):
                line = line.strip()
                if not line:
                    continue
                if has_arabic(line):
                    inner = urdu_flow(line, S["quotertl"], S["quote"].fontSize,
                                      avail - 22, gap=2.5)
                    rows.append([inner])
                else:
                    rows.append([Paragraph(rl(line, S["quote"].fontSize), S["quote"])])
            if not rows:
                continue
            t = Table(rows, colWidths=[avail])
            t.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, -1), c(BRAND["tint"])),
                ("LINEBEFORE", (0, 0), (0, -1), 3.2, c(BRAND["violet"])),
                ("LEFTPADDING", (0, 0), (-1, -1), 9),
                ("RIGHTPADDING", (0, 0), (-1, -1), 9),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ]))
            flow.append(Spacer(1, 2))
            flow.append(t)
            flow.append(Spacer(1, 8))
            prev_h1 = False
            continue

        if b.kind == "code":
            rows = [[Paragraph(line.replace(" ", "&nbsp;") if line else "&nbsp;", S["code"])]
                    for line in b.text.split("\n")]
            t = Table(rows, colWidths=[avail])
            t.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, -1), c("#0F172A")),
                ("LEFTPADDING", (0, 0), (-1, -1), 10),
                ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                ("TOPPADDING", (0, 0), (-1, -1), 1),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 1),
            ]))
            flow.append(Spacer(1, 2))
            flow.append(t)
            flow.append(Spacer(1, 8))
            prev_h1 = False
            continue

        if b.kind in ("ul", "ol"):
            items = []
            for entry in b.items:
                if b.kind == "ul":
                    level, text = entry
                    bullet = ["\u2022", "\u2013", "\u25AA"][level]
                else:
                    num, text = entry
                    level = 0
                    bullet = f"{num}."
                sty = ParagraphStyle(
                    f"li{level}", parent=S["bullet"],
                    leftIndent=12 + 14 * level, bulletIndent=1 + 14 * level,
                )
                if has_arabic(text):
                    sty = ParagraphStyle(f"lirtl{level}", parent=sty, alignment=2)
                items.append(Paragraph(rl(text, S["bullet"].fontSize), sty, bulletText=bullet))
            flow.append(Spacer(1, 1))
            flow.extend(items)
            flow.append(Spacer(1, 5))
            prev_h1 = False
            continue

        if b.kind == "table":
            ncols = len(b.headers)
            if ncols == 0:
                continue
            headless = all(not str(h).strip() for h in b.headers)
            first_w = 1.35 if ncols > 2 else 1.0
            rest_w = [1.0] * (ncols - 1)
            total = first_w + sum(rest_w)
            widths = [avail * first_w / total] + [avail * w / total for w in rest_w]
            if ncols == 2:
                widths = [avail * 0.52, avail * 0.48]
            data = []
            if not headless:
                data.append([Paragraph(rl(h, S["head"].fontSize),
                                       S["headr"] if (b.aligns[j] if j < len(b.aligns) else "left") == "right" else S["head"])
                             for j, h in enumerate(b.headers)])
            for row in b.rows:
                data.append([
                    Paragraph(rl(row[j] if j < len(row) else "", S["cell"].fontSize),
                              S["cellr"] if (b.aligns[j] if j < len(b.aligns) else "left") == "right" else S["cell"])
                    for j in range(ncols)
                ])
            t = Table(data, colWidths=widths, repeatRows=0 if headless else 1)
            style = [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 4.5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4.5),
                ("LINEBELOW", (0, 0), (-1, -1), 0.4, c(BRAND["line"])),
                ("BOX", (0, 0), (-1, -1), 0.5, c(BRAND["line"])),
            ]
            if not headless:
                style.append(("BACKGROUND", (0, 0), (-1, 0), c(BRAND["violet_dark"])))
                style.append(("LINEBELOW", (0, 0), (-1, 0), 0.8, c(BRAND["violet_dark"])))
                offset = 1
            else:
                offset = 0
            for k in range(offset, len(data)):
                if (k - offset) % 2 == 1:
                    style.append(("BACKGROUND", (0, k), (-1, k), c(BRAND["tint"])))
            t.setStyle(TableStyle(style))
            flow.append(Spacer(1, 2))
            flow.append(t)
            flow.append(Spacer(1, 9))
            prev_h1 = False
            continue

    # render cover template then body template
    def build_pages():
        doc.handle_pageBegin()
        for f in flow:
            yield f

    story = flow
    doc.build(_CoverFirst(story))
    print(f"  pdf   → {out_path.name}")


class _CoverFirst(list):
    """Wrap the story so the first page uses the 'cover' template and the rest 'body'."""

    def __init__(self, flow):
        super().__init__()
        # first element must trigger the cover template
        from reportlab.platypus import NextPageTemplate
        self.extend([NextPageTemplate("body"), PageBreak()] + flow)


if __name__ == "__main__":
    build_doc(Path(sys.argv[1]), Path(sys.argv[2]), sys.argv[3], sys.argv[4], sys.argv[5] if len(sys.argv) > 5 else "")
