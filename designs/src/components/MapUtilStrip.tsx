/* ─────────────────────────────────────────────
 * 지도 조작 스트립 — 레이어 · 3D · 확대 · 축소 · 좌/우회전 · 원래대로
 *
 * 지도를 쓰는 화면(SCR-01·02·03)이 전부 같은 자리에 같은 버튼을 세운다. 화면마다
 * 다른 것은 레이어 목록과 "원래대로"가 돌아갈 자리뿐이라 그 둘만 바깥에서 받는다.
 *
 * DS MapControlBar(흰 map-chrome 타일 + 좌측 툴팁)를 그대로 쓴다 — 지도 위 컨트롤은
 * 제품군 공통 크롬이라 앱 다크 테마와 무관하게 밝다.
 *
 * 3D 는 버튼 하나를 active 로 토글한다(DS 정본 패턴). 2D·3D 를 두 버튼으로 나누지 않는다.
 * 뷰 상태는 MapLibre 인스턴스가 들고 있으므로 여기서는 지도 API 를 호출만 하고, 드래그로
 * 직접 기울인 경우까지 pitchend 로 맞춘다.
 *
 * ▸ 제품 정본: cuvia_platform_web kits/gis-kit/src/components/map-controls.tsx
 *   (@cuvia/gis-kit MapControls) — 정본은 useMap() 컨텍스트에서 지도를 꺼내고, 이 앱은
 *   지도 ref 를 prop 으로 받는다. 그 한 가지만 다르고 버튼 구성·그룹 케이던스는 같다.
 *   gis-kit 을 물게 되면 map ref → useMap() 으로 바꾸고 정본을 쓴다.
 *   (레이어 팝오버는 정본에 없는 이 앱 추가분 — 이관 시 slot prop 으로 올려야 한다)
 * ───────────────────────────────────────────── */

import { Fragment, useEffect, useState, type RefObject } from "react";
import type maplibregl from "maplibre-gl";
import { Icon } from "@iconify/react";
import {
  Checkbox,
  MapControlBar,
  MapControlButton,
  MapControlDivider,
  Popover,
  PopoverContent,
  PopoverTrigger,
  cn,
} from "@ds";
import { ROTATE_STEP, TILT_PITCH } from "../lib/map-config";

/** 이 각도를 넘으면 3D 로 본다 */
const TILT_THRESHOLD = 5;

/** 켜고 끄는 지도 표식 묶음 한 줄 */
export interface MapLayerItem {
  id: string;
  label: string;
  /** 지도 표식 색 — 주면 범례 겸 체크 항목이 된다 */
  color?: string;
  /** 표식 글리프 — color 와 같이 준다 */
  icon?: string;
  /** 이 레이어에 걸린 대상 수 */
  count?: number;
  visible: boolean;
}

export interface MapLayerSpec {
  /** 팝오버 제목 — "위험지구" · "장비" */
  title: string;
  items: MapLayerItem[];
  onToggle: (id: string) => void;
  onSetAll: (visible: boolean) => void;
  /** 끄지 못하는 표식 안내 — 이벤트 핀처럼 항상 뜨는 것 */
  note?: string;
}

interface MapUtilStripProps {
  map: RefObject<maplibregl.Map | null>;
  /** 지도 준비 전에는 전체 비활성 */
  disabled?: boolean;
  /**
   * "원래대로" — 화면이 처음 잡아 둔 자리로 되돌린다.
   *
   * 화면마다 맞춤 방식이 다르다(시 전체는 fitBounds, 지구 화면은 easeTo). 기울기·회전까지
   * 함께 되돌려야 하므로 호출부에서 pitch·bearing 을 0 으로 넘긴다.
   */
  onReset: () => void;
  /**
   * 그 화면이 처음 서 있는 기울기. 되돌린 뒤 3D 버튼이 눌린 상태인지가 여기서 갈린다.
   *
   * 지도 화면은 평면(0)에서 시작하지만 트윈은 기울인 시점이 기본이다.
   */
  homePitch?: number;
  /** 레이어 팝오버 — 켜고 끌 표식이 있는 화면만 준다 */
  layers?: MapLayerSpec;
  className?: string;
}

