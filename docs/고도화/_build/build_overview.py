# -*- coding: utf-8 -*-
"""docs/고도화/overview.html 생성기.

여섯 정본 MD(README · 01 · 02 · 03 · 04 · IA)에서 절 · 표 · 텍스트 그림을 뽑아 한 파일로 만든다.
사람이 타이핑하는 내용은 없다. 정본이 바뀌면 다시 돌린다:

    python3 docs/고도화/_build/build_overview.py            # → docs/고도화/overview.html
    python3 docs/고도화/_build/build_overview.py --fragment  # 아티팩트용 본문 조각(head · body 없음)

정본에서 절 제목이나 표 열이 바뀌어 못 읽으면 조용히 틀린 그림을 내지 않고 여기서 실패한다.
"""
import html
import re
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent  # docs/고도화
FRAGMENT = "--fragment" in sys.argv
OUT = Path(sys.argv[sys.argv.index("--out") + 1]) if "--out" in sys.argv else ROOT / "overview.html"

DOCS = {
    "README": "README.md",
    "01": "01_이벤트·사건모델.md",
    "02": "02_대표데모시나리오.md",
    "03": "03_유형별디지털트윈.md",
    "04": "04_사건작업공간_화면상세.md",
    "IA": "CUVIA_NDMS_기능및정보구조도.md",
}
TEXT = {k: (ROOT / v).read_text(encoding="utf-8") for k, v in DOCS.items()}
LINES = {k: v.splitlines() for k, v in TEXT.items()}


# ───────────────────────────────────────── 절 추출
def section(doc, key):
    """key: '7.4' → '### 7.4 ...', '7' → '## 7. ...', 'D2' → '### D2. ...'. 다음 같은 급 이상 제목 전까지."""
    lines = LINES[doc]
    if re.fullmatch(r"\d+", key):
        pat = re.compile(r"^## " + re.escape(key) + r"\. ")
        stop = re.compile(r"^## ")
    elif re.fullmatch(r"\d+\.\d+", key):
        pat = re.compile(r"^### " + re.escape(key) + r" ")
        stop = re.compile(r"^##(#)? ")
    else:  # D0 등
        pat = re.compile(r"^### " + re.escape(key) + r"\. ")
        stop = re.compile(r"^##(#)? ")
    start = next((i for i, l in enumerate(lines) if pat.match(l)), None)
    if start is None:
        raise SystemExit(f"[{DOCS[doc]}] 절 '{key}' 을 찾지 못했다. 제목이 바뀌었나?")
    end = next((i for i in range(start + 1, len(lines)) if stop.match(lines[i])), len(lines))
    title = re.sub(r"^#+ ", "", lines[start])
    return title, lines[start + 1:end]


def subsection(body_lines, title_prefix):
    """번호 없는 ### 소절(예: '### 주요 행동')을 절 본문 안에서 찾는다."""
    start = next((i for i, l in enumerate(body_lines) if l.startswith("### " + title_prefix)), None)
    if start is None:
        raise SystemExit(f"소절 '{title_prefix}' 을 찾지 못했다.")
    end = next((i for i in range(start + 1, len(body_lines)) if body_lines[i].startswith("### ")), len(body_lines))
    return body_lines[start + 1:end]


def head_status(doc):
    m = re.search(r"^> 상태: (.+)$", TEXT[doc], re.M)
    if not m:
        raise SystemExit(f"[{DOCS[doc]}] 머리 '상태:' 줄이 없다.")
    return m.group(1).strip()


def head_quote(doc, key):
    """절 안의 첫 인용 블록(> **...**)을 한 문장으로."""
    _, body = section(doc, key)
    q = [l[2:].strip() for l in body if l.startswith("> ")]
    if not q:
        raise SystemExit(f"[{DOCS[doc]}] 절 {key} 에 인용 블록이 없다.")
    return " ".join(q).replace("**", "")


# ───────────────────────────────────────── 표 파싱
def tables(body_lines):
    out, cur = [], []
    for l in body_lines + [""]:
        if l.startswith("|"):
            cur.append(l)
        elif cur:
            out.append(cur)
            cur = []
    parsed = []
    for t in out:
        rows = [[c.strip() for c in r.strip().strip("|").split("|")] for r in t]
        rows = [r for r in rows if not all(re.fullmatch(r":?-+:?", c) for c in r)]
        parsed.append((rows[0], rows[1:]))
    return parsed


def first_table(doc, key, expect_cols=None):
    _, body = section(doc, key)
    ts = tables(body)
    if not ts:
        raise SystemExit(f"[{DOCS[doc]}] 절 {key} 에 표가 없다.")
    header, rows = ts[0]
    if expect_cols and header[: len(expect_cols)] != expect_cols:
        raise SystemExit(f"[{DOCS[doc]}] 절 {key} 표 열이 바뀌었다: {header} (기대 {expect_cols})")
    return header, rows


# ───────────────────────────────────────── 마크다운 → HTML (필요한 만큼만)
def inline(s):
    s = html.escape(s, quote=False)
    s = re.sub(r"`([^`]+)`", r"<code>\1</code>", s)
    s = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", s)
    s = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r'<a href="\2">\1</a>', s)
    return s


