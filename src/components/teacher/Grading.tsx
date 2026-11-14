"use client";

import { useEffect, useRef, useState } from "react";
import { api, ApiError, hhmm, shortLabels } from "@/lib/api-client";
import { DEFAULT_MAX, GRADE_SCALES, levelsOf, pointsTotal } from "@/lib/grading";
import type { Grade, GradeScale, ReportQuestion, StudentReportResponse } from "@/lib/types";
import { Acorn } from "../Acorn";
import { card } from "../ui";

type Value = string | number | null;
const scaleKey = (examId: string) => `dotori-grade-scale-${examId}`;

/** 선생님이 마지막으로 쓴 채점 단계 (이 수행평가에서) → 다음 학생도 같은 단계로 시작 */
function rememberedScale(examId: string): { scale: GradeScale; max: number } | null {
  try {
    const v = JSON.parse(localStorage.getItem(scaleKey(examId)) ?? "null");
    if (v && GRADE_SCALES.some((s) => s.id === v.scale)) return { scale: v.scale, max: Number(v.max) || DEFAULT_MAX };
  } catch {}
  return null;
}

/**
 * 교사 채점 칸. 결과물 채점은 선생님이, 그 옆에 항목별 과정 근거(질문·타임랩스 구간)를 붙여 한 화면에서 끝냄.
 * 누를 때마다 자동 저장. 채점 단계(상·중·하 / A~E / 통과·미통과 / 점수)는 선생님이 고르고, 고른 단계는 다음 학생에도 이어짐.
 */
