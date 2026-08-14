/* ─────────────────────────────────────────────
 * 간이 사용 매뉴얼 캡처
 *
 * 구현된 화면을 순서대로 열어 찍고, 그 화면에서 누를 버튼·읽을 패널의 화면 좌표를
 * 함께 뽑는다. 위험지구 이벤트 예시는 봉암지구 내수침수 하나만 쓴다.
 *
 * 좌표를 손으로 적지 않는 이유: 화면이 바뀌면 번호 라벨이 엉뚱한 곳을 가리킨다.
 * 여기서 실제 DOM 상자를 재서 data.json 에 담고, manual-build.mjs 가 그 위에 번호를
 * 얹는다. 화면을 고치면 두 스크립트를 다시 돌려 매뉴얼을 따라오게 한다.
 *
 * 사용:
 *   corepack pnpm dev                       # 5400 포트
 *   node scripts/manual-shots.mjs           # → ../manual-capture/shots/*.png · data.json
 *   DUMP=1 node scripts/manual-shots.mjs    # 화면별 조작 요소 목록도 함께 (라벨 고를 때)
 * ───────────────────────────────────────────── */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright-core";

const BASE = process.env.BASE_URL ?? "http://localhost:5400";
const OUT = path.resolve(process.env.OUT ?? "../manual-capture");
const SHOTS = path.join(OUT, "shots");
const WIDTH = 1600;
const HEIGHT = 1000;
const DUMP = process.env.DUMP === "1";

function findChromium() {
  const cache = path.join(os.homedir(), "Library/Caches/ms-playwright");
  const dirs = fs
    .readdirSync(cache)
    .filter((d) => d.startsWith("chromium-"))
    .sort((a, b) => Number(b.split("-")[1]) - Number(a.split("-")[1]));
  for (const dir of dirs) {
    const exec = path.join(
      cache,
      dir,
      "chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
    );
    if (fs.existsSync(exec)) return exec;
  }
  throw new Error("chromium 을 찾지 못했다. corepack pnpm exec playwright install chromium");
}

/* ── 표식 찾기 ────────────────────────────────
   region  … aria-label 이 붙은 패널
   role    … 접근성 역할 + 이름
   css     … 그 밖
   group   … 여러 요소를 하나로 묶어 감싸는 상자 (세로 버튼 스트립 등)
   rect    … 손으로 준 좌표 (붙잡을 것이 없는 자리) */
function locate(page, find) {
  let loc;
  if (find.region) loc = page.locator(`[aria-label="${find.region}"]`);
  else if (find.role) loc = page.getByRole(find.role, { name: find.name, exact: find.exact });
  else if (find.text) loc = page.getByText(find.text, { exact: find.exact });
  else if (find.css) loc = page.locator(find.css);
  else throw new Error(`찾는 법이 없다: ${JSON.stringify(find)}`);
  if (find.hasText) loc = loc.filter({ hasText: find.hasText });
  /* 같은 이름이 화면에 둘 있는 자리 — 팝업이 열리면 레일의 카드와 팝업의 카드가
     같은 aria-label 로 함께 선다. 팝업 쪽은 나중에 붙으므로 last 가 그것이다 */
  return find.pick === "last" ? loc.last() : loc.first();
}

async function measure(page, find) {
  if (find.rect) {
    const [x, y, w, h] = find.rect;
    return { x, y, w, h };
  }
  if (find.group) {
    const boxes = [];
    for (const one of find.group) {
      const box = await locate(page, one).boundingBox({ timeout: 10000 });
      if (box) boxes.push(box);
    }
    if (!boxes.length) throw new Error("group 전부 못 찾음");
    const x = Math.min(...boxes.map((b) => b.x));
    const y = Math.min(...boxes.map((b) => b.y));
    const r = Math.max(...boxes.map((b) => b.x + b.width));
    const bottom = Math.max(...boxes.map((b) => b.y + b.height));
    return { x, y, w: r - x, h: bottom - y };
  }
  const box = await locate(page, find).boundingBox({ timeout: 10000 });
  if (!box) throw new Error("boundingBox null");
  return { x: box.x, y: box.y, w: box.width, h: box.height };
}

/** 알람 토스트 걷어내기 (스스로 9초 뒤 닫히지만 기다리지 않는다) */
async function clearToasts(page) {
  for (let i = 0; i < 8; i += 1) {
    const close = page.locator("[data-close-button]");
    const n = await close.count();
    if (!n) break;
    await close.first().click({ timeout: 1500 }).catch(() => {});
    await page.waitForTimeout(200);
  }
  await page.waitForTimeout(400);
}