def render_table(header, rows, cls=""):
    th = "".join(f"<th>{inline(h)}</th>" for h in header)
    trs = "".join("<tr>" + "".join(f"<td>{inline(c)}</td>" for c in r) + "</tr>" for r in rows)
    return f'<div class="tbl {cls}"><table><thead><tr>{th}</tr></thead><tbody>{trs}</tbody></table></div>'


def render_md(body_lines, skip_tables=False, skip_code=False, skip_headings=True):
    out, i, n = [], 0, len(body_lines)
    while i < n:
        l = body_lines[i]
        if l.startswith("```"):
            j = i + 1
            while j < n and not body_lines[j].startswith("```"):
                j += 1
            if not skip_code:
                out.append("<pre class=\"tree\">" + html.escape("\n".join(body_lines[i + 1:j])) + "</pre>")
            i = j + 1
            continue
        if l.startswith("|"):
            j = i
            while j < n and body_lines[j].startswith("|"):
                j += 1
            if not skip_tables:
                h, r = tables(body_lines[i:j])[0]
                out.append(render_table(h, r))
            i = j
            continue
        if l.startswith("#"):
            if not skip_headings:
                out.append(f"<h4>{inline(re.sub(r'^#+ ', '', l))}</h4>")
            i += 1
            continue
        if l.startswith("> "):
            j = i
            q = []
            while j < n and body_lines[j].startswith(">"):
                q.append(body_lines[j][1:].strip())
                j += 1
            out.append("<blockquote>" + inline(" ".join(q)) + "</blockquote>")
            i = j
            continue
        if re.match(r"^\s*[-*] ", l) or re.match(r"^\s*\d+\. ", l):
            ordered = bool(re.match(r"^\s*\d+\. ", l))
            j = i
            items = []
            while j < n and (re.match(r"^\s*[-*] ", body_lines[j]) or re.match(r"^\s*\d+\. ", body_lines[j]) or (body_lines[j].startswith("  ") and items)):
                if re.match(r"^\s*([-*]|\d+\.) ", body_lines[j]):
                    items.append(re.sub(r"^\s*([-*]|\d+\.) ", "", body_lines[j]))
                else:
                    items[-1] += " " + body_lines[j].strip()
                j += 1
            tag = "ol" if ordered else "ul"
            out.append(f"<{tag}>" + "".join(f"<li>{inline(x)}</li>" for x in items) + f"</{tag}>")
            i = j
            continue
        if l.strip() == "":
            i += 1
            continue
        j = i
        p = []
        while j < n and body_lines[j].strip() and not re.match(r"^(```|\||#|> |\s*[-*] |\s*\d+\. )", body_lines[j]):
            p.append(body_lines[j].strip())
            j += 1
        out.append("<p>" + inline(" ".join(p)) + "</p>")
        i = j
    return "\n".join(out)


# ───────────────────────────────────────── mermaid 생성
def mm_id(s):
    return re.sub(r"[^0-9A-Za-z가-힣]", "_", s)


def mm_label(s):
    return s.replace('"', "'")


def architecture_flow():
    """01 §1 텍스트 흐름도를 노드와 간선 설명으로 읽는다."""
    _, body = section("01", "1")
    block, on = [], False
    for l in body:
        if l.startswith("```"):
            on = not on
            continue
        if on:
            block.append(l)
    nodes, edges, prev = [], [], None
    for l in block:
        if not l.strip():
            continue
        if l.lstrip().startswith("↓"):
            edges.append(l.lstrip()[1:].strip())
            continue
        m = re.match(r"^(\S+(?: \S+)*?)\s{2,}(.*)$", l)
        name, desc = (m.group(1), m.group(2)) if m else (l.strip(), "")
        nodes.append((name.strip(), desc.strip()))
    return nodes, edges


def mermaid_architecture():
    """01 §1 텍스트 흐름도 → flowchart TD."""
    nodes, edges = architecture_flow()
    out = ["flowchart TD"]
    for i, (name, desc) in enumerate(nodes):
        lab = name if not desc else f"{name}<br/><small>{desc}</small>"
        out.append(f'  N{i}["{mm_label(lab)}"]')
    for i in range(len(nodes) - 1):
        lab = edges[i] if i < len(edges) and edges[i] else ""
        out.append(f'  N{i} -- "{mm_label(lab)}" --> N{i+1}' if lab else f"  N{i} --> N{i+1}")
    return "\n".join(out)


def product_flow_spine():
    """첫 화면용 핵심 제품 흐름. 문구는 01 §1에서만 가져온다."""
    nodes, edges = architecture_flow()
    items = []
    for i, (name, desc) in enumerate(nodes):
        edge = edges[i - 1] if i > 0 and i - 1 < len(edges) else ""
        connector = (
            f'<div class="spine-edge">{html.escape(edge) if edge else "↓"}</div>'
            if i > 0 else ""
        )
        items.append(
            connector
            + f'<div class="spine-step"><span>{i + 1:02d}</span><div><strong>{html.escape(name)}</strong>'
            + (f'<small>{html.escape(desc)}</small>' if desc else "")
            + '</div></div>'
        )
    return '<div class="flow-spine" aria-label="CUVIA 핵심 제품 흐름">' + "".join(items) + '</div>'


