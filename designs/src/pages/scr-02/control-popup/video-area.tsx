/* ─────────────────────────────────────────────
 * 관제 팝업 영상 영역(본문 좌측) — KISA 관제 팝업 이식분
 *
 * 원본: cuvia_platform_web `kits/event-kit/src/control-popup/video-area.tsx`
 *
 * 골격·간격·조작 문법을 원본 그대로 옮겼다: 메인 영상 한 장 위에 라벨 칩, 그 아래
 * 관련 이벤트 카드 줄(가로 스크롤 + 헤더 우측 ‹ › ), 카드 호버 시 커서 추적 툴팁.
 *
 * DSMS 로 오면서 갈린 것은 **영상의 출처**뿐이다. 원본은 탐지 클립(mp4)과 실시간
 * 스트림을 틀지만 이 데모에는 스트림이 없다 — `CctvStill` 실촬 스틸이 그 자리를 받고
 * 라벨은 LIVE 다(04 §2-5). 원본의 모드 전환 칩(탐지 영상 / 실시간)이 있던 자리는
 * 그 지구의 CCTV 를 고르는 칩이 받는다.
 *
 * ※ 이 영역은 아직 검토 전이다 — 대상 이미지 스트립(원본 SubjectShotStrip)은 DSMS 에
 *   대응 데이터가 없어 옮기지 않았고, 관련 이벤트 카드는 읽기 전용이다(원본은 눌러
 *   중첩 팝업을 연다). 두 자리 모두 정할 때 열면 된다.
 * ───────────────────────────────────────────── */

import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Icon } from "@iconify/react";
import { EmptyState, cn } from "@ds";
import { CctvStill } from "../../../components/CctvStill";
import { LevelBadge } from "../../../components/LevelBadge";
import { cctvSceneOf, featuredCctvOf, type Device } from "../../../demo/devices";
import type { RelatedEventCandidate } from "./types";

interface VideoAreaProps {
  /** 이 지구의 주요 CCTV (04 §2-5) — 첫 대가 먼저 서고 나머지는 칩으로 고른다 */
  cameras: Device[];
  /** 같은 시각 진행 중인 다른 사건 */
  candidates: RelatedEventCandidate[];
  /** 카드 클릭 — 미주입이면 읽기 전용 카드다 */
  onOpenRelated?: (candidate: RelatedEventCandidate) => void;
}

/** 영상 영역 — 우측 탭 데이터 변경 시 리렌더 방지를 위해 memo (원본 그대로) */
export const VideoArea = memo(function VideoArea({
  cameras,
  candidates,
  onOpenRelated,
}: VideoAreaProps) {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
      <MainVideo cameras={cameras} />

      <RelatedStrip
        icon="mdi:alert-circle-multiple-outline"
        text="같은 시각 진행 사건"
        candidates={candidates}
        clickable={!!onOpenRelated}
        onOpen={onOpenRelated}
        empty={
          <EmptyState
            variant="inline"
            icon="mdi:check-circle-outline"
            message="같은 시각 진행 중인 다른 사건이 없습니다."
          />
        }
      />
    </div>
  );
});

