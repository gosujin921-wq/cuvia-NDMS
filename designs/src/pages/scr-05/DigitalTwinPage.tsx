/* ─────────────────────────────────────────────
 * SCR-05 모의훈련 — 지난 사건으로 돌려 보고 개선 항목을 남긴다 (README §2.3 · §6.1 · 03 §25 · §26 · IA-07 · 2026-09-16)
 *
 *   지난 사건     끝난 사건 목록(유형·기간·검색) → 고르면 그 사건의 시나리오 화면
 *   저장된 분석   사건별 분석 결과 아카이브 → 행을 누르면 정보 창 → 다시 열기 · 보고서(창)
 *
 * 진행 중 사건은 여기 서지 않는다. "지금 대응하면?"은 사건 작업공간의 전망 탭이 맡고, 진행 중 사건으로 들어온 링크는 그리로 넘긴다.
 * 점수 · 회차 · 훈련 실행(정지·예약) · 시나리오 편집기는 없다(비전 · 03 §26.11).
 *
 * ▸ 탭 줄 구조 정본은 METIS 시스템 모니터링(SCR-044)이다 — widgets/TwinSubNav 머리말 참고.
 * ▸ 상태는 query 가 든다. 신규 라우트를 만들지 않는다(CLAUDE.md · IA §5.2).
 *     /scr-05                               사건 목록
 *     /scr-05?incident=INC-…                그 사건의 트윈 (&validAt · alt · situation · response · preset · basis · view)
 *     /scr-05?tab=saved                     저장된 분석 목록
 *     /scr-05?tab=saved&analysis=A-…        목록 위에 그 분석의 정보 창
 *     /scr-05/:districtId                   Phase 1 링크 호환 — 그 지구의 사건 트윈으로 넘긴다. 없으면 사건 목록
 * ───────────────────────────────────────────── */

import { useMemo } from "react";
import { Navigate, useParams, useSearchParams } from "react-router-dom";
import { useScenario } from "../../state/ScenarioProvider";
import { findWhatIfCase, pastWhatIfCasesAt, whatIfCaseOfDistrict, whatIfStatusOf } from "../../model/selectors";
import { TrainingView } from "./TrainingView";
import { TrainingBoard } from "./TrainingBoard";
import { TrainingRunBoard } from "./TrainingRunBoard";
import { TwinSubNav, type TwinTab } from "./widgets/TwinSubNav";
import { useFabSlot } from "../../layout/fab-slot";

export function DigitalTwinPage() {
  const [params, setParams] = useSearchParams();
  const { analyses, demoNow: now } = useScenario();
  /* 모의훈련은 끝난 사건만 연다(README §2.3 · 03 §26.1). 진행 중 사건은 재난관제 전망 탭이 맡는다 */
  const cases = useMemo(() => pastWhatIfCasesAt(now), [now]);
  const tab: TwinTab = params.get("tab") === "saved" ? "saved" : "incidents";
  const incidentId = tab === "incidents" ? params.get("incident") : null;
  /* 질의 버튼 — 훈련 중에는 하단 중앙에 시계가 서므로 그 위로, 준비 화면은 레일 왼쪽,
     목록은 레일이 없으므로 화면 우하단. `run` 은 훈련이 시작됐다는 표식이다(TrainingView) */
  const running = Boolean(incidentId) && params.get("run") === "1";
  useFabSlot(!incidentId ? "screen" : running ? "clock" : "rail");
  /* Phase 1 지구 링크 — query 로 옮겨 싣고 경로는 /scr-05 하나로 둔다. 지구 경로에 머물면 목록으로 돌아갈 수 없다 */
  const { districtId } = useParams();

  const goTab = (next: TwinTab) => setParams(new URLSearchParams(next === "saved" ? { tab: "saved" } : {}));
  const openIncident = (id: string) => setParams(new URLSearchParams({ incident: id }));
  /* 진행 중 사건으로 들어온 링크는 대응 판단이 있는 자리로 넘긴다 — 같은 사건의 전망 탭이다(IA §5.2) */
  const liveCase = incidentId ? findWhatIfCase(incidentId) : undefined;
  if (liveCase && whatIfStatusOf(liveCase, now) === "진행 중") {
    const district = liveCase.legacyDistrictId ?? "seohang";
    return <Navigate replace to={`/scr-02/${district}?panel=twin`} />;
  }

  if (districtId) {
    const legacy = whatIfCaseOfDistrict(districtId);
    if (!legacy) return <Navigate replace to="/scr-05" />;
    /* 그 지구의 사건이 아직 진행 중이면 전망 탭, 끝났으면 모의훈련 시나리오 */
    return whatIfStatusOf(legacy, now) === "진행 중"
      ? <Navigate replace to={`/scr-02/${legacy.legacyDistrictId ?? districtId}?panel=twin`} />
      : <Navigate replace to={`/scr-05?incident=${encodeURIComponent(legacy.incidentId)}`} />;
  }

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <TwinSubNav tab={tab} onChange={goTab} counts={{ incidents: cases.length, saved: analyses.length }} />

      <div className="relative min-h-0 flex-1">
        {tab === "incidents" ? (
          incidentId ? (
            <TrainingView incidentId={incidentId} onBackToList={() => goTab("incidents")} />
          ) : (
            <TrainingBoard onPick={openIncident} />
          )
        ) : (
          <TrainingRunBoard onNew={() => goTab("incidents")} />
        )}
      </div>

    </div>
  );
}
