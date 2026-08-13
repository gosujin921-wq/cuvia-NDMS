/* ─────────────────────────────────────────────
 * 상단 상태 스트립 (03 화면정의서 §1 상단 중앙 · 04 §4-7)
 *
 * 담당자가 지도를 읽기 전에 만나는 한 줄. 지금 무엇이 걸려 있나(발효 특보), 도시가 어느
 * 수준으로 대응 중인가(대응단계), 지금이 언제인가(시나리오 시계), 오늘 처리할 것이 몇인가
 * (요약 3종).
 *
 * 형태는 IDC SCR-01 상단 KPI 스트립(KpiTiles) 선례를 그대로 쓴다. 맵 위 오버레이라
 * 타일을 따로 띄우지 않고 알약형 글래스 캡슐 하나에 담아 구분선으로 나눈다. 항목은
 * 아이콘 + 라벨 + 모노 숫자, 임계(1 이상)면 값과 아이콘이 톤 색으로 전환된다.
 *
 * 도시 대응단계 축은 이 자리에만 선다(03 §0-8). 요약 3종은 전부 파생값이고 표시만
 * 한다. 진행 중 사건은 좌측 목록·주요 재난 카드가, 연계 상세는 우하단 패널이 잇는다.
 * ───────────────────────────────────────────── */

import { Icon } from "@iconify/react";
import { GlassPanel, cn } from "@ds";
import { activeEventsAt, majorDisasterAt } from "../../../demo/events";
import { needsConfirmCountAt } from "../../../demo/sop";
import { interopLinksAt } from "../../../demo/interop";
import { backdropAdvisories, relatedAdvisories } from "../../../demo/weather";
import { formatClock, formatDate } from "../../../lib/datetime";
import { useScenario } from "../../../state/ScenarioProvider";

export function StatusStrip() {
  const { now, track, cityStage, approvedResponseLevel, onsetting } = useScenario();
  const activeCount = activeEventsAt(now).length;
  const confirmCount = needsConfirmCountAt(now, approvedResponseLevel);
  const brokenCount = interopLinksAt(now, track).filter((link) => link.status === "끊김").length;
  /* S6 승인에서 초기대응(보강)으로 오른다. 시나리오 상태값이지 판정 로직이 아니다(04 §0-1) */
  const stageRaised = cityStage !== "상시대비";
  /* 맨 앞 특보 배지 — 지금 주요 재난에 걸린 특보다(04 §4-7). 주요 재난 카드와 같은
     파생값을 쓰므로 두 곳이 갈라지지 않는다. 걸린 특보가 없으면 배지를 접는다.

     다만 특보는 사건에서 파생되기만 하면 두 자리에서 사라진다. 트랙의 배경 특보로
     받치는 자리가 그 둘이다:

       · 발생 연출 첫 칸 — 사건이 아직 0건이다. 특보는 사건보다 먼저 걸린 하늘이라
         발사 직후부터 서 있어야 한다(04 §0-3 · §15-1). 없으면 1.6초 깜빡인다
       · 대표 재난이 특보 없는 유형일 때 — 봉암은 08:27 부터 대표가 내수침수인데
         내수침수라는 특보는 없다. 그 물을 만든 호우경보는 그대로 발효 중이다

     사건이 다 해제된 뒤(S8 22:10)에는 둘 다 아니므로 배지가 접힌다 */
  const major = majorDisasterAt(now);
  const related = major ? relatedAdvisories(major.hazardType, track) : [];
  const advisories =
    related.length > 0 ? related : major || onsetting ? backdropAdvisories(track) : [];

  return (
    <GlassPanel
      borderStyle="none"
      className="flex items-center gap-4 rounded-full px-5 py-2"
      aria-label="발효 특보와 도시 대응단계, 오늘 처리 현황 요약"
    >
      {advisories.length > 0 && (
        <>
          <div className="flex shrink-0 items-center gap-1.5">
            {advisories.map((advisory) => (
              <span
                key={advisory.label}
                className={cn(
                  "rounded-full border px-2 py-0.5 text-caption font-medium",
                  advisory.level === "warning"
                    ? "border-risk-lv4 text-risk-lv4"
                    : "border-risk-lv3 text-risk-lv3",
                )}
              >
                기상특보 · {advisory.label}
              </span>
            ))}
          </div>
          <Divider />
        </>
      )}

      <Stat
        icon="mdi:shield-outline"
        label="대응단계"
        value={cityStage}
        valueClass={stageRaised ? "text-risk-lv4" : "text-foreground"}
        mono={false}
      />
      <Divider />

      {/* 시나리오 시계의 "지금". 상대 시간·집계 전부가 이 시각 기준이다 (03 §0-7) */}
      <div className="flex shrink-0 items-center gap-2">
        <Icon
          icon="mdi:clock-outline"
          className="size-4 shrink-0 text-foreground-subtle"
          aria-hidden
        />
        <span className="font-mono text-body font-semibold tabular-nums text-foreground">
          {formatDate(now)} {formatClock(now)}
        </span>
      </div>
      <Divider />

      <Stat
        icon="mdi:bell-ring-outline"
        label="진행 중"
        value={String(activeCount)}
        valueClass={activeCount > 0 ? "text-foreground" : "text-foreground-subtle"}
      />
      <Stat
        icon="mdi:eye-alert-outline"
        label="확인 필요"
        value={String(confirmCount)}
        valueClass={confirmCount > 0 ? "text-warning" : "text-foreground-subtle"}
        iconToned={confirmCount > 0}
      />
      <Stat
        icon="mdi:lan-disconnect"
        label="연계 장애"
        value={String(brokenCount)}
        valueClass={brokenCount > 0 ? "text-danger" : "text-foreground-subtle"}
        iconToned={brokenCount > 0}
      />
    </GlassPanel>
  );
}

function Divider() {
  return <span className="h-6 w-px shrink-0 bg-border" aria-hidden />;
}

function Stat({
  icon,
  label,
  value,
  valueClass,
  /** 임계 상태에서 아이콘도 값 색을 따라간다 (IDC KpiTiles 톤 규칙) */
  iconToned = false,
  mono = true,
}: {
  icon: string;
  label: string;
  value: string;
  valueClass: string;
  iconToned?: boolean;
  mono?: boolean;
}) {
  return (
    <div className="flex shrink-0 items-center gap-2">
      <Icon
        icon={icon}
        className={cn("size-4 shrink-0", iconToned ? valueClass : "text-foreground-subtle")}
        aria-hidden
      />
      <span className="text-caption text-foreground-muted">{label}</span>
      <span
        className={cn(
          "text-body font-semibold",
          mono && "font-mono tabular-nums",
          valueClass,
        )}
      >
        {value}
      </span>
    </div>
  );
}
