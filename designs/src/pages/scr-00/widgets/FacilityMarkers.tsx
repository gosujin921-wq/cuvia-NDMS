/* ─────────────────────────────────────────────
 * 시설 마커 — 장면의 점 객체를 DS `MapMarker` 로 (scr-00 · 2026-09-17)
 *
 * 다른 화면(종합상황 장치 핀 · 재난관제 시설 핀)과 같은 어법이다: 원형 글라스 칩 + 우상단 상태 배지 + 호버 피커.
 * 여기에 더하는 것 둘.
 *   조치 배지   시간이 조치 시각을 지나면 그 시설에 "방류 중 15:05~" · "통제 중 15:22~" 배지가 선다 — 색만 바뀌던 것을 말로 바꾼다
 *   서로 가리킴  관련 SOP 줄을 짚으면 그 시설이 켜지고(selected), 마커를 누르면 그 SOP 줄이 켜진다
 * 라벨 칩은 DS 밖이다(DS 마커는 핀만 든다) — 종합상황 IncidentMarkers 의 이름표와 같은 자리에 같은 모양으로.
 * ───────────────────────────────────────────── */

import { useEffect, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import maplibregl from "maplibre-gl";
import { MapMarker, cn } from "@ds";
import { formatClock } from "../../../lib/datetime";
import type { PointTone, ScenePoint } from "../../../model/scene";
import { isPast, type SimAction } from "../../../model/sim/flood";
import { ACTION_STYLE } from "./action-style";

const TONE_COLOR: Record<PointTone, string> = {
  danger: "var(--color-danger)",
  warning: "var(--color-warning)",
  success: "var(--color-success)",
  primary: "var(--color-primary)",
  neutral: "var(--color-foreground-muted)",
};

export function FacilityMarkers({ map, ready, points, actions, at, focus, onPick }: {
  map: RefObject<maplibregl.Map | null>;
  ready: boolean;
  points: ScenePoint[];
  /** 이 시나리오의 조치 — 시각이 지난 것만 배지가 된다 */
  actions: SimAction[];
  at: string;
  /** 켜진 시설 id (SOP 줄 hover · 마커 클릭) */
  focus: Set<string>;
  onPick: (facilityId: string) => void;
}) {
  if (!ready) return null;
  return (
    <>
      {points.map((p) => {
        const done = actions.find((a) => a.facilityIds.includes(p.id) && isPast(a.at, at));
        return <Pin key={p.id} map={map} point={p} done={done ?? null} selected={focus.has(p.id)} onPick={onPick} />;
      })}
    </>
  );
}

function Pin({ map, point, done, selected, onPick }: { map: RefObject<maplibregl.Map | null>; point: ScenePoint; done: SimAction | null; selected: boolean; onPick: (id: string) => void }) {
  const [host] = useState(() => document.createElement("div"));
  useEffect(() => {
    const instance = map.current;
    if (!instance) return;
    const marker = new maplibregl.Marker({ element: host, anchor: "center" }).setLngLat(point.at).addTo(instance);
    return () => { marker.remove(); };
  }, [map, host, point.at]);

  const tone = point.tone ?? "neutral";
  const rule = done?.kind === "규정";
  const color = done ? ACTION_STYLE[done.kind].cssVar : TONE_COLOR[tone];
  const sub = done ? `${rule ? "규정 해당 · " : ""}${done.label} ${formatClock(done.at)}~` : point.state;
  return createPortal(
    <div className={cn("flex flex-col items-center gap-0.5", selected && "z-10")}>
      <MapMarker
        className="pointer-events-auto"
        variant="facility"
        icon={point.icon}
        size={point.small ? 26 : 32}
        color={color}
        selected={selected}
        badge={done ? { icon: ACTION_STYLE[done.kind].icon, tone: ACTION_STYLE[done.kind].cssVar, label: done.label } : undefined}
        picker={{
          title: point.label,
          rows: [
            ...(point.state ? [{ label: "상태", value: point.state }] : []),
            ...(done ? [{ label: rule ? "규정 해당" : "조치", value: `${done.label} · ${formatClock(done.at)}`, tone: ACTION_STYLE[done.kind].cssVar }] : []),
          ],
        }}
        onClick={() => onPick(point.id)}
        aria-label={`${point.label}${sub ? ` · ${sub}` : ""}`}
      />
      {(!point.small || selected || done) && (
        <span className={cn("pointer-events-none flex max-w-[200px] flex-col items-center rounded bg-surface/85 px-1.5 py-0.5 text-caption leading-tight backdrop-blur-sm", selected ? "text-foreground ring-1 ring-primary" : "text-foreground")}>
          <span className="truncate">{point.label}</span>
          {sub && <span className={cn("font-semibold", done ? ACTION_STYLE[done.kind].text : tone === "neutral" ? "text-foreground-muted" : `text-${tone}`)}>{sub}</span>}
        </span>
      )}
    </div>,
    host,
  );
}