export function Grading({ studentId, data, onSeek }: { studentId: string; data: StudentReportResponse; onSeek: (time: string) => void }) {
  const examId = data.examId ?? "kor2";
  const n = data.exam.outlineItems.length;
  const labels = shortLabels(data.exam);
  const init = data.grade;
  const start = init ? { scale: init.scale, max: init.max ?? DEFAULT_MAX } : (rememberedScale(examId) ?? data.grading);

  const [scale, setScale] = useState<GradeScale>(start.scale);
  const [max, setMax] = useState(start.max);
  const [items, setItems] = useState<Value[]>(init?.items ?? Array.from({ length: n }, () => null));
  const [ai, setAi] = useState<Value | undefined>(init?.ai);
  const [comment, setComment] = useState(init?.comment ?? "");
  const [saved, setSaved] = useState<{ state: "idle" | "saving" | "ok" | "error"; at?: string; msg?: string }>(
    init ? { state: "ok", at: init.gradedAt } : { state: "idle" },
  );
  const timer = useRef<number | null>(null);
  useEffect(() => () => void (timer.current && window.clearTimeout(timer.current)), []);

  const levels = levelsOf(scale);
  const save = (next: { scale?: GradeScale; max?: number; items?: Value[]; ai?: Value | undefined | "off"; comment?: string }, delay = 0) => {
    const g = {
      scale: next.scale ?? scale,
      max: next.max ?? max,
      items: next.items ?? items,
      ai: next.ai === "off" ? undefined : next.ai !== undefined ? next.ai : ai,
      comment: next.comment ?? comment,
    };
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      setSaved({ state: "saving" });
      api
        .saveGrade(studentId, {
          scale: g.scale,
          ...(g.scale === "points" ? { max: g.max } : {}),
          items: g.items,
          ...(g.ai !== undefined ? { ai: g.ai } : {}),
          comment: g.comment,
        })
        .then(
          (r: { grade: Grade }) => setSaved({ state: "ok", at: r.grade.gradedAt }),
          (e) => setSaved({ state: "error", msg: e instanceof ApiError ? e.message : "저장하지 못했어요." }),
        );
    }, delay);
  };

  const pickScale = (s: GradeScale) => {
    if (s === scale) return;
    const filled = items.some((v) => v !== null) || (ai !== undefined && ai !== null);
    if (filled && !window.confirm("채점 단계를 바꾸면 이 학생에게 매긴 값이 지워져요. 바꿀까요?")) return;
    const empty = Array.from({ length: n }, () => null);
    setScale(s);
    setItems(empty);
    if (ai !== undefined) setAi(null);
    try {
      localStorage.setItem(scaleKey(examId), JSON.stringify({ scale: s, max }));
    } catch {}
    save({ scale: s, items: empty, ...(ai !== undefined ? { ai: null } : {}) });
  };
  const setItem = (i: number, v: Value) => {
    const next = items.map((x, k) => (k === i ? v : x));
    setItems(next);
    save({ items: next });
  };
  const toggleAi = () => {
    if (ai === undefined) {
      setAi(null);
      save({ ai: null });
    } else {
      setAi(undefined);
      save({ ai: "off" });
    }
  };

  const qsOf = (i: number) => data.questions.filter((q) => q.outlineItem === i + 1);
  const total = pointsTotal({ scale, max, items, ai, comment, gradedAt: "" });
  const doneCount = items.filter((v) => v !== null).length + (ai !== undefined && ai !== null ? 1 : 0);
  const rowCount = n + (ai !== undefined ? 1 : 0);

  const evidence = (qs: ReportQuestion[], i: number | null) => {
    const planned = i !== null ? data.acorns.planned?.[i] : null;
    const used = i !== null ? data.acorns.used[i] : null;
    return (
      <div className="flex flex-wrap items-center gap-1.5 text-[13px] text-muted">
        {i !== null && (
          <span className="mr-1">
            질문 {used}
            {planned !== null && planned !== undefined ? ` · 목표 ${planned}` : ""}
          </span>
        )}
        {qs.length === 0 && i !== null && <span className="text-faint">AI 없이 작성</span>}
        {qs.map((q) => (
          <button
            key={q.time}
            type="button"
            onClick={() => onSeek(q.time)}
            title={`${hhmm(q.time)} “${q.question}” · 눌러서 그 순간 다시 보기`}
            className={`inline-flex min-h-7 cursor-pointer items-center gap-1 rounded-full border px-2.5 text-[12px] font-bold ${q.blocked ? "border-alert/30 bg-alert-bg text-alert" : "border-line bg-cream-3 text-brown-dark hover:border-nut"}`}
          >
            <Acorn size={12} ghost={q.blocked} />
            {q.blocked ? "차단" : `도토리 ${q.acornNo}`}
          </button>
        ))}
      </div>
    );
  };

  return (
    <section aria-label="채점" className={`${card} flex flex-col gap-5 px-9 py-7 max-sm:px-5 print:hidden`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="m-0 font-display text-2xl font-normal">채점</h2>
          <p className="m-0 text-[13px] text-muted">결과물은 선생님이 채점하고, 항목마다 과정 근거가 옆에 붙어요. 도토리를 누르면 그 순간을 다시 볼 수 있어요.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div role="radiogroup" aria-label="채점 단계" className="flex rounded-full bg-cream-2 p-1">
            {GRADE_SCALES.map((s) => (
              <button
                key={s.id}
                type="button"
                role="radio"
                aria-checked={scale === s.id}
                onClick={() => pickScale(s.id)}
                className={`min-h-8 cursor-pointer rounded-full border-0 px-3 text-[13px] font-bold ${scale === s.id ? "bg-white text-ink" : "bg-transparent text-muted hover:text-ink"}`}
              >
                {s.label}
              </button>
            ))}
          </div>
          {scale === "points" && (
            <label className="flex items-center gap-1 text-[13px] text-muted">
              항목당
              <input
                type="number"
                min={1}
                max={1000}
                value={max}
                onChange={(e) => {
                  const m = Math.max(1, Math.min(1000, Math.round(Number(e.target.value) || 1)));
                  setMax(m);
                  const clipped = items.map((v) => (typeof v === "number" ? Math.min(v, m) : v));
                  setItems(clipped);
                  try {
                    localStorage.setItem(scaleKey(examId), JSON.stringify({ scale, max: m }));
                  } catch {}
                  save({ max: m, items: clipped }, 500);
                }}
                className="h-8 w-14 rounded-lg border border-line-2 bg-white px-1.5 text-right text-[14px] font-bold text-ink"
              />
              점
            </label>
          )}
        </div>
      </div>

      {data.flags.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-alert-bg/60 px-4 py-3 text-[13px]">
          <span className="font-bold text-alert">먼저 확인할 점</span>
          {data.flags.map((f) => (
            <span key={f.code} className="rounded-full bg-white px-2.5 py-1 font-bold text-alert">
              {f.label}
            </span>
          ))}
          <span className="text-muted">판정이 아니라 확인할 구간이에요.</span>
        </div>
      )}

      <ol className="m-0 flex list-none flex-col p-0">
        {data.exam.outlineItems.map((full, i) => (
          <li key={i} className="grid grid-cols-[150px_1fr_auto] items-center gap-4 border-t border-line py-3.5 first:border-t-0 max-md:grid-cols-1 max-md:gap-2">
            <span className="flex flex-col">
              <span className="text-[15px] font-bold text-ink">{labels[i] ?? full}</span>
              {data.outline?.[i] && <span className="line-clamp-1 text-[12px] text-faint" title={data.outline[i]}>개요: {data.outline[i]}</span>}
            </span>
            {evidence(qsOf(i), i)}
            <ValueControl v={items[i]} onPick={(v) => setItem(i, v)} label={labels[i] ?? full} levels={levels} max={max} />
          </li>
        ))}
        {ai !== undefined && (
          <li className="grid grid-cols-[150px_1fr_auto] items-center gap-4 border-t border-line py-3.5 max-md:grid-cols-1 max-md:gap-2">
            <span className="text-[15px] font-bold text-ink">AI 활용</span>
            <span className="text-[13px] text-muted">
              질문 {data.questions.filter((q) => !q.blocked).length} · 차단 {data.blockedCount} {data.acorns.totalPlanned > 0 ? ` · 계획 ${data.acorns.totalPlanned} → 실제 ${data.acorns.totalUsed}` : ""}
            </span>
            <ValueControl
              v={ai}
              onPick={(v) => {
                setAi(v);
                save({ ai: v });
              }}
              label="AI 활용"
              levels={levels}
              max={max}
            />
          </li>
        )}
      </ol>
      <button type="button" onClick={toggleAi} className="-mt-2 cursor-pointer self-start border-0 bg-transparent p-0 text-[13px] font-bold text-leaf">
        {ai === undefined ? "+ ‘AI 활용’ 항목 추가 (선택)" : "− ‘AI 활용’ 항목 빼기"}
      </button>

      <label className="flex flex-col gap-1.5">
        <span className="text-[14px] font-bold text-sub">평가 근거 한 줄 <span className="font-normal text-muted">· 나이스·세특에 옮길 문장 (반 채점표에 함께 내려받아요)</span></span>
        <textarea
          value={comment}
          onChange={(e) => {
            setComment(e.target.value);
            save({ comment: e.target.value }, 700);
          }}
          rows={2}
          maxLength={500}
          placeholder="예: 시어 ‘즈려밟고’의 뜻을 AI에게 묻고, 반어적 표현에 대한 해석을 스스로 고쳐 근거를 보강함."
          className="resize-y rounded-xl border border-line bg-paper px-4 py-3 text-[15px] leading-relaxed"
        />
      </label>

      <div className="flex flex-wrap items-center justify-between gap-2 text-[13px]">
        <span className="text-muted">
          {doneCount} / {rowCount} 항목 채점{total !== null ? ` · 합계 ${total} / ${max * rowCount}` : ""}
        </span>
        <span aria-live="polite" className={saved.state === "error" ? "font-bold text-alert" : "text-muted"}>
          {saved.state === "saving" && "저장 중…"}
          {saved.state === "ok" && saved.at && `자동 저장됨 ${hhmm(saved.at)}`}
          {saved.state === "error" && saved.msg}
        </span>
      </div>
    </section>
  );
}