def mermaid_state():
    """01 §7.4 전환표 → 기본 흐름과 예외·재개 흐름. 상세 조건은 접은 표로 함께 낸다."""
    header, rows = first_table("01", "7.4", ["현재 상태", "전환 조건", "다음 상태", "확정 주체"])
    required = {
        ("후보", "확인중"), ("후보", "오탐"), ("후보·확인중", "병합됨"),
        ("확인중", "대응중"), ("확인중", "오탐"),
        ("대응중", "대응중 (국면 안정)"), ("대응중 (안정)", "종료"), ("대응중 (안정)", "대응중"), ("종료", "확인중 또는 대응중"),
    }
    actual = {(cur, nxt) for cur, _, nxt, _ in rows}
    if actual != required:
        raise SystemExit("[01_이벤트·사건모델.md] §7.4 전환 행이 바뀌었다. overview 상태도를 다시 검토해야 한다.")

    # 처리상태 다섯(후보·확인중·대응중·종료·오탐) + 예외 병합됨. 안정은 대응중 안의 국면 (2026-09-14, 이름은 2026-09-16 통제 → 안정)
    primary = "\n".join([
        "flowchart TD",
        '  START((시작)) --> CAND["후보"]',
        '  CAND -->|담당자가 열어 검토 인수| REVIEW["확인중"]',
        '  REVIEW -->|실제 사건 판단 · 대응 시작<br/><small>자동 조치 즉시 · 승인 항목 대기</small>| RESPONDING["대응중"]',
        '  RESPONDING -->|확대 정지·감시 전환| CONTROLLED["대응중 · 안정 국면"]',
        '  CONTROLLED -->|종료 조건·잔여사항 정리| CLOSED["종료"]',
    ])
    exceptions = "\n".join([
        "flowchart TD",
        '  FALSE_SRC["오탐 판정 가능 상태<br/><small>후보 · 확인중</small>"]',
        '  FALSE_SRC -->|시험·중복·오경보 판정| FALSE["오탐<br/><small>기록 보존</small>"]',
        '  FALSE ~~~ MERGE_SRC',
        '  MERGE_SRC["병합 가능 상태<br/><small>후보 · 확인중</small>"]',
        '  MERGE_SRC -->|같은 원인·영향·업무 단위| MERGED["병합됨<br/><small>대상 사건으로 연결</small>"]',
        '  MERGED ~~~ CLOSED',
        '  CLOSED["종료"] -->|같은 원인 지속·위험 징후 재발| REOPEN{"재개"}',
        '  REOPEN -->|확인중으로 재개| REVIEW["확인중"]',
        '  REOPEN -->|대응중으로 재개| RESPONDING["대응중"]',
        # 안정 중 위험 재상승 (2026-09-16). 들어가는 것은 담당자, 풀리는 것은 시스템
        '  STABLE["대응중 · 안정 국면"] -->|새 이벤트로 위험등급 상향<br/><small>자동 해제 · 담당자 알림</small>| RESPONDING',
    ])
    return primary, exceptions, (header, rows)


def demo_transitions():
    """02 §7 D 절의 '상태 전환' 코드 줄."""
    tr = {}
    for d in range(9):
        _, body = section("02", f"D{d}")
        m = [l.strip("` ") for l in body if l.startswith("`") and "→" in l]
        if m:
            tr[f"D{d}"] = m[0]
    return tr


def mermaid_demo():
    """IA §13 동선표 + 02 상태 전환 → flowchart TD, 화면별 subgraph."""
    header, rows = first_table("IA", "13", ["시나리오", "화면", "화면에서 답할 질문", "주요 행위", "기준 라우트"])
    tr = demo_transitions()
    groups = {}
    order = []
    for sc, space, q, act, route in rows:
        d = sc.split()[0]
        if space not in groups:
            groups[space] = []
            order.append(space)
        groups[space].append((d, sc, q, act, route))
    out = ["flowchart TD"]
    for space in order:
        out.append(f'  subgraph {mm_id(space)}["{mm_label(space)}"]')
        out.append("    direction TB")
        for d, sc, q, act, route in groups[space]:
            lab = f"<b>{sc}</b><br/>{q}<br/><small>{act}</small><br/><code>{route}</code>"
            if d in tr:
                lab += f"<br/><code>{tr[d]}</code>"
            out.append(f'    {d}["{mm_label(lab)}"]')
        out.append("  end")
    ds = [r[0].split()[0] for r in rows]
    for a, b in zip(ds, ds[1:]):
        out.append(f"  {a} --> {b}")
    return "\n".join(out), (header, rows)


