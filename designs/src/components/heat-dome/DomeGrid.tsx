/* ─────────────────────────────────────────────
 * 돔 격자 — 부풀음을 읽는 눈금
 *
 * 색면만으로는 돔이 지도 위 얼룩이라 **높이가 안 읽힌다.** 경위도 격자를 얹고 돔이 있는
 * 자리에서 격자를 위로 밀어 올리면, 격자가 휘는 정도로 부풀음이 보인다 — 중력을 그린
 * 그림에서 격자가 우물처럼 패는 것과 같은 장치이고 여기서는 반대로 솟는다.
 *
 * ── 왜 지형(terrain)이 아닌가
 *
 * MapLibre 지형 위에 선을 드리우면 같은 그림이 나온다. 실제로 만들어 봤는데 두 가지가 걸렸다.
 *  · 돔 지형 타일이 44장 × 줌 4단계 = **7,426장 · 64MB** 였다. 시연 저장소가 감당 못 한다
 *    (기존 지형 자료가 835KB 다)
 *  · 프레임을 넘길 때마다 지형 타일을 새로 읽어야 해서 돌려보기가 버벅인다
 *  · 그리고 돔 지형을 켜면 **진짜 산맥이 사라진다** — 지형 자리에 기압을 앉히는 것이므로
 *
 * 그래서 격자만 직접 그린다. 타일이 0장이고, 프레임 전환이 즉시이고, 지도는 손대지 않는다.
 *
 * ── 이 높이는 진짜가 아니다
 *
 * ★ 돔의 실제 부풀음은 4,500km 폭에 100gpm 남짓, 비율로 **0.002%** 다. 있는 그대로 그리면
 *   완전히 평평하다. 눈에 보이려면 과장이 필요하고 그건 연출이다 — 화면이 "굴곡 과장"
 *   이라고 밝힌다. 격자 자체는 실제 경위도라 자리는 정직하다. 위로 민 것만 연출이다.
 * ───────────────────────────────────────────── */

import { useEffect, useRef } from "react";
import type maplibregl from "maplibre-gl";
import { valuesOf, type WeatherField } from "../../lib/weather-field";
import { LOWER, UPPER } from "./useHeatDomeData";

/** 몇 도마다 선을 긋나 */
const STEP = 4;
/** 선 위에 점을 몇 도마다 찍나 — 성기면 휘는 자리가 각진다 */
const DENSIFY = 1;

/**
 * 격자를 칠 범위 — **자료 범위와 무관하게** 넉넉히 친다.
 *
 * 한때 자료 범위 안쪽으로 잘랐다. 그러면 기울인 화면에서 위쪽(먼 쪽)에 격자가 없어
 * 중간에 뚝 끊긴다 — 지평선까지 이어져야 할 눈금이 허공에서 사라진다.
 *
 * 격자는 **경위도**일 뿐이라 자료가 없는 데도 그어도 거짓말이 아니다. 자료가 없는 자리는
 * 깊이 0 이라 그냥 평평하게 지나간다. 참조로 삼은 그림도 그렇다 — 격자는 끝까지 평평하고
 * 가운데만 휜다.
 */
const GRID_BOUNDS = { west: 40, east: 200, south: -10, north: 75 };

/** 깊이 1 이 화면에서 몇 픽셀 솟나 */
const RISE_PX = 190;


/**
 * ★ 아래로는 **내리지 않는다.** 돔이 있는 자리만 솟고 나머지는 완전히 평평하다.
 *
 * 한때 음수 깊이(기준선에 못 미친 곳)를 -0.4 까지 내려 그렸다. 그러면 두 자리에서 선이
 * 꺾인다 —
 *  · 깊이가 -0.4 에 닿아 더 안 내려가는 자리 (자르는 지점)
 *  · **자료 격자 밖** — 거기서는 깊이를 0 으로 보므로, 격자 안 끝(-0.4 → 약 76px 아래)과
 *    격자 밖(0) 사이에 76px 짜리 단차가 생긴다. 바깥 격자가 꺾여 보이던 것이 이것이다
 *
 * 0 에서 자르면 두 문제가 한꺼번에 사라진다. 자료가 없는 데도, 돔에 못 미치는 데도 똑같이
 * 평평하므로 이어 붙는 자리가 없다. 참조로 삼은 그림도 평평한 판에 가운데만 솟는다.
 */
const rise = (depth: number) => Math.max(0, depth);

export interface DomeGridProps {
  map: maplibregl.Map | null;
  ready: boolean;
  lower: WeatherField | null;
  upper: WeatherField | null;
  index: number;
  visible: boolean;
  /** 선 색 — 돔 경계선(흰색)과 **색으로** 갈린다. 호출부가 정한다 */
  color: string;
}

