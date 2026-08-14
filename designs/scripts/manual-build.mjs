/* ─────────────────────────────────────────────
 * 간이 사용 매뉴얼 HTML 만들기
 *
 * manual-shots.mjs 가 뽑아 둔 data.json(그림 + 표식 좌표)을 읽어 16:9 슬라이드
 * 한 벌로 엮는다. 그림은 JPEG 로 줄여 base64 로 박아 파일 하나로 끝낸다 —
 * 폴더째 옮기지 않아도 열리고, 브라우저 인쇄로 그대로 PDF · PPT 가 된다.
 *
 * 사용: node scripts/manual-build.mjs   # → ../manual-capture/간이매뉴얼.html
 * ───────────────────────────────────────────── */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const DIR = path.resolve(process.env.OUT ?? "../manual-capture");
const data = JSON.parse(fs.readFileSync(path.join(DIR, "data.json"), "utf8"));
const OUT_FILE = path.join(DIR, "CUVIA_안전재난관제_간이매뉴얼.html");

const SW = data.width;
const SH = data.height;

/* 그림 — PNG 를 JPEG 로 줄여 data URI 로. 원본 PNG 한 장이 0.8MB 라 그대로 박으면
   파일이 10MB 를 넘고 브라우저가 버벅인다 */
const jpegCache = new Map();
function dataUri(rel) {
  if (jpegCache.has(rel)) return jpegCache.get(rel);
  const src = path.join(DIR, rel);
  const tmp = path.join(os.tmpdir(), `manual-${path.basename(rel, ".png")}.jpg`);
  execFileSync("sips", ["-s", "format", "jpeg", "-s", "formatOptions", "80", src, "--out", tmp], {
    stdio: "ignore",
  });
  const uri = `data:image/jpeg;base64,${fs.readFileSync(tmp).toString("base64")}`;
  fs.rmSync(tmp, { force: true });
  jpegCache.set(rel, uri);
  return uri;
}

/* ── 번호 자리 잡기 ───────────────────────────
   표식 상자의 왼쪽 위 모서리에 번호를 붙인다. 가장자리를 벗어나지 않게 물리고,
   번호끼리 겹치면 아래로 밀어 둘 다 읽히게 한다 */
const BADGE = 30; // px, 원본 그림 좌표계
function placeBadges(marks) {
  const placed = [];
  for (const mark of marks) {
    const { x, y, w, h } = mark.box;
    /* 큰 패널은 왼쪽 위 모서리에, 버튼은 왼쪽 바깥에 붙인다.
       버튼 한가운데에 얹으면 정작 읽어야 할 글자를 번호가 가린다 */
    const panel = w >= 110 && h >= 46;
    let cx;
    let cy;
    if (panel) {
      /* 패널 안쪽 모서리에 얹으면 카드 제목을 가린다. 왼쪽 바깥에 세우고,
         화면 끝에 붙은 패널만 안으로 들인다 */
      cx = x - BADGE * 0.55 > BADGE * 0.7 ? x - BADGE * 0.55 : x + BADGE * 0.6;
      cy = y + BADGE * 0.55;
    } else {
      cy = y + h / 2;
      cx = x - BADGE * 0.62 > BADGE * 0.7 ? x - BADGE * 0.62 : x + w + BADGE * 0.62;
    }
    cx = Math.min(Math.max(cx, BADGE * 0.7), SW - BADGE * 0.7);
    cy = Math.min(Math.max(cy, BADGE * 0.7), SH - BADGE * 0.7);
    let guard = 0;
    while (
      guard < 12 &&
      placed.some((p) => Math.hypot(p.cx - cx, p.cy - cy) < BADGE * 1.15)
    ) {
      cy += BADGE * 1.2;
      if (cy > SH - BADGE) {
        cy = Math.min(Math.max(y + 2, BADGE), SH - BADGE);
        cx += BADGE * 1.2;
      }
      guard += 1;
    }
    placed.push({ ...mark, cx, cy });
  }
  return placed;
}

const pct = (v, total) => `${((v / total) * 100).toFixed(3)}%`;
const esc = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