def mermaid_ia():
    """IA §5 요약표 → 상시 메뉴와 사건 내부 화면을 구분한 흐름."""
    header, rows = first_table("IA", "5", ["ID", "업무 공간", "제공 형태", "담당자의 핵심 질문", "대표 산출물", "데모 위치"])
    by_id = {r[0]: r for r in rows}
    _, body = section("IA", "5")
    route_header, route_rows = tables(subsection(body, "5.2 Phase 2 라우트 계약"))[0]
    routes = {r[0]: r[1] for r in route_rows}

    def node(rid, shape="rect"):
        _, name, form, q, _, demo = by_id[rid]
        label = f"<b>{rid} {name}</b><br/><small>{mm_label(form)} · {mm_label(demo)}</small><br/>{mm_label(q)}<br/><code>{mm_label(routes[rid])}</code>"
        if shape == "round":
            return f'  {mm_id(rid)}(["{label}"])'
        return f'  {mm_id(rid)}["{label}"]'

    out = ["flowchart TD", node("IA-01"), '  subgraph CASE["사건 내부 업무 흐름"]', "    direction TB"]
    for rid in ("IA-02", "IA-03", "IA-04"):
        out.append("  " + node(rid).strip())
    out += [
        "    IA_02 -->|예측 이벤트 선택| IA_03",
        "    IA_03 -->|이 전망으로 조치안 갱신| IA_04",
        "    IA_02 -.->|긴급 대응| IA_04",
        "  end",
        node("IA-05"),
        node("IA-07", "round"),
        node("IA-G01", "round"),
        node("IA-A01", "round"),
        "  IA_01 -->|사건·후보 선택| IA_02",
        "  IA_04 -->|결과·종료| IA_05",
        "  IA_05 -->|종료 사건| IA_07",
        "  IA_07 -.-|같은 트윈 부품| IA_03",
        "  IA_G01 -.- IA_02",
        "  IA_A01 -.- IA_01",
    ]
    return "\n".join(out), (header + ["기준 라우트"], [r + [routes[r[0]]] for r in rows])


def mermaid_hazard():
    """03 §13 재난명↔유형군 표 → 재난별 세로 묶음. 주 유형군 실선, 결합 점선."""
    header, rows = first_table("03", "13", ["재난·상황", "주 유형군", "결합 가능 유형군", "비고"])
    out = ["flowchart TD"]
    tails = []
    for i, (hz, main, combo, note) in enumerate(rows):
        h, m, c = f"H{i}", f"M{i}", f"C{i}"
        out.append(f'  {h}["<b>{mm_label(hz)}</b>"]')
        out.append(f'  {h} -->|주 유형군| {m}["{mm_label(main)}"]')
        if combo and combo not in ("없음", "-"):
            out.append(f'  {m} -.->|결합 가능| {c}["{mm_label(combo)}"]')
            tails.append(c)
        else:
            tails.append(m)
        if i > 0:
            out.append(f"  {tails[i - 1]} ~~~ {h}")
    return "\n".join(out), (header, rows)


# ───────────────────────────────────────── 조각들
def src(doc, sec):
    return f'<a class="src" href="{DOCS[doc]}" title="{DOCS[doc]}">근거 · {doc} §{sec}</a>'


def chip(text, kind=""):
    return f'<span class="chip {kind}">{html.escape(text)}</span>'


def sec_html(anchor, num, title, inner, sources):
    s = " ".join(src(d, k) for d, k in sources)
    return f'<section id="{anchor}"><header><span class="num">{num}</span><h2>{html.escape(title)}</h2><div class="srcs">{s}</div></header>{inner}</section>'


def mermaid_block(code, caption=""):
    cap = f'<figcaption>{inline(caption)}</figcaption>' if caption else ""
    return f'<figure class="mm"><pre class="mermaid">{html.escape(code)}</pre>{cap}</figure>'


def details(summary, inner, open_=False):
    return f'<details{" open" if open_ else ""}><summary>{inline(summary)}</summary>{inner}</details>'


# ───────────────────────────────────────── 본문 조립
parts = []

# 0. 방향 · 문서 상태
status_rows = [[DOCS[k], head_status(k)] for k in DOCS]
_, r2 = section("README", "2")
questions = render_md([l for l in r2 if re.match(r"^\d+\. ", l)])
_, r5 = section("README", "5")
principles = render_md(r5)
parts.append(sec_html("goal", "0", "방향과 검토 질문", (
    "<blockquote class=\"vision\">" + inline(head_quote("README", "2")) + "</blockquote>"
    + "<h3>Phase 2가 답해야 할 다섯 질문</h3>" + questions
    + details("설계 원칙 (README §5)", principles)
    + details("정본 문서 상태", render_table(["문서", "상태"], status_rows))
), [("README", "2"), ("README", "5"), ("README", "6")]))

# 1. 아키텍처
_, s9 = section("01", "9")
parts.append(sec_html("arch", "1", "아키텍처 · 원천에서 결과까지", (
    mermaid_block(mermaid_architecture(), "01 §1의 텍스트 흐름도를 그대로 그린 것")
    + "<h3>이벤트가 쓰이는 자리</h3>" + render_md(s9)
), [("01", "1"), ("01", "9")]))

# 2. 이벤트 → 사건
_, s3 = section("01", "3")
_, s6 = section("01", "6")
_, s71 = section("01", "7.1")
_, s8 = section("01", "8")
state_primary_mm, state_exception_mm, (sh, srows) = mermaid_state()
parts.append(sec_html("incident", "2", "이벤트에서 사건으로", (
    "<h3>먼저 가르는 세 축</h3>" + render_md(s3)
    + "<h3>사건 처리상태 기본 흐름</h3>"
    + mermaid_block(state_primary_mm, "대표 사건이 후보에서 종료까지 진행하는 주 흐름")
    + "<h3>예외 판정과 종료 후 재개</h3>"
    + mermaid_block(state_exception_mm, "오탐·병합은 기록을 보존하고, 종료 사건은 확인중 또는 대응중으로 재개")
    + details("전환 조건 상세", render_table(sh, srows))
    + "<h3>사건 구조</h3>" + render_md(s8)
    + details("표준 이벤트 유형 22개 (01 §6)", render_md(s6))
    + details("사건 후보가 만들어지는 조건 (01 §7.1)", render_md(s71))
), [("01", "3"), ("01", "7.4"), ("01", "8"), ("01", "6")]))

