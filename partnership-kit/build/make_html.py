"""
make_html.py — render partnership-kit markdown to branded standalone HTML
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from mdkit import BRAND, has_arabic, inline_html, parse_blocks  # noqa: E402

CSS = """
:root{
  --violet:#6D28D9; --violet-dark:#4C1D95; --pink:#EC4899; --cyan:#0891B2;
  --ink:#120B2E; --slate:#4B5563; --line:#E5E1F5; --tint:#F5F3FF; --tint2:#FDF2F8;
}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{
  margin:0; background:#FBF9FF; color:var(--ink);
  font:16px/1.65 -apple-system,BlinkMacSystemFont,"Segoe UI",Inter,Roboto,Helvetica,Arial,sans-serif;
  -webkit-font-smoothing:antialiased;
}
.hero{
  position:relative; overflow:hidden; padding:64px 28px 52px;
  background:linear-gradient(135deg,#3B0764 0%,#6D28D9 42%,#EC4899 100%);
  color:#fff;
}
.hero:before,.hero:after{content:"";position:absolute;border-radius:50%;background:rgba(255,255,255,.10)}
.hero:before{width:340px;height:340px;top:-140px;right:-80px}
.hero:after{width:200px;height:200px;bottom:-110px;right:120px;background:rgba(255,255,255,.07)}
.hero .wrap{position:relative;max-width:920px;margin:0 auto}
.brand{font-weight:800;letter-spacing:.24em;font-size:12px;text-transform:uppercase;opacity:.92;margin:0 0 18px}
.hero h1{margin:0;font-size:clamp(30px,5.2vw,50px);line-height:1.06;font-weight:800;letter-spacing:-.02em;max-width:20ch}
.hero p.sub{margin:18px 0 0;font-size:17px;opacity:.95;max-width:60ch}
.badges{display:flex;flex-wrap:wrap;gap:10px;margin-top:26px}
.badge{
  background:rgba(255,255,255,.16); border:1px solid rgba(255,255,255,.28);
  padding:8px 14px;border-radius:999px;font-size:13px;font-weight:600;backdrop-filter:blur(6px);
}
.badge.hot{background:#fff;color:var(--violet-dark);border-color:#fff}
main{max-width:920px;margin:0 auto;padding:8px 28px 90px}
.toc{
  background:#fff;border:1px solid var(--line);border-radius:18px;padding:22px 26px;
  margin:-30px auto 40px;box-shadow:0 18px 40px -28px rgba(76,29,149,.45);position:relative;
}
.toc h2{margin:0 0 12px;font-size:13px;letter-spacing:.16em;text-transform:uppercase;color:var(--slate);border:0;padding:0}
.toc ol{margin:0;padding-left:20px;columns:2;column-gap:28px}
@media(max-width:640px){.toc ol{columns:1}}
.toc a{color:var(--violet-dark);text-decoration:none;font-weight:600;font-size:14.5px}
.toc a:hover{color:var(--pink);text-decoration:underline}
h2{
  font-size:26px;line-height:1.22;margin:56px 0 16px;font-weight:800;letter-spacing:-.015em;
  padding-bottom:12px;border-bottom:3px solid var(--pink);color:var(--violet-dark);
}
h3{font-size:19.5px;margin:36px 0 10px;font-weight:750;color:var(--violet)}
h4{font-size:16px;margin:26px 0 8px;font-weight:750;color:var(--cyan);letter-spacing:.01em}
h5,h6{font-size:15px;margin:22px 0 6px;color:var(--ink)}
p{margin:0 0 14px}
strong{color:var(--violet-dark);font-weight:700}
em{color:var(--slate)}
a{color:var(--violet);text-decoration:none;border-bottom:1px solid rgba(109,40,217,.35)}
a:hover{color:var(--pink);border-color:var(--pink)}
code{
  background:var(--tint);color:var(--pink);padding:2px 6px;border-radius:6px;
  font:13.5px/1.4 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace
}
pre{
  background:#0F172A;color:#A5F3FC;padding:20px 22px;border-radius:14px;overflow-x:auto;
  font:13.5px/1.6 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;margin:18px 0 22px;
  box-shadow:0 18px 40px -30px rgba(15,23,42,.9)
}
pre code{background:none;color:inherit;padding:0}
blockquote{
  margin:20px 0;padding:18px 22px;background:var(--tint);border-left:5px solid var(--violet);
  border-radius:0 14px 14px 0;color:var(--violet-dark)
}
blockquote p:last-child{margin-bottom:0}
hr{border:0;border-top:1px solid var(--line);margin:38px 0}
table{
  width:100%;border-collapse:separate;border-spacing:0;margin:20px 0 26px;font-size:14.5px;
  background:#fff;border:1px solid var(--line);border-radius:14px;overflow:hidden;
  box-shadow:0 16px 34px -30px rgba(76,29,149,.55)
}
thead th{
  background:var(--violet-dark);color:#fff;text-align:left;font-weight:700;
  padding:12px 14px;font-size:13.5px;letter-spacing:.01em
}
tbody td{padding:11px 14px;border-top:1px solid var(--line);vertical-align:top}
tbody tr:nth-child(even) td{background:var(--tint)}
tbody tr:hover td{background:var(--tint2)}
ul,ol{margin:0 0 16px;padding-left:24px}
li{margin:0 0 7px}
li>ul,li>ol{margin-top:7px}
footer{
  background:var(--ink);color:#C7C3E8;padding:34px 28px;text-align:center;font-size:14px
}
footer strong{color:#fff}
.doc-list{list-style:none;padding:0;margin:0}
.doc-list li{margin-bottom:10px}
.doc-list a{font-weight:650}
@media print{
  .hero{background:#4C1D95 !important;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .toc{display:none} body{background:#fff}
  h2{page-break-after:avoid} table,pre,blockquote{page-break-inside:avoid}
}
"""


def render(md: str, title: str, subtitle: str, tag: str, out: Path,
           back: str | None = None) -> None:
    blocks = parse_blocks(md)

    # collect h2s for the TOC
    toc = []
    idx = 0
    body: list[str] = []
    in_ol = False
    in_ul = False

    def close_lists():
        nonlocal in_ol, in_ul
        if in_ul:
            body.append("</ul>")
            in_ul = False
        if in_ol:
            body.append("</ol>")
            in_ol = False

    for b in blocks:
        if b.kind != "ul":
            if in_ul:
                body.append("</ul>")
                in_ul = False
        if b.kind != "ol":
            if in_ol:
                body.append("</ol>")
                in_ol = False

        if b.kind == "hr":
            body.append("<hr>")
        elif b.kind == "h":
            lvl = min(b.level + 1, 6)  # h1 -> h2
            txt = inline_html(b.text)
            if b.level == 1:
                anchor = f"sec-{idx}"
                idx += 1
                toc.append((anchor, b.text))
                body.append(f'<h2 id="{anchor}">{txt}</h2>')
            else:
                body.append(f"<h{lvl}>{txt}</h{lvl}>")
        elif b.kind == "p":
            rtl = ' dir="rtl" style="text-align:right"' if has_arabic(b.text) else ""
            body.append(f"<p{rtl}>{inline_html(b.text)}</p>")
        elif b.kind == "quote":
            rtl_attr = ' dir="rtl" style="text-align:right"'
            inner_parts = []
            for line in b.text.split("\n"):
                if not line.strip():
                    continue
                attr = rtl_attr if has_arabic(line) else ""
                inner_parts.append(f"<p{attr}>{inline_html(line.strip())}</p>")
            body.append(f"<blockquote>{''.join(inner_parts)}</blockquote>")
        elif b.kind == "code":
            esc = b.text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
            body.append(f"<pre><code>{esc}</code></pre>")
        elif b.kind == "ul":
            if not in_ul:
                body.append("<ul>")
                in_ul = True
            for item in b.items:
                level, text = item
                li = (f'<li dir="rtl" style="text-align:right">{inline_html(text)}</li>'
                      if has_arabic(text) else f"<li>{inline_html(text)}</li>")
                body.append(("<ul>" * 0 if level else "") + li)
        elif b.kind == "ol":
            if not in_ol:
                body.append("<ol>")
                in_ol = True
            for num, text in b.items:
                li = (f'<li dir="rtl" style="text-align:right">{inline_html(text)}</li>'
                      if has_arabic(text) else f"<li>{inline_html(text)}</li>")
                body.append(li)
        elif b.kind == "table":
            headless = all(not str(h).strip() for h in b.headers)
            head = "" if headless else "<thead><tr>" + "".join(
                f"<th>{inline_html(h)}</th>" for h in b.headers) + "</tr></thead>"
            rows = "".join(
                "<tr>" + "".join(f"<td>{inline_html(cell)}</td>" for cell in row) + "</tr>"
                for row in b.rows
            )
            body.append(f"<table>{head}<tbody>{rows}</tbody></table>")
    close_lists()

    toc_html = ""
    if len(toc) > 2:
        items = "".join(f'<li><a href="#{a}">{inline_html(t)}</a></li>' for a, t in toc)
        toc_html = f'<nav class="toc"><h2>On this page</h2><ol>{items}</ol></nav>'

    back_html = f'<p style="margin-top:22px"><a href="{back}">← Back to the partnership kit</a></p>' if back else ""

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title} · Devzard Sales Partnership</title>
<style>{CSS}</style>
</head>
<body>
<header class="hero">
  <div class="wrap">
    <p class="brand">Devzard</p>
    <h1>{title}</h1>
    <p class="sub">{subtitle}</p>
    <div class="badges">
      <span class="badge hot">70 / 30 profit share</span>
      <span class="badge">No coding required</span>
      <span class="badge">30% to the sales partner</span>
      <span class="badge">{tag}</span>
    </div>
  </div>
</header>
<main>
{toc_html}
{"".join(body)}
{back_html}
</main>
<footer>
  <strong>Devzard — Let's Build Together.</strong><br>
  Sales Partnership Program · 70/30 profit sharing · Figures are illustrative and vary by project.
</footer>
</body>
</html>
"""
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(html, encoding="utf-8")
    print(f"  html  → {out.name}")


if __name__ == "__main__":
    _md = Path(sys.argv[1]).read_text(encoding="utf-8")
    render(_md, sys.argv[3], sys.argv[4], sys.argv[5] if len(sys.argv) > 5 else "",
           Path(sys.argv[2]))
