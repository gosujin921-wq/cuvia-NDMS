/* ─────────────────────────────────────────────
 * SCR-06 AI 검색 — 배경: docs/레거시/정본/03_화면정의서.md §6
 *
 * 말로 묻고, 답과 **근거**를 함께 받고, 근거가 있는 화면으로 건너가는 자리다.
 * 다섯 화면이 각자 들고 있는 것을 한 번의 질문으로 모아 오는 것이 이 화면이 파는 것이다.
 *
 * 들어오는 길은 SCR-01 질의 바다. `?q={질의 ID}` 로 질의를 지정해 보내고, 못 알아들은
 * 문장만 `?ask=` 로 원문이 넘어온다.
 *
 * 이 화면은 답을 지어내지 않는다 (03 §6 AI 표현 원칙).
 *   · 결론에는 근거를 붙이고, 근거마다 04 문서의 어느 절에서 왔는지 적는다
 *   · 시나리오와 실측의 차이를 숨기지 않는다 — 17:22 시나리오 4.24 대 실측 4.31 을 답변 안에 적는다
 *   · 확률·신뢰도를 지어내 붙이지 않는다
 * ───────────────────────────────────────────── */

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Icon } from "@iconify/react";
import { Button, GlassPanel, Tag, cn } from "@ds";
import { FullWidthLayout } from "../../layout/FullWidthLayout";
import { useScenario } from "../../state/ScenarioProvider";
import {
  CANNED_QUERIES,
  CAUSE_ANSWER,
  DEFAULT_QUERY,
  IMPACT_ANSWER,
  RISK_ANSWER,
  districtRanking,
  queryById,
  riskEvidence,
  type CannedQuery,
  type DistrictRisk,
  type Evidence,
} from "../../demo/ai";
import { levelSpec } from "../../demo/levels";
import { LevelBadge } from "../../components/LevelBadge";

export function AiSearchPage() {
  const [params] = useSearchParams();
  const { advanceTo } = useScenario();
  const requested = params.get("q");
  const asked = params.get("ask");

  /* 에필로그 = S9 (04 §0). 엔진이 선행 스텝(S8)을 가드한다 — 시연 초반에 칩을 눌러
     들어와도 시계는 뛰지 않고 답변만 보인다 */
  useEffect(() => {
    advanceTo(9);
  }, [advanceTo]);

  /* 못 알아들은 문장(`?ask=`)으로 들어왔으면 답변을 열지 않는다 — 지어낸 답 대신
     물은 문장을 그대로 보이고 질의 3종을 내놓는다 (04 §14-5) */
  const [active, setActive] = useState<CannedQuery | null>(() =>
    asked ? null : (queryById(requested) ?? DEFAULT_QUERY),
  );

  /* 같은 화면에 머문 채 URL 만 바뀌는 길(대시보드 → 다른 칩)이 있어 params 를 따라간다 */
  useEffect(() => {
    if (asked) {
      setActive(null);
      return;
    }
    setActive(queryById(requested) ?? DEFAULT_QUERY);
  }, [requested, asked]);

  return (
    <FullWidthLayout bodyClassName="flex flex-col gap-3 overflow-y-auto p-3">
      <QueryBar active={active} asked={asked} onSelect={setActive} />

      {active ? (
        <>
          {active.kind === "cause" && <CauseAnswer />}
          {active.kind === "risk" && <RiskAnswer />}
          {active.kind === "impact" && <ImpactAnswer />}
          <AnswerFooter active={active} />
          <NextQuestions active={active} onSelect={setActive} />
        </>
      ) : (
        <UnknownQuery asked={asked ?? ""} onSelect={setActive} />
      )}
    </FullWidthLayout>
  );
}

/* ── 질의 바 ─────────────────────────────────────────────────── */

/** 한 글자 찍는 간격 (ms) — 답이 먼저 뜨고 질문이 뒤따르면 순서가 뒤집혀 읽힌다 */
const TYPE_MS = 26;

