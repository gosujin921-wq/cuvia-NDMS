/* ─────────────────────────────────────────────
 * 사용 매뉴얼 v2 캡처 — docs/매뉴얼/제작/v2/index.html 이 쓴다
 *
 * 시연 순서대로 화면을 눌러 가며 찍고, 번호 표식 자리를 실제 DOM 상자에서 잰다.
 *   → docs/매뉴얼/제작/v2/shots/<컷ID>.png
 *   → docs/매뉴얼/제작/v2/shots/marks.js   (window.SHOT_MARKS = { 컷ID: [[x%, y%], …] })
 * 표식 순서는 index.html 의 SLIDES[].marks 순서와 같아야 한다.
 *
 * 사용 (사용자 dev 서버 5400 은 건드리지 않는다):
 *   corepack pnpm exec vite build --outDir <임시폴더>
 *   corepack pnpm exec vite preview --outDir <임시폴더> --port 5401 --strictPort
 *   node scripts/manual-v2-shots.mjs
 * ───────────────────────────────────────────── */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright-core";

const BASE = process.env.BASE_URL ?? "http://localhost:5401";
const OUT = path.resolve(process.env.OUT ?? "../docs/매뉴얼/제작/v2/shots");
/* ONLY=A,B 처럼 주면 그 묶음만 다시 찍고 marks.js 의 나머지 컷은 남긴다 */
const ONLY = process.env.ONLY ? process.env.ONLY.split(",") : null;
const run = (k) => !ONLY || ONLY.includes(k);
const W = 1600;
const H = 1000;
fs.mkdirSync(OUT, { recursive: true });

function findChromium() {
  const cache = path.join(os.homedir(), "Library/Caches/ms-playwright");
  const dir = fs
    .readdirSync(cache)
    .filter((d) => d.startsWith("chromium-"))
    .sort((a, b) => Number(b.split("-")[1]) - Number(a.split("-")[1]))[0];
  return path.join(cache, dir, "chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing");
}

const MARKS = {};
const log = (...a) => console.log(...a);

/* 표식 한 자리 — 로케이터 또는 고정 좌표 [x, y].
   작은 요소는 왼쪽 가장자리 바로 바깥, 큰 상자는 왼쪽 위 모서리에 번호를 둔다 (글자를 덮지 않게) */
async function point(page, spec) {
  if (Array.isArray(spec)) return spec;
  const loc = typeof spec === "function" ? await spec(page) : page.locator(spec).first();
  const box = await loc.boundingBox({ timeout: 1500 }).catch(() => null);
  if (!box) return null;
  if (box.width < 360 && box.height < 60) return [Math.max(16, box.x - 14), box.y + box.height / 2];
  return [Math.max(16, box.x + 4), Math.max(16, box.y + 4)];
}

async function shot(page, id, specs, pre) {
  await page.screenshot({ path: path.join(OUT, `${id}.png`) });
  const pts = pre ?? [];
  if (!pre) {
    for (const s of specs) {
      const p = await point(page, s);
      if (!p) log(`  ! ${id} 표식 ${pts.length + 1} 못 찾음`);
      pts.push(p);
    }
  }
  MARKS[id] = pts.map((p) => (p ? [+(p[0] / W * 100).toFixed(2), +(p[1] / H * 100).toFixed(2)] : null));
  log(`✓ ${id}`);
}

const byRole = (role, name, exact = true) => (p) => p.getByRole(role, { name, exact }).first();
const byText = (text, last = false) => (p) => (last ? p.getByText(text).last() : p.getByText(text).first());
const btnHas = (text, last = false) => (p) => (last ? p.locator("button", { hasText: text }).last() : p.locator("button", { hasText: text }).first());
const aria = (label) => `[aria-label="${label}"]`;
const header = (p) => p.evaluate(() => document.querySelector('[aria-label="사건 헤더"]')?.innerText.replace(/\s+/g, " ") ?? "");

