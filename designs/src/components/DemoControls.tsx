/* ─────────────────────────────────────────────
 * 데모 컨트롤 · 발표자 전용 조작판 (숫자 0 키) · 정본: 04 §0-2 · IDC DemoControls 문법
 *
 * 사건 시나리오 목록 하나다. 구현된 2편(서항 8/12 · 봉암 8/13)이 서고, 진행 중이
 * 아닌 편을 누르면 그 트랙을 발사한 뒤 스스로 닫힌다. 누르는 동작은 구석에 있고
 * 화면에는 결과만 나타나므로 시연이 끊기지 않는다.
 *
 * 시나리오 진행(격상 · 권고 · 승인 · 실행 · 시계 점프 · 에필로그)은 조작판이 아니라
 * 화면 조작이 맡는다 — 지구 클릭 · 팝업 열기 · 트윈 진입 · 승인 · 화면 이동이 엔진의
 * advanceTo 를 밟는다. 조작판에 같은 이벤트를 한 벌 더 두면 두 길이 갈라진다.
 *
 * 입력 중(input·textarea·contenteditable)에는 단축키가 먹지 않는다. 자연어 질의에
 * "0" 을 타이핑하다 조작판이 열리면 안 된다.
 * ───────────────────────────────────────────── */

import { useEffect, useState } from "react";
import { Icon } from "@iconify/react";
import { GlassPanel, cn } from "@ds";
import { useScenario } from "../state/ScenarioProvider";

const TOGGLE_KEY = "0";

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.isContentEditable
  );
}

export function DemoControls() {
  const { track, launchTrack } = useScenario();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== TOGGLE_KEY) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;
      e.preventDefault();
      setOpen((prev) => !prev);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  /* 시나리오 행 — IDC 조작판의 사건 발생 자리. 진행 중인 편도 누를 수 있다: 같은 트랙
     재발사가 곧 되감기라 리허설 복구 수단이 된다.

     서항 발사 행은 내려 뒀다. 앱이 서항 트랙 상태로 열리므로 서항으로 돌아가는 길은
     새로고침이다. 되살리려면 배열에 한 줄을 더한다:
       { key: "seohang" as const, label: "서항 해일 수위 상승", date: "8/12" } */
  const tracks = [{ key: "bongam" as const, label: "봉암 호우·내수침수", date: "8/13" }];

  return (
    <>
      {open && (
        <GlassPanel
          borderStyle="none"
          className="fixed bottom-4 right-4 z-50 flex max-h-[calc(100vh-2rem)] w-72 flex-col gap-3 overflow-y-auto p-3"
          role="dialog"
          aria-label="데모 컨트롤"
        >
          <div className="flex items-center gap-2">
            <Icon icon="mdi:tune-variant" className="size-4 shrink-0 text-foreground-muted" aria-hidden />
            <span className="min-w-0 flex-1 truncate text-body font-semibold text-foreground">
              데모 컨트롤
            </span>
            <kbd className="shrink-0 rounded border border-border px-1.5 py-0.5 font-mono text-caption text-foreground-muted">
              0
            </kbd>
          </div>

          <div className="flex flex-col gap-1.5 border-t border-border pt-3">
            <span className="text-caption text-foreground-muted">사건 시나리오</span>
            <ul className="flex flex-col gap-1">
              {tracks.map((row) => (
                <li key={row.key}>
                  <button
                    type="button"
                    onClick={() => {
                      launchTrack(row.key);
                      /* 조작판은 스스로 물러난다. 발사가 일어나는 화면을 조작판이
                         덮으면 무엇이 일어나는지 보이지 않는다 */
                      setOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md border border-border bg-card px-2 py-1.5 text-left transition-colors",
                      track === row.key
                        ? "cursor-pointer text-foreground hover:border-foreground-subtle"
                        : "cursor-pointer text-foreground-muted hover:border-foreground-subtle hover:text-foreground",
                    )}
                  >
                    <Icon
                      icon={
                        track === row.key ? "mdi:motion-play-outline" : "mdi:play-circle-outline"
                      }
                      className="size-4 shrink-0"
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1 truncate text-caption font-medium">
                      {row.label}
                      <span className="font-normal text-foreground-subtle"> · {row.date}</span>
                    </span>
                    <span className="shrink-0 font-mono text-caption text-foreground-subtle">
                      {track === row.key ? "진행 중" : "발사"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </GlassPanel>
      )}
    </>
  );
}