function QueryBar({
  active,
  asked,
  onSelect,
}: {
  active: CannedQuery | null;
  asked: string | null;
  onSelect: (query: CannedQuery) => void;
}) {
  const text = active?.text ?? asked ?? "";
  const [typed, setTyped] = useState("");
  const timer = useRef<number | null>(null);

  /* 타이핑 연출 — 질의가 입력되는 것처럼 보인 뒤 답이 붙는다 */
  useEffect(() => {
    setTyped("");
    let index = 0;
    const tick = () => {
      index += 1;
      setTyped(text.slice(0, index));
      if (index < text.length) timer.current = window.setTimeout(tick, TYPE_MS);
    };
    timer.current = window.setTimeout(tick, TYPE_MS);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [text]);

  return (
    <GlassPanel className="flex shrink-0 flex-col gap-2.5 p-3">
      <div className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2.5">
        <Icon
          icon="mdi:creation-outline"
          className="size-4 shrink-0 text-foreground-muted"
          aria-hidden
        />
        <span className="min-w-0 flex-1 truncate text-body text-foreground">
          {typed}
          <span className="animate-pulse text-foreground-subtle">▏</span>
        </span>
      </div>

      <ul className="flex flex-wrap gap-1.5">
        {CANNED_QUERIES.map((query) => {
          const selected = query.id === active?.id;
          return (
            <li key={query.id}>
              <button
                type="button"
                onClick={() => onSelect(query)}
                aria-pressed={selected}
                className={cn(
                  "cursor-pointer rounded-full border px-3 py-1 text-caption transition-colors",
                  selected
                    ? "border-primary bg-card text-foreground"
                    : "border-border bg-card text-foreground-muted hover:border-foreground-subtle hover:text-foreground",
                )}
              >
                {query.text}
              </button>
            </li>
          );
        })}
      </ul>
    </GlassPanel>
  );
}

/* ── 답변 공통 ───────────────────────────────────────────────── */

function AnswerPanel({
  headline,
  detail,
  children,
}: {
  headline: string;
  detail: string;
  children: React.ReactNode;
}) {
  return (
    <GlassPanel className="shrink-0 p-3">
      <div className="flex items-start gap-3 border-b border-border pb-3">
        <Icon
          icon="mdi:creation-outline"
          className="mt-0.5 size-5 shrink-0 text-primary-text"
          aria-hidden
        />
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="text-h6 font-semibold text-foreground">{headline}</h2>
          <p className="text-caption text-foreground-muted">{detail}</p>
        </div>
      </div>
      <div className="pt-3">{children}</div>
    </GlassPanel>
  );
}

/** 근거 목록 — 항목마다 출처를 적는다 (03 §6). 출처는 데이터 원천의 이름(사용자
 *  언어)이다(04 §14 · 차수 K) — 절 번호는 데이터의 참조 필드로만 남고 화면에 서지 않는다 */
function EvidenceList({ items }: { items: readonly Evidence[] }) {
  return (
    <ul className="flex flex-col gap-1">
      {items.map((item) => (
        <li
          key={item.label}
          className="flex items-center gap-3 rounded-md border border-border bg-card px-3 py-2"
        >
          <span className="w-24 shrink-0 text-caption text-foreground-muted">{item.label}</span>
          <span className="min-w-0 flex-1 text-caption text-foreground">{item.value}</span>
          <span className="shrink-0 text-caption text-foreground-subtle">{item.source}</span>
        </li>
      ))}
    </ul>
  );
}

function SectionTitle({ title, note }: { title: string; note?: string }) {
  return (
    <div className="flex items-center gap-2 pb-2">
      <h3 className="text-body font-semibold text-foreground">{title}</h3>
      {note && <span className="text-caption text-foreground-muted">{note}</span>}
    </div>
  );
}

/* ── seohang-cause — 조건 시나리오 도달 예상의 세 항 분해 (04 §14-2) ────── */

function CauseAnswer() {
  return (
    <AnswerPanel headline={CAUSE_ANSWER.headline} detail={CAUSE_ANSWER.detail}>
      {/* 지금과 조건 시나리오를 나란히 — 두 값의 간격이 이 답의 요지다 */}
      <div className="mb-3 grid gap-1.5 sm:grid-cols-2">
        <div className="flex items-center gap-3 rounded-md border border-border bg-card px-3 py-2.5">
          <div className="flex min-w-0 flex-col">
            <span className="text-caption text-foreground-muted">
              현재 계측 · {CAUSE_ANSWER.currentAt}
            </span>
            <span className="font-mono text-h5 font-semibold text-foreground">
              {CAUSE_ANSWER.current.toFixed(2)}
              <span className="ml-1 text-caption font-normal text-foreground-muted">EL.m</span>
            </span>
          </div>
          <LevelBadge level={CAUSE_ANSWER.currentLevel} className="ml-auto shrink-0" />
        </div>

        <div
          className="flex items-center gap-3 rounded-md border bg-card px-3 py-2.5"
          style={{ borderColor: levelSpec("evacuate").color }}
        >
          <div className="flex min-w-0 flex-col">
            <span className="text-caption text-foreground-muted">
              조건 시나리오 · {CAUSE_ANSWER.scenarioAt} 만조
            </span>
            <span
              className="font-mono text-h5 font-semibold"
              style={{ color: levelSpec("evacuate").color }}
            >
              {CAUSE_ANSWER.scenario.toFixed(2)}
              <span className="ml-1 text-caption font-normal text-foreground-muted">EL.m</span>
            </span>
          </div>
          <Tag className="ml-auto shrink-0">대피 기준 4.2 초과</Tag>
        </div>
      </div>

      <SectionTitle title="근거" note="도달 예상 수위는 세 항을 더한 값이다" />
      <EvidenceList items={CAUSE_ANSWER.evidence} />
    </AnswerPanel>
  );
}

/* ── district-risk — 30일 원장 집계 (04 §14-3) ────────────────── */

function RiskAnswer() {
  /* 집계는 원장에서 계산한다. 상수를 두지 않는다 (04 §4-3) */
  const ranking = useMemo(() => districtRanking(), []);
  const top = ranking[0];

  /* 근거는 데이터 층이 조립한다(04 §14-3) — 출처 라벨·참조 절을 화면에 하드코딩하지 않는다 */
  const evidence = riskEvidence(ranking);

  return (
    <AnswerPanel headline={RISK_ANSWER.headlineOf(top)} detail={RISK_ANSWER.detail}>
      <SectionTitle title="지구별 발생 건수" note="최근 30일 · 상위 5개" />
      <ul className="mb-3 flex flex-col gap-1">
        {ranking.slice(0, 5).map((row) => (
          <RankRow key={row.districtId} row={row} max={top.total} first={row === top} />
        ))}
      </ul>

      <SectionTitle title="근거" />
      <EvidenceList items={evidence} />
    </AnswerPanel>
  );
}

function RankRow({ row, max, first }: { row: DistrictRisk; max: number; first: boolean }) {
  return (
    <li className="flex items-center gap-3 rounded-md border border-border bg-card px-3 py-2">
      <span
        className={cn(
          "w-20 shrink-0 truncate text-caption",
          first ? "font-semibold text-foreground" : "text-foreground-muted",
        )}
      >
        {row.name}
      </span>
      {/* 막대 — 건수 비교는 숫자보다 길이가 먼저 읽힌다 */}
      <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-raised">
        <span
          className="block h-full rounded-full"
          style={{
            width: `${(row.total / max) * 100}%`,
            background: first ? levelSpec("evacuate").color : "var(--color-foreground-subtle)",
          }}
        />
      </span>
      <span className="shrink-0 font-mono text-caption text-foreground">{row.total}건</span>
      <span className="w-24 shrink-0 text-right font-mono text-caption text-foreground-subtle">
        경보 이상 {row.severe}
      </span>
    </li>
  );
}

/* ── flood-impact — 침수 영향 비교 (04 §14-4) ─────────────────── */

function ImpactAnswer() {
  return (
    <AnswerPanel headline={IMPACT_ANSWER.headline} detail={IMPACT_ANSWER.detail}>
      <SectionTitle title="수위별 침수 영향" note="서항지구 · 사이값은 선형 보간" />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-caption">
          <thead>
            <tr className="border-b border-border text-foreground-muted">
              <th className="px-3 py-2 text-left font-normal">수위</th>
              <th className="px-3 py-2 text-right font-normal">침수 면적</th>
              <th className="px-3 py-2 text-right font-normal">영향 건물</th>
              <th className="px-3 py-2 text-left font-normal">침수 도로</th>
              <th className="px-3 py-2 text-right font-normal">대피 대상</th>
            </tr>
          </thead>
          <tbody>
            {IMPACT_ANSWER.rows.map((row) => (
              <tr
                key={row.level}
                className={cn(
                  "border-b border-border last:border-0",
                  row.emphasis ? "text-foreground" : "text-foreground-muted",
                )}
              >
                <td className="px-3 py-2">
                  <span className="font-mono font-semibold">{row.level.toFixed(2)} EL.m</span>
                  <span className="ml-2 text-foreground-subtle">{row.caption}</span>
                </td>
                <td className="px-3 py-2 text-right font-mono">{row.area}</td>
                <td
                  className={cn("px-3 py-2 text-right font-mono", row.emphasis && "font-semibold")}
                >
                  {row.buildings}동
                </td>
                <td className="px-3 py-2">{row.road}</td>
                <td className="px-3 py-2 text-right font-mono">
                  {row.evacuees === null ? "—" : `${row.evacuees}명`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AnswerPanel>
  );
}

/* ── 답변 꼬리 — 한계 문구와 바로가기 ────────────────────────── */

/* 이 화면이 답하는 세 짜임. 패널 전용 질의(panelOnly)는 목록에서 빠지므로 여기 없다 */
type LegacyKind = "cause" | "risk" | "impact";

const LIMIT_TEXT: Record<LegacyKind, string> = {
  cause: CAUSE_ANSWER.limit,
  risk: RISK_ANSWER.limitOf(districtRanking().reduce((sum, row) => sum + row.total, 0)),
  impact: IMPACT_ANSWER.limit,
};

function AnswerFooter({ active }: { active: CannedQuery }) {
  const navigate = useNavigate();
  return (
    <GlassPanel className="flex shrink-0 items-center gap-3 p-3">
      <Icon
        icon="mdi:alert-circle-outline"
        className="size-4 shrink-0 text-foreground-muted"
        aria-hidden
      />
      <span className="min-w-0 flex-1 text-caption text-foreground-muted">
        {LIMIT_TEXT[active.kind as LegacyKind]}
      </span>
      <Button className="shrink-0" onClick={() => navigate(active.route)}>
        {active.routeLabel}
        <Icon icon="mdi:chevron-right" className="size-4" aria-hidden />
      </Button>
    </GlassPanel>
  );
}

/* ── 이어서 물어볼 것 ────────────────────────────────────────── */

/**
 * 남은 질의 둘을 답의 첫 줄과 함께 세운다.
 *
 * 세 질의는 같은 사건을 원인·이력·영향 세 각도에서 묻는 것이라(04 §14-1), 하나를 보고
 * 나면 다음이 이어진다. 답의 첫 줄을 미리 보이는 것은 시연자가 다음에 무엇을 눌러야
 * 이야기가 이어지는지 화면에서 읽으려는 것이다.
 */
function NextQuestions({
  active,
  onSelect,
}: {
  active: CannedQuery;
  onSelect: (query: CannedQuery) => void;
}) {
  const ranking = useMemo(() => districtRanking(), []);
  const rest = CANNED_QUERIES.filter((query) => query.id !== active.id && !query.panelOnly);

  const teaser: Record<LegacyKind, string> = {
    cause: CAUSE_ANSWER.headline,
    risk: RISK_ANSWER.headlineOf(ranking[0]),
    impact: IMPACT_ANSWER.headline,
  };

  return (
    <GlassPanel className="shrink-0 p-3">
      <SectionTitle title="이어서 물어볼 것" note="같은 사건을 다른 각도에서 묻는다" />
      <ul className="grid gap-1.5 lg:grid-cols-2">
        {rest.map((query) => (
          <li key={query.id}>
            <button
              type="button"
              onClick={() => onSelect(query)}
              className={cn(
                "flex w-full cursor-pointer flex-col gap-1 rounded-md border border-border bg-card px-3 py-2.5 text-left",
                "transition-colors hover:border-foreground-subtle",
              )}
            >
              <span className="flex w-full items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-caption font-semibold text-foreground">
                  {query.text}
                </span>
                <Icon
                  icon="mdi:chevron-right"
                  className="size-4 shrink-0 text-foreground-subtle"
                  aria-hidden
                />
              </span>
              <span className="w-full truncate text-caption text-foreground-muted">
                {teaser[query.kind as LegacyKind]}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </GlassPanel>
  );
}

/* ── 못 알아들은 질의 (04 §14-5) ─────────────────────────────── */

function UnknownQuery({
  asked,
  onSelect,
}: {
  asked: string;
  onSelect: (query: CannedQuery) => void;
}) {
  return (
    <GlassPanel className="flex shrink-0 flex-col gap-3 p-3">
      <div className="flex items-start gap-3">
        <Icon
          icon="mdi:help-circle-outline"
          className="mt-0.5 size-5 shrink-0 text-foreground-muted"
          aria-hidden
        />
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="text-h6 font-semibold text-foreground">이 질문에는 답할 수 없다</h2>
          <p className="text-caption text-foreground-muted">
            “{asked}” — 데모가 답하는 질의는 아래 3종뿐이다. 없는 답을 지어내지 않는다.
            질의 해석 범위는 백엔드 협의 항목이다 (03 §7).
          </p>
        </div>
      </div>

      <ul className="flex flex-col gap-1">
        {CANNED_QUERIES.map((query) => (
          <li key={query.id}>
            <button
              type="button"
              onClick={() => onSelect(query)}
              className={cn(
                "flex w-full cursor-pointer items-center gap-2 rounded-md border border-border bg-card px-3 py-2.5 text-left",
                "transition-colors hover:border-foreground-subtle",
              )}
            >
              <span className="min-w-0 flex-1 truncate text-caption text-foreground">
                {query.text}
              </span>
              <Icon
                icon="mdi:chevron-right"
                className="size-4 shrink-0 text-foreground-subtle"
                aria-hidden
              />
            </button>
          </li>
        ))}
      </ul>
    </GlassPanel>
  );
}