/* ── 슬라이드 ────────────────────────────────── */
function contentSlide(stop, no, total) {
  const marks = placeBadges(stop.marks);
  const boxes = marks
    .map(
      (m, i) => `
        <span class="hit ${m.kind}" style="left:${pct(m.box.x, SW)};top:${pct(m.box.y, SH)};width:${pct(m.box.w, SW)};height:${pct(m.box.h, SH)}"></span>
        <span class="pin ${m.kind}" style="left:${pct(m.cx, SW)};top:${pct(m.cy, SH)}">${i + 1}</span>`,
    )
    .join("");

  const notes = marks
    .map(
      (m, i) => `
        <li class="note">
          <span class="num ${m.kind}">${i + 1}</span>
          <div><b>${esc(m.label)}</b><p>${esc(m.desc)}</p></div>
        </li>`,
    )
    .join("");

  return `
    <section class="slide" id="s${no}">
      <header class="head">
        <span class="scr">${esc(stop.scr)}</span>
        <h2>${esc(stop.title)}</h2>
        <span class="pageno">${no} / ${total}</span>
      </header>
      <div class="body">
        <div class="shot">
          <div class="frame">
            <img src="${dataUri(stop.shot)}" alt="${esc(stop.title)}" loading="lazy" />
            ${boxes}
          </div>
        </div>
        <aside class="side${marks.length >= 7 ? " dense" : ""}">
          <p class="lead">${esc(stop.lead)}</p>
          ${marks.length ? `<ul class="notes">${notes}</ul>` : ""}
        </aside>
      </div>
    </section>`;
}

function coverSlide(shot, total) {
  return `
    <section class="slide cover" id="s0">
      <div class="cover-art"><img src="${dataUri(shot)}" alt="" /></div>
      <div class="cover-copy">
        <span class="brand">CUVIA</span>
        <h1>안전재난관제시스템<br />간이 사용 매뉴얼</h1>
        <p>구현된 화면을 차례로 열어 두고, 누르는 버튼과 읽는 자리에 번호를 붙였습니다.
           위험지구 이벤트는 봉암지구 내수침수 하나를 예시로 씁니다.</p>
        <ul class="cover-list">
          <li><b>SCR-01</b> 종합상황</li>
          <li><b>SCR-02</b> 재난관제</li>
          <li><b>SCR-04</b> 통계 · 분석</li>
          <li><b>SCR-05</b> 디지털트윈</li>
          <li><b>공통</b> 이벤트 알람 · AI 에이전트</li>
        </ul>
        <div class="cover-meta"><span>슬라이드 ${total}장</span><span>16:9</span><span>창원특례시</span></div>
      </div>
    </section>`;
}