async function setAxisTo(page, hhmm) {
  const input = page.locator(aria("시각 이동")).first();
  await input.focus();
  for (let i = 0; i < 400; i += 1) {
    /* 시각 이동 막대에서 위로 올라가 재생 버튼까지 품은 줄을 찾는다. 그 줄의 첫 HH:MM 이 큰 시계다 */
    const cur = await page.evaluate(() => {
      let el = document.querySelector('[aria-label="시각 이동"]');
      while (el && !el.querySelector('[aria-label="재생"], [aria-label="재생 멈춤"]')) el = el.parentElement;
      return el?.innerText ?? "";
    });
    const m = cur.match(/(\d\d):(\d\d)/);
    if (!m) break;
    const diff = (+hhmm.slice(0, 2) * 60 + +hhmm.slice(3)) - (+m[1] * 60 + +m[2]);
    if (diff === 0) return true;
    await page.keyboard.press(diff > 0 ? "ArrowRight" : "ArrowLeft");
    await page.waitForTimeout(30);
  }
  return false;
}

const browser = await chromium.launch({
  executablePath: findChromium(),
  args: ["--use-gl=angle", "--enable-webgl", "--ignore-gpu-blocklist"],
});
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
const open = async (url, wait = 3500) => {
  const page = await ctx.newPage();
  await page.goto(BASE + url, { waitUntil: "load", timeout: 60000 });
  await page.waitForTimeout(wait);
  return page;
};

/* ── A. 시연 흐름 (한 세션, 되감기 없음) ── */
if (run("A")) {
  const p = await open("/scr-01");
  await shot(p, "M00", [
    aria("초기 화면으로 (종합상황 · 시연 처음부터)"),
    (q) => q.locator("nav button", { hasText: "재난관제" }),
    [800, 76],
    aria("에이전트 메시지 입력"),
  ]);
  await shot(p, "M10", [
    aria("특보 · 시각 · 데이터 장애 요약"),
    aria("지구 목록"),
    '[aria-label^="서항지구"]',
    aria("레이어"),
    aria("위험 현황"),
    aria("실시간 주요 사건"),
    'section[aria-label$="CCTV"]',
  ]);

  await p.keyboard.press("0");
  await p.waitForTimeout(1800);
  await shot(p, "M14", [
    "[data-sonner-toast]",
    byRole("button", "사건 확인하기"),
    `${aria("실시간 주요 사건")} button`,
  ]);

  await p.getByRole("button", { name: "사건 확인하기" }).first().click();
  await p.waitForTimeout(3500);
  await shot(p, "M20", [
    btnHas("종합상황", true),
    aria("사건 헤더"),
    aria("관측"),
    aria("근거"),
    [820, 230],
    aria("현장영상"),
    aria("우측 레일 탭"),
    aria("다음 행동"),
  ]);

  await p.getByRole("button", { name: "사건 대응", exact: true }).click();
  await p.waitForTimeout(6500);
  await p.keyboard.press("Escape");
  await p.waitForTimeout(1200);
  log("  시각", await header(p));
  await shot(p, "M25", [
    aria("위험도"),
    btnHas("반대로 볼 근거"),
    byRole("button", "예측 탭에서 보기"),
    aria("대응 요약"),
    aria("이력"),
    aria("다음 행동"),
  ]);

  await p.locator(aria("경보 · 수위 · 서항 간선관로 수위계")).click();
  await p.waitForTimeout(1500);
  await shot(p, "M21", [
    btnHas("위험도에 쓰인"),
    btnHas("차로 일부 침수"),
    byRole("button", "근거에서 보기"),
    byRole("button", "이 사건 대응하기"),
    '[aria-label$="영상 열기"]',
  ]);
  await p.locator(aria("팝업 닫기")).first().click().catch(() => {});
  await p.waitForTimeout(500);

  await p.getByRole("button", { name: "예측 탭에서 보기" }).click();
  await p.waitForTimeout(2500);
  log("  18:00 맞춤", await setAxisTo(p, "18:00"));
  await p.waitForTimeout(2500);
  await shot(p, "M26", [
    [735, 560],
    byText("그대로 두면"),
    byText("중요시설"),
    aria("재생"),
    byRole("button", "디지털트윈에서 열기"),
    byRole("button", "이 예측으로 조치안 갱신"),
  ]);

  await p.getByRole("button", { name: "이 예측으로 조치안 갱신" }).click();
  await p.waitForTimeout(7500);
  log("  시각", await header(p));
  await shot(p, "M27", [
    [276, 170],
    aria("상황실에서 현장까지 대응 흐름"),
    btnHas("MUST"),
    byRole("button", "전파 승인"),
  ]);

  /* 승인 버튼은 SOP 목록 맨 아래다. 목록을 끝까지 내려 한 장 더 */
  await p.getByRole("button", { name: "전체 승인·실행" }).scrollIntoViewIfNeeded();
  await p.waitForTimeout(800);
  await shot(p, "M28", [
    (q) => q.getByRole("checkbox").last(),
    btnHas("부분 승인"),
    byRole("button", "전체 승인·실행"),
  ]);

  await p.getByRole("button", { name: "전체 승인·실행" }).click();
  await p.waitForTimeout(1200);
  await shot(p, "M29", [
    byText("승인할 조치"),
    byText(/사건 확정/),
    byRole("button", "승인 · 실행 요청"),
  ]);

  await p.getByRole("button", { name: "승인 · 실행 요청" }).click();
  await p.waitForTimeout(300);
  await p.evaluate(() => {
    let el = document.querySelector('[aria-label="대응"]');
    while (el && el.scrollHeight <= el.clientHeight + 2) el = el.parentElement;
    if (el) el.scrollTop = 0;
  });
  /* 18:08 은 다음 자동 칸까지 1.8초뿐이다. 헤더가 54분이 되는 순간 찍는다 */
  for (let i = 0; i < 80 && !(await header(p)).includes("54분"); i += 1) await p.waitForTimeout(50);
  await shot(p, "M2A", [
    aria("상황실에서 현장까지 대응 흐름"),
    byText("마을방송"),
    (q) => q.getByRole("dialog").getByText("심각", { exact: true }).first(),
    [262, 900],
  ]);
  log("  M2A 뒤 시각", await header(p));

  for (let i = 0; i < 100 && !(await header(p)).includes("1시간 24분"); i += 1) await p.waitForTimeout(100);
  await p.waitForTimeout(600);
  await shot(p, "M2B", [
    (q) => q.getByRole("button", { name: "안정으로 전환" }).first(),
    byText("SOP 진행률"),
  ]);
  await p.getByRole("button", { name: "안정으로 전환" }).first().click();
  await p.waitForTimeout(800);
  await p.getByRole("button", { name: "안정으로 전환" }).last().click();
  await p.waitForTimeout(3000);
  log("  시각", await header(p));
  await shot(p, "M2C", [
    (q) => q.getByRole("dialog").getByText("안정", { exact: true }).first(),
    byRole("button", "종료 검토"),
  ]);

  await p.getByRole("button", { name: "종료 검토" }).first().click();
  await p.waitForTimeout(4000);
  await shot(p, "M52", [
    byText("무슨 정보로 예측했나"),
    byText("예측 대 실제"),
    (q) => q.getByRole("dialog").getByText("영향 대상").first(),
    byText("예측 범위 vs 실제 범위"),
    byText("학습 · 개선 항목"),
  ]);

  await p.getByRole("dialog").locator("button", { hasText: "사건 요약" }).first().click();
  await p.waitForTimeout(1500);
  await shot(p, "M50", [
    [110, 22],
    "tbody tr",
    (q) => q.getByRole("dialog").locator("button", { hasText: "사건 요약" }).first(),
    byRole("button", "보고서 보기"),
  ]);

  await p.getByRole("button", { name: "보고서 보기" }).click();
  await p.waitForTimeout(2500);
  await shot(p, "M54", [
    btnHas("구분"),
    "tbody tr",
    byRole("button", "보고서 화면"),
    byRole("button", "인쇄"),
  ]);
  await p.close();
}