/* 자주 쓰는 표식 — 화면마다 같은 자리에 같은 것이 선다 */
const MENU = {
  kind: "act",
  find: { css: '[aria-label="메인 내비게이션"]' },
  label: "좌측 메뉴",
  desc: "종합상황 · 재난관제 · 통계 · 디지털트윈 네 화면을 오간다. 맨 위 로고를 누르면 종합상황으로 돌아온다.",
};
const MAP_UTIL = {
  kind: "act",
  find: {
    group: [
      { css: '[aria-label="레이어"]' },
      { css: '[aria-label="원래대로"]' },
    ],
  },
  label: "지도 조작",
  desc: "위에서부터 레이어 · 3D · 확대 · 축소 · 좌회전 · 우회전 · 원래대로. [레이어]에서 지도에 올릴 항목을 켜고 끈다.",
};
const AGENT_FAB = {
  kind: "act",
  find: { css: '[aria-label="CUVIA Agent 열기"]' },
  label: "AI 에이전트 열기",
  desc: "누르면 오른쪽에서 질의 패널이 열린다. 보고 있던 화면은 왼쪽에 그대로 남는다.",
};

/* ─────────────────────────────────────────────
 * 정류장 — act(그 화면을 여는 조작) + marks(번호를 붙일 것)
 *   kind: act  … 눌러서 무언가 일어나는 것
 *   kind: read … 읽는 자리 (패널 · 표시)
 * reuse 를 주면 앞 정류장의 그림을 그대로 쓴다 (한 화면을 두 장으로 나눠 설명할 때)
 * ───────────────────────────────────────────── */
