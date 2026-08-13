/* ─────────────────────────────────────────────
 * 열돔 판 — 가운데 지구본을 읽어 주는 한 판
 *
 * 다섯 덩이가 위에서 아래로 선다:
 *   ① 머리    무엇을 · 언제 것인가
 *   ② 단면    두 높이가 기준선 위인가 아래인가
 *   ③ 범례    지도의 선·면이 각각 무엇인가
 *   ④ 조작    일렁임을 멈추고 손으로 밀어 본다
 *   ⑤ 출처    잰 값과 자료 출처
 *
 * ★ 좁은 레일용 판독(HeatDomeReadout)과 다른 물건이다. 저쪽은 숫자 두 줄만 세우는 것이고,
 *   이 판은 지구본이 무엇을 그린 것인지를 끝까지 댄다.
 *
 * 트윈에서는 **우측 레일의 분석 조건 자리**에 선다. 폭염에는 조절할 조건이 없어(수위 같은
 * 변수가 없다) 그 칸이 "미등재"로 비는데, 비는 칸을 두느니 지구본을 읽어 주는 판이 든다.
 *
 * ── 말투 규칙 (04 §5)
 *
 * 쓰지 않는 말: "깊은 돔"(등급처럼 읽힌다 · 열돔은 공식 기준이 없다) · "뜨겁다"(이 값은
 * 온도가 아니라 높이다) · "덮었다/뚜껑"(하늘에 뚜껑이 있는 것으로 읽힌다. 더위는 지면에
 * 있다) · "티베트고기압"(자료 창 안에서 중심이 안 잡힌다) · "찬 상공"(상공 기온을 재지
 * 않는다) · 기준선과의 차(12,500 은 임의로 그은 보조선이라 그 거리에 뜻이 없다) ·
 * hPa/gpm(판독부에서 뺀다. 맨 아래 잰 값 줄에만 남긴다).
 * ───────────────────────────────────────────── */

import { useEffect, useRef, useState, type ReactNode } from "react";

import { CONTOUR_COLOR, CONTOUR_OPACITY } from "../../lib/upper-contour";
import { LOWER, UPPER, type HeatDomeData, type LayerReading } from "./useHeatDomeData";

/* ─────────────────────────────────────────────
 * 일렁임 — "이건 멈춘 그림이 아니라 잰 값이다"를 보이는 움직임
 *
 * 한때 90ms 로 22일치를 통째로 넘겼다. 두 가지가 어긋났다. 초당 열한 장은 **너무 빨라
 * 만든 효과처럼 보이고**, 22일을 다 도니 돔이 왔다가 깨지는 동안 판독(단면·잰 값)이
 * 넘었다/못 넘었다를 계속 뒤집어 판이 시끄러웠다.
 *
 * 그래서 **기본 프레임에서 뒤로 세 장(=하루 반)을 천천히 오간다.** 돔 가장자리는 넘실거리되
 * 판정은 그대로 있다. 넘기는 자료는 여전히 실측이다 — 지어낸 움직임이 아니다.
 *
 * ★ **앞(이전 날)으로는 안 간다.** 기본 프레임은 돔이 가장 깊은 날이라, 그 앞은 아직 12km
 *   선을 못 넘은 날이 섞인다(12,486 · 12,491 · 12,498 대 기준선 12,500). 앞뒤로 오가면
 *   단면 그림의 위 선이 1초마다 붉었다 회색이었다 해서, 없애려던 시끄러움이 그대로 돌아온다.
 * ───────────────────────────────────────────── */

/** 한 장 넘기는 간격 (ms) */
const SHIMMER_MS = 1100;
/** 기본 프레임에서 뒤로 몇 장까지 오가나 = **현재 구간**의 길이 */
const SHIMMER_SPAN = 3;

/* ─────────────────────────────────────────────
 * 이동 경로 — 44장을 과거 · 현재 · 예상경로 셋으로 가른다
 *
 * 자료를 새로 굽지 않는다. 이미 있는 한 사이클(돔이 오고 · 머물다 · 깨지는 44장, 12시간
 * 간격)을 **잘라 쓴다.** 자르는 자리는 기본 프레임(돔이 가장 깊은 날)이 정한다:
 *
 *   과거      처음 ~ 기본 직전        돔이 자리 잡으며 커지는 동안
 *   현재      기본 ~ 기본+3           일렁임이 노는 구간 (SHIMMER_SPAN 과 같은 자리다)
 *   예상경로  그 뒤 열 장             돔이 머물다 물러나기 시작하는 동안
 *
 * 뒤쪽 나머지는 안 쓴다. 끝까지 가면 돔이 다 깨진 뒤라 예상경로만 13일이 되어, 손잡이를
 * 밀어도 한참 아무 일이 없는 구간이 생긴다.
 * ───────────────────────────────────────────── */

