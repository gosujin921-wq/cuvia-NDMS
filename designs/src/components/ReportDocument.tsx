/* ─────────────────────────────────────────────
 * 보고서 문서 — 인쇄 양식 한 벌 (양식 정본: KISA 월간 운영 보고서 v0.5 · 2026-09-08)
 *
 * 사건 보고서와 모의훈련 분석 보고서가 같은 종이를 쓴다. 문서는 밖으로 나가는 물건이라 앱의 어두운 화면 테마가 아니라
 * **A4 흰 종이 팔레트**를 따로 든다 — 이 파일 위의 PAPER 토큰이 그 한 벌이고, 값은 아래 양식 규칙 그대로다.
 *
 * 양식에서 그대로 가져온 규칙:
 *   종이     794 × 1123 px · 안쪽 여백 56/60 · 옅은 그림자 · 회색 바탕 위에 뜬다
 *   머리     좌측 제목(28px/800) + 기간·생성일시·번호 항목표, 우측 CUVIA 워드마크
 *   절 제목  검은 동그라미 번호 + 18px/800 제목 + 회색 한마디. 제목만 쪽 끝에 남지 않게 break-after:avoid
 *   표(rtab) 배경 없음. 머리글은 굵은 아래선(2px), 줄은 옅은 아래선(1px). **항상 좌측 정렬**
 *   항목표   이름표 칸 110px 고정 · 위아래 11px
 *   숫자     본문 글꼴 그대로 쓰되 tabular-nums 로 세로를 맞춘다
 *   바닥     문서명·번호 / 쪽 번호, 옅은 윗선
 *   유의사항 윗선 + 굵은 캡션 + 원형 불렛 목록
 *   인쇄     @page A4 · 표 줄과 카드가 쪽 경계에서 쪼개지지 않게 break-inside:avoid
 * ───────────────────────────────────────────── */

/* ⚠ 표 클래스 이름은 `rtab` 이다. `grid` 로 두면 Tailwind 의 display:grid 유틸리티와 이름이 겹쳐
   표가 그리드 컨테이너가 되고 칸이 다 무너진다(2026-09-15에 실제로 그랬다). */

import wordmarkUrl from "@cuvia/assets/wordmark.svg";
import type { Report, ReportSection, ReportTable } from "../demo/report";

/** 종이 팔레트 — 인쇄물의 색이다. 앱 테마 토큰(어두운 면)과 섞지 않는다 */
const PAPER = `
.rpt { --p-ink:#1a1a1a; --p-sub:#555; --p-mute:#777; --p-faint:#888; --p-line:#eee; --p-rule:#ddd; --p-card:#e5e5e8; --p-wash:#f7f7f9; --p-desk:#f0f0f2; }
.rpt { background:var(--p-desk); color:var(--p-ink); font-size:13px; line-height:1.6; }
.rpt .page { width:794px; min-height:1123px; background:#fff; margin:0 auto; padding:56px 60px; box-shadow:0 2px 10px rgba(0,0,0,.08); position:relative; }
.rpt .hd { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:20px; }
.rpt .hd h1 { font-size:28px; font-weight:800; margin:0 0 9px; line-height:1.25; }
.rpt dl.meta { display:grid; grid-template-columns:58px auto; row-gap:3px; column-gap:8px; font-size:12px; line-height:1.5; align-content:start; margin:0; }
.rpt dl.meta dt { color:var(--p-mute); font-weight:700; }
.rpt dl.meta dd { color:var(--p-sub); margin:0; }
.rpt dl.ident { display:grid; grid-template-columns:auto 1fr auto 1fr; column-gap:14px; row-gap:7px; font-size:12.5px; margin:0; padding:14px 0 0; border-top:2px solid #111; }
.rpt dl.ident dt { color:var(--p-mute); font-weight:700; white-space:nowrap; }
.rpt dl.ident dd { color:var(--p-ink); font-weight:700; margin:0; }
.rpt .sec { display:flex; align-items:center; gap:7px; margin:40px 0 12px; break-after:avoid; page-break-after:avoid; }
.rpt .sec .num { width:18px; height:18px; border-radius:50%; background:#111; color:#fff; font-size:11.5px; font-weight:800; line-height:1; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
.rpt .sec h2 { font-size:18px; font-weight:800; margin:0; }
.rpt .sec .note { color:var(--p-faint); font-size:12px; }
.rpt table.rtab { width:100%; border-collapse:collapse; font-size:12.5px; }
.rpt table.rtab th { text-align:left; font-size:12px; color:#666; font-weight:700; padding:9px 6px; border-bottom:2px solid var(--p-rule); }
.rpt table.rtab td { padding:9px 6px; border-bottom:1px solid var(--p-line); vertical-align:top; text-align:left; }
.rpt table.rtab td.r, .rpt table.rtab th.r { text-align:right; }
.rpt table.rtab tr.sum td { font-weight:700; border-bottom:none; }
.rpt table.kv { width:100%; border-collapse:collapse; }
.rpt table.kv th { width:110px; text-align:left; font-weight:700; color:#333; padding:11px 4px; border-bottom:1px solid var(--p-line); vertical-align:top; }
.rpt table.kv td { padding:11px 4px; border-bottom:1px solid var(--p-line); vertical-align:top; }
.rpt .fnote { color:var(--p-faint); font-size:11.5px; margin-top:8px; line-height:1.6; }
.rpt .empty { color:var(--p-faint); font-size:12.5px; padding:11px 4px; border-bottom:1px solid var(--p-line); }
.rpt .figure { margin-top:4px; }
.rpt .figure img { display:block; width:100%; border:1px solid var(--p-card); border-radius:6px; }
.rpt .figure figcaption { color:var(--p-faint); font-size:11.5px; margin-top:8px; }
.rpt .notice { margin-top:40px; padding-top:14px; border-top:1px solid var(--p-line); }
.rpt .notice .cap { font-size:11.5px; font-weight:800; color:var(--p-sub); margin-bottom:8px; }
.rpt .notice ul { list-style:none; margin:0; padding:0; }
.rpt .notice li { position:relative; padding-left:12px; color:var(--p-faint); font-size:11.5px; line-height:1.8; }
.rpt .notice li::before { content:"\\2022"; position:absolute; left:1px; top:0; }
.rpt .foot { position:absolute; bottom:28px; left:60px; right:60px; display:flex; justify-content:space-between; color:var(--p-mute); font-size:11.5px; border-top:1px solid var(--p-line); padding-top:10px; }
.rpt .num-t { font-variant-numeric:tabular-nums; font-feature-settings:"tnum" 1; }
.rpt table.rtab tr, .rpt table.kv tr { break-inside:avoid; page-break-inside:avoid; }
.rpt table.rtab thead { display:table-header-group; }
.rpt .figure, .rpt .notice { break-inside:avoid; page-break-inside:avoid; }
@media print { @page { size:A4; margin:0; } .rpt { background:#fff; } .rpt .page { margin:0 auto; box-shadow:none; } }
`;