/* ── B. AI 질의 — 하단 입력창에서 [>]로 추천 질문을 넘겨 "수온이 왜 이렇게 높아?"를 고른다 ── */
if (run("B")) {
  const p = await open("/scr-01");
  /* 넘기기 전 화면에 [>]를 표시하고, 넘긴 뒤의 칩 줄은 잘라서 확대 그림(M15A-row.png)으로 얹는다.
     칩 줄이 좁아 [>]와 "수온이 왜 이렇게 높아?"가 한 화면에 같이 온전히 서지 않는다 */
  const above = async (loc) => { const b = await loc.boundingBox(); return b ? [b.x + b.width / 2, b.y - 16] : null; };
  await shot(p, "M15A", null, [await above(p.locator(aria("다음 추천 질문"))), null]);
  const rowBox = await p.evaluate(() => {
    let el = [...document.querySelectorAll("button")].find((b) => b.innerText.trim() === "수온이 왜 이렇게 높아?");
    while (el && el.scrollWidth <= el.clientWidth + 2) el = el.parentElement;
    const r = el.getBoundingClientRect();
    return { x: r.x - 8, y: r.y - 6, width: r.width + 16, height: r.height + 12 };
  });
  await p.locator(aria("다음 추천 질문")).click();
  await p.waitForTimeout(900);
  await p.screenshot({ path: path.join(OUT, "M15A-row.png"), clip: rowBox });
  await p.getByRole("button", { name: "수온이 왜 이렇게 높아?" }).click();
  await p.waitForTimeout(9000);
  const closeBtn = await p.getByRole("button", { name: "대화 닫기" }).boundingBox().catch(() => null);
  await shot(p, "M15", [
    (q) => q.getByPlaceholder(/자연어/).first(),
    closeBtn ? [closeBtn.x - 300, closeBtn.y + 4] : [1150, 40],
    async (q) => ((await q.locator(aria("인셋 줄이기")).count()) ? q.locator(aria("인셋 줄이기")) : q.locator(aria("인셋 키우기"))).first(),
  ]);
  await p.close();
}

