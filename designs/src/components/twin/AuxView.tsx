/* ─────────────────────────────────────────────
 * 보조 분석뷰 — 지도로 못 보이는 것 (03 §21 · §24)
 *
 *   ProfileView  종단도. 상류 → 하류 수위 단면과 기준 수위선. B 하천범람
 *   SystemView   계통도. 시설 노드와 의존 연결, 노드 상태·복구 순번. G 기반시설 장애
 *
 * 화면 아래 패널에 선다. 시간 칩을 누르면 같은 눈금으로 바뀐다. 값은 예측판이 든 시나리오다.
 * SVG 는 컨테이너 픽셀 폭 그대로 그린다 — viewBox 축소로 글자가 13px 아래로 내려가지 않게.
 * DS 에 차트 부품이 없어 직접 그린다. // TODO(ds): 선 그래프·다이어그램 부품 DS 승격 대상
 * ───────────────────────────────────────────── */

import { useRef, type ReactNode } from "react";
import { Icon } from "@iconify/react";
import { cn } from "@ds";
import type { NodeState, SceneProfile, SceneSystem } from "../../model/scene";
import { formatClock } from "../../lib/datetime";
import { useElementWidth } from "../../lib/useElementWidth";

const FONT = 13;
const PAD = { l: 48, r: 16, t: 18, b: 28 };

interface AuxSectionProps {
  title: string;
  meta: ReactNode;
  label: string;
  /** 접힘 — 지도 장면을 가리므로 머리만 남길 수 있다 */
  collapsed?: boolean;
  onToggle?: () => void;
  children: ReactNode;
}

function AuxSection({ title, meta, label, collapsed, onToggle, children }: AuxSectionProps) {
  return (
    <section className="flex flex-col gap-1 p-3" aria-label={label}>
      <header className="flex items-center justify-between gap-2">
        <h2 className="text-body font-semibold text-foreground">{title}</h2>
        <div className="flex items-center gap-2">
          <span className="font-mono text-caption text-foreground-subtle">{meta}</span>
          {onToggle && (
            <button type="button" onClick={onToggle} className="flex cursor-pointer items-center rounded border-none bg-transparent p-0.5 text-foreground-muted hover:bg-surface-raised hover:text-foreground" aria-label={collapsed ? `${title} 펼치기` : `${title} 접기`}>
              <Icon icon={collapsed ? "mdi:chevron-up" : "mdi:chevron-down"} className="size-4" aria-hidden />
            </button>
          )}
        </div>
      </header>
      {!collapsed && children}
    </section>
  );
}

