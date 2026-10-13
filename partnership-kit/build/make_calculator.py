"""
make_calculator.py — build the Devzard commission calculator workbook (.xlsx)

Sheets: How to use · Calculator · Examples · Payout Tracker · Rates & Rules
Every figure is a live formula, so partners can model their own deals.
"""

from __future__ import annotations

import sys
from pathlib import Path

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation

VIOLET = "6D28D9"
VIOLET_DARK = "4C1D95"
PINK = "EC4899"
CYAN = "0891B2"
INK = "120B2E"
TINT = "F5F3FF"
TINT2 = "FDF2F8"
LINE = "E5E1F5"
WHITE = "FFFFFF"
GREEN = "047857"
AMBER = "B45309"
RED = "B91C1C"

F_TITLE = Font(name="Calibri", size=20, bold=True, color=VIOLET_DARK)
F_SUB = Font(name="Calibri", size=11, color="4B5563", italic=True)
F_H1 = Font(name="Calibri", size=13, bold=True, color=WHITE)
F_H2 = Font(name="Calibri", size=11.5, bold=True, color=VIOLET)
F_LBL = Font(name="Calibri", size=11, bold=True, color=INK)
F_BODY = Font(name="Calibri", size=11, color="1F2937")
F_SMALL = Font(name="Calibri", size=9.5, color="4B5563")
F_BIG = Font(name="Calibri", size=14, bold=True, color=VIOLET_DARK)
F_PINK = Font(name="Calibri", size=12, bold=True, color=PINK)

FILL_HDR = PatternFill("solid", fgColor=VIOLET_DARK)
FILL_VIOLET = PatternFill("solid", fgColor=VIOLET)
FILL_TINT = PatternFill("solid", fgColor=TINT)
FILL_TINT2 = PatternFill("solid", fgColor=TINT2)
FILL_INPUT = PatternFill("solid", fgColor="FFF7ED")
FILL_OK = PatternFill("solid", fgColor="ECFDF5")

THIN = Side(style="thin", color=LINE)
BOX = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)
MONEY = '#,##0'
MONEY2 = '#,##0;[Red]-#,##0'
PCT = '0%'

WRAP = Alignment(wrap_text=True, vertical="top")
WRAPC = Alignment(wrap_text=True, vertical="center")
CTR = Alignment(horizontal="center", vertical="center")
RIGHT = Alignment(horizontal="right", vertical="center")


def hdr(ws, row: int, text: str, span: int = 6, fill=FILL_HDR, font=F_H1) -> None:
    ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=span)
    cell = ws.cell(row=row, column=1, value=text)
    cell.fill = fill
    cell.font = font
    cell.alignment = Alignment(horizontal="left", vertical="center", indent=1)
    ws.row_dimensions[row].height = 24
    for col in range(1, span + 1):
        ws.cell(row=row, column=col).fill = fill


def title_block(ws, title: str, sub: str, span: int = 6) -> None:
    ws.merge_cells(start_row=1, start_column=1, end_row=1, end_column=span)
    ws.cell(row=1, column=1, value=title).font = F_TITLE
    ws.merge_cells(start_row=2, start_column=1, end_row=2, end_column=span)
    ws.cell(row=2, column=1, value=sub).font = F_SUB
    ws.row_dimensions[1].height = 28
    ws.row_dimensions[2].height = 18


def txt(ws, row: int, col: int, value, font=None, fill=None, border=None, align=None):
    """Write a cell that must stay TEXT even when it starts with '=' or '-'."""
    cell = ws.cell(row=row, column=col)
    cell.value = value
    if isinstance(value, str):
        cell.data_type = "s"
    if font:
        cell.font = font
    if fill:
        cell.fill = fill
    if border:
        cell.border = border
    if align:
        cell.alignment = align
    return cell


def widths(ws, spec: dict) -> None:
    for col, w in spec.items():
        ws.column_dimensions[col].width = w


# ---------------------------------------------------------------- workbook