/** 예상경로로 보일 장수 — 5일치 */
const FUTURE_SPAN = 10;

/** 손잡이가 선 자리가 어느 구간인가 */
type PathBand = "past" | "now" | "next";

export interface HeatDomeCardProps {
  dome: HeatDomeData;
  /** 판 껍데기는 바깥이 씌운다 — 레일 카드는 GlassPanel 안에 알맹이만 넣는 규약이다 */
  className?: string;
}

export function HeatDomeCard({ dome, className }: HeatDomeCardProps) {
  /* 들어오자마자 일렁인다 — 눌러야 움직이면 안 누른 사람에게는 그림 한 장으로 보인다 */
  const [playing, setPlaying] = useState(true);

  const setIndexRef = useRef(dome.setIndex);
  setIndexRef.current = dome.setIndex;
  const total = dome.labels.length;

  /* 현재 구간의 시작 — 자료가 정한 기본 프레임(돔이 가장 깊은 날). 구간 셋이 여기서 갈린다 */
  const [base, setBase] = useState<number | null>(null);
  useEffect(() => {
    if (base == null && dome.readings) setBase(dome.index);
  }, [base, dome.readings, dome.index]);

  /* 세 구간의 경계. 자료를 다 읽기 전에는 손잡이를 세우지 않는다 */
  const nowFrom = base ?? 0;
  const nowTo = Math.min(nowFrom + SHIMMER_SPAN, total - 1);
  const pathTo = Math.min(nowTo + FUTURE_SPAN, total - 1);
  const band: PathBand = dome.index < nowFrom ? "past" : dome.index <= nowTo ? "now" : "next";

  useEffect(() => {
    if (!playing || total < 2) return;
    let dir = 1;
    const id = setInterval(() => {
      setIndexRef.current((i: number) => {
        if (i + dir > nowTo) dir = -1;
        else if (i + dir < nowFrom) dir = 1;
        return Math.max(nowFrom, Math.min(nowTo, i + dir));
      });
    }, SHIMMER_MS);
    return () => clearInterval(id);
  }, [playing, total, nowFrom, nowTo]);

  /* 실시간을 다시 켜면 현재 구간으로 돌아온다 — 과거에 세워 둔 채 켜면 한 박자 동안
     "실시간"이라 해 놓고 과거를 보여준다 */
  const goLive = (on: boolean) => {
    setPlaying(on);
    if (on) dome.setIndex(nowFrom);
  };

  const lower = dome.readings?.find((r) => r.spec.id === LOWER.id) ?? null;
  const upper = dome.readings?.find((r) => r.spec.id === UPPER.id) ?? null;
  /* startDate 는 상층장에만 있는 값이라 공용 WeatherField 타입에 없다 — 공용 타입을
     상층 사정으로 넓히지 않고 여기서만 느슨하게 읽는다 */
  const year =
    (dome.lower?.meta as { startDate?: string } | undefined)?.startDate?.slice(0, 4) ?? "";

  return (
    <section className={className} aria-label="열돔">
      {/* ① 머리 ─────────────────────────────────── */}
      <div className="flex items-baseline justify-between gap-2 px-4 pb-2.5 pt-3">
        <h2 className="text-body font-semibold">열돔</h2>
        {dome.date && (
          <span className="font-mono text-caption text-foreground-subtle">
            {year && `${year}-`}
            {dome.date}
          </span>
        )}
      </div>

      {lower && upper ? (
        <>
          {/* ② 단면 ───────────────────────────────── */}
          <Block>
            <Column lower={lower} upper={upper} />
          </Block>

          {/* ③ 지도 범례 ──────────────────────────── */}
          <Block>
            <div className="flex flex-col gap-1.5">
              <MapKey kind="solid">5.5km 기준선</MapKey>
              <MapKey kind="dashed">12km 기준선</MapKey>
              <MapKey kind="fill">열돔</MapKey>
            </div>
          </Block>

          {/* ④ 이동 경로 ─────────────────────────── */}
          <Block>
            <div className="flex items-center justify-between gap-2">
              <span className="text-caption font-semibold text-foreground-muted">
                열돔 이동 경로
              </span>
              {/* 실시간 — 켜면 현재 구간 안에서 일렁이고, 끄면 손으로 민다 */}
              <label className="flex cursor-pointer items-center gap-1.5 text-caption text-foreground-muted">
                <input
                  type="checkbox"
                  checked={playing}
                  onChange={(e) => goLive(e.target.checked)}
                  className="size-3.5 accent-[var(--color-risk-lv5)]"
                />
                실시간
              </label>
            </div>

            {/* 세 구간 띠 — 손잡이가 선 구간만 진하다. 폭은 구간 장수에 비례한다 */}
            <div className="mt-2.5 flex gap-0.5" aria-hidden>
              {(
                [
                  ["past", "과거", nowFrom],
                  ["now", "현재", nowTo - nowFrom + 1],
                  ["next", "예상경로", pathTo - nowTo],
                ] as const
              ).map(([id, label, span]) => (
                <div key={id} className="flex flex-col gap-1" style={{ flexGrow: span }}>
                  <div
                    className="h-1 rounded-full"
                    style={{
                      background:
                        id === "now" ? "var(--color-risk-lv5)" : "var(--color-foreground-subtle)",
                      opacity: band === id ? 1 : 0.35,
                    }}
                  />
                  <span
                    className="text-center text-[11px] leading-none"
                    style={{
                      color:
                        band === id ? "var(--color-foreground)" : "var(--color-foreground-subtle)",
                    }}
                  >
                    {label}
                  </span>
                </div>
              ))}
            </div>

            {/* 손잡이 — 경로 전체를 민다. 잡는 순간 실시간이 꺼진다 */}
            <input
              type="range"
              min={0}
              max={pathTo}
              value={Math.min(dome.index, pathTo)}
              onChange={(e) => {
                setPlaying(false);
                dome.setIndex(Number(e.target.value));
              }}
              className="mt-2 h-1 w-full accent-[var(--color-risk-lv5)]"
              aria-label="열돔 이동 경로"
            />
          </Block>

          {/* ⑤ 출처 ───────────────────────────────── */}
          <Block>
            {/* DS 최소 글자는 13px 이지만 여기만 11px 이다 — 출처는 읽히되 판독을
                  가리면 안 되는 줄이고, 13px 로 두면 판 아래가 출처로 채워진다 */}
            <p className="font-mono text-[11px] leading-snug text-foreground-subtle">
              잰 값 {Math.round(lower.value).toLocaleString()}m ·{" "}
              {Math.round(upper.value).toLocaleString()}m (기준선 {LOWER.contour.toLocaleString()} ·{" "}
              {UPPER.contour.toLocaleString()})
            </p>
            <p className="mt-1 text-[11px] leading-snug text-foreground-subtle">
              {LOWER.sourceLabel} · {dome.lower?.meta.license} · 경계 © OpenStreetMap (ODbL)
            </p>
          </Block>
        </>
      ) : (
        <div className="px-4 pb-3">
          <p className="text-caption text-foreground-muted">상층장을 읽는 중이다.</p>
        </div>
      )}
    </section>
  );
}