/* ── C. 디지털트윈 ── */
if (run("C")) {
  const flood = async () => {
    const p = await open("/scr-00", 6000);
    await p.locator(aria("시각 이동")).first().focus();
    await setAxisTo(p, "22:30");
    await p.waitForTimeout(2500);
    return p;
  };
  let p = await flood();
  await shot(p, "M30", [
    byRole("tab", "침수"),
    byRole("combobox", "대상"),
    byRole("combobox", "시나리오"),
    aria("강우 직접 조정"),
    aria("그 시각 상태"),
    '[aria-label^="결과"]',
    aria("해당 규정"),
    aria("재생"),
    byRole("button", "근거"),
  ]);

  await p.getByRole("combobox", { name: "시나리오" }).click();
  await p.waitForTimeout(600);
  await p.getByRole("option").nth(1).click();
  await p.waitForTimeout(2500);
  const overlay = p.getByRole("switch", { name: /겹쳐/ }).first();
  if (await overlay.count()) await overlay.click();
  await p.waitForTimeout(2000);
  await shot(p, "M31", [
    byRole("combobox", "시나리오"),
    '[aria-label^="결과"]',
    (q) => q.getByRole("switch", { name: /겹쳐/ }).first(),
    [700, 380],
  ]);
  await p.close();

  p = await flood();
  await p.getByRole("switch", { name: "해안도로 저지대 구간 통제 · 규정대로 했다면" }).click();
  await p.getByRole("switch", { name: "신포 지하차도 진입 통제 · 규정대로 했다면" }).click();
  await p.waitForTimeout(2500);
  await shot(p, "M32", [
    byRole("switch", "해안도로 저지대 구간 통제 · 규정대로 했다면"),
    btnHas("1시간 전"),
    byRole("switch", "규정 전부 켜기"),
    byText("여유"),
    (q) => q.locator(`${aria("시간축")} button`).nth(1),
  ]);

  await p.getByRole("button", { name: "보고서", exact: true }).click();
  await p.waitForTimeout(4000);
  await shot(p, "M34", [
    (q) => q.getByRole("dialog").first(),
    byRole("button", "이력에 저장"),
    byRole("button", "인쇄"),
  ]);
  await p.close();

  p = await open("/scr-00?type=heat", 7000);
  await p.locator(aria("시각 이동")).first().focus();
  await setAxisTo(p, "15:00");
  await p.waitForTimeout(3000);
  await shot(p, "M37", [
    byRole("combobox", "시나리오"),
    [760, 420],
    aria("인셋 키우기"),
    '[aria-label^="결과"]',
    aria("그 시각 열환경"),
  ]);
  await p.close();
}

/* ── D. 통계 ── */
if (run("D")) {
  const p = await open("/scr-04", 3000);
  await shot(p, "M40", [
    btnHas("기간"),
    aria("핵심 지표"),
    aria("유형별 사건 흐름"),
    aria("지역별 비교"),
  ]);
  await p.close();
}

const marksFile = path.join(OUT, "marks.js");
if (ONLY && fs.existsSync(marksFile)) {
  const old = fs.readFileSync(marksFile, "utf8");
  Object.assign(MARKS, { ...JSON.parse(old.slice(old.indexOf("{"), old.lastIndexOf("}") + 1)), ...MARKS });
}
fs.writeFileSync(
  marksFile,
  `/* manual-v2-shots.mjs 가 만든다. 손으로 고치지 않는다 */\nwindow.SHOT_MARKS = ${JSON.stringify(MARKS, null, 1)};\n`,
);
await browser.close();
log("done", Object.keys(MARKS).length);