export function DomeGrid({ map, ready, lower, upper, index, visible, color }: DomeGridProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  /** 매 프레임 다시 읽히는 값들 — 그리기 함수를 새로 만들지 않으려고 ref 로 흘린다 */
  const stateRef = useRef({ lower, upper, index, visible, color });
  stateRef.current = { lower, upper, index, visible, color };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!ready || !map || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    /* 격자선 좌표를 한 번만 만들어 둔다 — 매 프레임 다시 만들 이유가 없다 */
    const lines: [number, number][][] = [];
    {
      const { west: W, east: E, south: S, north: N } = GRID_BOUNDS;
      for (let lon = Math.ceil(W / STEP) * STEP; lon <= E; lon += STEP) {
        const pts: [number, number][] = [];
        for (let lat = S; lat <= N; lat += DENSIFY) pts.push([lon, lat]);
        lines.push(pts);
      }
      for (let lat = Math.ceil(S / STEP) * STEP; lat <= N; lat += STEP) {
        const pts: [number, number][] = [];
        for (let lon = W; lon <= E; lon += DENSIFY) pts.push([lon, lat]);
        lines.push(pts);
      }
    }

    /** 그 자리의 돔 깊이 — dome-layer.ts 와 같은 셈이다 */
    const depthAt = (() => {
      const st = stateRef.current;
      const lo = st.lower;
      const up = st.upper;
      if (!lo || !up) return () => 0;
      const fLo = lo.frames[Math.min(st.index, lo.frames.length - 1)];
      const fUp = up.frames[Math.min(st.index, up.frames.length - 1)];
      if (!fLo || !fUp) return () => 0;
      const vLo = valuesOf(fLo, LOWER);
      const vUp = valuesOf(fUp, UPPER);
      const s5 = Math.max(25, Math.max(...vLo) - LOWER.contour);
      const s2 = Math.max(25, Math.max(...vUp) - UPPER.contour);
      const { cols, rows, step, bbox } = lo;
      const [west, , , north] = bbox;

      const bilinear = (v: number[], c: number, r: number) => {
        const c0 = Math.max(0, Math.min(cols - 2, Math.floor(c)));
        const r0 = Math.max(0, Math.min(rows - 2, Math.floor(r)));
        const tx = c - c0;
        const ty = r - r0;
        const i = r0 * cols + c0;
        const top = v[i] + (v[i + 1] - v[i]) * tx;
        const bot = v[i + cols] + (v[i + cols + 1] - v[i + cols]) * tx;
        return top + (bot - top) * ty;
      };

      return (lon: number, lat: number) => {
        const c = (lon - west) / step;
        const r = (north - lat) / step;
        if (c < 0 || c > cols - 1 || r < 0 || r > rows - 1) return 0;
        return Math.min(
          (bilinear(vLo, c, r) - LOWER.contour) / s5,
          (bilinear(vUp, c, r) - UPPER.contour) / s2,
        );
      };
    });

    /*
     * 화면 좌표는 카메라가 움직일 때만 다시 잡는다.
     *
     * project() 를 격자 점 3천여 개에 매번 부르면 돌려보기 한 장마다 수십 ms 가 든다.
     * 이 화면은 카메라가 창원에 못 박혀 있어 **배율이 바뀔 때 말고는 좌표가 그대로**다.
     * 그래서 카메라 상태를 열쇠로 삼아 담아 두고, 프레임이 넘어갈 때는 깊이만 다시 잰다.
     */
    let baseKey = "";
    let base: ({ x: number; y: number } | null)[][] = [];

    let raf = 0;
    const draw = () => {
      raf = 0;
      const st = stateRef.current;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = map.getContainer().clientWidth;
      const h = map.getContainer().clientHeight;
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      if (!st.visible || !lines.length) return;

      const depth = depthAt();

      const c = map.getCenter();
      const key = `${c.lng},${c.lat},${map.getZoom()},${map.getPitch()},${map.getBearing()},${w},${h}`;
      if (key !== baseKey) {
        baseKey = key;
        base = lines.map((pts) =>
          pts.map(([lon, lat]) => {
            const p = map.project([lon, lat]);
            /* 기울인 화면에서는 지평선 너머 좌표가 엉뚱하게 크게 나온다 — 그런 점은 버린다 */
            if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || p.y < -h || p.y > h * 2) {
              return null;
            }
            return { x: p.x, y: p.y };
          }),
        );
      }

      /* 담아 둔 화면 좌표에 이번 장의 깊이만 얹는다 */
      const screen = base.map((pts, li) =>
        pts.map((p, pi) => {
          if (!p) return null;
          const [lon, lat] = lines[li][pi];
          return { x: p.x, y: p.y - rise(depth(lon, lat)) * RISE_PX };
        }),
      );

      /* 이어진 구간만 긋는다 — 버린 점에서 끊는다 */
      ctx.strokeStyle = st.color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (const pts of screen) {
        let started = false;
        for (const p of pts) {
          if (!p) {
            started = false;
            continue;
          }
          if (started) ctx.lineTo(p.x, p.y);
          else {
            ctx.moveTo(p.x, p.y);
            started = true;
          }
        }
      }
      ctx.stroke();
    };

    /** 지도가 움직일 때마다 다시 그린다 — 한 프레임에 한 번만 */
    const request = () => {
      if (!raf) raf = requestAnimationFrame(draw);
    };

    map.on("render", request);
    map.on("resize", request);
    request();

    return () => {
      map.off("render", request);
      map.off("resize", request);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [map, ready, lower, upper, index, visible, color]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0"
      aria-hidden
    />
  );
}