function legendSlide(no, total) {
  return `
    <section class="slide" id="s${no}">
      <header class="head">
        <span class="scr">읽는 법</span>
        <h2>번호 표시 규칙과 PPT 로 옮기기</h2>
        <span class="pageno">${no} / ${total}</span>
      </header>
      <div class="body legend-body">
        <div class="legend-card">
          <h3>번호 색</h3>
          <ul class="legend-list">
            <li><span class="num act">1</span><div><b>주황 · 실선</b><p>눌러서 무언가 일어나는 곳. 버튼 · 목록 줄 · 지도 핀 · 탭.</p></div></li>
            <li><span class="num read">2</span><div><b>하늘 · 점선</b><p>읽는 자리. 값을 보여 주는 패널과 표시.</p></div></li>
          </ul>
          <h3>화면 번호</h3>
          <p class="legend-p">SCR-01 종합상황, SCR-02 재난관제, SCR-04 통계 · 분석, SCR-05 디지털트윈.
             SCR-03 은 재난관제로 합쳐져 결번입니다.</p>
        </div>
        <div class="legend-card">
          <h3>PPT 로 옮기기</h3>
          <ol class="legend-steps">
            <li>이 파일을 브라우저에서 열고 <b>인쇄</b>(⌘P)를 누릅니다.</li>
            <li>대상을 <b>PDF 로 저장</b>, 용지 방향 <b>가로</b>, 여백 <b>없음</b>,
                <b>배경 그래픽</b>을 켭니다. 슬라이드 한 장이 한 페이지로 떨어집니다.</li>
            <li>PowerPoint 에서 <b>삽입 → 개체 → 파일에서</b> 로 PDF 를 넣거나,
                Keynote 는 PDF 를 그대로 열어 페이지마다 한 장으로 받습니다.</li>
          </ol>
          <p class="legend-p">화면을 고친 뒤에는 <code>node scripts/manual-shots.mjs</code> 와
             <code>node scripts/manual-build.mjs</code> 를 차례로 돌리면 그림과 번호 위치가 함께 갱신됩니다.</p>
        </div>
        <div class="legend-card flow-card">
          <h3>화면 이동</h3>
          <div class="flow">
            <div class="flow-step"><b>종합상황</b><span>시 전체를 보고 지구를 고른다</span></div>
            <div class="flow-step"><b>재난관제</b><span>지구 하나로 좁혀 계측과 영상을 본다</span></div>
            <div class="flow-step"><b>대응 실행 팝업</b><span>절차를 고르고 전파한다</span></div>
            <div class="flow-step"><b>디지털트윈</b><span>조건을 바꿔 영향을 확인한다</span></div>
            <div class="flow-step"><b>통계 · 분석</b><span>지난 기간을 되짚는다</span></div>
          </div>
          <p class="legend-p">어느 화면에서든 오른쪽 아래 <b>AI 에이전트</b> 버튼으로 물어볼 수 있고,
             이벤트 <b>알람</b>은 화면과 상관없이 위쪽에 뜹니다.</p>
        </div>
      </div>
    </section>`;
}

/* ── 엮기 ────────────────────────────────────── */
const total = data.stops.length + 1; // 표지 제외, 읽는 법 포함
const slides = [
  coverSlide(data.stops[1]?.shot ?? data.stops[0].shot, total),
  legendSlide(1, total),
  ...data.stops.map((stop, i) => contentSlide(stop, i + 2, total)),
];