const STOPS = [
  {
    id: "01-alarm",
    scr: "공통",
    title: "이벤트 알람",
    lead: "계측값이 발령 기준을 넘으면 화면 위쪽에 알람이 뜬다. 어느 화면에 있든 같은 자리에 뜨고, 9초 뒤 스스로 닫힌다.",
    marks: [
      {
        kind: "read",
        find: { css: "[data-sonner-toast]" },
        label: "알람 카드",
        desc: "무엇이(지구 · 장비) · 얼마나(계측값과 초과한 기준) · 언제(발생 시각)를 한 줄씩 적는다. 테두리 색이 계측단계 색이다. 왼쪽 위 X 로 바로 지울 수 있고, 그 지구 재난관제에 들어가면 쌓인 알람이 함께 닫힌다.",
      },
      {
        kind: "act",
        find: { role: "button", name: "재난관제로 가기" },
        label: "재난관제로 가기",
        desc: "그 지구의 재난관제 화면을 연다. 이미 그 화면에 있으면 이 버튼은 뜨지 않는다.",
      },
    ],
  },
  {
    id: "02-dashboard",
    scr: "SCR-01",
    title: "종합상황 · 화면 구성",
    lead: "시 전체 지도를 배경에 깔고 오늘 볼 것을 얹은 화면이다. 앱을 열면 여기로 들어온다.",
    act: async (page) => {
      await clearToasts(page);
    },
    marks: [
      MENU,
      {
        kind: "read",
        find: { region: "발효 특보와 도시 대응단계, 오늘 처리 현황 요약" },
        label: "상태 스트립",
        desc: "발효 특보 · 도시 대응단계 · 현재 시각 · 진행 중 · 확인 필요 · 연계 장애 건수.",
      },
      {
        kind: "act",
        find: { css: '[aria-label="봉암지구 내수 · 주의보 발생 중"]' },
        label: "지구 이름표",
        desc: "지도 위 위험지구. 앞의 점 색이 계측단계다. 누르면 그 지구의 재난관제로 들어간다.",
      },
      MAP_UTIL,
      {
        kind: "act",
        find: {
          group: [
            { css: '[aria-label="에이전트 메시지 입력"]' },
            { css: '[aria-label="메시지 전송"]' },
          ],
        },
        label: "질의 바",
        desc: "자연어로 상황을 묻는다. 위에 뜬 문장을 누르면 그대로 질문이 들어간다.",
      },
    ],
  },
  {
    id: "03-dashboard-panels",
    scr: "SCR-01",
    title: "종합상황 · 좌우 패널",
    lead: "왼쪽은 위험지구, 오른쪽은 기상과 집계다. 아래 가운데는 주요 지점 CCTV.",
    reuse: "02-dashboard",
    marks: [
      {
        kind: "act",
        find: { region: "현재 주요 재난" },
        label: "현재 주요 재난",
        desc: "지금 대응 중인 재난과 영향 지구. 지구 줄을 누르면 그 지구의 재난관제로 들어간다.",
      },
      {
        kind: "act",
        find: {
          group: [
            { role: "button", name: /서항 물양장/ },
            { role: "button", name: /팔용 배수구역/ },
          ],
        },
        label: "그 외 위험지구",
        desc: "주요 재난에 선 지구를 뺀 나머지 목록. 계측단계가 높은 지구가 위로 온다. 한 줄을 누르면 그 지구의 재난관제로 들어간다.",
      },
      {
        kind: "read",
        find: { region: "계측단계 색상 기준" },
        label: "계측단계 색상 기준",
        desc: "주의보 · 경보 · 대피 세 단계의 색. 지도 핀 · 뱃지 · 그래프가 모두 이 색을 쓴다.",
      },
      {
        kind: "read",
        find: { region: "창원시 기상" },
        label: "기상",
        desc: "현재 기온 · 강수 · 체감과 관련 기상, 조위. 아래는 폭염 · 가뭄 같은 도시 배경 위험.",
      },
      {
        kind: "read",
        find: { region: "최근 30일 발생 통계" },
        label: "최근 30일 발생 통계",
        desc: "재난유형별 발생 건수. 자세한 것은 통계 화면에서 본다.",
      },
      {
        kind: "read",
        find: { region: "연계 현황" },
        label: "연계 현황",
        desc: "외부 기관 연계 상태와 마지막 수신 시각.",
      },
      {
        kind: "act",
        find: { region: "주요 CCTV" },
        label: "주요 CCTV",
        desc: "주요 지점 실시간 영상. 타일을 누르면 그 장비가 있는 지구의 재난관제로 들어간다.",
      },
    ],
  },
  {
    id: "04-control-left",
    scr: "SCR-02",
    title: "재난관제 · 왼쪽 (상황 근거)",
    lead: "지구 하나로 좁혀 계측값과 현장 영상을 함께 보는 화면이다. 왼쪽은 근거, 오른쪽은 판단과 대응.",
    act: async (page) => {
      await page
        .getByRole("button", { name: /^봉암지구/ })
        .first()
        .dispatchEvent("click");
      // 지도가 앉고 경보 격상이 반영될 때까지
      await page.waitForTimeout(6000);
      await clearToasts(page);
    },
    marks: [
      {
        kind: "read",
        find: { region: "진행 사건" },
        label: "사건 캡슐",
        desc: "이 지구에서 진행 중인 사건. 재난유형 · 처리상태 · 계측단계 뱃지 · 발생과 격상 시각 · 탐지 장비. 장비 이름을 누르면 그 장비가 선택된다.",
      },
      {
        kind: "act",
        find: { css: '[aria-label="종합상황으로"]' },
        label: "종합상황으로",
        desc: "지구 이름 왼쪽 화살표. 전체 화면으로 돌아간다.",
      },
      {
        kind: "act",
        find: { region: "계측 추이" },
        label: "계측 추이",
        desc: "이 지구 장비의 현재값 목록과 선택한 장비의 추이 그래프. 장비 줄을 누르면 지도가 그 장비로 옮겨 가고 팝업이 열린다. 그래프의 점선이 주의보 · 경보 · 대피 기준선이다.",
      },
      {
        kind: "read",
        find: { region: "봉암지구 현장 교차검증" },
        label: "현장 교차검증",
        desc: "계측단계를 받치는 근거를 한 줄씩. 수위 · 외수위 · 배수문 폐쇄 · 펌프 가동 · 강우 · 조위를 함께 놓고 맞춰 본다.",
      },
      {
        kind: "act",
        find: { region: "봉암지구 현장영상" },
        label: "현장영상",
        desc: "이 지구 CCTV. 타일을 누르면 지도 위에 영상 팝업이 열린다.",
      },
      {
        kind: "act",
        find: { css: '[aria-label="경보 · 수위 · 봉암지구 수위계 2호기"]' },
        label: "장비 핀",
        desc: "지도 위 계측 장비와 방재시설. 핀 색이 계측단계다. 누르면 그 장비 팝업이 열린다. 겹치면 숫자 묶음으로 모이고, 누르면 확대된다.",
      },
    ],
  },
  {
    id: "05-control-right",
    scr: "SCR-02",
    title: "재난관제 · 오른쪽 (판단과 대응)",
    lead: "왼쪽 근거를 보고 여기서 결정한다. 위에서 아래로 판정, 영향, 대응, 기록 순이다.",
    reuse: "04-control-left",
    marks: [
      {
        kind: "read",
        find: { region: "위험도 판정" },
        label: "위험도 판정",
        desc: "계측 단계와 판단 근거, 권고 대응과 그 사유. 승인한 대응등급이 있으면 여기 함께 선다.",
      },
      {
        kind: "read",
        find: { region: "영향 분석" },
        label: "영향 분석",
        desc: "조건 수위 · 침수 범위 · 대피 대상. 계측과 침수 영향 자료로 자동 추정한 값이다.",
      },
      {
        kind: "act",
        find: { role: "button", name: /디지털트윈으로 확인하기/ },
        label: "디지털트윈으로 확인하기",
        desc: "이 사건을 들고 디지털트윈 화면으로 간다. 조건을 바꿔 가며 침수 영향을 3D 로 확인한다.",
      },
      {
        kind: "act",
        find: { role: "button", name: "대응 실행" },
        label: "대응 실행",
        desc: "대응등급 승인 · 절차 선택 · 전파를 한 자리에서 처리하는 팝업을 연다.",
      },
      {
        kind: "read",
        find: { region: "사건 진행" },
        label: "사건 진행",
        desc: "이 사건에 일어난 일의 시간순 기록. 실행한 전파도 여기 쌓인다.",
      },
      MAP_UTIL,
      AGENT_FAB,
    ],
  },
  {
    id: "06-device-popup",
    scr: "SCR-02",
    title: "장비 팝업 (계측 장비)",
    lead: "지도 핀이나 계측 추이의 장비 줄을 누르면 열린다. 그 장비 하나의 현재값과 최근 추이를 본다.",
    act: async (page) => {
      await page
        .getByRole("button", { name: /강우량계 1호기/ })
        .first()
        .dispatchEvent("click");
      await page.waitForTimeout(1800);
    },
    marks: [
      {
        kind: "read",
        find: { css: ".dsms-popup" },
        label: "장비 팝업",
        desc: "장비 이름과 종류, 지금 계측단계와 값, 재난유형 · 초과한 기준 · 발생과 격상 시각 · 탐지 장비를 한 자리에 모은다.",
      },
      {
        kind: "act",
        find: { role: "button", name: "이 사건 대응하기" },
        label: "이 사건 대응하기",
        desc: "이 장비가 탐지한 사건의 대응 실행 팝업을 바로 연다. 진행 중인 사건이 있을 때만 나온다.",
      },
      {
        kind: "act",
        find: { role: "button", name: "상세 측정현황 보기" },
        label: "상세 측정현황 보기",
        desc: "이 장비의 측정 이력을 자세히 본다.",
      },
      {
        kind: "act",
        find: { css: '[aria-label="팝업 닫기"]' },
        label: "닫기",
        desc: "팝업을 닫는다. 지도의 장비 선택은 그대로 남는다.",
      },
    ],
  },
  {
    id: "07-cctv-popup",
    scr: "SCR-02",
    title: "CCTV 팝업 (현장 영상)",
    lead: "CCTV 핀이나 아래 현장영상 타일을 누르면 열린다. 계측값을 영상으로 교차 확인하는 자리다.",
    act: async (page) => {
      await page.locator('[aria-label="팝업 닫기"]').first().click().catch(() => {});
      await page.waitForTimeout(400);
      await page
        .getByRole("button", { name: /봉암지구 배수문 CCTV 팝업 열기/ })
        .first()
        .click();
      await page.waitForTimeout(2000);
    },
    marks: [
      {
        kind: "read",
        find: { css: '[role="dialog"]' },
        label: "영상 팝업",
        desc: "위에 장비 이름과 설치 주소, 영상 왼쪽 위에 현재 상태와 LIVE 표시, 오른쪽 아래에 촬영 시각이 붙는다.",
      },
      {
        kind: "act",
        find: { css: '[role="dialog"] button' },
        label: "닫기",
        desc: "영상을 닫고 지도로 돌아간다. 바깥을 누르거나 Esc 를 눌러도 닫힌다.",
      },
    ],
  },
  {
    id: "08-twin",
    scr: "SCR-05",
    title: "디지털트윈",
    lead: "지형과 침수 범위를 3D 로 놓고 시점을 옮겨 가며 영향을 확인하는 화면이다. 배경은 드래그로 돌리고 휠로 확대한다. 사건에서 들어오면 그 사건 조건으로, 왼쪽 메뉴로 들어오면 조건을 직접 고르는 사전 모의분석으로 열린다.",
    act: async (page) => {
      // 영상 모달 · 장비 팝업을 걷는다. 모달이 열린 채로는 뒤 화면 클릭이 막힌다
      await page.keyboard.press("Escape");
      await page.waitForTimeout(600);
      await page.locator('[aria-label="팝업 닫기"]').first().click({ timeout: 2000 }).catch(() => {});
      await page.waitForTimeout(600);
      await page.getByRole("button", { name: /디지털트윈으로 확인하기/ }).click();
      await page.waitForTimeout(8000);
      await clearToasts(page);
    },
    marks: [
      {
        kind: "act",
        find: { css: '[aria-label="위치"]' },
        label: "위치",
        desc: "지금 보고 있는 지구. 앞 마디를 누르면 돌아간다.",
      },
      {
        kind: "read",
        find: { region: "날씨" },
        label: "날씨",
        desc: "분석 구간의 시각별 풍속 · 강수량 · 강수확률.",
      },
      {
        kind: "read",
        find: { region: "현재 분석 사건" },
        label: "현재 분석 사건",
        desc: "지금 분석하고 있는 사건과 현재 관측값, 분석 목적. 사전 모의분석으로 들어오면 이 자리가 지구 · 재난유형 · 조건을 고르는 [사전 모의분석] 카드가 된다.",
      },
      {
        kind: "act",
        find: { region: "시간대별 영향 시나리오" },
        label: "시간축",
        desc: "가로 막대를 끌면 그 시각의 침수 표현과 아래 결과로 함께 바뀐다. 밑의 세 버튼은 격상 시점 · 현재 · 영향 확대 시점으로 바로 옮겨 준다.",
      },
      {
        kind: "read",
        find: { region: "영향 결과" },
        label: "영향 결과",
        desc: "고른 시점의 예상 수위 · 영향 범위 · 영향 건물 · 통제 도로 · 대응 대상. 대피 판단의 근거가 되는 숫자다.",
      },
      {
        kind: "read",
        find: { region: "분석 근거와 가정" },
        label: "분석 근거와 가정",
        desc: "이 숫자가 어떤 값과 자료에서 나왔는지, 어떤 조건을 전제했는지.",
      },
      {
        kind: "act",
        find: { role: "button", name: /참고 · 지구 위치와 과거 이벤트/ },
        label: "참고",
        desc: "펼치면 시 전체 미니맵과 이 지구의 과거 이벤트 목록이 나온다.",
      },
      {
        kind: "act",
        find: { role: "button", name: /재난관제로 돌아가기/ },
        label: "재난관제로 돌아가기",
        desc: "그 사건의 재난관제로 돌아간다. 사전 모의분석일 때는 이 자리가 [모의분석 결과 저장] 이다.",
      },
    ],
  },
  {
    id: "09-execution-info",
    scr: "SCR-02",
    title: "대응 실행 팝업 · 이벤트 정보",
    lead: "재난관제 오른쪽 [대응 실행]을 누르면 열린다. 왼쪽은 현장 영상, 오른쪽은 이 사건의 정보와 대응 절차, 이력이 탭으로 갈린다. 화면을 옮기지 않고 여기서 대응을 끝낸다.",
    act: async (page) => {
      await page.getByRole("button", { name: /재난관제로 돌아가기/ }).click();
      await page.waitForTimeout(4500);
      await clearToasts(page);
      await page.getByRole("button", { name: "대응 실행" }).click();
      await page.waitForTimeout(2000);
    },
    marks: [
      {
        kind: "act",
        find: { css: "section", hasText: "같은 시각 진행 사건", pick: "last" },
        label: "같은 시각 진행 사건",
        desc: "이 지구에서 같은 시각에 함께 돌고 있는 다른 사건. 좌우 화살표로 넘긴다.",
      },
      {
        kind: "act",
        find: {
          group: [
            { role: "button", name: "봉암지구 배수문 CCTV", exact: true },
            { role: "button", name: "봉암지구 배수펌프장 CCTV", exact: true },
          ],
        },
        label: "카메라 전환",
        desc: "팝업 안에서 이 지구의 다른 CCTV 로 갈아탄다.",
      },
      {
        kind: "act",
        find: {
          group: [
            { role: "tab", name: "이벤트 정보" },
            { role: "tab", name: "이력" },
          ],
        },
        label: "탭",
        desc: "[이벤트 정보]는 판정과 사건 상세, [SOP 대응]은 대응 절차와 전파, [이력]은 이 사건에 오간 기록이다.",
      },
      {
        kind: "read",
        find: { region: "위험도 판정", pick: "last" },
        label: "위험도 판정",
        desc: "계측 단계와 판단 근거, 권고 대응과 그 사유. 아래로 이벤트 ID · 발생시각 · 경과시간 · 탐지 장비 · 처리 상태가 이어진다.",
      },
      {
        kind: "act",
        find: { role: "button", name: /관제 화면으로 돌아가기/ },
        label: "관제 화면으로 돌아가기",
        desc: "팝업을 닫고 관제 화면으로 돌아간다. 오른쪽 위 X 나 Esc 로도 닫힌다.",
      },
    ],
  },
  {
    id: "10-execution-sop",
    scr: "SCR-02",
    title: "대응 실행 팝업 · SOP 대응",
    lead: "[SOP 대응] 탭을 누르면 이 재난유형과 등급에 맞는 대응 절차가 목록으로 선다. 실행할 항목을 고르고 전파 문안을 확인해 한 번에 내보낸다. 따로 승인 버튼을 두지 않는다. 고르고 [승인 · 실행]을 누르는 그 행위가 승인이다.",
    act: async (page) => {
      await page.getByRole("tab", { name: "SOP 대응" }).click();
      await page.waitForTimeout(1800);
    },
    marks: [
      {
        kind: "read",
        find: { region: "대응 절차", pick: "last" },
        label: "대응 절차",
        desc: "재난유형과 등급으로 정해진 SOP. 각 줄이 하나의 조치이고, 자동으로 나가는 항목과 사람이 승인해야 나가는 항목이 갈린다.",
      },
      {
        kind: "act",
        find: { role: "button", name: "전체 선택" },
        label: "전체 선택",
        desc: "승인이 필요한 항목을 한 번에 고른다. 줄마다 따로 고를 수도 있다.",
      },
      {
        kind: "act",
        find: { role: "button", name: /승인 · 실행/ },
        label: "승인 · 실행",
        desc: "고른 절차를 실행하고 채널별로 전파한다. 이때 대응등급도 함께 기록되어 종합상황의 대응단계와 통계에 반영된다.",
      },
    ],
  },
  {
    id: "11-execution-result",
    scr: "SCR-02",
    title: "대응 실행 팝업 · 실행 결과",
    lead: "실행한 항목이 위에서 아래로 결과를 채운다. 성공과 실패가 갈려 나오고, 실패한 채널은 대체 조치를 기록해 빈자리를 남기지 않는다.",
    act: async (page) => {
      await page.getByRole("button", { name: "전체 선택" }).click();
      await page.waitForTimeout(500);
      await page.getByRole("button", { name: /승인 · 실행/ }).click();
      await page.waitForTimeout(5000);
    },
    marks: [
      {
        kind: "read",
        find: { region: "대응 절차", pick: "last" },
        label: "실행 결과",
        desc: "항목마다 성공 · 실패와 전파 채널이 붙는다. 자동으로 나간 항목도 결과 확인이 필요하다.",
      },
      {
        kind: "act",
        find: { role: "button", name: /유선 보고 기록/ },
        label: "유선 보고 기록",
        desc: "연계가 끊겨 자동 전파가 실패한 항목을 유선으로 처리했다고 남긴다. 대체 조치가 같은 줄에 이어 붙는다.",
      },
      {
        kind: "act",
        find: { role: "button", name: /관제 화면으로 돌아가기/ },
        label: "관제 화면으로 돌아가기",
        desc: "팝업을 닫는다. 실행한 내용은 관제 화면의 대응 절차 카드와 사건 진행에 남는다.",
      },
    ],
  },
  {
    id: "12-after-execution",
    scr: "SCR-02",
    title: "재난관제 · 대응 뒤 화면",
    lead: "팝업을 닫아도 무엇을 했는지가 화면에 남는다. 사건 진행에 전파 기록이 쌓이고, 통계 화면의 집계도 같은 값을 읽는다.",
    act: async (page) => {
      await page.getByRole("button", { name: /유선 보고 기록/ }).click().catch(() => {});
      await page.waitForTimeout(800);
      await page.getByRole("button", { name: /관제 화면으로 돌아가기/ }).click();
      await page.waitForTimeout(2000);
      await clearToasts(page);
    },
    marks: [
      {
        kind: "read",
        find: { region: "실행 결과 요약" },
        label: "실행 결과 요약",
        desc: "방금 실행한 절차와 전파 결과 요약.",
      },
      {
        kind: "read",
        find: { region: "사건 진행" },
        label: "사건 진행",
        desc: "실행한 전파가 시간순 기록에 들어와 있다.",
      },
    ],
  },
  {
    id: "13-stats",
    scr: "SCR-04",
    title: "통계 · 분석",
    lead: "지난 기간의 발생과 대응을 조건별로 되짚어 보는 화면이다. 위에서 조건을 고르면 아래 전부가 함께 바뀐다.",
    act: async (page) => {
      await page.getByTitle(/SCR-04/).click();
      await page.waitForTimeout(3500);
      await clearToasts(page);
    },
    marks: [
      {
        kind: "act",
        find: { region: "조회 조건" },
        label: "조회 조건",
        desc: "위에서부터 범위(지구) · 기간 · 재난 분류 · 재난유형 · 계측단계. 고르면 아래 지표와 그래프가 그 조건으로 다시 계산된다.",
      },
      {
        kind: "act",
        find: { role: "tab", name: "사건 이력" },
        label: "탭",
        desc: "[통계 분석]은 집계와 그래프, [사건 이력]은 개별 사건 목록을 보여 준다.",
      },
      {
        kind: "read",
        find: { region: "핵심 지표" },
        label: "핵심 지표",
        desc: "총 발생 · 경보 이상 · 선제 대응 · 최다 발생 지구 등 여섯 칸 요약.",
      },
      {
        kind: "read",
        find: { region: "발생 추이와 분포" },
        label: "발생 추이와 분포",
        desc: "왼쪽은 기간별 발생 추이, 오른쪽은 계측단계별과 재난유형별 분포.",
      },
      {
        kind: "act",
        find: { region: "지구별 비교" },
        label: "지구별 비교",
        desc: "지구별 발생 · 경보 이상 · 최고 수위 · 누적 강우 · 전파 건수. 한 줄을 누르면 아래에 그 지구 상세가 펼쳐진다.",
      },
      {
        kind: "act",
        find: { role: "button", name: "다운로드" },
        label: "다운로드",
        desc: "지금 조건으로 조회한 결과를 내려받는다.",
      },
    ],
  },
  {
    id: "14-stats-detail",
    scr: "SCR-04",
    title: "통계 · 분석 · 지구 상세",
    lead: "지구별 비교에서 한 줄을 누르면 그 지구만 따로 펼쳐진다.",
    act: async (page) => {
      await page.getByRole("row", { name: /봉암지구/ }).first().click();
      await page.waitForTimeout(1000);
      await page.mouse.wheel(0, 1500);
      await page.waitForTimeout(1000);
    },
    marks: [
      {
        kind: "read",
        find: { region: "선택 지구 상세" },
        label: "선택 지구 상세",
        desc: "그 지구의 수위와 강우량 기간 그래프. 가로 점선이 주의보 · 경보 · 대피 기준이다.",
      },
    ],
  },
  {
    id: "15-agent",
    scr: "공통",
    title: "AI 에이전트 패널",
    lead: "어느 화면에서든 오른쪽 아래 버튼으로 연다. 보고 있던 화면을 왼쪽에 남긴 채 오른쪽으로 밀려 나온다. 물으면 문장만 돌려주지 않고 근거 표와 그래프, 그 화면으로 가는 길을 함께 준다.",
    act: async (page) => {
      await page.mouse.wheel(0, -2000);
      await page.waitForTimeout(600);
      await page.locator('[aria-label="CUVIA Agent 열기"]').first().click();
      await page.waitForTimeout(1500);
      await page
        .getByRole("button", { name: /최근 한 달 가장 위험했던 지구는/ })
        .first()
        .click();
      await page.waitForTimeout(5000);
    },
    marks: [
      {
        kind: "read",
        find: { css: '[aria-label="CUVIA Agent 대화"]' },
        label: "대화 패널",
        desc: "물음과 답이 위에서 아래로 쌓인다. 답에는 판단의 근거가 표와 그래프로 함께 붙는다.",
      },
      {
        kind: "act",
        find: { role: "button", name: "통계·분석", exact: true },
        label: "바로가기",
        desc: "답이 가리키는 화면으로 보낸다. 누르면 패널이 닫히고 뒤 화면이 그 화면으로 바뀐다.",
      },
      {
        kind: "act",
        find: {
          group: [
            { role: "button", name: /서항지구 수위가 왜 오르고 있어/ },
            { role: "button", name: /수온이 왜 이렇게 높아/ },
          ],
        },
        label: "이어 물을 질문",
        desc: "누르면 그대로 다음 질문이 들어간다.",
      },
      {
        kind: "act",
        find: {
          group: [
            { css: '[aria-label="검색 조건을 자연어로 입력해 주세요."]' },
            { css: '[aria-label="전송"]' },
          ],
        },
        label: "입력창",
        desc: "직접 문장을 적어 묻는다.",
      },
      {
        kind: "act",
        find: { css: '[aria-label="대화 닫기"]' },
        label: "닫기",
        desc: "패널을 접는다. 뒤에 두고 온 화면은 그대로다.",
      },
    ],
  },
];

