# Devzard Motion

Marketing and partnership collateral for **Devzard** — *Let's Build Together.*

---

## Sales Partnership Program — partner kit

A complete, ready-to-use kit for recruiting and onboarding sales partners under Devzard's
**70 / 30 profit-sharing** model: the sales partner finds clients, Devzard builds, and the net
profit on every successful project is split 70% to Devzard and 30% to the sales partner.

**Open [`partnership-kit/index.html`](partnership-kit/index.html)** to browse the whole kit.

| # | Document | What it is for | Formats |
|---|---|---|---|
| 01 | [Sales Partnership Program](partnership-kit/01-program-overview.md) | The pitch — role, 70/30 split, support, 60-day trial, 12-point FAQ | PDF · Word · HTML |
| 02 | [Sales Partnership Agreement](partnership-kit/02-partner-agreement.md) | The contract — 23 clauses, 5 schedules, signature page | PDF · Word · HTML |
| 03 | [Commission & Net Profit Guide](partnership-kit/03-commission-guide.md) | The money rules — expense definitions, 8 worked examples, payout timeline | PDF · Word · HTML |
| 04 | [Outreach Playbook](partnership-kit/04-outreach-playbook.md) | The field guide — 12 segments, English/Urdu/Roman-Urdu templates, objection handling | PDF · Word · HTML |
| 05 | [Partner Onboarding Checklist](partnership-kit/05-onboarding-checklist.md) | The first 60 days — setup, targets, trial review | PDF · Word · HTML |
| 06 | [Commission Calculator](partnership-kit/exports/xlsx/Devzard-Commission-Calculator.xlsx) | Live Excel workbook — calculator, examples, payout tracker, rates | Excel |

### The programme in one line

> Net Profit = Gross Client Revenue − agreed, documented, project-specific expenses.
> **30% of that goes to the sales partner.** Nothing else is deducted.

Reference deal: PKR 20,000 revenue − PKR 5,000 expenses = **PKR 15,000 net profit** →
Devzard PKR 10,500, sales partner **PKR 4,500**.

### What the kit is designed to do

- **Be transparent enough to be trusted.** Every rupee of the split is defined, and every
  deduction Devzard absorbs is written down. A partner can verify the arithmetic themselves.
- **Protect the partner's commission.** Lead registration before contact, 30-day protection
  windows, written approval required for expenses above PKR 25,000, a 15-day query window, and
  90-day tail protection on leads after the partnership ends.
- **Be usable on day one.** Ready-to-send outreach messages in English, Roman Urdu and Urdu
  script; objection responses; a weekly rhythm; and a live calculator that handles real deals.

### Repository layout

```
partnership-kit/
├── 01-program-overview.md         ← source of truth (edit these)
├── 02-partner-agreement.md
├── 03-commission-guide.md
├── 04-outreach-playbook.md
├── 05-onboarding-checklist.md
├── index.html                     ← generated hub page
├── exports/
│   ├── pdf/                       ← generated
│   ├── docx/                      ← generated, editable for legal review
│   ├── html/                      ← generated, self-contained
│   └── xlsx/                      ← generated workbook
└── build/                         ← generators (markdown → PDF/DOCX/HTML/XLSX)
```

The markdown files are the source of truth. Every export is generated from them, so edit the
markdown and rebuild rather than editing a PDF.

### Rebuilding the kit

```bash
python3 -m venv .venv
.venv/bin/pip install -r partnership-kit/build/requirements.txt
.venv/bin/python partnership-kit/build/build_all.py
```

Exports are written to `partnership-kit/exports/`, and the hub page is regenerated.

### Local preview

```bash
python3 -m http.server 8080 --directory partnership-kit
# then open http://localhost:8080/
```

---

## Notes on the numbers

- All amounts are **illustrative examples** in PKR, based on the reference deal of PKR 20,000
  revenue and PKR 5,000 expenses. Actual profits vary with each project's price, scope and
  expenses, and partner earnings depend entirely on the successful deals they bring in.
- `02-partner-agreement.md` is a **template, not legal advice**. Have it reviewed by a qualified
  advocate or legal advisor in Pakistan, and replace every `[…]` field, before it is signed.
- The workbook's figures are live formulas and were verified against the worked examples in the
  commission guide — the totals match exactly.