# 3. 대표 데모
_, s1 = section("02", "1")
_, s4 = section("02", "4")
_, s51 = section("02", "5.1")
_, s52 = section("02", "5.2")
_, s12 = section("02", "12")
demo_mm, (dh, drows) = mermaid_demo()
tr = demo_transitions()
drows2 = [r + [tr.get(r[0].split()[0], "")] for r in drows]
parts.append(sec_html("demo", "3", "대표 데모 · 창원 도시침수 D0~D8", (
    render_md(s1)
    + "<h3>사건 정의</h3>" + render_md(s4)
    + "<h3>시나리오 흐름</h3>"
    + mermaid_block(demo_mm, "단계·업무 공간·질문·행위는 IA §13, 상태 전환은 02 §7")
    + details("D0~D8 단계별 질문·행위·상태 전환", render_table(dh + ["상태 전환 (02 §7)"], drows2, "wide"))
    + details("들어오는 이벤트 (02 §5.1)", render_md(s51))
    + details("CUVIA 내부 업무 이벤트 (02 §5.2)", render_md(s52))
    + "<h3>확정 전 확인할 사항과 축소안</h3>" + render_md(s12)
), [("02", "1"), ("02", "4"), ("02", "7"), ("IA", "13"), ("02", "12")]))

# 4. 업무 공간과 화면 이동
_, ia4 = section("IA", "4")
_, ia5 = section("IA", "5")
_, ia131 = section("IA", "13.1")
_, ia14 = section("IA", "14")
_, ia15 = section("IA", "15")
_, ia17 = section("IA", "17")
_, ia20 = section("IA", "20")
ia_mm, (ih, irows) = mermaid_ia()
space_blocks = []
for key, label in (("6", "IA-01 종합상황"), ("7", "IA-02 사건 작업공간"), ("8", "IA-03 전망 탭 · 기준과 대안"), ("9", "IA-04 대응·실행"), ("10", "IA-05 기록·검증"), ("11", "IA-G01 공통 AI 보조"), ("12", "IA-A01 운영 관리")):
    t, b = section("IA", key)
    space_blocks.append(details(t, render_md(b, skip_headings=False)))
parts.append(sec_html("ia", "4", "업무 공간과 화면 관계", (
    mermaid_block(ia_mm, "상시 메뉴, 사건 내부 화면 모드와 팝업을 구분한 IA §5 흐름")
    + '<p>SCR-02의 지도·관련 이벤트·판단·전망·대응 집중 팝업 배치는 ' + src("04", "2") + '에서 확인한다.</p>'
    + '<p>디지털트윈의 유형별 장면·광역 인셋·표현 부품은 ' + src("03", "22") + ', 모의훈련(IA-07)의 시나리오·비교·개선 항목은 ' + src("03", "26") + '에서 확인한다.</p>'
    + render_table(ih, irows, "wide")
    + details("전체 메뉴·화면 구조 (IA §4)", render_md(ia4))
    + details("라우트 계약·전환·예외 처리 (IA §5.2)", render_md(subsection(ia5, "5.2 Phase 2 라우트 계약"), skip_headings=False))
    + details("화면 간 유지할 사건 맥락", render_md(ia14))
    + details("공통 정보 객체", render_md(ia15))
    + details("D8 → 기록·검증 예측 케이스 계약 (IA §13.1)", render_md(ia131))
    + "<h3>업무 공간별 상세</h3>" + "".join(space_blocks)
    + details("Phase 1 화면 초기 판정 (IA §17)", render_md(ia17))
    + details("확정 전 확인할 사항 (IA §20)", render_md(ia20))
), [("IA", "4"), ("IA", "5.2"), ("IA", "13.1"), ("IA", "14"), ("IA", "15"), ("IA", "17")]))

# 5. 트윈 유형군
_, t2 = section("03", "2")
_, t5 = section("03", "5")
_, t14 = section("03", "14")
_, t15 = section("03", "15")
_, t16 = section("03", "16")
_, t17 = section("03", "17")
hz_mm, (hh, hrows) = mermaid_hazard()
type_blocks = []
for key in ("6", "7", "8", "9", "10", "11", "12"):
    t, b = section("03", key)
    type_blocks.append(details(t, render_md(b, skip_headings=False)))
parts.append(sec_html("twin", "5", "유형별 디지털트윈", (
    render_md(t2)
    + "<h3>Phase 2 트윈 유형군</h3>" + render_md(t5)
    + "<h3>재난명과 유형군</h3>"
    + mermaid_block(hz_mm, "재난별로 주 유형군을 먼저 읽고, 점선의 결합 가능 유형군을 확인한다. 03 §13")
    + "<h3>복합재난</h3>" + render_md(t14)
    + "<h3>준비도</h3>" + render_md(t15)
    + "<h3>모의훈련의 유형별 조건 기준안</h3>" + render_md(subsection(t16, "모의훈련의 유형별 조건 기준안 (2026-09-15 · 2026-09-16 모의훈련으로 고침)"))
    + "<h3>IA에서의 역할</h3>" + render_md(t17)
    + "<h3>유형군별 계약</h3>" + "".join(type_blocks)
), [("03", "2"), ("03", "5"), ("03", "13"), ("03", "14"), ("03", "15"), ("03", "16")]))