export function ProfileView({ profile, validAt, compareAt, collapsed, onToggle }: { profile: SceneProfile; validAt: string; /** 대안 비교 시 기준 예측판의 같은 눈금 수위 */ compareAt?: number[] | null; collapsed?: boolean; onToggle?: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const W = useElementWidth(ref);
  const H = 160;
  const levels = profile.levelsByMark[validAt] ?? profile.levelsByMark[Object.keys(profile.levelsByMark)[0]] ?? [];
  const kms = profile.stations.map((s) => s.km);
  const minKm = Math.min(...kms), maxKm = Math.max(...kms);
  /* 기준 수위 — 관측소마다 다르면 하상을 따라 기울어진 선, 같으면 수평선 */
  const thresholds = profile.stations.map((s) => s.threshold ?? profile.threshold);
  const sloped = profile.stations.some((s) => s.threshold !== undefined);
  const allY = [...profile.stations.map((s) => s.bed), ...Object.values(profile.levelsByMark).flat(), ...thresholds];
  const minY = Math.min(...allY) - 0.3, maxY = Math.max(...allY) + 0.3;
  const x = (km: number) => PAD.l + ((km - minKm) / Math.max(maxKm - minKm, 1e-9)) * (W - PAD.l - PAD.r);
  const y = (v: number) => H - PAD.b - ((v - minY) / Math.max(maxY - minY, 1e-9)) * (H - PAD.t - PAD.b);
  const path = (vals: number[]) => vals.map((v, i) => `${i === 0 ? "M" : "L"}${x(profile.stations[i].km).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const bedPath = path(profile.stations.map((s) => s.bed));
  const levelPath = path(levels);
  const area = `${levelPath} ${profile.stations.slice().reverse().map((s) => `L${x(s.km).toFixed(1)},${y(s.bed).toFixed(1)}`).join(" ")} Z`;
  const over = levels.map((v, i) => v >= thresholds[i]);
  const thresholdPath = path(thresholds);

  return (
    <AuxSection title="종단도 · 상류 → 하류" meta={<>{formatClock(validAt)} · {sloped ? "기준 수위 = 관측소별 둑 높이" : `기준 수위 EL.${profile.threshold.toFixed(1)} m`}</>} label="종단도" collapsed={collapsed} onToggle={onToggle}>
      <div ref={ref} className="w-full">
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block" role="img" aria-label="하천 종단 수위" fontSize={FONT}>
          {/* 기준 수위선 — 관측소별이면 관측소를 잇는 선, 하나면 수평선 */}
          {sloped ? (
            <path d={thresholdPath} className="fill-none stroke-danger" strokeDasharray="4 3" strokeWidth={1.2} />
          ) : (
            <line x1={PAD.l} x2={W - PAD.r} y1={y(profile.threshold)} y2={y(profile.threshold)} className="stroke-danger" strokeDasharray="4 3" strokeWidth={1.2} />
          )}
          {/* 관측소별 기준이면 머리 한 줄("기준 수위 = 관측소별 둑 높이")이 말한다 — 선 끝 글자는 마지막 관측소 값과 겹쳤다 */}
          {!sloped && <text x={W - PAD.r} y={y(profile.threshold) - 5} textAnchor="end" className="fill-danger">기준 수위</text>}
          {/* 대안 비교 — 기준 예측판 수위를 옅게 */}
          {compareAt && <path d={path(compareAt)} className="fill-none stroke-foreground-subtle" strokeWidth={1.5} strokeDasharray="3 3" />}
          {/* 수면 */}
          <path d={area} className="fill-primary-text/25" />
          <path d={levelPath} className="fill-none stroke-primary-text" strokeWidth={2.2} />
          {/* 하상 */}
          <path d={bedPath} className="fill-none stroke-foreground-muted" strokeWidth={1.5} />
          {/* 관측소 */}
          {profile.stations.map((s, i) => {
            const v = levels[i] ?? s.bed;
            const first = i === 0, last = i === profile.stations.length - 1;
            return (
              <g key={s.id}>
                <circle cx={x(s.km)} cy={y(v)} r={4} className={cn(over[i] ? "fill-danger" : "fill-primary-text")} />
                <text x={x(s.km)} y={H - 9} textAnchor={first ? "start" : last ? "end" : "middle"} className="fill-foreground-muted">{s.label}</text>
                <text x={x(s.km) + (first ? 8 : last ? -8 : 0)} y={y(v) - 9} textAnchor={first ? "start" : last ? "end" : "middle"} className={cn("font-mono", over[i] ? "fill-danger" : "fill-foreground")}>{v.toFixed(1)}</text>
              </g>
            );
          })}
          <text x={PAD.l - 8} y={PAD.t + 4} textAnchor="end" className="fill-foreground-subtle">EL.m</text>
        </svg>
      </div>
    </AuxSection>
  );
}

const NODE_CLASS: Record<NodeState, { ring: string; icon: string; text: string }> = {
  정상: { ring: "stroke-success fill-success/20", icon: "text-success", text: "fill-success" },
  경고: { ring: "stroke-warning fill-warning/20", icon: "text-warning", text: "fill-warning" },
  중단: { ring: "stroke-danger fill-danger/20", icon: "text-danger", text: "fill-danger" },
  복구: { ring: "stroke-primary fill-primary/20", icon: "text-primary-text", text: "fill-primary-text" },
};

const NODE_R = 15;
/** 노드 한 줄 높이 — 원 + 라벨 두 줄이 겹치지 않는 간격 */
const ROW = 40;

export function SystemView({ system, validAt, collapsed, onToggle }: { system: SceneSystem; validAt: string; collapsed?: boolean; onToggle?: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const W = useElementWidth(ref);
  const state = system.stateByMark[validAt] ?? {};
  const order = system.orderByMark?.[validAt] ?? {};
  /* 배치 — 깊이(상류 노드 수)별로 열을 나눈다. 루트는 들어오는 간선이 없는 노드. 라벨은 원 오른쪽에 둬 세로로 쌓여도 안 겹친다 */
  const incoming = new Map<string, string[]>();
  for (const e of system.edges) incoming.set(e.to, [...(incoming.get(e.to) ?? []), e.from]);
  const depth = new Map<string, number>();
  const depthOf = (id: string): number => {
    if (depth.has(id)) return depth.get(id)!;
    const ins = incoming.get(id) ?? [];
    const d = ins.length === 0 ? 0 : 1 + Math.max(...ins.map(depthOf));
    depth.set(id, d);
    return d;
  };
  system.nodes.forEach((n) => depthOf(n.id));
  const cols = Math.max(...system.nodes.map((n) => depth.get(n.id) ?? 0)) + 1;
  const byCol: string[][] = Array.from({ length: cols }, () => []);
  for (const n of system.nodes) byCol[depth.get(n.id) ?? 0].push(n.id);
  const rows = Math.max(...byCol.map((c) => c.length));
  const H = Math.max(120, rows * ROW + 24);
  const colW = (W - 24) / cols;
  const pos = new Map<string, { x: number; y: number }>();
  byCol.forEach((ids, c) => {
    const top = (H - ids.length * ROW) / 2;
    ids.forEach((id, r) => pos.set(id, { x: 12 + c * colW + NODE_R + 4, y: top + r * ROW + ROW / 2 }));
  });

  return (
    <AuxSection title="계통도 · 의존 연결" meta={formatClock(validAt)} label="계통도" collapsed={collapsed} onToggle={onToggle}>
      <div ref={ref} className="relative w-full">
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block" role="img" aria-label="시설 계통도" fontSize={FONT}>
          {system.edges.map((e) => {
            const a = pos.get(e.from), b = pos.get(e.to);
            if (!a || !b) return null;
            const broken = state[e.from] === "중단" || state[e.to] === "중단";
            /* 간선은 라벨 칸을 지나가지 않게 원 오른쪽 라벨 끝에서 다음 원 왼쪽으로 */
            return <line key={`${e.from}-${e.to}`} x1={a.x + colW - NODE_R - 12} y1={a.y} x2={b.x - NODE_R - 2} y2={b.y} className={cn(broken ? "stroke-danger/60" : "stroke-foreground-muted")} strokeWidth={2} strokeDasharray={broken ? "4 4" : undefined} />;
          })}
          {system.nodes.map((n) => {
            const p = pos.get(n.id)!;
            const st = state[n.id] ?? "정상";
            const c = NODE_CLASS[st];
            return (
              <g key={n.id}>
                <circle cx={p.x} cy={p.y} r={NODE_R} className={cn(c.ring)} strokeWidth={2} />
                <text x={p.x + NODE_R + 6} y={p.y - 2} className="fill-foreground">{n.label}</text>
                <text x={p.x + NODE_R + 6} y={p.y + FONT + 1} className={cn("font-semibold", c.text)}>{st}</text>
                {order[n.id] !== undefined && (
                  <>
                    <circle cx={p.x + 12} cy={p.y - 12} r={8} className="fill-primary" />
                    <text x={p.x + 12} y={p.y - 8} textAnchor="middle" className="fill-primary-foreground font-bold" fontSize={11}>{order[n.id]}</text>
                  </>
                )}
              </g>
            );
          })}
        </svg>
        {/* 아이콘은 SVG 위에 겹쳐 놓는다 — Iconify 는 DOM 이라 */}
        {system.nodes.map((n) => {
          const p = pos.get(n.id)!;
          const st = state[n.id] ?? "정상";
          return (
            <Icon key={n.id} icon={n.icon} className={cn("pointer-events-none absolute size-4 -translate-x-1/2 -translate-y-1/2", NODE_CLASS[st].icon)} style={{ left: p.x, top: p.y }} aria-hidden />
          );
        })}
      </div>
    </AuxSection>
  );
}