/* ── 판 안의 한 덩어리 — 사이는 가는 구분선으로 가른다 ────────── */
function Block({ children }: { children: ReactNode }) {
  return <div className="border-t border-border px-4 py-3">{children}</div>;
}

/* ─────────────────────────────────────────────
 * 단면 그림 — 두 높이가 기준선 위인가 아래인가
 *
 * ★ 점선과 실선 사이는 **항상 11px 고정**이다. 값에 비례시키면 안 된다 — 실제 차이는
 *   15m·65m 라 이 눈금에서 1px 도 안 되어 두 선이 겹쳐 버린다. 이 그림이 말하는 것은
 *   얼마나 높은가가 아니라 **넘었나 아닌가** 하나뿐이다.
 * ───────────────────────────────────────────── */

/** 그림 높이 (px) */
const FIG_H = 120;
/** 두 높이의 자리 — 12km 는 위, 5.5km 는 지면에서 약 46% */
const ANCHOR = { upper: 8, lower: 60 };
/** 점선과 실선 사이 — 고정값이다(위 머리말) */
const GAP = 11;
/** 지면선 */
const GROUND = 100;
/** 왼쪽 라벨이 차지하는 폭 */
const LABEL_W = 42;

function Column({ lower, upper }: { lower: LayerReading; upper: LayerReading }) {
  /* 붉은 기운이 어디부터 깔리나 — 둘 다 넘으면 기둥 전체, 아래만 넘으면 아래만 */
  const tintTop = upper.inside && lower.inside ? ANCHOR.upper : lower.inside ? ANCHOR.lower : null;

  return (
    <div className="relative w-full" style={{ height: FIG_H }}>
      {tintTop != null && (
        <div
          className="absolute rounded-sm"
          style={{
            left: LABEL_W,
            right: 0,
            top: tintTop,
            height: GROUND - tintTop,
            background: "var(--color-risk-lv5)",
            opacity: 0.12,
          }}
          aria-hidden
        />
      )}

      <Pair label="12km" anchor={ANCHOR.upper} inside={upper.inside} dashed />
      <Pair label="5.5km" anchor={ANCHOR.lower} inside={lower.inside} />

      {/* 지면 — 더위가 있는 자리다 */}
      <div
        className="absolute"
        style={{
          left: LABEL_W,
          right: 0,
          top: GROUND,
          borderTop: "1px solid var(--color-foreground-subtle)",
        }}
        aria-hidden
      />
      <span
        className="absolute text-[11px] leading-none text-foreground-subtle"
        style={{ left: LABEL_W, top: GROUND + 5 }}
      >
        지면 · 창원
      </span>
    </div>
  );
}

