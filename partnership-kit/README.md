# Devzard Partnership Kit

Everything needed to recruit, contract, onboard and pay a **sales partner** under Devzard's
70 / 30 profit-sharing model.

**Start here → [`index.html`](index.html)**

---

## The documents

| File | Purpose | Who reads it |
|---|---|---|
| `01-program-overview.md` | The programme pitch: role, split, support, trial, FAQ | Prospective partners |
| `02-partner-agreement.md` | The binding contract, with schedules and signatures | Partners + legal review |
| `03-commission-guide.md` | How net profit and the 30% are calculated, with 8 worked examples | Everyone |
| `04-outreach-playbook.md` | Target segments, message templates, objection handling, weekly plan | Partners, daily |
| `05-onboarding-checklist.md` | Day 0 to day 60, with the trial review sheet | Partners + Devzard team |
| `exports/xlsx/Devzard-Commission-Calculator.xlsx` | Live calculator, worked examples, payout tracker | Partners |

## Exports

Each markdown document is rendered to three formats:

- **PDF** (`exports/pdf/`) — branded, paginated, ready to send. Includes proper Urdu script
  shaping for the outreach templates.
- **DOCX** (`exports/docx/`) — fully editable in Word, with right-to-left Urdu support. Use this
  version for legal review of the agreement.
- **HTML** (`exports/html/`) — a self-contained, mobile-friendly web version with a table of
  contents. No external assets, no CDN, works offline.

Plus the **XLSX** workbook (`exports/xlsx/`) with five sheets: *How to use*, *Calculator*,
*Examples*, *Payout Tracker*, *Rates & Rules*.

## Editing

The markdown files are the source of truth. Edit those, then rebuild:

```bash
python3 -m venv ../.venv
../.venv/bin/pip install -r build/requirements.txt
../.venv/bin/python build/build_all.py
```

Rebuilds every PDF, DOCX, HTML file, the workbook and both hub pages in a couple of seconds.

### Build requirements

- Python 3.9+
- `reportlab`, `python-docx`, `openpyxl` — layout engines
- `arabic-reshaper`, `python-bidi` — Urdu shaping and bidi reordering
- `weasyprint` / `pypdfium2` are *not* required

Urdu text needs a font with Arabic glyphs. `build/fonts/NotoNaskhArabic.ttf` is bundled for this
purpose under the SIL Open Font License (`build/fonts/OFL-NotoNaskhArabic.txt`).

## Numbers that must stay consistent

If you change the commercial terms, update them everywhere or the documents will contradict each
other. The figures below appear in multiple files:

| Figure | Appears in |
|---|---|
| 70 / 30 split | Overview §6, Agreement cl. 6, Guide §1, Calculator |
| Reference deal: 20,000 − 5,000 = 15,000 → 10,500 / **4,500** | Overview §6, Agreement Schedule B, Guide §5, Calculator *Examples*, workbook |
| PKR 25,000 expense approval threshold | Agreement cl. 7.5, Guide §4, Calculator *Rates & Rules* |
| 7-business-day payout window | Agreement cl. 8.1, Guide §7, Overview §2 |
| PKR 5,000 minimum payout | Agreement cl. 8.3, Guide §7, Calculator |
| 60-day trial, default targets | Agreement cl. 11, Overview §8, Checklist |
| 90-day tail protection | Agreement cl. 20.4, Overview FAQ |
| Service price bands | Overview §5, Agreement Schedule A, Calculator *Rates & Rules* |

The workbook's formulas were verified against the worked examples in `03-commission-guide.md`;
both produce identical totals (partner share of 4,500 · 25,080 · 29,325 · 96,000 · 9,000).

## Legal note

`02-partner-agreement.md` is a drafting template, not legal advice. Replace every `[…]` field,
delete clauses and schedules that do not apply, and have it reviewed by a qualified advocate in
Pakistan before either party signs. Clauses 6, 8 and 9 contain the commercial terms and should be
checked against the numbers actually agreed.
