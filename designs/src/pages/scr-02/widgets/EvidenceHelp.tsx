/* ─────────────────────────────────────────────
 * 근거 도움말 — 근거 목록 머리의 ⓘ 팝오버 (2026-09-14 사용자 지시)
 *
 * 근거 한 줄에 무엇이 있고, 연결·미연결이 무엇이며, 점 라벨과 버튼이 어떻게 다른지 그 자리에서 읽는다. 정본의
 * 규칙(01 §8.3 · 04 §3)을 담당자 말로 옮긴 것이라 여기 문장이 곧 화면 문구다. 별도 문서를 열게 하지 않는다.
 * ───────────────────────────────────────────── */

import { Icon } from "@iconify/react";
import { Button, Popover, PopoverContent, PopoverTrigger, StatusDotLabel } from "@ds";

export function EvidenceHelp() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="size-6 shrink-0 text-foreground-subtle hover:text-foreground" aria-label="근거 도움말">
          <Icon icon="mdi:help-circle-outline" className="size-4" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent side="right" align="start" sideOffset={10} className="w-[320px] p-0 text-caption">
        <div className="border-b border-border px-3 py-2 text-body font-semibold text-foreground">근거란</div>
        <div className="flex flex-col gap-3 px-3 py-2.5 text-foreground-muted">
          <p>이 사건과 관련해 들어온 것들입니다. 센서 값, 특보, 영상 분석, 시설 상태, 침수 예측이 시간 순으로 섭니다.</p>
          <section className="flex flex-col gap-1">
            <h4 className="font-semibold text-foreground">한 줄 읽기</h4>
            <p>첫 줄은 <span className="text-foreground">무슨 일이 언제</span>, 둘째 줄은 <span className="text-foreground">어디서</span>입니다. 줄을 누르면 왜 이 사건과 묶였는지 한 줄이 더 열리고, 지도와 그래프가 그 장비로 옮겨 갑니다. 영상이면 크게 열립니다.</p>
          </section>
          <section className="flex flex-col gap-1.5">
            <h4 className="font-semibold text-foreground">표시</h4>
            <ul className="flex flex-col gap-1.5">
              <li className="flex items-start gap-2"><span className="flex w-[96px] shrink-0 items-center gap-1.5 whitespace-nowrap pt-0.5"><StatusDotLabel status="pending" label="지연" /><StatusDotLabel status="danger" label="결측" /></span><span>데이터가 늦거나 끊겼습니다. 참고만 하세요</span></li>
              <li className="flex items-start gap-2"><span className="w-[96px] shrink-0 whitespace-nowrap pt-0.5 text-foreground">위험도에 쓰인 n건만</span><span>머리의 이 토글을 누르면 위험도 계산에 들어간 근거만 남습니다</span></li>
              <li className="flex items-start gap-2"><span className="flex w-[96px] shrink-0 items-center whitespace-nowrap"><Button size="sm" variant="outline" className="pointer-events-none h-6 px-2 text-foreground"><Icon icon="mdi:cube-scan" className="size-3.5" aria-hidden />전망 보기</Button></span><span>침수 예측입니다. 같은 지도가 그 시각의 예측으로 바뀝니다</span></li>
            </ul>
          </section>
          <section className="flex flex-col gap-1">
            <h4 className="font-semibold text-foreground">지구의 다른 이벤트</h4>
            <p>같은 지구에 있지만 이 사건과는 관계없는 관측입니다. 접어 두고 필요할 때 펼치세요.</p>
          </section>
        </div>
      </PopoverContent>
    </Popover>
  );
}