def build(out: Path) -> None:
    wb = Workbook()

    # =========================================================== How to use
    ws = wb.active
    ws.title = "How to use"
    widths(ws, {"A": 3, "B": 30, "C": 62, "D": 26, "E": 18, "F": 14})
    title_block(
        ws,
        "Devzard — Commission Calculator",
        "Sales Partnership Program · 70% Devzard / 30% Sales Partner of net project profit",
    )

    r = 4
    hdr(ws, r, "START HERE — 2 MINUTES", 5)
    r += 2
    steps = [
        ("1. Open the Calculator tab", "Enter the client revenue for your project in the orange input cell."),
        ("2. Enter the expenses", "Only direct, project-specific, documented costs. Anything above PKR 25,000 needs the partner's written approval first."),
        ("3. Read your share", "Your 30% is calculated live. No formulas to edit, no guessing."),
        ("4. Change the split if you want", "Cell B5 of the Calculator holds the partner share %. It is set to 30%. Change it to model any other split."),
        ("5. Log the deal", "Once a project closes, add it to the Payout Tracker tab and let it total your earnings."),
        ("6. Check a rule", "Rates & Rules has the deductible / non-deductible list and the four expense rules on one page."),
    ]
    for label, text in steps:
        txt(ws, r, 2, label, font=F_LBL, fill=FILL_TINT, align=WRAPC)
        txt(ws, r, 3, text, font=F_BODY, fill=FILL_TINT, align=WRAP)
        ws.row_dimensions[r].height = 30
        r += 1

    r += 1
    hdr(ws, r, "THE FORMULA", 5)
    r += 2
    lines = [
        ("Gross client revenue", "Contract value, excluding sales tax"),
        ("− Direct project expenses", "Agreed, documented, project-specific"),
        ("= Net profit", ""),
        ("× 30% = Sales partner share", "Your commission"),
        ("× 70% = Devzard share", ""),
    ]
    for i, (a, b) in enumerate(lines):
        strong = i in (2, 3)
        txt(ws, r, 2, a, font=F_LBL if strong else F_BODY,
            fill=FILL_TINT if strong else None)
        txt(ws, r, 3, b, font=F_SMALL, fill=FILL_TINT if strong else None)
        r += 1

    r += 1
    hdr(ws, r, "PAYMENT TERMS AT A GLANCE", 5)
    r += 2
    for a, b in [
        ("Paid when", "Client payment received and cleared, AND the related milestone delivered"),
        ("Payout window", "Within 7 business days of both conditions being met"),
        ("Statement", "Every payment is accompanied by a written statement"),
        ("Query window", "15 days from receiving a statement"),
        ("Minimum payout", "PKR 5,000 — smaller balances carry forward"),
        ("Multi-milestone", "Commission is paid milestone by milestone"),
        ("Recurring work", "30% of net profit on retainers, renewals and upsells while the partnership is active"),
        ("If a project loses money", "No commission, and nothing is ever charged to the partner"),
    ]:
        txt(ws, r, 2, a, font=F_LBL, border=BOX)
        txt(ws, r, 3, b, font=F_BODY, border=BOX, align=WRAP)
        r += 1

    r += 1
    ws.merge_cells(start_row=r, start_column=2, end_row=r, end_column=5)
    ws.cell(row=r, column=2,
            value="Illustrative only. Actual profits vary with the project's price, scope and expenses. "
                  "Earnings depend on the successful deals brought in — nothing here is a guarantee of income.").font = F_SMALL
    ws.cell(row=r, column=2).alignment = WRAP
    ws.row_dimensions[r].height = 30
    ws.sheet_view.showGridLines = False

    # ============================================================ Calculator
    ws = wb.create_sheet("Calculator")
    widths(ws, {"A": 3, "B": 46, "C": 18, "D": 52, "E": 16})
    title_block(ws, "Project Commission Calculator", "Enter the orange cells only — everything else calculates itself.")
    ws["B4"] = "Project / client name"
    ws["B4"].font = F_LBL
    ws["C4"].fill = FILL_INPUT
    ws["C4"].border = BOX
    ws["D4"] = "Type the client or project here (optional)"
    ws["D4"].font = F_SMALL

    ws["B5"] = "Sales partner share %"
    ws["B5"].font = F_LBL
    ws["C5"] = 0.30
    ws["C5"].number_format = PCT
    ws["C5"].fill = FILL_INPUT
    ws["C5"].border = BOX
    ws["D5"] = "Agreed split is 30%. Change only to model a different split."
    ws["D5"].font = F_SMALL

    hdr(ws, 7, "1  CLIENT REVENUE", 4)
    ws["B8"] = "Client revenue (excluding sales tax)"
    ws["B8"].font = F_LBL
    ws["C8"] = 20000
    ws["C8"].number_format = MONEY
    ws["C8"].fill = FILL_INPUT
    ws["C8"].border = BOX
    ws["D8"] = "Contract value agreed with the client"
    ws["D8"].font = F_SMALL

    hdr(ws, 10, "2  DIRECT PROJECT EXPENSES  (only project-specific, documented costs)", 4)
    ws["B11"] = "Expense line"
    ws["C11"] = "Amount (PKR)"
    ws["D11"] = "Approval flag"
    for col in ("B", "C", "D"):
        ws[f"{col}11"].font = Font(name="Calibri", size=11, bold=True, color=WHITE)
        ws[f"{col}11"].fill = FILL_VIOLET
        ws[f"{col}11"].alignment = CTR if col == "C" else Alignment(vertical="center", indent=1)

    default_expenses = [
        ("Domain name and hosting (project period)", 4000),
        ("Premium theme / plugin licences", 1000),
        ("Stock images, video or fonts", 0),
        ("Paid APIs, integrations, SMS, gateway setup", 0),
        ("Outsourced / subcontracted delivery", 0),
        ("Payment gateway and bank transfer fees", 0),
        ("Client-specific ad spend", 0),
        ("Printing, courier or physical costs", 0),
        ("Taxes or levies arising solely from this project", 0),
        ("Other (specify in the note column)", 0),
    ]
    first_exp = 12
    r = first_exp
    for label, amount in default_expenses:
        ws.cell(row=r, column=2, value=label).font = F_BODY
        ws.cell(row=r, column=2).alignment = WRAPC
        cell = ws.cell(row=r, column=3, value=amount)
        cell.number_format = MONEY
        cell.fill = FILL_INPUT
        cell.border = BOX
        flag = ws.cell(row=r, column=4,
                       value=f'=IF(C{r}="","",IF(C{r}>25000,"NEEDS PARTNER WRITTEN APPROVAL BEFORE IT IS COMMITTED",""))')
        flag.font = Font(name="Calibri", size=9.5, bold=True, color=AMBER)
        flag.alignment = WRAPC
        ws.row_dimensions[r].height = 20
        r += 1
    last_exp = r - 1

    ws.cell(row=r, column=2, value="Total direct expenses").font = F_LBL
    ws.cell(row=r, column=2).fill = FILL_TINT
    tot = ws.cell(row=r, column=3, value=f"=SUM(C{first_exp}:C{last_exp})")
    tot.number_format = MONEY
    tot.font = F_LBL
    tot.fill = FILL_TINT
    tot.border = BOX
    ws.cell(row=r, column=4,
            value="Only these expenses are deducted. Devzard's salaries, overheads, tools, internal rework and "
                  "late-delivery penalties are never deducted.").font = F_SMALL
    ws.cell(row=r, column=4).alignment = WRAP
    ws.row_dimensions[r].height = 30
    total_row = r

    hdr(ws, r + 2, "3  RESULT", 4)
    r = r + 3
    res = [
        ("Gross client revenue received", f"=C8", MONEY, F_BODY, None),
        ("Less: total direct expenses", f"=-C{total_row}", MONEY2, F_BODY, None),
        ("NET PROFIT", f"=C8-C{total_row}", MONEY2, F_BIG, FILL_TINT),
    ]
    np_row = None
    for label, formula, fmt, font, fill in res:
        ws.cell(row=r, column=2, value=label).font = font
        cell = ws.cell(row=r, column=3, value=formula)
        cell.number_format = fmt
        cell.font = font
        if fill:
            ws.cell(row=r, column=2).fill = fill
            cell.fill = fill
            ws.cell(row=r, column=2).border = BOX
            cell.border = BOX
            ws.row_dimensions[r].height = 22
            np_row = r
        r += 1

    ws.cell(row=r, column=2,
            value=f'=IF(C{np_row}<0,"This project shows a loss. No commission is payable — and nothing is ever charged to you.",'
                  f'IF(C{np_row}=0,"No profit on this project, so no commission.","Project is profitable — see the split below."))')
    ws.cell(row=r, column=2).font = Font(name="Calibri", size=10.5, bold=True, color=GREEN)
    ws.cell(row=r, column=2).alignment = WRAP
    ws.merge_cells(start_row=r, start_column=2, end_row=r, end_column=4)
    ws.cell(row=r, column=2).fill = FILL_OK
    r += 2

    hdr(ws, r, "4  SPLIT", 4)
    r += 1
    ws.cell(row=r, column=2, value="Share").font = F_LBL
    ws.cell(row=r, column=3, value="Amount (PKR)").font = F_LBL
    ws.cell(row=r, column=4, value="Of net profit").font = F_LBL
    for col in ("B", "C", "D"):
        ws[f"{col}{r}"].fill = FILL_VIOLET
        ws[f"{col}{r}"].font = Font(name="Calibri", size=11, bold=True, color=WHITE)
        ws[f"{col}{r}"].alignment = CTR if col != "B" else Alignment(vertical="center", indent=1)
    r += 1
    dev_row, part_row = r, r + 1
    ws.cell(row=dev_row, column=2, value="Devzard").font = F_BODY
    ws.cell(row=dev_row, column=3, value=f"=MAX(0,C{np_row})*(1-C5)").number_format = MONEY
    ws.cell(row=dev_row, column=3).font = F_BODY
    ws.cell(row=dev_row, column=4, value="=IF(MAX(0,$C$" + str(np_row) + ")=0,\"\",1-$C$5)").number_format = PCT
    ws.cell(row=dev_row, column=4).alignment = CTR

    ws.cell(row=part_row, column=2, value="Sales partner  —  YOUR SHARE").font = F_PINK
    pc = ws.cell(row=part_row, column=3, value=f"=MAX(0,C{np_row})*C5")
    pc.number_format = MONEY
    pc.font = F_PINK
    pc.fill = FILL_TINT2
    ws.cell(row=part_row, column=2).fill = FILL_TINT2
    ws.cell(row=part_row, column=4, value="=IF(MAX(0,$C$" + str(np_row) + ")=0,\"\",$C$5)").number_format = PCT
    ws.cell(row=part_row, column=4).alignment = CTR
    for rr in (dev_row, part_row):
        for col in ("B", "C", "D"):
            ws[f"{col}{rr}"].border = BOX
        ws.row_dimensions[rr].height = 20
    r = part_row + 2

    checks = [
        (f'=IF(C{part_row}<5000,"Your share is below the PKR 5,000 minimum payout — it carries forward to the next payout.","Your share is above the PKR 5,000 minimum payout.")', GREEN),
        (f'=IF(C{np_row}<=0,"",TEXT(C{part_row}/C8,"0.0%")&" of the client revenue you brought in ends up in your pocket.")', VIOLET),
        (f'=IF(C8=0,"Enter the client revenue in cell C8 to begin.","")', AMBER),
    ]
    for formula, color in checks:
        ws.merge_cells(start_row=r, start_column=2, end_row=r, end_column=4)
        cell = ws.cell(row=r, column=2, value=formula)
        cell.font = Font(name="Calibri", size=10.5, bold=True, color=color)
        cell.alignment = WRAP
        r += 1

    r += 1
    ws.merge_cells(start_row=r, start_column=2, end_row=r, end_column=4)
    ws.cell(row=r, column=2,
            value="Reminder: never quote a price, offer a discount or commit to a delivery date without written "
                  "confirmation from Devzard. Unapproved discounts reduce net profit — and 30% of that reduction is yours.").font = F_SMALL
    ws.cell(row=r, column=2).alignment = WRAP
    ws.row_dimensions[r].height = 32
    ws.freeze_panes = "A3"
    ws.sheet_view.showGridLines = False

    # ============================================================== Examples
    ws = wb.create_sheet("Examples")
    widths(ws, {"A": 3, "B": 34, "C": 16, "D": 16, "E": 16, "F": 16, "G": 16, "H": 22})
    title_block(ws, "Worked examples", "Every figure below is a live formula — change any revenue or expense cell and the split updates.", span=7)
    r = 4
    hdr(ws, r, "A  SUMMARY OF WORKED EXAMPLES", 7)
    r += 1
    heads = ["Example", "Client revenue", "Direct expenses", "Net profit", "Devzard 70%", "Partner 30%", "Note"]
    for i, h in enumerate(heads):
        cell = ws.cell(row=r, column=2 + i, value=h)
        cell.font = Font(name="Calibri", size=11, bold=True, color=WHITE)
        cell.fill = FILL_VIOLET
        cell.alignment = CTR if i else Alignment(vertical="center", indent=1)
    r += 1
    examples = [
        ("Landing page (reference deal)", 20000, 5000, "The example used across the programme documents"),
        ("Business website (5-8 pages)", 120000, 36400, "Domain, theme, imagery, gateway fees"),
        ("E-commerce store", 250000, 152250, "Plugins, photography, outsourced dev, gateway fees"),
        ("Custom web application", 650000, 330000, "Hosting, senior subcontractor, licences"),
        ("Maintenance retainer (per month)", 35000, 5000, "Recurring — paid every month the client stays"),
        ("UI/UX design package", 90000, 22000, "Stock assets, freelance designer support"),
        ("Branding and identity package", 45000, 12000, "Fonts, stock assets, printing proofs"),
        ("SEO retainer (per month)", 40000, 9000, "Tool licences and ad-hoc content costs"),
    ]
    first_ex = r
    for name, rev, exp, note in examples:
        ws.cell(row=r, column=2, value=name).font = F_BODY
        ws.cell(row=r, column=2).alignment = WRAPC
        ws.cell(row=r, column=3, value=rev).number_format = MONEY
        ws.cell(row=r, column=4, value=exp).number_format = MONEY
        ws.cell(row=r, column=5, value=f"=C{r}-D{r}").number_format = MONEY2
        ws.cell(row=r, column=6, value=f"=MAX(0,E{r})*0.7").number_format = MONEY
        pc = ws.cell(row=r, column=7, value=f"=MAX(0,E{r})*0.3")
        pc.number_format = MONEY
        pc.font = Font(name="Calibri", size=11, bold=True, color=PINK)
        pc.fill = FILL_TINT2
        ws.cell(row=r, column=8, value=note).font = F_SMALL
        ws.cell(row=r, column=8).alignment = WRAPC
        for col in range(2, 9):
            ws.cell(row=r, column=col).border = BOX
            if col in (3, 4, 5, 6, 7):
                ws.cell(row=r, column=col).alignment = RIGHT
            else:
                ws.cell(row=r, column=col).alignment = WRAPC
        ws.row_dimensions[r].height = 20
        r += 1
    ws.cell(row=r, column=2, value="TOTAL if all of the above closed in one year").font = F_LBL
    ws.cell(row=r, column=2).fill = FILL_TINT
    for col in (3, 4, 5, 6, 7):
        L = get_column_letter(col)
        cell = ws.cell(row=r, column=col, value=f"=SUM({L}{first_ex}:{L}{r-1})")
        cell.number_format = MONEY2
        cell.font = F_LBL
        cell.fill = FILL_TINT
        cell.alignment = RIGHT
    ws.cell(row=r, column=8, value="Illustrative only — not a forecast or a promise.").font = F_SMALL
    ws.cell(row=r, column=8).alignment = WRAPC
    r += 3

    hdr(ws, r, "B  WHY AN UNAPPROVED DISCOUNT IS EXPENSIVE", 7)
    r += 2
    for i, h in enumerate(["Scenario", "Client revenue", "Direct expenses", "Net profit", "Devzard 70%", "Partner 30%"]):
        cell = ws.cell(row=r, column=2 + i, value=h)
        cell.font = Font(name="Calibri", size=11, bold=True, color=WHITE)
        cell.fill = FILL_VIOLET
        cell.alignment = CTR if i else Alignment(vertical="center", indent=1)
    r += 1
    disc_first = r
    for label, rev in [("Price approved by Devzard", 150000), ("You discount 20% without asking", 120000)]:
        ws.cell(row=r, column=2, value=label).font = F_BODY
        ws.cell(row=r, column=3, value=rev).number_format = MONEY
        ws.cell(row=r, column=4, value=40000).number_format = MONEY
        ws.cell(row=r, column=5, value=f"=C{r}-D{r}").number_format = MONEY2
        ws.cell(row=r, column=6, value=f"=MAX(0,E{r})*0.7").number_format = MONEY
        ws.cell(row=r, column=7, value=f"=MAX(0,E{r})*0.3").number_format = MONEY
        ws.cell(row=r, column=7).font = Font(name="Calibri", size=11, bold=True, color=PINK)
        for col in range(2, 8):
            ws.cell(row=r, column=col).border = BOX
        r += 1
    ws.cell(row=r, column=2, value="What the discount costs you").font = F_LBL
    loss = ws.cell(row=r, column=7, value=f"=G{disc_first+1}-G{disc_first}")
    loss.number_format = MONEY
    loss.font = Font(name="Calibri", size=11, bold=True, color=RED)
    ws.cell(row=r, column=2).fill = FILL_TINT
    loss.fill = FILL_TINT
    r += 3

    hdr(ws, r, "C  MILESTONE PAYMENTS  (revenue 300,000 · expenses 100,000 · your total 60,000)", 7)
    r += 2
    for i, h in enumerate(["Milestone", "Client pays", "Expenses to date", "Net profit", "Devzard 70%", "Partner 30%"]):
        cell = ws.cell(row=r, column=2 + i, value=h)
        cell.font = Font(name="Calibri", size=11, bold=True, color=WHITE)
        cell.fill = FILL_VIOLET
        cell.alignment = CTR if i else Alignment(vertical="center", indent=1)
    r += 1
    ms_first = r
    for label, paid, exp in [
        ("Advance (50%)", 150000, 40000),
        ("Mid-project (40%)", 120000, 45000),
        ("Final delivery (10%)", 30000, 15000),
    ]:
        ws.cell(row=r, column=2, value=label).font = F_BODY
        ws.cell(row=r, column=3, value=paid).number_format = MONEY
        ws.cell(row=r, column=4, value=exp).number_format = MONEY
        ws.cell(row=r, column=5, value=f"=C{r}-D{r}").number_format = MONEY2
        ws.cell(row=r, column=6, value=f"=MAX(0,E{r})*0.7").number_format = MONEY
        ws.cell(row=r, column=7, value=f"=MAX(0,E{r})*0.3").number_format = MONEY
        ws.cell(row=r, column=7).font = Font(name="Calibri", size=11, bold=True, color=PINK)
        for col in range(2, 8):
            ws.cell(row=r, column=col).border = BOX
        r += 1
    ws.cell(row=r, column=2, value="TOTAL").font = F_LBL
    for col in (3, 4, 5, 6, 7):
        L = get_column_letter(col)
        cell = ws.cell(row=r, column=col, value=f"=SUM({L}{ms_first}:{L}{r-1})")
        cell.number_format = MONEY2
        cell.font = F_LBL
        cell.fill = FILL_TINT
    r += 1
    ws.merge_cells(start_row=r, start_column=2, end_row=r, end_column=7)
    ws.cell(row=r, column=2,
            value="Commission is paid milestone by milestone, once each client payment clears and the related work is delivered.").font = F_SMALL
    ws.cell(row=r, column=2).alignment = WRAP
    ws.sheet_view.showGridLines = False

    # ========================================================= Payout Tracker
    ws = wb.create_sheet("Payout Tracker")
    widths(ws, {"A": 3, "B": 12, "C": 22, "D": 24, "E": 14, "F": 14, "G": 14,
                "H": 15, "I": 13, "J": 12, "K": 12, "L": 18})
    title_block(ws, "Payout Tracker", "Log every closed deal. Earnings, paid and outstanding totals update automatically.", span=11)
    ws["B4"] = "TOTAL NET PROFIT LOGGED"
    ws["C4"] = "=SUM(G7:G36)"
    ws["D4"] = "YOUR COMMISSION EARNED"
    ws["E4"] = "=SUM(H7:H36)"
    ws["B5"] = "PAID TO YOU"
    ws["C5"] = '=SUMIF(J7:J36,"Y",H7:H36)'
    ws["D5"] = "OUTSTANDING"
    ws["E5"] = '=SUMIF(J7:J36,"<>Y",H7:H36)'
    for cell in ("B4", "D4", "B5", "D5"):
        ws[cell].font = F_LBL
        ws[cell].fill = FILL_TINT
        ws[cell].alignment = Alignment(vertical="center", indent=1)
    for cell in ("C4", "E4", "C5", "E5"):
        ws[cell].number_format = MONEY
        ws[cell].font = F_PINK
        ws[cell].fill = FILL_TINT
        ws[cell].alignment = RIGHT
    ws["E4"].font = Font(name="Calibri", size=12, bold=True, color=VIOLET_DARK)

    heads = ["Date closed", "Client", "Project", "Client revenue", "Direct expenses",
             "Net profit", "Your 30%", "Statement received?", "Paid?", "Date paid", "Notes"]
    for i, h in enumerate(heads):
        cell = ws.cell(row=6, column=2 + i, value=h)
        cell.font = Font(name="Calibri", size=10.5, bold=True, color=WHITE)
        cell.fill = FILL_VIOLET
        cell.alignment = Alignment(wrap_text=True, vertical="center", horizontal="center")
    ws.row_dimensions[6].height = 32

    for r in range(7, 37):
        ws.cell(row=r, column=7, value=f'=IF(OR(D{r}="",E{r}=""),"",D{r}-E{r})').number_format = MONEY2
        pcell = ws.cell(row=r, column=8, value=f'=IF(G{r}="","",MAX(0,G{r})*0.3)')
        pcell.number_format = MONEY
        pcell.font = Font(name="Calibri", size=11, bold=True, color=PINK)
        for col in range(2, 13):
            c2 = ws.cell(row=r, column=col)
            c2.border = BOX
            if col in (4, 5, 6, 7, 8, 11):
                c2.number_format = c2.number_format or MONEY
            if col in (2, 9, 10):
                c2.alignment = CTR
        ws.cell(row=r, column=4).fill = FILL_INPUT
        ws.cell(row=r, column=5).fill = FILL_INPUT
        ws.cell(row=r, column=6).fill = FILL_INPUT
        ws.cell(row=r, column=7).fill = FILL_INPUT

    dv = DataValidation(type="list", formula1='"Y,N"', allow_blank=True, showDropDown=False)
    ws.add_data_validation(dv)
    dv.add("I7:I36")
    dv.add("J7:J36")

    ws.cell(row=38, column=2,
            value="Enter client revenue plus any commission adjustment in the Client revenue column "
                  "(for example -4500 if a refund reduced your commission). 'Y' in Paid? counts towards Paid to You.").font = F_SMALL
    ws.merge_cells(start_row=38, start_column=2, end_row=38, end_column=11)
    ws.cell(row=38, column=2).alignment = WRAP
    ws.freeze_panes = "B7"
    ws.sheet_view.showGridLines = False

    # ========================================================= Rates & Rules
    ws = wb.create_sheet("Rates & Rules")
    widths(ws, {"A": 3, "B": 46, "C": 30, "D": 30, "E": 22, "F": 16})
    title_block(ws, "Rates, rules and the expense list", "Everything a partner needs on one page.", span=5)
    r = 4
    hdr(ws, r, "INDICATIVE SERVICE RATES  (PKR — always confirm the final price with Devzard)", 5)
    r += 2
    for h in ["Service", "Typical project size (PKR)", "Typical delivery"]:
        pass
    ws.cell(row=r, column=2, value="Service").font = Font(name="Calibri", size=11, bold=True, color=WHITE)
    ws.cell(row=r, column=3, value="Typical project size (PKR)").font = Font(name="Calibri", size=11, bold=True, color=WHITE)
    ws.cell(row=r, column=4, value="Typical delivery").font = Font(name="Calibri", size=11, bold=True, color=WHITE)
    for col in (2, 3, 4):
        ws.cell(row=r, column=col).fill = FILL_VIOLET
        ws.cell(row=r, column=col).alignment = Alignment(vertical="center", indent=1)
    r += 1
    services = [
        ("One-page / landing page", "25,000 - 60,000", "1 - 2 weeks"),
        ("Business website (5-8 pages)", "60,000 - 150,000", "2 - 4 weeks"),
        ("E-commerce store (WooCommerce / Shopify)", "120,000 - 350,000", "3 - 6 weeks"),
        ("Custom web app / dashboard / portal", "250,000 - 900,000+", "6 - 16 weeks"),
        ("Mobile app (Android + iOS)", "400,000 - 1,500,000+", "8 - 20 weeks"),
        ("UI / UX design package", "40,000 - 150,000", "2 - 4 weeks"),
        ("Branding, logo and identity", "20,000 - 80,000", "1 - 3 weeks"),
        ("SEO / digital marketing retainer", "30,000 - 100,000 / month", "Ongoing"),
        ("Website maintenance and support retainer", "10,000 - 40,000 / month", "Ongoing"),
        ("AI automation, chatbot, CRM integration", "80,000 - 300,000", "3 - 8 weeks"),
    ]
    for s in services:
        for i, v in enumerate(s):
            cell = ws.cell(row=r, column=2 + i, value=v)
            cell.font = F_BODY
            cell.border = BOX
            cell.alignment = Alignment(vertical="center", indent=1)
        r += 1
    r += 2

    hdr(ws, r, "DEDUCTIBLE  (reduces the profit pool — receipts required)", 5)
    r += 1
    for item in [
        "Domain, hosting, SSL and cloud infrastructure for the project",
        "Premium themes, plugins, licences and fonts bought for the client",
        "Stock images, video and design assets licensed for the project",
        "Paid APIs, integrations, SMS, gateway setup and AI credits used",
        "Subcontracted or outsourced delivery (freelancers, designers, QA)",
        "Payment gateway, bank and transfer fees on the client's money",
        "Client-specific ad spend not reimbursed by the client",
        "Hardware, printing, courier and physical project costs",
        "Taxes or levies arising solely from the project (not income tax)",
    ]:
        ws.cell(row=r, column=2, value=item).font = F_BODY
        ws.cell(row=r, column=2).border = BOX
        r += 1
    r += 2

    hdr(ws, r, "NEVER DEDUCTIBLE  (Devzard absorbs these inside its 70%)", 5)
    r += 1
    for item in [
        "Devzard salaries and core team time",
        "Office rent, utilities and internet",
        "Internal software subscriptions and tools",
        "General marketing and advertising of Devzard",
        "Rework caused by Devzard's own errors or omissions",
        "Penalties paid because Devzard delivered late (added back before the split)",
        "Anything not agreed in advance above the PKR 25,000 approval threshold",
    ]:
        ws.cell(row=r, column=2, value=item).font = F_BODY
        ws.cell(row=r, column=2).border = BOX
        r += 1
    r += 2

    hdr(ws, r, "THE FOUR EXPENSE RULES", 5)
    r += 1
    for a, b in [
        ("Rule 1 - Project-specific", "If the cost would exist without this project, it is not deducted."),
        ("Rule 2 - Documented", "No receipt, no deduction. Partners may ask to see receipts for any project."),
        ("Rule 3 - The Big Expense Rule", "Any single expense above PKR 25,000, or anything that changes the client price, needs the partner's written approval first."),
        ("Rule 4 - Shared costs", "Costs shared across clients are apportioned fairly and shown on the statement."),
    ]:
        ws.cell(row=r, column=2, value=a).font = F_LBL
        ws.cell(row=r, column=3, value=b).font = F_BODY
        ws.cell(row=r, column=2).border = BOX
        ws.cell(row=r, column=3).border = BOX
        ws.cell(row=r, column=3).alignment = WRAP
        ws.merge_cells(start_row=r, start_column=3, end_row=r, end_column=5)
        ws.row_dimensions[r].height = 28
        r += 1
    r += 2

    hdr(ws, r, "WHEN YOU GET PAID", 5)
    r += 1
    for a, b in [
        ("Trigger", "Client payment received and cleared, AND the related milestone delivered"),
        ("Window", "Within 7 business days of both"),
        ("Multi-milestone", "Paid milestone by milestone"),
        ("Recurring / retainers", "30% of net profit every billing cycle while the partnership is active"),
        ("Minimum payout", "PKR 5,000 — smaller balances carry forward"),
        ("Statement", "Written statement with every payment, showing revenue, expenses and net profit"),
        ("Query window", "15 days from receiving a statement"),
        ("Refunds and bad debt", "Commission already paid on an amount later refunded or written off is set off against future commission"),
        ("Loss-making project", "No commission, and nothing is charged to the partner"),
    ]:
        ws.cell(row=r, column=2, value=a).font = F_LBL
        ws.cell(row=r, column=3, value=b).font = F_BODY
        ws.cell(row=r, column=2).border = BOX
        ws.cell(row=r, column=3).border = BOX
        ws.cell(row=r, column=3).alignment = WRAP
        ws.merge_cells(start_row=r, start_column=3, end_row=r, end_column=5)
        ws.row_dimensions[r].height = 26
        r += 1
    ws.sheet_view.showGridLines = False

    out.parent.mkdir(parents=True, exist_ok=True)
    wb.save(out)
    print(f"  xlsx  → {out.name}")


if __name__ == "__main__":
    build(Path(sys.argv[1]))
