/* ─────────────────────────────────────────────
 * 장치 핀 클러스터 — 03 화면정의서 §0-5 "겹치면 묶는다"
 *
 * 화면에서 장치 핀끼리 겹칠 만큼 가까우면(중심 간 약 38px) DS MapClusterMarker 알약으로
 * 묶어 대수를 보인다. 호버 피커가 묶인 장비를 나열하고, 클릭하면 그 자리를 확대해 낱개
 * 핀으로 펼친다. 이벤트 핀과 선택(팝업 열린) 장비는 묶지 않는다 — 제외는 호출부가 정한다.
 *
 * 묶음은 줌에만 매인다. 픽셀 거리는 월드 좌표 × 배율이라 팬(이동)으로는 변하지 않으므로
 * zoomend 에서만 다시 계산한다. move 마다 계산하면 드래그 내내 마커가 떨렸다 붙는다.
 * ───────────────────────────────────────────── */

import { useEffect, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import maplibregl from "maplibre-gl";
import { MapClusterMarker } from "@ds";
import { deviceKindSpec, type Device } from "../demo/devices";

/** 묶음 문턱(px) — 장치 핀 30px 에 숨 쉴 틈을 더한 값. 이보다 가까우면 겹쳐 읽힌다 */
const CLUSTER_RADIUS_PX = 38;
/** 피커에 나열하는 장비 수 — 넘치면 "외 N대" (03 §0-5) */
const PICKER_ITEM_MAX = 5;
/** 클러스터 클릭 확대 폭·상한 — 두 번이면 대부분 낱개로 풀리는 값 */
const EXPAND_ZOOM_STEP = 1.5;
const EXPAND_ZOOM_MAX = 17;

export interface DeviceCluster {
  key: string;
  center: [number, number];
  devices: Device[];
}

/** 현재 줌 — zoomend 에서만 갱신한다 (묶음 재계산 트리거) */
export function useMapZoom(map: RefObject<maplibregl.Map | null>, ready: boolean): number | null {
  const [zoom, setZoom] = useState<number | null>(null);

  useEffect(() => {
    if (!ready) return;
    const instance = map.current;
    if (!instance) return;
    setZoom(instance.getZoom());
    const onZoom = () => setZoom(instance.getZoom());
    instance.on("zoomend", onZoom);
    return () => {
      instance.off("zoomend", onZoom);
    };
  }, [map, ready]);

  return zoom;
}

/** 경위도 → 월드 픽셀 (MapLibre 512px 타일 기준). 팬과 무관, 줌에만 매인다 */
function worldPx([lng, lat]: [number, number], zoom: number): [number, number] {
  const scale = 512 * Math.pow(2, zoom);
  const siny = Math.sin((lat * Math.PI) / 180);
  const x = ((lng + 180) / 360) * scale;
  const y = (0.5 - Math.log((1 + siny) / (1 - siny)) / (4 * Math.PI)) * scale;
  return [x, y];
}

/**
 * 장비를 낱개와 묶음으로 가른다. exclude 에 든 장비(이벤트 핀·선택 장비)는 항상 낱개다.
 * 그리디 — 먼저 온 장비가 씨앗이 되고, 문턱 안의 뒷 장비가 합류한다. 좌표가 고정
 * 시드 생성이라 결과도 항상 같다.
 */
export function clusterDevices(
  devices: Device[],
  zoom: number,
  exclude: ReadonlySet<string>,
): { singles: Device[]; clusters: DeviceCluster[] } {
  const singles: Device[] = [];
  const groups: { seed: [number, number]; devices: Device[] }[] = [];

  for (const device of devices) {
    if (exclude.has(device.id)) {
      singles.push(device);
      continue;
    }
    const px = worldPx(device.center, zoom);
    const group = groups.find(
      (g) => Math.hypot(g.seed[0] - px[0], g.seed[1] - px[1]) < CLUSTER_RADIUS_PX,
    );
    if (group) group.devices.push(device);
    else groups.push({ seed: px, devices: [device] });
  }

  const clusters: DeviceCluster[] = [];
  for (const group of groups) {
    if (group.devices.length === 1) {
      singles.push(group.devices[0]);
      continue;
    }
    const lng = group.devices.reduce((sum, d) => sum + d.center[0], 0) / group.devices.length;
    const lat = group.devices.reduce((sum, d) => sum + d.center[1], 0) / group.devices.length;
    clusters.push({
      key: group.devices.map((d) => d.id).join("+"),
      center: [lng, lat],
      devices: group.devices,
    });
  }

  return { singles, clusters };
}

interface ClusterMarkersProps {
  map: RefObject<maplibregl.Map | null>;
  clusters: DeviceCluster[];
}

export function ClusterMarkers({ map, clusters }: ClusterMarkersProps) {
  return (
    <>
      {clusters.map((cluster) => (
        <ClusterMarkerItem key={cluster.key} map={map} cluster={cluster} />
      ))}
    </>
  );
}

function ClusterMarkerItem({
  map,
  cluster,
}: {
  map: RefObject<maplibregl.Map | null>;
  cluster: DeviceCluster;
}) {
  const [host] = useState(() => {
    const el = document.createElement("div");
    el.style.pointerEvents = "none";
    return el;
  });

  useEffect(() => {
    const instance = map.current;
    if (!instance) return;
    const marker = new maplibregl.Marker({ element: host, anchor: "center" })
      .setLngLat(cluster.center)
      .addTo(instance);
    return () => {
      marker.remove();
    };
  }, [map, host, cluster]);

  /* 대표 아이콘은 가장 많은 종류 — 대개 CCTV. 섞인 묶음의 속은 피커가 말한다 */
  const tally = new Map<string, number>();
  for (const device of cluster.devices)
    tally.set(device.kind, (tally.get(device.kind) ?? 0) + 1);
  const dominant = [...tally.entries()].sort((a, b) => b[1] - a[1])[0][0];
  const spec = deviceKindSpec(dominant as Device["kind"]);

  const shown = cluster.devices.slice(0, PICKER_ITEM_MAX);
  const rest = cluster.devices.length - shown.length;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const instance = map.current;
    if (!instance) return;
    instance.easeTo({
      center: cluster.center,
      zoom: Math.min(instance.getZoom() + EXPAND_ZOOM_STEP, EXPAND_ZOOM_MAX),
      duration: 500,
    });
  };

  return createPortal(
    <MapClusterMarker
      className="pointer-events-auto"
      count={cluster.devices.length}
      icon={spec.icon}
      picker={{
        title: `장비 ${cluster.devices.length}대`,
        items: shown.map((device) => ({
          icon: deviceKindSpec(device.kind).icon,
          label: device.name,
          trailing: device.status !== "정상" ? device.status : undefined,
        })),
        itemsOverflow: rest > 0 ? `외 ${rest}대` : undefined,
        hint: "클릭하면 확대해 펼칩니다.",
      }}
      onClick={handleClick}
      aria-label={`장비 ${cluster.devices.length}대 묶음 · 클릭하면 확대`}
    />,
    host,
  );
}