export interface ReportDocumentProps {
  report: Report;
  /** 머리 항목표 — 기간·생성일시·번호처럼 문서를 식별하는 것만 */
  meta: { label: string; value: string }[];
  /** 바닥 왼쪽 — "CUVIA 모의훈련 분석 보고서 · A-…" */
  footLabel: string;
  /** 마지막 절로 붙는 그림 한 장 */
  figure?: { src: string; alt: string; caption?: string };
  /** 문서 끝 유의사항. 없으면 세우지 않는다 */
  notice?: string[];
}

export function ReportDocument({ report, meta, footLabel, figure, notice }: ReportDocumentProps) {
  /* 그림이 있으면 번호를 하나 더 쓴다 — 본문 절 다음 번호다 */
  const figureIndex = report.sections.length + 1;
  return (
    <div className="rpt">
      <style>{PAPER}</style>
      <div className="page">
        <header className="hd">
          <div>
            <h1>{report.title}</h1>
            <dl className="meta">
              {meta.map((m) => (
                <div key={m.label} style={{ display: "contents" }}>
                  <dt>{m.label}</dt>
                  <dd className="num-t">{m.value}</dd>
                </div>
              ))}
            </dl>
          </div>
          <img src={wordmarkUrl} alt="CUVIA" width={100} height={18} />
        </header>

        {/* 식별 블록 — 이 문서가 무엇에 대한 것인가. 번호를 붙이지 않는다(양식의 머리 밑 자리) */}
        {report.head.length > 0 && (
          <dl className="ident">
            {report.head.map((r) => (
              <div key={r.label} style={{ display: "contents" }}>
                <dt>{r.label}</dt>
                <dd className="num-t">{r.value}</dd>
              </div>
            ))}
          </dl>
        )}

        {report.sections.map((s, i) => <Section key={s.id} index={i + 1} section={s} />)}

        {figure && (
          <>
            <div className="sec"><span className="num">{figureIndex}</span><h2>분석 범위</h2></div>
            <figure className="figure">
              <img src={figure.src} alt={figure.alt} />
              {figure.caption && <figcaption>{figure.caption}</figcaption>}
            </figure>
          </>
        )}

        {notice && notice.length > 0 && (
          <section className="notice">
            <p className="cap">유의사항</p>
            <ul>{notice.map((line) => <li key={line}>{line}</li>)}</ul>
          </section>
        )}

        <div className="foot">
          <span>{footLabel}</span>
          <span className="num-t">1 / 1</span>
        </div>
      </div>
    </div>
  );
}

function Section({ index, section }: { index: number; section: ReportSection }) {
  const empty = section.rows.length === 0 && !section.table && !section.figure;
  return (
    <section>
      <div className="sec">
        <span className="num">{index}</span>
        <h2>{section.title}</h2>
        {section.note && <span className="note">{section.note}</span>}
      </div>

      {section.table && <Grid table={section.table} />}

      {section.figure && (
        <figure className="figure">
          <img src={section.figure.src} alt={section.figure.alt} />
          {section.figure.caption && <figcaption>{section.figure.caption}</figcaption>}
        </figure>
      )}

      {section.rows.length > 0 && (
        <table className="kv">
          <tbody>
            {section.rows.map((r) => (
              <tr key={r.label}>
                <th scope="row">{r.label}</th>
                <td className="num-t">{r.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* 비어 있는 절도 자리를 남긴다 — 문서에서 절이 사라지면 번호가 밀려 다른 문서와 대조가 안 된다 */}
      {empty && !section.footnote && <p className="empty">기록 없음</p>}
      {section.footnote && <p className="fnote">{section.footnote}</p>}
    </section>
  );
}

function Grid({ table }: { table: ReportTable }) {
  const cls = (i: number) => (table.align?.[i] === "right" ? "r" : undefined);
  const last = table.rows.length - 1;
  return (
    <table className="rtab">
      {table.widths && <colgroup>{table.widths.map((w, i) => <col key={i} style={w ? { width: w } : undefined} />)}</colgroup>}
      <thead>
        <tr>{table.head.map((h, i) => <th key={h} className={cls(i)}>{h}</th>)}</tr>
      </thead>
      <tbody>
        {table.rows.map((row, ri) => (
          <tr key={row.join("|")} className={table.summary && ri === last ? "sum" : undefined}>
            {row.map((cell, ci) => <td key={`${ci}-${cell}`} className={[cls(ci), ci > 0 ? "num-t" : ""].filter(Boolean).join(" ") || undefined}>{cell}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
