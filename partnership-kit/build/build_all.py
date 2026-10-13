"""
build_all.py — build every export in the Devzard partnership kit from markdown.

    python3 build/build_all.py

Outputs:
    exports/pdf/*.pdf
    exports/docx/*.docx
    exports/html/*.html
    exports/xlsx/Devzard-Commission-Calculator.xlsx
    index.html            (hub page linking everything)
"""

from __future__ import annotations

import shutil
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
sys.path.insert(0, str(HERE))

import make_calculator  # noqa: E402
import make_docx  # noqa: E402
import make_pdf  # noqa: E402
from make_html import CSS, render  # noqa: E402

DOCS = [
    {
        "src": "01-program-overview.md",
        "stem": "Devzard-Sales-Partnership-Program-Overview",
        "title": "Sales Partnership Program",
        "subtitle": "Find clients, introduce Devzard, earn 30% of the net profit on every deal you close. "
                    "No technical skills required — we handle the building.",
        "tag": "Program overview",
        "blurb": "The complete pitch: what the program is, what you do, what Devzard does, the 70/30 split, "
                 "the 60-day trial and the answers to every question a prospective partner asks.",
        "pdf_page": "partnership-kit",
    },
    {
        "src": "02-partner-agreement.md",
        "stem": "Devzard-Sales-Partnership-Agreement",
        "title": "Sales Partnership Agreement",
        "subtitle": "The binding terms — 70/30 split, lead protection, expense approval, payout timing, "
                    "tail protection and dispute resolution. Fill in the blanks and sign.",
        "tag": "Contract template",
        "blurb": "A complete, editable partnership agreement with a plain-language summary, five schedules "
                 "and a signature page. Reviewed clause by clause so a partner can see exactly what protects them.",
        "pdf_page": "partnership-kit",
    },
    {
        "src": "03-commission-guide.md",
        "stem": "Devzard-Commission-and-Net-Profit-Guide",
        "title": "Commission & Net Profit Guide",
        "subtitle": "Every rupee explained — what counts as a project expense, what never does, eight worked "
                    "examples, payout timing and how to verify any number we send you.",
        "tag": "Money guide",
        "blurb": "The transparency document. Eight worked examples from a PKR 20,000 landing page to a "
                 "PKR 650,000 web application, plus the four expense rules and the payout timeline.",
        "pdf_page": "partnership-kit",
    },
    {
        "src": "04-outreach-playbook.md",
        "stem": "Devzard-Outreach-Playbook",
        "title": "Outreach Playbook",
        "subtitle": "Who to contact, exactly what to send in English and Urdu, how to qualify, how to handle "
                    "objections, and the weekly rhythm that produces deals.",
        "tag": "Field guide",
        "blurb": "The practical weapon: 12 target segments, ready-to-send WhatsApp, LinkedIn and email "
                 "templates, a five-stage follow-up sequence and answers to the ten objections you will hear.",
        "pdf_page": "partnership-kit",
    },
    {
        "src": "05-onboarding-checklist.md",
        "stem": "Devzard-Partner-Onboarding-Checklist",
        "title": "Partner Onboarding Checklist",
        "subtitle": "From signature to first commission — a day-by-day 60-day plan with owners, targets and a "
                    "trial review that decides what happens next.",
        "tag": "Get started",
        "blurb": "Everything that must happen between yes and the first payout: the setup list, the onboarding "
                 "agenda, week-one actions and the day-60 review sheet.",
        "pdf_page": "partnership-kit",
    },
]


