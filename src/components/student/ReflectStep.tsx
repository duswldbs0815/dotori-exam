"use client";

import { useState } from "react";
import { api, ApiError, shortLabels } from "@/lib/api-client";
import type { ExamInfo, PerItem, Reflection, StudentQuestion } from "@/lib/types";
import { Squirrel } from "../Squirrel";
import { btn, card, ErrorBox } from "../ui";
import type { DoneInfo } from "./ExamApp";


/** ③ 성찰지: 항목별 목표 vs 실제 그래프 + 돌아보기 4문항 → 최종 제출 */
export function ReflectStep(props: {
  attemptId: string;
  exam: ExamInfo;
  plan: PerItem;
  used: PerItem;
  questions: StudentQuestion[];
  draft: string;
  saveDraft: (text: string, force?: boolean) => Promise<boolean>;
  onBack: () => void;
  onSubmitted: (info: DoneInfo) => void;
}) {
  const { plan, used, questions } = props;
  const [answers, setAnswers] = useState<Reflection>(["", "", "", ""]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmEmpty, setConfirmEmpty] = useState(false);
  const totalUsed = used.reduce((a, b) => a + b, 0);
  const totalPlan = plan.reduce((a, b) => a + b, 0);
  const filled = answers.filter((a) => a.trim()).length;

  async function submit() {
    if (filled < 4 && !confirmEmpty) {
      setConfirmEmpty(true);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await props.saveDraft(props.draft, true);
      const res = await api.submit(props.attemptId, props.draft, answers);
      props.onSubmitted({ submittedAt: res.submittedAt, chars: props.draft.length, reflectionCount: filled });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "제출하지 못했어요.");
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-start gap-6">
      <section aria-label="나의 도토리 사용" className="flex min-w-0 flex-[1_1_440px] flex-col gap-4">
        <div className={`${card} flex flex-col gap-[18px] p-7`}>
          <div className="flex flex-col gap-1">
            <h1 className="m-0 font-display text-[32px] font-normal">내 도토리는 어디로 갔을까?</h1>
            <p className="m-0 text-[15px] text-sub">
              개요 항목별로 정한 목표와 실제로 쓴 도토리예요. 목표 {totalPlan}개 중 {totalUsed}개를 썼어요.
            </p>
          </div>
          <PlanChart plan={plan} used={used} labels={shortLabels(props.exam)} />
        </div>
        <div className="flex flex-col gap-2.5 rounded-[22px] border border-line bg-white px-[22px] py-[18px]">
          <h2 className="m-0 font-display text-xl font-normal">내가 한 질문 다시 보기</h2>
          {questions.length === 0 && <span className="text-sm text-muted">이번 시험에서는 질문하지 않았어요.</span>}
          {questions.map((q, i) =>
            q.blocked ? (
              <div key={i} className="flex gap-2.5 text-sm leading-normal text-alert">
                <span className="flex-none font-bold">차단</span>
                <span>“{q.question}” · 도토리 안 씀</span>
              </div>
            ) : (
              <div key={i} className="flex gap-2.5 text-sm leading-normal">
                <span className="flex-none font-display text-brown">#{q.acornNo}</span>
                <span>
                  <span className="text-muted">{shortLabels(props.exam)[q.outlineItem - 1]} · </span>
                  {q.question}
                </span>
              </div>
            ),
          )}
        </div>
      </section>

      <section aria-label="성찰 질문" className={`${card} flex min-w-0 flex-[999_1_560px] flex-col gap-[18px] px-8 py-7 max-sm:px-5`}>
        <h2 className="m-0 font-display text-[26px] font-normal">돌아보기 4문항</h2>
        {props.exam.reflectionQuestions.map((p, i) => (
          <div key={i} className="flex flex-col gap-2">
            <label htmlFor={`r${i}`} className="text-[15px] font-bold leading-relaxed">
              {i + 1}. {p}
            </label>
            <textarea
              id={`r${i}`}
              rows={3}
              value={answers[i]}
              onChange={(e) => {
                setConfirmEmpty(false);
                setAnswers((a) => a.map((s, j) => (j === i ? e.target.value : s)) as Reflection);
              }}
              className="resize-y rounded-2xl border border-line bg-paper px-3.5 py-3 text-[15px] text-ink"
            />
          </div>
        ))}
        {confirmEmpty && (
          <div role="alert" className="rounded-2xl bg-cream-3 px-4 py-3 text-sm text-sub">
            아직 {4 - filled}문항이 비어 있어요. 이대로 제출하려면 한 번 더 눌러 주세요. 제출하면 글과 성찰지를 더 고칠 수 없어요.
          </div>
        )}
        {error && <ErrorBox>{error}</ErrorBox>}
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-dashed border-line pt-[18px]">
          <div className="flex items-center gap-3">
            <Squirrel size={64} />
            <span className="font-display text-[17px] leading-snug text-brown-dark">여기까지 왔다! 마지막 한 칸만 더</span>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <button type="button" onClick={props.onBack} disabled={busy} className={btn.secondary}>
              글 다시 보기
            </button>
            <button type="button" onClick={submit} disabled={busy || !props.draft.trim()} className={`${btn.primary} px-7`}>
              {busy ? "제출 중…" : confirmEmpty ? "그래도 제출하기" : "최종 제출하기"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

/** 항목별 목표(테두리 막대) vs 실제 사용(채운 막대) */
function PlanChart({ plan, used, labels }: { plan: PerItem; used: PerItem; labels: readonly string[] }) {
  const max = Math.max(3, ...plan, ...used);
  const H = 180;
  const top = 30;
  const base = top + H;
  const y = (n: number) => base - (n / max) * H;
  const ticks = Array.from(new Set([0, Math.round(max / 2), max]));
  const summary = labels.map((l, i) => `${l} 목표 ${plan[i]} 사용 ${used[i]}`).join(", ");
  return (
    <div className="flex flex-col gap-2">
      <svg viewBox="0 0 440 270" width="100%" role="img" aria-label={`항목별 도토리: ${summary}`}>
        <g stroke="#F0E4D3" strokeWidth="1">
          {ticks.map((t) => (
            <line key={t} x1="40" y1={y(t)} x2="430" y2={y(t)} />
          ))}
        </g>
        <g fontSize="12" fill="#7A6450" textAnchor="end">
          {ticks.map((t) => (
            <text key={t} x="32" y={y(t) + 4}>
              {t}
            </text>
          ))}
        </g>
        {labels.map((label, i) => {
          const cx = 92 + i * 96;
          const p = plan[i];
          const u = used[i];
          return (
            <g key={label}>
              {p > 0 && <rect x={cx - 30} y={y(p)} width="26" height={base - y(p)} rx="8" fill="#FFF6E5" stroke="#C27C3E" strokeWidth="2" strokeDasharray="5 4" />}
              {u > 0 ? (
                <rect
                  x={cx + 2}
                  y={y(u)}
                  width="26"
                  height={base - y(u)}
                  rx="8"
                  fill={u > p ? "#8A4B12" : "#C27C3E"}
                  style={{ transformBox: "fill-box", transformOrigin: "bottom", animation: `dotori-grow .9s ${i * 0.15}s cubic-bezier(.2,.8,.2,1) both` }}
                />
              ) : (
                <rect x={cx + 2} y={base - 4} width="26" height="4" rx="2" fill="#E4D6C4" />
              )}
              <text x={cx - 17} y={y(p) - 6} fontSize="13" fill="#7A6450" textAnchor="middle">
                {p}
              </text>
              <text x={cx + 15} y={y(u) - 6} fontSize="16" fill="#3A2A1C" textAnchor="middle" style={{ fontFamily: "var(--font-jua)" }}>
                {u}
              </text>
              <text x={cx} y={base + 24} fontSize="13" fill="#5C3A1E" textAnchor="middle">
                {label}
              </text>
              <text x={cx} y={base + 42} fontSize="11" fill="#7A6450" textAnchor="middle">
                {u === 0 ? "혼자 해결" : u > p ? "목표보다 많이" : u === p ? "목표만큼" : "목표보다 적게"}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="flex flex-wrap gap-4 text-xs text-sub">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded border-2 border-dashed border-nut bg-cream-3" />
          목표
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-nut" />
          실제 사용
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-brown" />
          목표보다 많이 씀
        </span>
      </div>
    </div>
  );
}