function ValueControl({ v, onPick, label, levels, max }: { v: Value; onPick: (v: Value) => void; label: string; levels: readonly string[] | null; max: number }) {
  return levels ? (
      <div role="radiogroup" aria-label={`${label} 채점`} className="flex w-fit overflow-hidden rounded-xl border border-line-2 bg-white">
        {levels.map((lv) => (
          <button
            key={lv}
            type="button"
            role="radio"
            aria-checked={v === lv}
            onClick={() => onPick(v === lv ? null : lv)}
            className={`min-h-10 min-w-11 cursor-pointer border-0 border-l border-line px-3 text-[15px] font-bold first:border-l-0 ${v === lv ? "bg-leaf text-white" : "bg-white text-sub hover:bg-cream-3"}`}
          >
            {lv}
          </button>
        ))}
      </div>
    ) : (
      <label className="flex items-center gap-1.5 text-[14px] text-muted">
        <input
          type="number"
          min={0}
          max={max}
          value={typeof v === "number" ? v : ""}
          onChange={(e) => {
            const raw = e.target.value;
            const num = raw === "" ? null : Math.max(0, Math.min(max, Math.round(Number(raw))));
            onPick(num);
          }}
          aria-label={`${label} 점수`}
          className="h-10 w-[72px] rounded-xl border border-line-2 bg-white px-2 text-right text-[16px] font-bold text-ink"
        />
        / {max}
      </label>
    );
}