def hub_page(base: str = "", nested: bool = False) -> str:
    """base: path prefix from the hub page to the kit root ("", "../", ...)."""
    def link(kind: str, stem: str, ext: str) -> str:
        # the nested hub already lives inside exports/, so it needs one level up
        if kind == "html" and nested:
            return f"{stem}.html"          # sits alongside this hub
        prefix = base if nested else "exports/"
        return f"{prefix}{kind}/{stem}.{ext}"

    cards = []
    for i, d in enumerate(DOCS, start=1):
        stem = d["stem"]
        cards.append(f"""
    <article class="card">
      <span class="num">0{i}</span>
      <h3>{d['title']}</h3>
      <p>{d['blurb']}</p>
      <div class="links">
        <a class="btn primary" href="{link('html', stem, 'html')}">Read online</a>
        <a class="btn" href="{link('pdf', stem, 'pdf')}">PDF</a>
        <a class="btn" href="{link('docx', stem, 'docx')}">Word</a>
      </div>
    </article>""")
    cards.append(f"""
    <article class="card wide">
      <span class="num">06</span>
      <h3>Commission Calculator &amp; Payout Tracker</h3>
      <p>A live Excel workbook: enter client revenue and expense lines to get net profit, Devzard's 70% and
         your 30% instantly. Includes eight worked examples, a payout tracker with running totals and the
         full rates-and-rules reference.</p>
      <div class="links">
        <a class="btn primary" href="{link('xlsx', 'Devzard-Commission-Calculator', 'xlsx')}">Download workbook</a>
      </div>
    </article>""")
    cards_html = chr(10).join(cards)
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Devzard Sales Partnership Program — Partner Kit</title>
<style>{CSS}
.grid{{display:grid;grid-template-columns:1fr 1fr;gap:22px;margin-top:-30px}}
@media(max-width:760px){{.grid{{grid-template-columns:1fr}}}}
.card{{
  position:relative;background:#fff;border:1px solid var(--line);border-radius:20px;padding:26px 26px 22px;
  box-shadow:0 22px 50px -36px rgba(76,29,149,.55);display:flex;flex-direction:column
}}
.card.wide{{grid-column:1/-1}}
.card .num{{
  position:absolute;top:18px;right:22px;font-weight:800;font-size:26px;color:var(--line);letter-spacing:-.02em
}}
.card h3{{margin:0 0 10px;font-size:20px;color:var(--violet-dark);font-weight:800}}
.card p{{margin:0 0 18px;color:var(--slate);font-size:15px}}
.links{{display:flex;gap:9px;flex-wrap:wrap;margin-top:auto}}
.btn{{
  border:1.5px solid var(--line);border-radius:10px;padding:9px 15px;font-size:14px;font-weight:650;
  color:var(--violet-dark);border-bottom:1.5px solid var(--line)
}}
.btn:hover{{border-color:var(--pink);color:var(--pink)}}
.btn.primary{{background:linear-gradient(135deg,#6D28D9,#EC4899);color:#fff;border-color:transparent}}
.btn.primary:hover{{color:#fff;opacity:.92}}
.stat-row{{display:flex;gap:14px;flex-wrap:wrap;margin:34px 0 44px}}
.stat{{flex:1 1 170px;background:#fff;border:1px solid var(--line);border-radius:16px;padding:18px 20px}}
.stat b{{display:block;font-size:27px;color:var(--violet);font-weight:800;letter-spacing:-.02em}}
.stat span{{font-size:13.5px;color:var(--slate)}}
.note{{background:var(--tint);border-left:5px solid var(--violet);border-radius:0 14px 14px 0;padding:18px 22px;margin:34px 0;color:var(--violet-dark);font-size:15px}}
</style>
</head>
<body>
<header class="hero">
  <div class="wrap">
    <p class="brand">Devzard</p>
    <h1>Sales Partnership Program</h1>
    <p class="sub">Find clients. Introduce Devzard. Earn <strong style="color:#fff">30% of the net profit</strong>
    on every deal you close — while our team handles all the technical work.</p>
    <div class="badges">
      <span class="badge hot">70 / 30 profit share</span>
      <span class="badge">No coding required</span>
      <span class="badge">60-day trial</span>
      <span class="badge">Non-exclusive</span>
      <span class="badge">No joining fee</span>
    </div>
  </div>
</header>
<main>
  <div class="stat-row">
    <div class="stat"><b>30%</b><span>to the sales partner on every successful project</span></div>
    <div class="stat"><b>PKR 4,500</b><span>on the reference deal: PKR 15,000 net profit</span></div>
    <div class="stat"><b>7 days</b><span>payout window after payment clears and delivery lands</span></div>
    <div class="stat"><b>60 days</b><span>trial, with a written review at the end</span></div>
  </div>
  <div class="grid">{cards_html}
  </div>
  <div class="note">
    <strong>Partner kit contents.</strong> Five documents and one live workbook — the pitch, the contract, the
    money rules, the outreach templates and the onboarding plan. Everything is editable: the DOCX files are
    ready for legal review, the PDFs are ready to send, and the workbook calculates real deals.
  </div>
  <div class="note" style="border-left-color:var(--pink);background:var(--tint2)">
    <strong>Illustrative figures.</strong> All amounts shown are examples based on the reference deal of
    PKR 20,000 revenue and PKR 5,000 expenses. Actual profits vary with each project's price, scope and
    expenses, and partner earnings depend entirely on successful deals brought in. Nothing here is a
    guarantee of income.
  </div>
</main>
<footer>
  <strong>Devzard — Let's Build Together.</strong><br>
  Sales Partnership Program · 70/30 profit sharing
</footer>
</body>
</html>
"""


def main() -> None:
    exports = ROOT / "exports"
    for sub in ("pdf", "docx", "html", "xlsx"):
        (exports / sub).mkdir(parents=True, exist_ok=True)

    print("Building Devzard partnership kit …")
    for d in DOCS:
        src = ROOT / d["src"]
        if not src.exists():
            print(f"  !! missing {src.name}")
            continue
        stem = d["stem"]
        make_pdf.build_doc(src, exports / "pdf" / f"{stem}.pdf",
                           d["title"], d["subtitle"], d["tag"])
        make_docx.build(src, exports / "docx" / f"{stem}.docx",
                        d["title"], d["subtitle"])
        render(src.read_text(encoding="utf-8"),
               d["title"], d["subtitle"], d["tag"],
               exports / "html" / f"{stem}.html", back="../../index.html")

    make_calculator.build(exports / "xlsx" / "Devzard-Commission-Calculator.xlsx")

    (ROOT / "index.html").write_text(hub_page(), encoding="utf-8")
    print("  html  → index.html (kit hub)")

    # the same hub inside exports/html, with links rewritten for that depth
    (exports / "html" / "index.html").write_text(
        hub_page(base="../", nested=True), encoding="utf-8")
    print("  html  → exports/html/index.html (hub copy)")

    print("\nDone. Exports in partnership-kit/exports/")


if __name__ == "__main__":
    main()
