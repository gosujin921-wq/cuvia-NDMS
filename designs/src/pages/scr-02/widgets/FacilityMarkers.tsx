/* ─────────────────────────────────────────────
 * 방재시설 마커 — 배수문 · 배수펌프장
 *
 * 장비 마커(DeviceMarkers)와 같은 자리 잡기 문법이다: MapLibre Marker 에 자리를 맡기고
 * React 는 내용만 그린다. 다른 점은 셋이다 —
 *   · 묶지 않는다. 지구당 한둘이라 겹칠 일이 없다
 *   · 이벤트 핀으로 갈아타지 않는다. 폐쇄·가동은 센서 이벤트가 아니다(demo/drainage.ts)
 *   · 장치 핀·클러스터 위에 선다(z 1). 시설은 지구당 한둘인데 그 아래 장비가 수십이라,
 *     겹치면 언제나 시설이 가려진다. 클러스터는 줌마다 다시 붙어(DOM 순서가 바뀐다)
 *     쌓임 순서를 그리는 차례에 맡길 수 없다
 *
 * 수동 개폐 확인 창은 **이 묶음이 든다.** 피커는 마우스가 떠나면 닫히므로 그 안에서 열면
 * 확인 창이 같이 사라진다. KISA 도어 핀도 같은 구조다 — 핀은 요청만 올리고(onRequestDoorToggle)
 * 화면이 확인 창을 연다.
 * ───────────────────────────────────────────── */

import { useEffect, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import maplibregl from "maplibre-gl";
import { Icon } from "@iconify/react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  toast,
} from "@ds";
import { devicesOf, type Device } from "../../../demo/devices";
import { facilityStateAt, type Facility } from "../../../demo/facilities";
import { FacilityPin } from "../../../components/MapPins";
import { formatClock } from "../../../lib/datetime";
import { useScenario } from "../../../state/ScenarioProvider";

interface FacilityMarkersProps {
  map: RefObject<maplibregl.Map | null>;
  ready: boolean;
  facilities: Facility[];
  /** 피커의 [현장 영상] — 같은 자리 CCTV 를 지도 팝업으로 연다 */
  onOpenCctv: (device: Device) => void;
}

export function FacilityMarkers({
  map,
  ready,
  facilities,
  onOpenCctv,
}: FacilityMarkersProps) {
  const { now, gateOverrides, setGateClosed } = useScenario();
  /* 확인 대기 중인 배수문 — null 이면 창이 닫혀 있다 */
  const [confirm, setConfirm] = useState<Facility | null>(null);

  if (!ready) return null;

  const confirmState = confirm ? facilityStateAt(confirm, now, gateOverrides[confirm.id]) : null;
  const confirmClosed = confirmState?.engaged ?? false;

  return (
    <>
      {facilities.map((facility) => (
        <FacilityMarkerItem
          key={facility.id}
          map={map}
          facility={facility}
          onOpenCctv={onOpenCctv}
          onRequestGateToggle={() => setConfirm(facility)}
        />
      ))}

      {/* 개폐 확인 — KISA 도어 차단 확인 창과 같은 문구·문법 */}
      <Dialog open={!!confirm} onOpenChange={(open) => !open && setConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <Icon
                icon={confirmClosed ? "mdi:lock-open-variant" : "mdi:lock"}
                className="size-5 text-warning"
                aria-hidden
              />
              <DialogTitle>
                {confirmClosed ? "배수문을 개방할까요?" : "배수문을 폐쇄할까요?"}
              </DialogTitle>
            </div>
            {confirm && (
              <DialogDescription>
                {confirmClosed
                  ? `${confirm.name}을 개방합니다. 외수위가 내수위보다 높으면 하천 물이 배수구역으로 역류합니다.`
                  : `${confirm.name}을 폐쇄합니다. 자연배수가 멈추고 배수펌프만 남습니다.`}
              </DialogDescription>
            )}
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(null)}>
              취소
            </Button>
            <Button
              onClick={() => {
                if (!confirm) return;
                setGateClosed(confirm.id, !confirmClosed, now);
                setConfirm(null);
                toast.success(
                  `${confirm.name} ${confirmClosed ? "개방" : "폐쇄"} — ${formatClock(now)} 상황실 수동 조작`,
                );
              }}
            >
              {confirmClosed ? "개방" : "폐쇄"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function FacilityMarkerItem({
  map,
  facility,
  onOpenCctv,
  onRequestGateToggle,
}: {
  map: RefObject<maplibregl.Map | null>;
  facility: Facility;
  onOpenCctv: (device: Device) => void;
  onRequestGateToggle: () => void;
}) {
  const { now, gateOverrides } = useScenario();
  const [host] = useState(() => {
    const el = document.createElement("div");
    el.style.pointerEvents = "none";
    /* 장치 핀·클러스터(기본 0) 위, 이벤트 핀(2) 아래 */
    el.style.zIndex = "1";
    return el;
  });
  /* 같은 설치 지점의 첫 CCTV — 시설 좌표가 이 카메라 자리에서 나왔으므로 항상 옆에 있다 */
  const cctv = devicesOf(facility.districtId).find(
    (d) => d.kind === "CV" && d.spot === facility.deviceSpot,
  );

  useEffect(() => {
    const instance = map.current;
    if (!instance) return;
    const marker = new maplibregl.Marker({ element: host, anchor: "center" })
      .setLngLat(facility.center)
      .addTo(instance);
    return () => {
      marker.remove();
    };
  }, [map, host, facility]);

  return createPortal(
    <FacilityPin
      facility={facility}
      state={facilityStateAt(facility, now, gateOverrides[facility.id])}
      cctv={cctv ? { name: cctv.name, onOpen: () => onOpenCctv(cctv) } : undefined}
      onRequestGateToggle={facility.kind === "gate" ? onRequestGateToggle : undefined}
      /* 지도 클릭으로 전파되면 장비 팝업이 열려 있을 때 같이 닫힌다 */
      onClick={(e) => e.stopPropagation()}
    />,
    host,
  );
}