# 6. 상태축
_, s11 = section("01", "11")
_, d6 = section("02", "6")
parts.append(sec_html("axes", "6", "정직한 상태 표시 · 네 축", (
    render_md(s11) + "<h3>데모에서의 표시</h3>" + render_md(d6)
), [("01", "11"), ("02", "6")]))

# 7. 결정 상태 · 다음 작업
_, r81 = section("README", "8.1")
_, r82 = section("README", "8.2")
_, r10 = section("README", "10")
_, r11 = section("README", "11")
_, r7 = section("README", "7")
implementation_tables = tables(r7)
if not implementation_tables or implementation_tables[0][0] != ["구현 묶음", "범위", "완료 기준"]:
    raise SystemExit("[README.md] §7 구현 묶음 표를 찾지 못했다.")
implementation_header, implementation_rows = implementation_tables[0]
gates = [[re.sub(r"^### ", "", l), ""] for l in r7 if l.startswith("### ")]
gate_lines = [l for l in r7 if l.startswith("완료 관문:")]
for g, gl in zip(gates, gate_lines):
    g[1] = gl.replace("완료 관문:", "").strip()
open_items = [["01", l] for l in section("01", "12.2")[1] if l.startswith("|") and not l.startswith("| 우선") and "---" not in l]
parts.append(sec_html("decisions", "7", "결정 상태와 다음 작업", (
    "<h3>확정된 원칙</h3>" + render_md(r81)
    + "<h3>권고 기준안</h3>" + render_md(r82)
    + "<h3>아직 결정하지 않은 항목</h3>" + render_md(r10)
    + "<h3>단계와 완료 관문</h3>" + render_table(["단계", "완료 관문"], gates)
    + "<h3>구현 순서</h3>" + render_table(implementation_header, implementation_rows)
    + "<h3>바로 다음 작업</h3>" + render_md(r11)
), [("README", "8"), ("README", "10"), ("README", "7"), ("README", "11")]))

# 8. 검수 기록
review_dir = ROOT / "검수"
reviews = sorted(p.name for p in review_dir.glob("*.md")) if review_dir.exists() else []
rv = "<ul>" + "".join(f'<li><a href="검수/{html.escape(n)}">{html.escape(n)}</a></li>' for n in reviews) + "</ul>"
parts.append(sec_html("review", "8", "검수 기록", (
    "<p>정본이 아니라 특정 시점 문서에 대한 점검 기록이다. 결함과 단계 의존 항목은 각 파일 머리에서 갈라 두었다.</p>" + rv
), [("README", "6.1")]))

toc = [("goal", "0 방향"), ("arch", "1 아키텍처"), ("incident", "2 이벤트→사건"), ("demo", "3 대표 데모"), ("ia", "4 화면 관계"), ("twin", "5 트윈 유형군"), ("axes", "6 상태축"), ("decisions", "7 결정·다음 작업"), ("review", "8 검수 기록")]
toc_html = "".join(f'<a href="#{a}">{html.escape(t)}</a>' for a, t in toc)
built = datetime.now().strftime("%Y-%m-%d %H:%M")
mtimes = " · ".join(f"{k} {datetime.fromtimestamp((ROOT / v).stat().st_mtime).strftime('%H:%M')}" for k, v in DOCS.items())

