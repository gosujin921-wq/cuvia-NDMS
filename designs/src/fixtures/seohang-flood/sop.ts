/* ─────────────────────────────────────────────
 * SOP 카탈로그 — 대표 사건의 대응 절차 항목 (초안 사건작업공간_화면상세 §3 SOP 항목 표)
 *
 * 무엇이 SOP 에 서는지와 우선순위·실행방식·단계만 든다. 상태·시각·담당·결과는 이벤트 원장(workflow.ts)이
 * 정본이고 selectors 가 바인딩한다:
 *   auto           내부 조치는 사건 후보 생성 시각에, 대외 통보는 승인 시각에 완료로 선다(README §8.1 승인 경계).
 *                  수신자는 배정된 조치의 담당 조직
 *   action         권고 proposedActions 와 배정 Action 에 종류·대상으로 묶인다
 *   dissemination  DISSEMINATION_REQUESTED · RESULT_RECORDED 를 읽는다
 * ⚠ 항목 문안은 데모 예시이며 운영 SOP 확정값이 아니다.
 * ───────────────────────────────────────────── */

import type { ChainStage, SopExecMode, SopPriority } from "../../model/sop";
import type { ActionKind } from "../../model/response";
import type { RiskGrade } from "../../model/risk-matrix";

export type SopBinding =
  | { kind: "auto"; completeOn: "candidate" | "approval"; detail: string; recipientsFrom?: "actions" }
  | { kind: "action"; actionKind: ActionKind; target: string; facility?: string }
  | { kind: "dissemination" };

export interface SopCatalogItem {
  id: string;
  label: string;
  priority: SopPriority;
  execMode: SopExecMode;
  chain?: ChainStage;
  /** 수동 조치의 담당 조직 — 권고 생성 전에도 항목을 세우기 위한 카탈로그 값. 권고·배정이 오면 그 값이 우선 */
  organization?: string;
  /** 이 항목이 서는 최소 위험등급 — 세기를 사람이 고르지 않는다. 주의는 내부 자동만, 경계부터 통제·전파·현장 (2026-09-14) */
  minGrade?: RiskGrade;
  binding: SopBinding;
}

export const SOP_CATALOG: SopCatalogItem[] = [
  { id: "SOP-01", label: "사건 CCTV 집중 배치", priority: "MUST", execMode: "자동", binding: { kind: "auto", completeOn: "candidate", detail: "사건 카메라 2채널 현장영상 고정" } },
  { id: "SOP-02", label: "담당기관 통보", priority: "MUST", execMode: "자동", chain: "AGENCY", minGrade: "경계", binding: { kind: "auto", completeOn: "approval", detail: "조치 담당 부서에 권고·승인 통보", recipientsFrom: "actions" } },
  { id: "SOP-03", label: "주민 전파 · CAP 문안", priority: "MUST", execMode: "자동", chain: "PUBLIC", minGrade: "경계", binding: { kind: "dissemination" } },
  { id: "SOP-04", label: "해안도로 저지대 구간 통제", priority: "MUST", execMode: "수동", chain: "FIELD", minGrade: "경계", organization: "교통과", binding: { kind: "action", actionKind: "도로 통제", target: "해안도로 저지대 구간" } },
  { id: "SOP-05", label: "제2배수펌프장 2호기 점검·재가동 요청", priority: "MUST", execMode: "수동", chain: "FIELD", minGrade: "경계", organization: "하수과", binding: { kind: "action", actionKind: "시설 점검", target: "제2배수펌프장 2호기", facility: "PS-SH-02" } },
  { id: "SOP-06", label: "신포 지하차도 진입부 현장 확인", priority: "SHOULD", execMode: "수동", chain: "FIELD", minGrade: "경계", organization: "안전총괄과", binding: { kind: "action", actionKind: "현장 확인", target: "신포 지하차도" } },
  { id: "SOP-07", label: "관련 CCTV 구성", priority: "SHOULD", execMode: "자동", binding: { kind: "auto", completeOn: "candidate", detail: "배수관리용 폴 CCTV 를 관련 채널로" } },
  { id: "SOP-08", label: "사건 영상·예측판 보존", priority: "MAY", execMode: "자동", binding: { kind: "auto", completeOn: "candidate", detail: "장면 분석 컷과 침수예측판 스냅샷 보존" } },
  /* 심각에만 서는 항목 — 대응 중 등급이 오르면 목록에 추가되고 다시 승인받는다 (2026-09-14) */
  { id: "SOP-09", label: "신포 지하차도 진입 통제", priority: "MUST", execMode: "수동", chain: "FIELD", organization: "안전총괄과", minGrade: "심각", binding: { kind: "action", actionKind: "도로 통제", target: "신포 지하차도" } },
  { id: "SOP-10", label: "저지대 건물 대피 권고", priority: "MUST", execMode: "수동", chain: "PUBLIC", organization: "재난안전 상황실", minGrade: "심각", binding: { kind: "action", actionKind: "대피 안내", target: "저지대 건물 12동" } },
];