const head = `<title>CUVIA 안전재난관제 간이 매뉴얼</title>
<style>
  :root {
    --bg: #0a0e15; --ink: #eef2f8; --dim: #97a6bd; --line: #22304a;
    --card: #101827; --act: #ff9d2e; --read: #47c6ff;
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: #05080d; color: var(--ink);
    font-family: Pretendard, "Apple SD Gothic Neo", "Noto Sans KR", system-ui, sans-serif; }
  .bar { position: sticky; top: 0; z-index: 50; display: flex; align-items: center; gap: 14px;
    height: 52px; padding: 0 20px; background: rgba(8,12,19,.93); border-bottom: 1px solid var(--line);
    backdrop-filter: blur(12px); font-size: 13px; }
  .bar strong { margin-right: auto; font-weight: 700; letter-spacing: -.01em; }
  .bar button { font: inherit; color: #dbe6f6; background: #16202f; border: 1px solid #2c3b53;
    border-radius: 7px; padding: 7px 12px; cursor: pointer; }
  .bar button:hover { border-color: var(--read); }
  .deck { padding: 26px 0 60px; }

  .slide { position: relative; width: min(calc(100vw - 40px), 1600px); aspect-ratio: 16 / 9;
    margin: 0 auto 30px; background: var(--bg); border: 1px solid var(--line);
    border-radius: 4px; overflow: hidden; container-type: size; }
  .head { display: flex; align-items: center; gap: 2.2cqw; height: 11cqh; padding: 0 2.4cqw;
    border-bottom: 1px solid var(--line); }
  .scr { flex: none; font-size: 1.35cqw; font-weight: 800; letter-spacing: .1em; color: var(--read);
    border: 1px solid rgba(71,198,255,.4); border-radius: 999px; padding: .5cqh 1cqw; }
  .head h2 { margin: 0; font-size: 2.1cqw; letter-spacing: -.03em; font-weight: 700; }
  .pageno { margin-left: auto; font-size: 1.3cqw; color: #64748b; font-weight: 700; }

  .body { display: grid; grid-template-columns: 1fr 27.5cqw; height: 89cqh; }
  /* 그림 틀은 원본과 같은 비율이라야 한다. 칸을 그대로 쓰고 object-fit 으로 맞추면
     남는 여백만큼 번호가 밀려 엉뚱한 곳을 가리킨다 */
  .shot { display: grid; place-items: center; background: #05080d; overflow: hidden; }
  .frame { position: relative; width: min(100%, calc(89cqh * ${(SW / SH).toFixed(4)}));
    aspect-ratio: ${SW} / ${SH}; }
  .frame img { display: block; width: 100%; height: 100%; }
  .side { padding: 2.4cqh 1.7cqw; border-left: 1px solid var(--line); background: #0b111c; overflow: hidden; }
  .lead { margin: 0 0 2.2cqh; font-size: 1.28cqw; line-height: 1.55; color: #c6d3e6; }
  .notes { margin: 0; padding: 0; list-style: none; }
  .note { display: grid; grid-template-columns: 2.1cqw 1fr; gap: .9cqw; margin-bottom: 1.7cqh; }
  .note b { display: block; font-size: 1.22cqw; line-height: 1.3; }
  .note p { margin: .35cqh 0 0; font-size: 1.02cqw; line-height: 1.45; color: var(--dim); }
  .num { display: grid; place-items: center; width: 2.1cqw; height: 2.1cqw; border-radius: 50%;
    font-size: 1.15cqw; font-weight: 800; color: #08111c; }
  .num.act, .pin.act { background: var(--act); }
  .num.read, .pin.read { background: var(--read); }

  /* 번호가 일곱을 넘는 화면 — 글자를 한 단 줄여 한 장에 다 담는다 */
  .side.dense { padding: 2cqh 1.5cqw; }
  .side.dense .lead { font-size: 1.11cqw; margin-bottom: 1.2cqh; }
  .side.dense .note { grid-template-columns: 1.8cqw 1fr; gap: .75cqw; margin-bottom: .9cqh; }
  .side.dense .note b { font-size: 1.06cqw; }
  .side.dense .note p { font-size: .9cqw; line-height: 1.34; }
  .side.dense .num { width: 1.8cqw; height: 1.8cqw; font-size: .98cqw; }

  /* 그림 위 표식 — 상자는 무엇을 가리키는지, 번호는 설명과 잇는다 */
  .hit { position: absolute; border-radius: 5px; pointer-events: none; }
  .hit.act { border: .17cqw solid var(--act); box-shadow: 0 0 0 .17cqw rgba(0,0,0,.5); }
  .hit.read { border: .17cqw dashed var(--read); box-shadow: 0 0 0 .17cqw rgba(0,0,0,.45); }
  .pin { position: absolute; display: grid; place-items: center; width: 2.35cqw; height: 2.35cqw;
    border-radius: 50%; font-size: 1.3cqw; font-weight: 900; color: #08111c;
    transform: translate(-50%, -50%); box-shadow: 0 0 0 .2cqw #05080d, 0 .3cqw .6cqw rgba(0,0,0,.6); }

  /* 표지 */
  .cover { display: grid; grid-template-columns: 46% 54%; }
  .cover-art { position: relative; overflow: hidden; }
  .cover-art img { width: 100%; height: 100%; object-fit: cover; object-position: 30% center;
    filter: saturate(.7) brightness(.5); }
  .cover-art::after { content: ""; position: absolute; inset: 0;
    background: linear-gradient(90deg, rgba(5,8,13,.2) 40%, var(--bg) 100%); }
  .cover-copy { display: flex; flex-direction: column; justify-content: center; padding: 0 4.5cqw; }
  .brand { font-size: 1.5cqw; font-weight: 900; letter-spacing: .28em; color: var(--read); }
  .cover h1 { margin: 1.8cqh 0 2.4cqh; font-size: 4.2cqw; line-height: 1.16; letter-spacing: -.045em; }
  .cover-copy > p { margin: 0; font-size: 1.35cqw; line-height: 1.7; color: #b3c2d6; }
  .cover-list { margin: 3cqh 0 0; padding: 0; list-style: none; display: grid; gap: .9cqh;
    font-size: 1.28cqw; color: #cdd9ea; }
  .cover-list b { display: inline-block; min-width: 5.4cqw; color: var(--read); font-weight: 800; }
  .cover-meta { margin-top: 3.4cqh; display: flex; gap: .8cqw; font-size: 1.1cqw; color: #8ea0b8; }
  .cover-meta span { border: 1px solid var(--line); border-radius: 999px; padding: .7cqh 1.1cqw; }

  /* 읽는 법 */
  .legend-body { grid-template-columns: 1fr 1fr; grid-template-rows: auto 1fr;
    gap: 2.6cqh 2.4cqw; padding: 3.2cqh 2.4cqw; }
  .flow-card { grid-column: 1 / -1; }
  .flow { display: grid; grid-template-columns: repeat(5, 1fr); gap: 1.5cqw; margin-bottom: 2.2cqh; }
  .flow-step { position: relative; border: 1px solid var(--line); border-radius: 8px;
    padding: 1.6cqh 1cqw; background: #0d1523; }
  .flow-step:not(:last-child)::after { content: "›"; position: absolute; right: -1.05cqw; top: 50%;
    transform: translateY(-50%); color: var(--read); font-size: 1.9cqw; font-weight: 700; }
  .flow-step b { display: block; font-size: 1.18cqw; margin-bottom: .6cqh; }
  .flow-step span { display: block; font-size: .94cqw; line-height: 1.45; color: var(--dim); }
  .legend-card { background: var(--card); border: 1px solid var(--line); border-radius: 10px; padding: 2.8cqh 1.9cqw; }
  .legend-card h3 { margin: 0 0 1.6cqh; font-size: 1.5cqw; color: var(--read); }
  .legend-card h3 + h3 { margin-top: 3cqh; }
  .legend-list { margin: 0; padding: 0; list-style: none; }
  .legend-list li { display: grid; grid-template-columns: 2.1cqw 1fr; gap: .9cqw; margin-bottom: 1.8cqh; }
  .legend-list b { font-size: 1.25cqw; }
  .legend-list p, .legend-p { margin: .3cqh 0 0; font-size: 1.1cqw; line-height: 1.6; color: var(--dim); }
  .legend-steps { margin: 0; padding-left: 1.4cqw; font-size: 1.15cqw; line-height: 1.75; color: #c2cfe1; }
  .legend-steps li { margin-bottom: 1.2cqh; }
  .legend-steps b, .legend-p b { color: var(--ink); }
  code { background: #1a2434; border-radius: 4px; padding: .1cqw .4cqw; font-size: .95em; }

  @media print {
    .bar { display: none; }
    body { background: #fff; }
    .deck { padding: 0; }
    @page { size: 297mm 167mm; margin: 0; }
    .slide { width: 100%; height: 100vh; margin: 0; border: 0; border-radius: 0;
      break-after: page; page-break-after: always; }
    .slide:last-child { break-after: auto; page-break-after: auto; }
  }
</style>`;

const body = `  <div class="bar">
    <strong>CUVIA 안전재난관제시스템 · 간이 사용 매뉴얼</strong>
    <button onclick="window.print()">인쇄 · PDF 로 저장</button>
  </div>
  <div class="deck">
${slides.join("\n")}
  </div>`;

/* 두 벌로 낸다.
   · 로컬 파일 — 브라우저로 열어 인쇄(PDF)까지 하는 완전한 문서
   · 공유용 — 껍데기(doctype·head·body)를 아티팩트가 씌우므로 알맹이만 */
const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
${head}
</head>
<body>
${body}
</body>
</html>
`;

fs.writeFileSync(OUT_FILE, html);
fs.writeFileSync(path.join(DIR, "artifact.html"), `${head}\n${body}\n`);
console.log(`${slides.length}장  →  ${OUT_FILE}  (${(html.length / 1024 / 1024).toFixed(1)} MB)`);
console.log(`공유용 알맹이  →  ${path.join(DIR, "artifact.html")}`);
