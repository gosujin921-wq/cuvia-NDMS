/* ─────────────────────────────────────────────
 * 대응 절차(SOP) 통합 리스트 — 03 화면정의서 §2 대응 실행 집중 팝업 · 04 §11 · §13
 *
 * 체크리스트와 실행 결과는 한 리스트다. [승인·실행]을 누르면 승인 항목이 위에서
 * 아래로 하나씩 스피너 → 결과로 진화하고(0.45초 간격), 조건 대기 자동 항목(상급
 * 보고)이 그 뒤에 이어 실행된다. 실행 전 목록을 결과 목록으로 통째로 갈아끼우면
 * 하나씩 넘어가는 연출을 화면 교체가 지운다. (IDC SopChecklist 문법)
 *
 * 실행 결과는 실패를 성공처럼 칠하지 않는다. 경남 보고(자동 처리 · 등급 확정 후
 * 실행)가 연계 끊김으로 실패하고, [유선 보고 기록]이 대체 조치를 같은 행에 잇는다.
 *
 * 전파 문안은 전파 항목 행의 [문안] 토글로 펼치는 접이식이다(03 §2). 문자·방송·
 * 전광판이 같은 문안을 쓰므로 편집기는 하나다. 열람·수정은 실행 전까지고, 실행 뒤의
 * 문안은 [수정 문안 재전파]가 든다.
 *
 * 승인에서 뺀 항목은 실행 후에도 목록에 남아 미승인으로 적는다 — 실행하지 않은
 * 항목이 목록에서 사라지면 기록이 아니라 편집이다.
 * ───────────────────────────────────────────── */

import { useEffect, useRef, useState } from "react";
import { Icon } from "@iconify/react";
import {
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  FilterCapsule,
  StatusDotLabel,
  Tag,
  Textarea,
  cn,
  toast,
} from "@ds";
import { sopItemsFor, sopResultsFor, type SopItem, type SopResult } from "../../../demo/sop";
import { CHANNELS, defaultChannelsFor, type ChannelId } from "../../../demo/dispatch";
import { HERO_EVENT_ID } from "../../../demo/events";
import { levelSpec, type AlertLevel } from "../../../demo/levels";
import { formatClock } from "../../../lib/datetime";
import { useScenario } from "../../../state/ScenarioProvider";

/** 항목이 하나씩 완료로 넘어가는 간격 — 일이 진행되는 속도로 보이는 값 (03 §3) */
const STEP_MS = 450;

/** 전파 항목 — [문안] 토글이 서는 행 (04 §11-2 의 4·5번) */
const MESSAGE_ITEM_IDS = ["sms", "broadcast"];

interface SopPanelProps {
  /** SOP 가 따르는 등급 — 승인 대응등급, 승인 전에는 권고 (04 §10-1) */
  level: AlertLevel;
  /** 담당자가 등급을 승인했는가 — 승인 전에는 제안 상태로 잠긴다 */
  approved: boolean;
  /** 실행 완료 시 전파 기록에 한 줄을 쌓는다 (04 §7-3·§7-5). 실행한 승인 항목 id 를 넘긴다 */
  onExecuted: (itemIds: string[]) => void;
  /** 전파 문안 — 페이지가 든다(04 §7-2·§7-5). SOP 최초 전파와 재전파가 같은 문안을 잇는다 */
  message: string;
  onMessageChange: (message: string) => void;
  /** 실행 결과 하단 [수정 문안 재전파] (03 §2 · 차수 L) */
  onResend: (channels: ChannelId[], message: string) => void;
  /** 실행 연출 진행 여부 — 집중 팝업이 닫기 잠금·자동 스크롤에 쓴다(03 §2 수용 기준) */
  onBusyChange?: (busy: boolean) => void;
}