export function MapUtilStrip({
  map,
  disabled = false,
  onReset,
  homePitch = 0,
  layers,
  className,
}: MapUtilStripProps) {
  const [is3d, setIs3d] = useState(homePitch > TILT_THRESHOLD);

  /* 드래그로 기울인 경우까지 반영 */
  useEffect(() => {
    const instance = map.current;
    if (!instance) return;
    const sync = () => setIs3d(instance.getPitch() > TILT_THRESHOLD);
    instance.on("pitchend", sync);
    return () => {
      instance.off("pitchend", sync);
    };
  }, [map, disabled]);

  const toggle3d = () => {
    const next = !is3d;
    setIs3d(next);
    map.current?.easeTo({ pitch: next ? TILT_PITCH : 0, duration: 400 });
  };

  const rotate = (deg: number) => {
    const instance = map.current;
    if (!instance) return;
    instance.easeTo({ bearing: instance.getBearing() + deg });
  };

  const groups = [
    [
      {
        id: "3d",
        icon: "mdi:cube-outline",
        label: is3d ? "3D 끄기" : "3D 켜기",
        active: is3d,
        onClick: toggle3d,
      },
    ],
    [
      { id: "zoom-in", icon: "mdi:plus", label: "확대", onClick: () => map.current?.zoomIn() },
      { id: "zoom-out", icon: "mdi:minus", label: "축소", onClick: () => map.current?.zoomOut() },
    ],
    [
      {
        id: "rotate-left",
        icon: "mdi:rotate-left",
        label: "좌회전",
        onClick: () => rotate(-ROTATE_STEP),
      },
      {
        id: "rotate-right",
        icon: "mdi:rotate-right",
        label: "우회전",
        onClick: () => rotate(ROTATE_STEP),
      },
    ],
    [
      {
        id: "reset",
        icon: "mdi:fit-to-screen",
        label: "원래대로",
        onClick: () => {
          setIs3d(homePitch > TILT_THRESHOLD);
          onReset();
        },
      },
    ],
  ];

  return (
    <MapControlBar className={className}>
      {layers && (
        <>
          <MapLayerControl spec={layers} disabled={disabled} />
          <MapControlDivider />
        </>
      )}
      {groups.map((group, index) => (
        <Fragment key={group[0].id}>
          {index > 0 && <MapControlDivider />}
          {group.map((btn) => (
            <MapControlButton
              key={btn.id}
              icon={btn.icon}
              label={btn.label}
              active={"active" in btn ? btn.active : false}
              disabled={disabled}
              onClick={btn.onClick}
            />
          ))}
        </Fragment>
      ))}
    </MapControlBar>
  );
}

/* ─────────────────────────────────────────────
 * 레이어 팝오버 — 지도 표식을 종류별로 켜고 끈다.
 *
 * 색·글리프를 같이 세워 범례 노릇을 겸한다. 지도 위에서 "이 색이 뭐냐"와 "이건 잠깐 끄자"는
 * 같은 줄에서 나는 판단이라 한 자리에 둔다.
 * ───────────────────────────────────────────── */

function MapLayerControl({ spec, disabled }: { spec: MapLayerSpec; disabled: boolean }) {
  const shownCount = spec.items.filter((item) => item.visible).length;
  const allShown = shownCount === spec.items.length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        {/* 하나라도 꺼져 있으면 눌린 상태로 — 팝오버를 닫아도 필터가 걸려 있음이 남는다 */}
        <MapControlButton
          icon="mdi:layers-outline"
          label="레이어"
          active={!allShown}
          disabled={disabled}
        />
      </PopoverTrigger>
      <PopoverContent side="left" align="start" sideOffset={10} className="w-60 p-0">
        <section className="flex flex-col gap-1 p-3">
          <div className="flex items-center gap-2 pb-0.5">
            <span className="min-w-0 flex-1 text-caption font-semibold text-foreground-muted">
              {spec.title}
            </span>
            <button
              type="button"
              onClick={() => spec.onSetAll(!allShown)}
              className="shrink-0 cursor-pointer rounded border-none bg-transparent p-0 text-caption text-primary-text hover:underline"
            >
              {allShown ? "모두 끄기" : "모두 켜기"}
            </button>
          </div>

          {spec.items.map((item) => (
            <label
              key={item.id}
              className="flex cursor-pointer items-center gap-2 rounded-md py-1 pl-0.5 pr-1 transition-colors hover:bg-surface-raised"
            >
              <Checkbox checked={item.visible} onCheckedChange={() => spec.onToggle(item.id)} />
              {item.color && (
                /* 지도 표식과 같은 문법 — 색 바탕 + 흰 글리프. 한눈에 같은 것으로 읽힌다 */
                <span
                  aria-hidden
                  className="flex size-5 shrink-0 items-center justify-center rounded"
                  style={{ backgroundColor: item.color }}
                >
                  {item.icon && <Icon icon={item.icon} className="size-3 text-white" />}
                </span>
              )}
              <span
                className={cn(
                  "min-w-0 flex-1 truncate text-caption",
                  item.visible ? "text-foreground" : "text-foreground-subtle",
                )}
              >
                {item.label}
              </span>
              {item.count !== undefined && (
                <span className="shrink-0 font-mono text-caption text-foreground-subtle">
                  {item.count}
                </span>
              )}
            </label>
          ))}

          {spec.note && (
            <p className="border-t border-border pt-2 text-caption text-foreground-subtle">
              {spec.note}
            </p>
          )}
        </section>
      </PopoverContent>
    </Popover>
  );
}