/* ── 메인 영상 — 지구 CCTV 연출 그래픽. 카메라가 둘 이상이면 헤더 우측 칩으로 고른다 ── */
function MainVideo({ cameras }: { cameras: Device[] }) {
  const [index, setIndex] = useState(0);
  const camera = cameras[index] ?? cameras[0];
  const scene = camera ? cctvSceneOf(camera) : undefined;
  const offline = !!camera && camera.status !== "정상";

  return (
    <section className="shrink-0">
      <div className="mb-2 flex items-center gap-2">
        <SectionLabel icon="mdi:video" text={camera?.name ?? "현장영상"} inline />
        {cameras.length > 1 && (
          <div className="ml-auto flex shrink-0 items-center gap-1">
            {cameras.map((cam, i) => (
              <ModeChip
                key={cam.id}
                active={i === index}
                label={cam.name}
                onClick={() => setIndex(i)}
              />
            ))}
          </div>
        )}
      </div>

      <div
        className="relative aspect-video overflow-hidden rounded-lg border border-border"
        style={{
          background:
            "linear-gradient(to bottom, #4a5361 0%, #2f353e 55%, #1c2027 100%)",
        }}
      >
        {offline ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5">
            <Icon
              icon="mdi:video-off-outline"
              className="size-10 text-foreground-subtle"
              aria-hidden
            />
            <span className="text-caption text-foreground-subtle">{camera.status}</span>
          </div>
        ) : camera ? (
          <CctvStill device={camera} className="absolute inset-0" />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5">
            <Icon
              icon="mdi:video-off-outline"
              className="size-10 text-foreground-subtle"
              aria-hidden
            />
            <span className="text-caption text-foreground-subtle">등재된 CCTV 없음</span>
          </div>
        )}

        <div
          className="pointer-events-none absolute inset-x-0 top-0 z-[5] h-1/4"
          style={{
            background:
              "linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.15) 55%, rgba(0,0,0,0) 100%)",
          }}
          aria-hidden
        />

        {camera && (
          <div className="pointer-events-none absolute left-3 top-3 z-10 flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-caption backdrop-blur-sm">
            {!offline && (
              <span
                className="size-1.5 shrink-0 animate-pulse rounded-full bg-danger"
                aria-hidden
              />
            )}
            <span className="font-medium text-white/90">{offline ? camera.status : "LIVE"}</span>
            {scene && (
              <>
                <span className="text-white/40">·</span>
                <span className="text-white/70">
                  {scene.scene} · {scene.bearing}
                </span>
              </>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

/* ── 헤더 우측 칩 — 원본의 영상 모드 전환(탐지 영상 / 실시간)이 있던 자리 ── */
function ModeChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "cursor-pointer rounded-full border-none px-2.5 py-1 text-caption font-medium transition-colors",
        active
          ? "bg-primary text-on-primary"
          : "bg-surface-raised text-foreground-muted hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}

/* ── 공용 CCTV 썸네일 프레임 — 원본의 탐지 클립 자리. 그 지구의 주요 CCTV 스틸을 튼다 ── */
function ThumbFrame({ districtId }: { districtId: string }) {
  const camera = featuredCctvOf(districtId)[0];
  if (!camera) {
    return (
      <div className="relative flex aspect-video items-center justify-center bg-black">
        <Icon icon="mdi:cctv" className="size-7 text-white opacity-10" aria-hidden />
      </div>
    );
  }
  return (
    <div className="relative">
      <CctvStill device={camera} className="aspect-video" />
      <span className="absolute left-1 top-1 flex items-center gap-1 rounded bg-black/60 px-1 py-px text-caption text-white/90">
        <span className="size-1 animate-pulse rounded-full bg-danger" aria-hidden />
        LIVE
      </span>
    </div>
  );
}

/* ── 커서 추적 툴팁 — 마우스 좌표에 전체 정보 표시(원본 그대로) ── */
function useCursorTip() {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const track = (e: MouseEvent) => setPos({ x: e.clientX, y: e.clientY });
  return {
    pos,
    handlers: {
      onMouseEnter: track,
      onMouseMove: track,
      onMouseLeave: () => setPos(null),
    },
  };
}

function CursorTip({
  pos,
  children,
}: {
  pos: { x: number; y: number } | null;
  children: ReactNode;
}) {
  if (!pos) return null;
  return createPortal(
    <div
      className="pointer-events-none fixed z-[60] w-max whitespace-nowrap rounded-md border border-border bg-surface-raised px-3 py-2 text-caption text-white shadow-lg"
      style={{ left: pos.x + 14, top: pos.y + 14 }}
    >
      {children}
    </div>,
    document.body,
  );
}

function TipRow({ label, value }: { label: string; value: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="text-white/55">{label}</span>
      <span>{value}</span>
    </span>
  );
}

/* ── 관련 이벤트 카드 — 썸네일 + 재난유형·단계·지구·시각·탐지 장비 ── */
function RelatedCard({
  candidate,
  clickable,
  onOpen,
}: {
  candidate: RelatedEventCandidate;
  clickable: boolean;
  onOpen?: () => void;
}) {
  const { pos, handlers } = useCursorTip();
  return (
    <div
      {...handlers}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={clickable ? onOpen : undefined}
      onKeyDown={(e) => {
        if (clickable && onOpen && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onOpen();
        }
      }}
      className={cn(
        "w-44 shrink-0 overflow-hidden rounded-lg border border-border bg-surface",
        clickable && "cursor-pointer transition-colors hover:border-foreground-subtle",
      )}
    >
      <ThumbFrame districtId={candidate.districtId} />
      <div className="flex flex-col gap-1 p-2.5">
        <div className="flex items-center gap-1.5">
          <span className="min-w-0 flex-1 truncate text-body font-medium text-foreground">
            {candidate.hazardLabel}
          </span>
          <LevelBadge level={candidate.level} />
        </div>
        <div className="flex items-center gap-1 text-caption text-foreground-muted">
          <Icon
            icon="mdi:map-marker"
            className="size-3.5 shrink-0 text-foreground-subtle"
            aria-hidden
          />
          <span className="min-w-0 truncate">{candidate.location}</span>
          <span className="shrink-0">·</span>
          <span className="shrink-0 font-mono">{candidate.relativeTime}</span>
        </div>
        <div className="flex items-center gap-1 text-caption">
          <span className="min-w-0 flex-1 truncate text-foreground-muted">
            {candidate.device}
          </span>
          <span className="shrink-0 font-mono text-foreground">{candidate.valueText}</span>
        </div>
      </div>
      <CursorTip pos={pos}>
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-1.5">
            <span className="font-medium">{candidate.hazardLabel}</span>
            <span className="font-mono text-white/70">{candidate.valueText}</span>
          </div>
          <TipRow label="지구" value={candidate.location} />
          <TipRow label="시각" value={candidate.relativeTime} />
          <TipRow label="탐지" value={candidate.device} />
          {candidate.sameDistrict && (
            <span className="pt-0.5 text-warning">같은 지구에서 동시 진행</span>
          )}
        </div>
      </CursorTip>
    </div>
  );
}

function RelatedHeader({
  icon,
  text,
  count,
  action,
}: {
  icon: string;
  text: string;
  count: number;
  /** 우측 끝 슬롯 — 카드 줄 이전/다음 네비게이션 */
  action?: ReactNode;
}) {
  return (
    <div className="mb-2 flex items-center gap-1.5">
      <Icon icon={icon} className="size-4 shrink-0 text-foreground-subtle" aria-hidden />
      <span className="text-caption font-semibold text-foreground">{text}</span>
      <span className="text-caption text-foreground-muted">
        <span className="font-mono">{count}</span>건
      </span>
      {action && <div className="ml-auto flex items-center gap-0.5">{action}</div>}
    </div>
  );
}

/* ── 관련 이벤트 카드 줄 (원본 그대로) ── 카드가 영역보다 많으면 가로 스크롤 +
 *   헤더 우측의 ‹ › 로 한 화면씩 넘긴다 */
function RelatedStrip({
  icon,
  text,
  candidates,
  clickable,
  onOpen,
  empty,
}: {
  icon: string;
  text: string;
  candidates: RelatedEventCandidate[];
  clickable: boolean;
  onOpen?: (c: RelatedEventCandidate) => void;
  /** 후보가 없을 때 자리에 넣을 것 */
  empty?: ReactNode;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(true);

  /* 스크롤 위치·크기 변화마다 양끝 도달 여부 갱신 — 버튼 비활성 판단에 쓴다 */
  const syncEdges = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setAtStart(el.scrollLeft <= 1);
    /* max <= 1 이면 넘길 것이 없다(카드가 영역 안에 다 들어옴) */
    setAtEnd(el.scrollLeft >= max - 1);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    syncEdges();
    /* 팝업 크기·카드 수 변화도 잡는다 */
    const ro = new ResizeObserver(syncEdges);
    ro.observe(el);
    return () => ro.disconnect();
  }, [syncEdges, candidates.length]);

  const step = (dir: 1 | -1) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: "smooth" });
  };

  return (
    <section className="shrink-0">
      <RelatedHeader
        icon={icon}
        text={text}
        count={candidates.length}
        action={
          candidates.length > 0 && (
            <>
              <StripNavButton
                icon="mdi:chevron-left"
                label="이전 사건"
                disabled={atStart}
                onClick={() => step(-1)}
              />
              <StripNavButton
                icon="mdi:chevron-right"
                label="다음 사건"
                disabled={atEnd}
                onClick={() => step(1)}
              />
            </>
          )
        }
      />
      {candidates.length === 0 ? (
        empty
      ) : (
        <div
          ref={scrollRef}
          onScroll={syncEdges}
          className="flex gap-2 overflow-x-auto pb-1"
        >
          {candidates.map((c) => (
            <RelatedCard
              key={c.id}
              candidate={c}
              clickable={clickable}
              onOpen={onOpen ? () => onOpen(c) : undefined}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function StripNavButton({
  icon,
  label,
  disabled,
  onClick,
}: {
  icon: string;
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cn(
        "flex size-6 items-center justify-center rounded border-none bg-transparent transition-colors",
        disabled
          ? "cursor-not-allowed text-foreground-subtle"
          : "cursor-pointer text-foreground-muted hover:bg-surface-raised hover:text-foreground",
      )}
    >
      <Icon icon={icon} className="size-4" aria-hidden />
    </button>
  );
}

function SectionLabel({
  icon,
  text,
  inline,
}: {
  icon: string;
  text: string;
  inline?: boolean;
}) {
  return (
    <div className={cn("flex min-w-0 items-center gap-1.5", !inline && "mb-2")}>
      <Icon icon={icon} className="size-4 shrink-0 text-foreground-subtle" aria-hidden />
      <span
        className="min-w-0 truncate text-caption font-semibold text-foreground"
        title={text}
      >
        {text}
      </span>
    </div>
  );
}