export function SopPanel({
  level,
  approved,
  onExecuted,
  message,
  onMessageChange,
  onResend,
  onBusyChange,
}: SopPanelProps) {
  const {
    track,
    sopExecuted,
    sopExecutedItemIds,
    approvedAt,
    completeSopExecution,
    phoneReportedAt,
    logPhoneReport,
  } = useScenario();
  /* 절차는 재난유형이 고른다 (04 §11-2 · §15-10). 트랙 B 의 주인공은 내수침수라
     배수펌프장 확인이 더해진 8항목이 서고, 통제 대상도 저지대 도로다 */
  const hazardType = track === "bongam" ? ("내수침수" as const) : undefined;
  const items = sopItemsFor(level, hazardType);
  const results = sopResultsFor(hazardType);
  const approvalItems = items.filter((item) => item.mode === "approval");

  const [checked, setChecked] = useState<string[]>([]);
  const [running, setRunning] = useState<string[]>([]);
  /* 로컬 연출이 끝난 행 — 엔진 반영(sopExecuted) 전에도 결과 줄이 그 자리에 선다 */
  const [settled, setSettled] = useState<string[]>([]);
  const [executing, setExecuting] = useState(false);
  const [messageOpenId, setMessageOpenId] = useState<string | null>(null);
  const timers = useRef<number[]>([]);

  useEffect(
    () => () => {
      timers.current.forEach((id) => window.clearTimeout(id));
      timers.current = [];
    },
    [],
  );

  /** [승인·실행] — 승인 항목이 위에서 아래로 스피너 → 결과로 진화하고, 조건 대기
   *  자동 항목이 그 뒤에 이어 실행된다. 자동 항목이 스스로 나가는 장면이 있어야
   *  "자동 처리도 결과 확인이 필요하다"(04 §11-1)가 화면에 선다 */
  const run = () => {
    const ids = approvalItems.filter((i) => checked.includes(i.id)).map((i) => i.id);
    if (ids.length === 0) {
      toast.error("승인할 항목을 하나 이상 고르세요.");
      return;
    }
    setExecuting(true);
    onBusyChange?.(true);
    setMessageOpenId(null);
    const queue = [
      ...ids,
      ...items.filter((i) => i.mode === "auto" && i.afterApproval).map((i) => i.id),
    ];
    queue.forEach((id, index) => {
      timers.current.push(
        window.setTimeout(() => setRunning((prev) => [...prev, id]), index * STEP_MS),
      );
      timers.current.push(
        window.setTimeout(() => {
          setRunning((prev) => prev.filter((r) => r !== id));
          setSettled((prev) => [...prev, id]);
        }, (index + 1) * STEP_MS),
      );
    });
    timers.current.push(
      window.setTimeout(() => {
        completeSopExecution(ids);
        onExecuted(ids);
        onBusyChange?.(false);
        toast.success("SOP 실행 완료 — 실행 결과를 확인하세요. 자동 항목도 결과 확인이 필요합니다.");
      }, queue.length * STEP_MS + 200),
    );
  };

  const spec = levelSpec(level);

  /* 실행 완료 → 결과 하단(안내문·재전파)으로 이동. 팝업 본문이 스크롤 컨테이너다(03 §2) */
  const doneRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (sopExecuted) doneRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [sopExecuted]);

  return (
    <section className="flex flex-col gap-1.5 p-3" aria-label="대응 절차">
      <header className="flex items-baseline gap-2">
        <h2 className="text-body font-semibold text-foreground">대응 절차</h2>
        {/* 절차 이름은 재난유형이 정한다 — 내수침수 사건에 `SOP-해일` 이 서면 안 된다 */}
        <Tag className="shrink-0">
          SOP-{hazardType ?? "해일"}-{spec.label}
        </Tag>
        {!approved && (
          <span className="ml-auto shrink-0 text-caption text-foreground-subtle">제안 상태</span>
        )}
      </header>

      <ul className="flex flex-col">
        {items.map((item) => {
          const auto = item.mode === "auto";
          const result = results.find((r) => r.itemId === item.id) ?? null;
          const executedByEngine =
            sopExecuted && (auto || (sopExecutedItemIds?.includes(item.id) ?? false));
          const resolved = settled.includes(item.id) || executedByEngine;
          const unapproved =
            sopExecuted && !auto && !(sopExecutedItemIds?.includes(item.id) ?? false);
          return (
            <SopRow
              key={item.id}
              item={item}
              checked={checked.includes(item.id)}
              running={running.includes(item.id)}
              resolved={resolved}
              unapproved={unapproved}
              result={result}
              resultAt={
                result && approvedAt
                  ? new Date(approvedAt.getTime() + result.offsetMin * 60_000)
                  : null
              }
              disabled={!approved || executing || sopExecuted}
              onToggle={() =>
                setChecked((prev) =>
                  prev.includes(item.id)
                    ? prev.filter((id) => id !== item.id)
                    : [...prev, item.id],
                )
              }
              messageOpen={messageOpenId === item.id}
              onToggleMessage={
                MESSAGE_ITEM_IDS.includes(item.id) && !resolved && !sopExecuted && !executing
                  ? () => setMessageOpenId((prev) => (prev === item.id ? null : item.id))
                  : undefined
              }
              message={message}
              onMessageChange={onMessageChange}
              phoneReportedAt={phoneReportedAt}
              onPhoneReport={() => {
                logPhoneReport();
                toast.success("유선 보고를 기록했습니다 — 대체 조치가 같은 사건 이력에 남습니다.");
              }}
            />
          );
        })}
      </ul>

      {sopExecuted ? (
        <>
          <p ref={doneRef} className="text-caption text-foreground-subtle">
            자동 처리는 승인이 필요 없다는 뜻이지 확인이 필요 없다는 뜻이 아닙니다 — 실패는
            실패로 표시되고 대체 조치까지 같은 기록에 남습니다
          </p>

          {/* [수정 문안 재전파] — 리스트 하단(03 §3 · 차수 L). 재전파는 실행이 끝난
              사건에만 성립하므로 버튼도 결과가 있는 자리에 선다 */}
          <ResendControls
            level={level}
            message={message}
            onMessageChange={onMessageChange}
            onResend={onResend}
          />
        </>
      ) : (
        <>
          {/* 승인 전: 되돌릴 수 없는 조치는 승인 없이 나가지 않는다(04 §11-1).
              승인 후: [전체 선택] → [승인·실행] 한 번으로 세 갈래가 동시에 나간다(05 S6).
              "전체 승인·실행" 한 버튼으로 합치지 않는다 — 선택과 실행이 한 번에 되는 것처럼
              읽히면 사람 승인을 강조하는 문법이 죽는다 */}
          <div className="flex gap-1.5">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              disabled={!approved || executing}
              onClick={() => setChecked(approvalItems.map((i) => i.id))}
            >
              전체 선택
            </Button>
            <Button size="sm" className="flex-1" disabled={!approved || executing} onClick={run}>
              <Icon icon="mdi:send" className="size-4" aria-hidden />
              승인 · 실행
            </Button>
          </div>
          {!approved && (
            <p className="text-caption text-foreground-subtle">
              위 판정 카드에서 대응등급을 승인하면 실행 버튼이 열립니다
            </p>
          )}
        </>
      )}
    </section>
  );
}

