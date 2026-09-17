/* ─────────────────────────────────────────────
 * 시뮬레이션 보고서 창 — /scr-00 에서 본 장면을 문서 한 장으로 (2026-09-17)
 *
 * 사건 보고서와 **같은 창**(ReportModal)을 쓴다. 다른 것은 바닥의 [이력에 저장] 하나다 —
 * 저장하면 이력의 보고서 목록에 "시뮬레이션" 구분으로 선다(사용자 "보고서를 사건 · 시뮬레이션으로 나누면").
 * 저장 뒤에는 그 자리가 [이력에서 보기]로 바뀐다.
 * ───────────────────────────────────────────── */

import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "@iconify/react";
import { FormDialog } from "../../../components/FormDialog";
import { ReportModal } from "../../../components/ReportModal";
import { simDocOf, type SimReportInput } from "../../../lib/sim-report";
import { useScenario } from "../../../state/ScenarioProvider";

export function SimReportDialog({ input, onClose }: { input: SimReportInput; onClose: () => void }) {
  const navigate = useNavigate();
  const { saveSimReport } = useScenario();
  const [savedId, setSavedId] = useState<string | null>(null);
  /* 저장 전 번호는 임시 — 저장하면 엔진이 준 번호로 문서가 다시 선다 */
  const doc = useMemo(() => simDocOf(input, savedId ?? "저장 전"), [input, savedId]);
  return (
    <ReportModal
      open
      onOpenChange={(next) => { if (!next) onClose(); }}
      doc={doc}
      kindLabel="모의훈련 보고서"
      extraAction={
        savedId ? (
          <FormDialog.CancelButton onClick={() => navigate(`/scr-07?tab=report&sim=${savedId}`)}>
            <Icon icon="mdi:history" className="size-4 shrink-0" aria-hidden />
            이력에서 보기
          </FormDialog.CancelButton>
        ) : (
          <FormDialog.CancelButton onClick={() => setSavedId(saveSimReport(input).reportId)}>
            <Icon icon="mdi:content-save-outline" className="size-4 shrink-0" aria-hidden />
            이력에 저장
          </FormDialog.CancelButton>
        )
      }
    />
  );
}