CSS = r"""
<style>
:root{
  --bg:#F4F6F7; --surface:#FFFFFF; --ink:#182129; --muted:#56656F; --line:#D3DBE0; --line-soft:#E6ECEF;
  --accent:#0F5F7E; --accent-ink:#0A4660; --accent-soft:#E3EFF4;
  --warn:#B5720B; --crit:#AE3A31; --code-bg:#EEF2F4;
  --mm-node:#E3EFF4; --mm-line:#0F5F7E; --mm-ink:#182129;
  --sans:"IBM Plex Sans KR","Apple SD Gothic Neo","Noto Sans KR",system-ui,sans-serif;
  --mono:"IBM Plex Mono","SF Mono",Menlo,monospace;
}
@media (prefers-color-scheme: dark){ :root:not([data-theme="light"]){
  --bg:#141A1F; --surface:#1B2329; --ink:#E6ECEF; --muted:#9AA8B2; --line:#2E3A43; --line-soft:#242E36;
  --accent:#5FB3D3; --accent-ink:#8FCCE3; --accent-soft:#1E3440;
  --warn:#E0A54A; --crit:#E07068; --code-bg:#232D35;
  --mm-node:#1E3440; --mm-line:#5FB3D3; --mm-ink:#E6ECEF;
}}
:root[data-theme="dark"]{
  --bg:#141A1F; --surface:#1B2329; --ink:#E6ECEF; --muted:#9AA8B2; --line:#2E3A43; --line-soft:#242E36;
  --accent:#5FB3D3; --accent-ink:#8FCCE3; --accent-soft:#1E3440;
  --warn:#E0A54A; --crit:#E07068; --code-bg:#232D35;
  --mm-node:#1E3440; --mm-line:#5FB3D3; --mm-ink:#E6ECEF;
}
*{box-sizing:border-box}
html{scroll-behavior:smooth;scroll-padding-top:24px}
body{margin:0;background:radial-gradient(circle at 12% 0,var(--surface) 0,transparent 32rem),var(--bg);color:var(--ink);font-family:var(--sans);font-size:15px;line-height:1.65}
a{color:var(--accent);text-decoration:none}a:hover{text-decoration:underline}
a:focus-visible,summary:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.skip{position:fixed;left:16px;top:12px;z-index:2;transform:translateY(-160%);padding:8px 12px;background:var(--ink);color:var(--surface);border-radius:3px}.skip:focus{transform:none}
.wrap{display:grid;grid-template-columns:220px minmax(0,1fr);gap:56px;max-width:1380px;margin:0 auto;padding:40px 32px 112px}
nav.toc{position:sticky;top:24px;align-self:start;display:flex;flex-direction:column;gap:2px;font-size:13.5px}
nav.toc a{padding:7px 10px;border-left:2px solid var(--line-soft);color:var(--muted);transition:color .2s,border-color .2s,background .2s}
nav.toc a:hover{border-left-color:var(--accent);color:var(--ink);text-decoration:none}
nav.toc a.active{border-left-color:var(--accent);color:var(--accent-ink);background:var(--accent-soft);font-weight:600}
nav.toc .meta{margin-top:18px;padding:10px;border-top:1px solid var(--line);color:var(--muted);font-size:12px;line-height:1.5}
main{min-width:0;max-width:980px}
h1{font-size:clamp(28px,4vw,42px);font-weight:600;line-height:1.12;letter-spacing:-.035em;margin:0 0 10px;text-wrap:balance}
.lede{color:var(--muted);margin:0 0 52px;max-width:64ch;font-size:16px}
.flow-intro{margin:0 0 64px;padding:24px 26px;background:var(--surface);border:1px solid var(--line);border-top:3px solid var(--accent)}
.flow-intro h2{margin:0 0 4px;font-size:21px;letter-spacing:-.02em}
.flow-intro>p{margin-bottom:22px;color:var(--muted)}
.flow-spine{display:flex;flex-direction:column;max-width:720px}
.spine-step{display:grid;grid-template-columns:42px 1fr;gap:12px;align-items:start}
.spine-step>span{font-family:var(--mono);font-size:11px;color:var(--accent);padding-top:4px}
.spine-step strong{display:block;font-size:16px;font-weight:600}
.spine-step small{display:block;margin-top:2px;color:var(--muted);font-size:13px;line-height:1.45}
.spine-edge{margin:5px 0 5px 19px;padding:5px 0 5px 34px;border-left:1px solid var(--accent);color:var(--accent-ink);font-size:12px}
section{margin:0 0 72px;padding-top:8px}
section>header{display:grid;grid-template-columns:auto 1fr;gap:6px 14px;align-items:baseline;border-bottom:1px solid var(--line);padding-bottom:10px;margin-bottom:18px}
section>header .num{font-family:var(--mono);font-size:13px;color:var(--accent);letter-spacing:.06em}
section>header h2{margin:0;font-size:23px;font-weight:600;letter-spacing:-.02em;text-wrap:balance}
section>header .srcs{grid-column:2;display:flex;flex-wrap:wrap;gap:6px}
.src{font-family:var(--mono);font-size:11.5px;color:var(--muted);border:1px solid var(--line);border-radius:3px;padding:1px 7px}
.src:hover{color:var(--accent);border-color:var(--accent);text-decoration:none}
h3{font-size:15px;font-weight:600;margin:28px 0 8px;color:var(--ink)}
h4{font-size:14px;font-weight:600;margin:18px 0 6px;color:var(--muted);text-transform:none}
p{margin:0 0 10px;max-width:72ch}
blockquote{margin:12px 0 14px;padding:12px 18px;border-left:3px solid var(--accent);background:var(--accent-soft);color:var(--ink);max-width:72ch;font-weight:500}
blockquote.vision{margin:0 0 28px;padding:20px 24px;font-size:18px;line-height:1.55;letter-spacing:-.01em}
ul,ol{margin:0 0 12px;padding-left:22px;max-width:76ch}li{margin:2px 0}
code{font-family:var(--mono);font-size:.88em;background:var(--code-bg);padding:1px 5px;border-radius:3px}
pre.tree{font-family:var(--mono);font-size:12.5px;line-height:1.55;background:var(--surface);border:1px solid var(--line);border-radius:4px;padding:14px 16px;overflow-x:auto;margin:10px 0 14px}
.tbl{overflow-x:auto;margin:8px 0 16px;border:1px solid var(--line);border-radius:4px;background:var(--surface)}
table{border-collapse:collapse;width:100%;font-size:13.5px;font-variant-numeric:tabular-nums}
th,td{padding:7px 10px;border-bottom:1px solid var(--line-soft);vertical-align:top;text-align:left}
th{font-weight:600;color:var(--muted);font-size:12.5px;letter-spacing:.02em;background:var(--bg);white-space:nowrap}
tbody tr:last-child td{border-bottom:0}
td code{white-space:nowrap}
figure.mm{margin:8px 0 18px;padding:14px 12px 8px;background:var(--surface);border:1px solid var(--line);border-radius:4px;overflow-x:auto}
figure.mm pre.mermaid{margin:0;font-family:var(--mono);font-size:12px;color:var(--muted)}
figure.mm svg{display:block;max-width:100%;height:auto;margin:0 auto}
figure.mm figcaption{font-size:12.5px;color:var(--muted);margin-top:8px}
details{border:1px solid var(--line);border-radius:4px;background:var(--surface);margin:8px 0 12px;padding:0 14px}
details>summary{cursor:pointer;padding:10px 0;font-weight:500;color:var(--accent-ink);list-style:none;transition:color .2s}
details>summary:hover{color:var(--accent)}
details>summary::before{content:"▸ ";color:var(--muted)}details[open]>summary::before{content:"▾ "}
details[open]>summary{border-bottom:1px solid var(--line-soft);margin-bottom:8px}
details .tbl{border:0;margin-left:-14px;margin-right:-14px;border-top:1px solid var(--line-soft);border-radius:0}
.chip{display:inline-block;font-family:var(--mono);font-size:11.5px;padding:1px 7px;border-radius:3px;background:var(--code-bg);color:var(--ink)}
@media (max-width:900px){.wrap{grid-template-columns:1fr;gap:24px;padding:24px 18px 80px}nav.toc{position:static;flex-direction:row;flex-wrap:wrap}nav.toc .meta{width:100%;border-top:0}section{margin-bottom:56px}}
@media (prefers-reduced-motion: reduce){*{scroll-behavior:auto!important}}
</style>
"""