/* ── 항목 행 — 체크리스트가 그 자리에서 결과로 진화한다 (03 §3) ────────── */

interface SopRowProps {
  item: SopItem;
  checked: boolean;
  running: boolean;
  /** 실행이 끝나 결과가 판명된 행 — 로컬 연출(settled) 또는 엔진 상태에서 온다 */
  resolved: boolean;
  /** 실행은 끝났는데 승인에서 빠져 실행되지 않은 행 — 목록에 남아 미승인으로 적는다 */
  unapproved: boolean;
  result: SopResult | null;
  resultAt: Date | null;
  disabled: boolean;
  onToggle: () => void;
  messageOpen: boolean;
  /** 전파 항목의 [문안] 토글 — 실행 전에만 선다 */
  onToggleMessage?: () => void;
  message: string;
  onMessageChange: (message: string) => void;
  phoneReportedAt: Date | null;
  onPhoneReport: () => void;
}

function SopRow({
  item,
  checked,
  running,
  resolved,
  unapproved,
  result,
  resultAt,
  disabled,
  onToggle,
  messageOpen,
  onToggleMessage,
  message,
  onMessageChange,
  phoneReportedAt,
  onPhoneReport,
}: SopRowProps) {
  const auto = item.mode === "auto";
  const rowRef = useRef<HTMLLIElement>(null);
  /* 실행 중 항목이 보이도록 자동 스크롤(03 §2 수용 기준) */
  useEffect(() => {
    if (running) rowRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [running]);
  /* 내부 자동 3종은 표출 시점에 이미 실행돼 있다(04 §11-3). 조건 대기 자동 항목은
     결과가 판명되기 전에는 ✓ 로 칠하지 않는다 — 실패할 항목을 성공처럼 미리 보이면
     S7 의 회수가 죽는다(05 S7) */
  const doneFromStart = auto && !item.afterApproval;
  const failed = resolved && result?.ok === false;
  const showResult = resolved && result !== null && resultAt !== null;

  return (
    <li
      ref={rowRef}
      className={cn(
        "flex flex-col border-b border-border py-1 last:border-b-0",
        running && "bg-surface-raised",
      )}
    >
      <div className="flex items-center gap-2">
        {/* 상태 자리 — ✓ 실행 완료 · ⋯ 조건 대기 · 스피너 실행 중 · ☐ 승인 (04 §11-3 표기) */}
        {running ? (
          <Icon
            icon="mdi:loading"
            className="size-4 shrink-0 animate-spin text-warning"
            aria-hidden
          />
        ) : !auto && !resolved ? (
          <Checkbox
            checked={checked}
            disabled={disabled}
            onCheckedChange={onToggle}
            aria-label={`${item.label} 승인`}
            className="shrink-0"
          />
        ) : failed ? (
          <Icon icon="mdi:close-circle" className="size-4 shrink-0 text-danger" aria-hidden />
        ) : doneFromStart || resolved ? (
          <Icon icon="mdi:check-circle" className="size-4 shrink-0 text-success" aria-hidden />
        ) : (
          <Icon
            icon="mdi:dots-horizontal-circle-outline"
            className="size-4 shrink-0 text-foreground-subtle"
            aria-hidden
          />
        )}

        <span className="flex min-w-0 flex-1 flex-col">
          <span
            className={cn(
              "truncate text-caption",
              failed
                ? "font-medium text-danger"
                : unapproved
                  ? "text-foreground-subtle"
                  : "text-foreground",
            )}
          >
            {item.label}
            {/* 대상은 라벨과 한 줄 — 집중 팝업은 가로가 남고 세로가 모자라다(03 §2 수용 기준) */}
            {item.target !== "—" && !showResult && (
              <span className="font-normal text-foreground-subtle"> · {item.target}</span>
            )}
          </span>
          {auto && item.afterApproval && !resolved && !running && (
            <span className="truncate text-caption text-foreground-subtle">
              조건 대기 · 등급 확정 후 자동 실행
            </span>
          )}
          {unapproved && (
            <span className="truncate text-caption text-foreground-subtle">
              미승인 · 실행되지 않음
            </span>
          )}
        </span>

        {onToggleMessage && (
          <button
            type="button"
            onClick={onToggleMessage}
            aria-expanded={messageOpen}
            className="flex shrink-0 cursor-pointer items-center gap-0.5 rounded border-none bg-transparent px-1 py-0.5 text-caption text-foreground-subtle transition-colors hover:bg-surface-raised hover:text-foreground"
          >
            문안
            <Icon
              icon="mdi:chevron-down"
              className={cn("size-3.5 transition-transform", messageOpen && "rotate-180")}
              aria-hidden
            />
          </button>
        )}

        <Tag tone={auto ? "neutral" : "warning"} className="shrink-0">
          {auto ? "자동 처리" : "승인 후 실행"}
        </Tag>
      </div>

      {/* 결과 줄 — 무엇이 어떻게 됐는지가 같은 행에 이어 붙는다 (03 §3 실행 결과) */}
      {showResult && result && resultAt && (
        <div className="flex items-baseline gap-2 pl-6 pt-0.5">
          <span
            className={cn(
              "min-w-0 flex-1 text-caption",
              result.ok ? "text-foreground-muted" : "text-danger",
            )}
          >
            {result.outcome}
          </span>
          <span className="shrink-0 font-mono text-caption text-foreground-subtle">
            {formatClock(resultAt)}
          </span>
        </div>
      )}

      {/* 실패 항목의 대체 조치 — [유선 보고 기록]이 같은 행에 이어 붙는다(04 §13-1) */}
      {failed &&
        (phoneReportedAt ? (
          <div className="ml-6 mt-1 flex items-center gap-1.5 rounded border border-border px-2 py-1">
            <StatusDotLabel status="success" label="유선 보고" />
            <span className="min-w-0 flex-1 truncate text-caption text-foreground-muted">
              경상남도 재난안전상황실 당직 · 기록자 상황실 담당
            </span>
            <span className="shrink-0 font-mono text-caption text-foreground-subtle">
              {formatClock(phoneReportedAt)}
            </span>
          </div>
        ) : (
          <Button variant="outline" size="sm" className="ml-6 mt-1 w-fit" onClick={onPhoneReport}>
            <Icon icon="mdi:phone" className="size-3.5" aria-hidden />
            유선 보고 기록
          </Button>
        ))}

      {/* 전파 문안 — 전파 항목에 딸린 접이식 미리보기(03 §3). 문자·방송·전광판 공통이라
          편집기는 하나고, 어느 행에서 펼쳐도 같은 문안이다 */}
      {messageOpen && (
        <div className="ml-6 mt-1.5 flex flex-col gap-1 rounded border border-border p-2">
          <span className="text-caption text-foreground-subtle">
            전파 문안 · 문자·방송·전광판 공통, 전파 항목 실행 시 이대로 나간다
          </span>
          <Textarea
            value={message}
            onChange={(e) => onMessageChange(e.target.value)}
            rows={3}
            aria-label="전파 문안"
            className="text-caption"
          />
        </div>
      )}
    </li>
  );
}

/* ── 수정 문안 재전파 (03 §3 · 04 §7-5) ─────────────────────────
 * 수단을 다시 고르고, 직전 전파와 겹치면 중복 확인창을 거친다 — 겹치는 수단 ·
 * 직전 전파 시각 · 대상 인원을 명시하고 담당자가 확인해야 나간다. 이미 보낸 것을
 * 모르고 또 보내는 사고를 막는 자리다.
 * ─────────────────────────────────────────────────────────── */

function ResendControls({
  level,
  message,
  onMessageChange,
  onResend,
}: {
  level: AlertLevel;
  message: string;
  onMessageChange: (message: string) => void;
  onResend: (channels: ChannelId[], message: string) => void;
}) {
  const { dispatches } = useScenario();
  const [channels, setChannels] = useState<ChannelId[]>(() => defaultChannelsFor(level));
  const [confirmOpen, setConfirmOpen] = useState(false);

  const lastDispatch = dispatches.find((r) => r.eventId === HERO_EVENT_ID) ?? null;
  const overlap = lastDispatch
    ? CHANNELS.filter((c) => channels.includes(c.id) && lastDispatch.channels.includes(c.id))
    : [];

  const send = () => {
    onResend(channels, message);
    const names = CHANNELS.filter((c) => channels.includes(c.id))
      .map((c) => c.label)
      .join(", ");
    toast.success(`수정 문안을 ${names}로 재전파했습니다.`);
  };

  const handleResend = () => {
    if (channels.length === 0) {
      toast.error("전파 수단을 하나 이상 고르세요.");
      return;
    }
    if (overlap.length > 0) {
      setConfirmOpen(true);
      return;
    }
    send();
  };

  return (
    <div className="flex flex-col gap-2 border-t border-border pt-2">
      <Textarea
        value={message}
        onChange={(e) => onMessageChange(e.target.value)}
        rows={3}
        aria-label="재전파 문안"
        className="text-caption"
      />
      <div className="flex flex-wrap gap-1">
        {CHANNELS.map((channel) => {
          const on = channels.includes(channel.id);
          return (
            <FilterCapsule
              key={channel.id}
              selected={on}
              aria-pressed={on}
              onClick={() =>
                setChannels((prev) =>
                  prev.includes(channel.id)
                    ? prev.filter((c) => c !== channel.id)
                    : [...prev, channel.id],
                )
              }
            >
              <Icon icon={channel.icon} className="size-3.5 shrink-0" aria-hidden />
              {channel.label}
            </FilterCapsule>
          );
        })}
      </div>
      <Button onClick={handleResend} className="w-full" size="sm">
        <Icon icon="mdi:send" className="size-4" aria-hidden />
        수정 문안 재전파
      </Button>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>이미 전파한 수단이 있습니다</DialogTitle>
            {lastDispatch && (
              <DialogDescription>
                {overlap.map((c) => c.label).join(" · ")} 은(는){" "}
                {formatClock(lastDispatch.sentAt)} 에 {lastDispatch.recipients.toLocaleString()}
                명에게 이미 나갔습니다. 수정 문안으로 다시 보낼까요?
              </DialogDescription>
            )}
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              취소
            </Button>
            <Button
              onClick={() => {
                setConfirmOpen(false);
                send();
              }}
            >
              재전파
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
