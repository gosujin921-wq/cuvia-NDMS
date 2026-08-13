/* ─────────────────────────────────────────────
 * 바람 입자 레이어 — 격자 위를 흐르는 꼬리 입자 (SCR-01)
 *
 * 캔버스를 지도 캔버스 컨테이너에 끼워 타일 위·핀 아래에 세운다. 입자는 경위도로
 * 움직인다 — 화면 좌표로 움직이면 지도를 돌렸을 때 바람이 엉뚱한 방위로 분다.
 * 투영(project)이 회전·기울임을 알아서 처리한다.
 *
 * 꼬리는 매 프레임 destination-in 으로 이전 그림의 알파를 깎아 남긴다. 지도를
 * 움직이는 동안은 이전 프레임의 투영이 어긋나 꼬리가 번지므로 그때마다 지운다.
 *
 * 입자 속도는 실측(m/s)에 비례하되 줌과 무관하게 화면 픽셀 기준으로 맞춘다 —
 * 실시간 축척으로는 눈에 보이지 않고, 경위도 고정 속도로는 줌인할수록 폭주한다.
 * ───────────────────────────────────────────── */

import type maplibregl from "maplibre-gl";
import { sampleWind, type WindField } from "./wind-field";

/** 입자 하나가 프레임마다 가는 화면 거리 — px per (m/s) */
const PX_PER_MS = 0.15;
/** 프레임마다 남기는 꼬리 알파 — 낮출수록 꼬리가 짧다 */
const TRAIL_KEEP = 0.92;
/** 화면 픽셀당 입자 밀도 — 화면 크기에 비례해 뿌린다 */
const PARTICLES_PER_PX = 1 / 2800;
const MAX_PARTICLES = 900;

interface Particle {
  lng: number;
  lat: number;
  ttl: number;
}

export class WindParticleLayer {
  private map: maplibregl.Map;
  private field: WindField;
  private hourIndex: number;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private particles: Particle[] = [];
  private frameId: number | null = null;
  private readonly handleMove = () => this.clear();
  private readonly handleResize = () => this.resize();

  constructor(map: maplibregl.Map, field: WindField) {
    this.map = map;
    this.field = field;
    this.hourIndex = Math.max(0, field.hours.indexOf(field.defaultHour));

    this.canvas = document.createElement("canvas");
    this.canvas.style.position = "absolute";
    this.canvas.style.inset = "0";
    this.canvas.style.pointerEvents = "none";
    /* 캔버스 컨테이너 안 = 타일 위 · React 오버레이(핀·이름표) 아래 */
    map.getCanvasContainer().appendChild(this.canvas);
    this.ctx = this.canvas.getContext("2d")!;
    this.resize();

    map.on("move", this.handleMove);
    map.on("resize", this.handleResize);
  }

  setVisible(visible: boolean) {
    if (visible) {
      if (this.frameId == null) this.frame();
      this.canvas.style.display = "";
    } else {
      if (this.frameId != null) cancelAnimationFrame(this.frameId);
      this.frameId = null;
      this.clear();
      this.canvas.style.display = "none";
    }
  }

  destroy() {
    this.setVisible(false);
    this.map.off("move", this.handleMove);
    this.map.off("resize", this.handleResize);
    this.canvas.remove();
  }

  private resize() {
    const { clientWidth, clientHeight } = this.map.getCanvas();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = clientWidth * dpr;
    this.canvas.height = clientHeight * dpr;
    this.canvas.style.width = `${clientWidth}px`;
    this.canvas.style.height = `${clientHeight}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const target = Math.min(MAX_PARTICLES, Math.round(clientWidth * clientHeight * PARTICLES_PER_PX));
    while (this.particles.length < target) this.particles.push(this.spawn());
    this.particles.length = target;
  }

  private clear() {
    this.ctx.save();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.restore();
  }

  /** 보이는 범위 ∩ 격자 범위 안의 아무 자리 */
  private spawn(): Particle {
    const bounds = this.map.getBounds();
    const [west, south, east, north] = this.field.bbox;
    const w = Math.max(bounds.getWest(), west);
    const e = Math.min(bounds.getEast(), east);
    const s = Math.max(bounds.getSouth(), south);
    const n = Math.min(bounds.getNorth(), north);
    return {
      lng: w + Math.random() * Math.max(e - w, 0),
      lat: s + Math.random() * Math.max(n - s, 0),
      ttl: 40 + Math.random() * 120,
    };
  }

  private frame = () => {
    this.frameId = requestAnimationFrame(this.frame);
    const { ctx } = this;
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;

    /* 이전 그림을 조금 깎아 꼬리로 남긴다 */
    ctx.globalCompositeOperation = "destination-in";
    ctx.fillStyle = `rgba(0, 0, 0, ${TRAIL_KEEP})`;
    ctx.fillRect(0, 0, width, height);
    ctx.globalCompositeOperation = "source-over";

    /* 화면 픽셀 → 경위도 환산 — 줌이 달라져도 화면 속도가 같도록 */
    const degPerPx = 360 / (512 * 2 ** this.map.getZoom());

    ctx.lineWidth = 1.2;
    ctx.lineCap = "round";

    for (let i = 0; i < this.particles.length; i += 1) {
      let p = this.particles[i];
      const wind = p.ttl > 0 ? sampleWind(this.field, this.hourIndex, p.lng, p.lat) : null;
      if (!wind) {
        p = this.particles[i] = this.spawn();
        continue;
      }

      const from = this.map.project([p.lng, p.lat]);
      p.lng += wind.u * PX_PER_MS * degPerPx;
      p.lat += wind.v * PX_PER_MS * degPerPx * Math.cos((p.lat * Math.PI) / 180);
      p.ttl -= 1;
      const to = this.map.project([p.lng, p.lat]);

      if (to.x < -40 || to.x > width + 40 || to.y < -40 || to.y > height + 40) {
        this.particles[i] = this.spawn();
        continue;
      }

      /* 센 바람일수록 또렷하게 — 태풍의 결이 세기로도 읽힌다 */
      ctx.strokeStyle = `rgba(255, 255, 255, ${Math.min(0.2 + wind.speed / 30, 0.65)})`;
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
    }
  };
}