body = f"""
<a class="skip" href="#main">본문으로 건너뛰기</a>
<div class="wrap">
<nav class="toc" aria-label="문서 목차">{toc_html}<div class="meta">정본에서 생성 · {built}<br/>{mtimes}<br/>값이 다르면 MD가 우선한다</div></nav>
<main id="main">
<h1>CUVIA NDMS Phase 2 고도화 개요</h1>
<p class="lede">한 건의 재난 사건으로 데이터 수집부터 위험 판단, 예측, 대응과 보고까지 보여주는 Phase 2 방향.</p>
<div class="flow-intro">
<h2>한눈에 보는 제품 흐름</h2>
<p>데모와 이후 제품 개발이 공통으로 따라갈 중심 동선</p>
{product_flow_spine()}
</div>
{''.join(parts)}
</main>
</div>
"""

MERMAID_INIT = """
<script>
(function(){
  var dark = document.documentElement.getAttribute('data-theme')==='dark' ||
    (document.documentElement.getAttribute('data-theme')!=='light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  var v = dark ? {background:'#1B2329',primaryColor:'#1E3440',primaryTextColor:'#E6ECEF',primaryBorderColor:'#5FB3D3',lineColor:'#9AA8B2',secondaryColor:'#232D35',tertiaryColor:'#141A1F',clusterBkg:'#141A1F',clusterBorder:'#2E3A43',edgeLabelBackground:'#1B2329',fontFamily:'IBM Plex Sans KR, Apple SD Gothic Neo, sans-serif'}
                 : {background:'#FFFFFF',primaryColor:'#E3EFF4',primaryTextColor:'#182129',primaryBorderColor:'#0F5F7E',lineColor:'#56656F',secondaryColor:'#EEF2F4',tertiaryColor:'#F4F6F7',clusterBkg:'#F4F6F7',clusterBorder:'#D3DBE0',edgeLabelBackground:'#FFFFFF',fontFamily:'IBM Plex Sans KR, Apple SD Gothic Neo, sans-serif'};
  if (window.mermaid) mermaid.initialize({startOnLoad:true,theme:'base',themeVariables:v,flowchart:{htmlLabels:true,curve:'basis'},securityLevel:'loose'});
  var links = Array.from(document.querySelectorAll('nav.toc > a'));
  var targets = links.map(function(a){ return document.querySelector(a.getAttribute('href')); }).filter(Boolean);
  if ('IntersectionObserver' in window) {
    var observer = new IntersectionObserver(function(entries){
      var visible = entries.filter(function(e){ return e.isIntersecting; }).sort(function(a,b){ return a.boundingClientRect.top-b.boundingClientRect.top; })[0];
      if (!visible) return;
      links.forEach(function(a){ a.classList.toggle('active', a.getAttribute('href') === '#' + visible.target.id); });
    }, {rootMargin:'-15% 0px -70% 0px',threshold:0});
    targets.forEach(function(el){ observer.observe(el); });
  }
})();
</script>
"""

FONTS = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+KR:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap">'

if FRAGMENT:
    doc = f"<title>NDMS Phase 2 고도화 개요</title>\n{FONTS}\n{CSS}\n{body}"
else:
    doc = f"""<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="description" content="CUVIA NDMS Phase 2 제품 방향, 사건 구조, 대표 데모와 화면 관계 요약">
<title>NDMS Phase 2 고도화 개요</title>
{FONTS}
{CSS}
</head>
<body>
{body}
<script src="https://cdn.jsdelivr.net/npm/mermaid@11.4.1/dist/mermaid.min.js"></script>
{MERMAID_INIT}
</body>
</html>"""

OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(doc, encoding="utf-8")
print("saved", OUT, f"({len(doc)//1024} KB)", "fragment" if FRAGMENT else "standalone")
