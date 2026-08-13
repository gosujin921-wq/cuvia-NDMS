/* ─────────────────────────────────────────────
 * 레이어 — 03 화면정의서 §5 우하단
 *
 * 씬 표현(3D·지형·날씨)과 장비 표시, 침수 표현을 한 상자에서 켜고 끈다. 시연자가
 * 침수 예상범위를 마지막에 켜는 흐름이라 침수 항목을 아래쪽에 모은다.
 *
 * 부품이 두 가지인 것은 성격이 둘이기 때문이다.
 *   Switch   씬을 켜고 끈다 — 3D·날씨·지형·침수. 화면 자체가 달라지는 모드 전환
 *   Checkbox 표식을 걸러 본다 — 장비 종류. "무엇을 볼지" 고르는 필터
 * 장비 필터가 Checkbox 인 것은 정본을 따른 것이다 — 같은 일을 하는 지도 위 레이어 팝오버
 * (components/MapUtilStrip.tsx)와 KISA map-layer-control 이 둘 다 Checkbox 다.
 * 같은 판단을 화면마다 다른 부품으로 물으면 같은 앱으로 안 읽힌다.
 * ───────────────────────────────────────────── */

import { Icon } from "@iconify/react";
import { Checkbox, Switch, cn } from "@ds";
import { DEVICE_KINDS, type DeviceKind } from "../../../demo/devices";

export interface LayerState {
  buildings3d: boolean;
  weather: boolean;
  terrain: boolean;
  hillshade: boolean;
  devices: Record<DeviceKind, boolean>;
  floodLine: boolean;
  flood: boolean;
}

interface LayerPanelProps {
  state: LayerState;
  onChange: (next: LayerState) => void;
}

export function LayerPanel({ state, onChange }: LayerPanelProps) {
  const set = (patch: Partial<LayerState>) => onChange({ ...state, ...patch });

  return (
    <section className="flex flex-col gap-2 p-3" aria-label="레이어">
      <h2 className="text-body font-semibold text-foreground">레이어</h2>

      <div className="flex flex-col gap-1.5">
        <Row label="3D 보기" checked={state.buildings3d} onChange={(v) => set({ buildings3d: v })} />
        <Row label="날씨효과" checked={state.weather} onChange={(v) => set({ weather: v })} />
        <Row label="지형 렌더링" checked={state.terrain} onChange={(v) => set({ terrain: v })} />
        <Row
          label="지형 음영"
          hint="등고선 데이터가 없어 음영으로 기복을 보인다"
          checked={state.hillshade}
          onChange={(v) => set({ hillshade: v })}
        />
      </div>

      <div className="flex flex-col gap-1.5 border-t border-border pt-2">
        {DEVICE_KINDS.map((spec) => (
          <DeviceRow
            key={spec.kind}
            label={spec.label}
            swatch={spec.color}
            icon={spec.icon}
            checked={state.devices[spec.kind]}
            onChange={(v) => set({ devices: { ...state.devices, [spec.kind]: v } })}
          />
        ))}
      </div>

      <div className="flex flex-col gap-1.5 border-t border-border pt-2">
        <Row label="침수선 보기" checked={state.floodLine} onChange={(v) => set({ floodLine: v })} />
        <Row
          label="범람시 침수 예상범위 보기"
          checked={state.flood}
          onChange={(v) => set({ flood: v })}
          emphasis
        />
      </div>
    </section>
  );
}

/** 씬 모드 한 줄 — 라벨 왼쪽, 스위치 오른쪽 */
function Row({
  label,
  hint,
  checked,
  onChange,
  emphasis,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  emphasis?: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2">
      <span className="flex min-w-0 flex-1 flex-col">
        <span
          className={cn(
            "truncate text-caption",
            emphasis ? "font-medium text-foreground" : "text-foreground-muted",
          )}
        >
          {label}
        </span>
        {hint && <span className="truncate text-caption text-foreground-subtle">{hint}</span>}
      </span>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
    </label>
  );
}

/**
 * 장비 표시 한 줄 — 체크박스 · 색 바탕 글리프 · 라벨.
 *
 * 줄 문법을 지도 위 레이어 팝오버(MapUtilStrip)와 같게 맞춘다. 같은 장비를 두 화면에서
 * 켜고 끄는데 한쪽은 스위치, 한쪽은 체크박스면 두 화면이 남남으로 읽힌다.
 */
function DeviceRow({
  label,
  swatch,
  icon,
  checked,
  onChange,
}: {
  label: string;
  swatch: string;
  icon: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-md py-0.5 transition-colors hover:bg-surface-raised">
      <Checkbox checked={checked} onCheckedChange={onChange} aria-label={label} />
      {/* 지도 표식과 같은 문법 — 색 바탕 + 흰 글리프 */}
      <span
        className="flex size-4 shrink-0 items-center justify-center rounded"
        style={{ backgroundColor: swatch }}
      >
        <Icon icon={icon} className="size-2.5 text-white" aria-hidden />
      </span>
      <span className="min-w-0 flex-1 truncate text-caption text-foreground-muted">{label}</span>
    </label>
  );
}