/**
 * 한 높이 — 기준선과 지금 높이 두 줄.
 *
 * ★ 선 **모양**은 어느 높이인가만 말한다 — 지도와 같은 규칙이다(실선 5.5km · 점선 12km).
 *   기준선인지 지금 높이인지는 **굵기와 색**으로 가른다(가는 회색 / 굵은 붉은색).
 *
 * 한때 그림에서만 점선=기준선, 실선=지금 높이로 썼다. 그러면 선 모양이 두 가지 뜻을 갖고,
 * 같은 화면 안에서 지도 범례와 어긋난다 — 범례를 두 벌 두어야 했다. 규칙을 지도에 맞추니
 * 범례가 하나로 준다.
 *
 * 넘었으면 지금 높이가 기준선 **위**, 못 넘었으면 **아래**에 온다.
 */
function Pair({
  label,
  anchor,
  inside,
  dashed = false,
}: {
  label: string;
  anchor: number;
  inside: boolean;
  dashed?: boolean;
}) {
  const style = dashed ? "dashed" : "solid";
  const nowTop = inside ? anchor : anchor + GAP;
  const baseTop = inside ? anchor + GAP : anchor;
  const nowColor = inside ? "var(--color-risk-lv5)" : "var(--color-foreground-subtle)";

  return (
    <>
      <span
        className="absolute text-[11px] leading-none text-foreground-subtle"
        style={{ left: 0, top: anchor + GAP / 2 - 4 }}
      >
        {label}
      </span>
      {/* 기준선 — 가는 회색 */}
      <div
        className="absolute"
        style={{
          left: LABEL_W,
          right: 0,
          top: baseTop,
          borderTop: `1px ${style} var(--color-foreground-subtle)`,
        }}
        aria-hidden
      />
      {/* 지금 높이 — 굵은 선. 넘었으면 붉게 */}
      <div
        className="absolute"
        style={{
          left: LABEL_W,
          right: 0,
          top: nowTop,
          borderTop: `2px ${style} ${nowColor}`,
        }}
        aria-hidden
      />
    </>
  );
}

/* ── 지도 범례 한 칸 — 지도의 선·면과 같은 모양을 그대로 보인다 ────────── */
function MapKey({ kind, children }: { kind: "solid" | "dashed" | "fill"; children: ReactNode }) {
  return (
    <span className="flex items-center gap-2 text-caption text-foreground-muted">
      {kind === "fill" ? (
        <span
          className="h-3 w-5 shrink-0 rounded-sm"
          style={{ background: "var(--color-risk-lv5)", opacity: 0.45 }}
          aria-hidden
        />
      ) : (
        <span
          className="h-0 w-5 shrink-0"
          style={{
            borderTop: `2px ${kind === "dashed" ? "dashed" : "solid"} ${CONTOUR_COLOR}`,
            opacity: CONTOUR_OPACITY,
          }}
          aria-hidden
        />
      )}
      {children}
    </span>
  );
}