/* ── 실행 ────────────────────────────────────── */
fs.mkdirSync(SHOTS, { recursive: true });
const browser = await chromium.launch({ executablePath: findChromium() });
const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT } });

// 못 찾는 요소에 30초씩 매달리면 한 벌 도는 데 십 분이 넘는다
page.setDefaultTimeout(8000);

const warn = [];
page.on("pageerror", (e) => warn.push(`pageerror ${String(e.stack ?? e).split("\n").slice(0, 3).join(" | ")}`));
page.on("console", (m) => m.type() === "error" && warn.push(`console ${m.text().slice(0, 200)}`));
page.on("crash", () => warn.push("page crashed"));

// 봉암 트랙 발사 — 앱은 서항 상태로 열린다. 0 키가 봉암을 쏜다 (DemoControls)
await page.goto(`${BASE}/scr-01`, { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(5000);
await page.keyboard.press("0");
await page.waitForTimeout(5200);

const data = { width: WIDTH, height: HEIGHT, stops: [] };

for (const stop of STOPS) {
  try {
    if (stop.act) await stop.act(page);
  } catch (e) {
    warn.push(`[${stop.id}] 조작 실패: ${e.message.split("\n")[0]}`);
  }

  /* 화면이 살아 있는지 — 빈 화면을 찍고도 모른 채 지나가면 뒤 정류장이 전부 무너진다 */
  const health = await page.evaluate(() => ({
    url: location.pathname,
    text: (document.body.innerText ?? "").length,
  }));
  if (health.text < 200) warn.push(`[${stop.id}] 화면이 비었다 (${health.url}, 글자 ${health.text})`);

  let shot;
  if (stop.reuse) {
    shot = `shots/${stop.reuse}.png`;
  } else {
    await page.screenshot({
      path: path.join(SHOTS, `${stop.id}.png`),
      timeout: 60000,
      animations: "disabled",
      caret: "hide",
    });
    shot = `shots/${stop.id}.png`;
  }

  const marks = [];
  for (const mark of stop.marks ?? []) {
    try {
      const box = await measure(page, mark.find);
      marks.push({
        kind: mark.kind,
        label: mark.label,
        desc: mark.desc,
        box: {
          x: Math.round(box.x),
          y: Math.round(box.y),
          w: Math.round(box.w),
          h: Math.round(box.h),
        },
      });
    } catch (e) {
      warn.push(`[${stop.id}] 표식 못 찾음: ${mark.label} (${e.message.split("\n")[0]})`);
    }
  }

  data.stops.push({
    id: stop.id,
    scr: stop.scr,
    title: stop.title,
    lead: stop.lead,
    shot,
    marks,
  });
  console.log(
    `${stop.id}  →  ${health.url}  표식 ${marks.length}/${(stop.marks ?? []).length}  글자 ${health.text}`,
  );

  if (DUMP) {
    const inventory = await page.evaluate(() => {
      const out = [];
      const sel =
        'button, [role="button"], [role="tab"], [role="row"], [role="combobox"], textarea, input, section, [aria-label]';
      for (const el of document.querySelectorAll(sel)) {
        const r = el.getBoundingClientRect();
        if (r.width < 8 || r.height < 8) continue;
        const s = getComputedStyle(el);
        if (s.visibility === "hidden" || s.display === "none") continue;
        out.push({
          tag: el.tagName.toLowerCase(),
          role: el.getAttribute("role") ?? "",
          aria: el.getAttribute("aria-label") ?? "",
          text: (el.textContent ?? "").trim().slice(0, 70),
          box: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)],
        });
      }
      return out;
    });
    fs.writeFileSync(
      path.join(OUT, `inventory-${stop.id}.json`),
      JSON.stringify(inventory, null, 2),
    );
  }
}

fs.writeFileSync(path.join(OUT, "data.json"), JSON.stringify(data, null, 2));
await browser.close();

console.log(`\n${data.stops.length}컷  →  ${OUT}`);
if (warn.length) console.log(`\n확인 필요 ${warn.length}건\n  ${warn.join("\n  ")}`);
