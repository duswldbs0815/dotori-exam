"use client";

import { useState } from "react";
import { api, ApiError } from "@/lib/api-client";
import type { ExamInfo, Outline, PerItem } from "@/lib/types";
import { Acorn } from "../Acorn";
import { Squirrel } from "../Squirrel";
import { PassagePanel } from "./PassagePanel";
import { btn, card, ErrorBox } from "../ui";

/** ① 개요: 4항목 + 항목별 도토리 목표 (AI 없이) */
export function OutlineStep(props: {
  attemptId: string;
  exam: ExamInfo;
  initialOutline: Outline | null;
  initialPlan: PerItem | null;
  used: PerItem;
  planLocked: boolean;
  onSaved: (outline: Outline, plan: PerItem) => void;
}) {
  const { exam, used, planLocked } = props;
  const [outline, setOutline] = useState<Outline>(props.initialOutline ?? ["", "", "", ""]);
  const [plan, setPlan] = useState<PerItem>(props.initialPlan ?? [0, 0, 0, 0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const max = exam.acornPlanMaxPerItem;
  const filled = outline.every((s) => s.trim().length > 0);
  const totalPlan = plan.reduce((a, b) => a + b, 0);

  const setItem = (i: number, v: string) => setOutline((o) => o.map((s, j) => (j === i ? v : s)) as Outline);
  const bump = (i: number, d: number) =>
    setPlan((p) => p.map((n, j) => (j === i ? Math.max(0, Math.min(max, n + d)) : n)) as PerItem);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await api.outline(props.attemptId, outline, plan);
      props.onSaved(outline, props.planLocked && props.initialPlan ? props.initialPlan : plan);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "저장하지 못했어요.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-start gap-6">
      <section className={`${card} flex min-w-0 flex-[999_1_600px] flex-col gap-5 p-8 max-sm:p-5`}>
        <div className="flex flex-col gap-1.5">
          <h1 className="m-0 font-display text-4xl font-normal">개요부터 내 생각으로</h1>
          <p className="m-0 text-[15px] text-sub">
            이 단계는 AI 없이 써요. 오른쪽 칸에는 항목마다 도토리를 몇 개 쓸지 목표를 정해요.
          </p>
        </div>

        <div className="flex flex-col gap-3.5">
          {exam.outlineItems.map((label, i) => (
            <div key={label} className="flex flex-wrap items-stretch gap-4">
              <label htmlFor={`o${i}`} className="flex flex-[0_0_180px] flex-col justify-center gap-1 rounded-[18px] bg-cream-2 px-4 py-3.5 max-sm:flex-[1_1_100%]">
                <span className="font-display text-[22px] text-brown">{i + 1}</span>
                <span className="text-[15px] font-bold">{label.replace("·", " · ")}</span>
                {exam.itemGuides?.[i] && (
                  <span className="text-xs leading-snug text-sub" title={exam.itemGuides[i].help}>
                    선생님 권장 도토리 {exam.itemGuides[i].acorns}개
                  </span>
                )}
              </label>
              <textarea
                id={`o${i}`}
                rows={2}
                value={outline[i]}
                onChange={(e) => setItem(i, e.target.value)}
                placeholder="내 생각을 짧게 적어요"
                className="min-w-0 flex-[999_1_280px] resize-y rounded-[18px] border border-line bg-paper px-4 py-3.5 text-[15px] leading-relaxed"
              />
              <div
                role="group"
                aria-label={`${label} 도토리 목표`}
                className="flex flex-[0_0_128px] flex-col items-center justify-center gap-1.5 rounded-[18px] border border-dashed border-line-2 px-2 py-2"
              >
                <span className="text-xs text-muted">도토리 목표</span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    aria-label="목표 하나 줄이기"
                    disabled={planLocked || plan[i] <= 0}
                    onClick={() => bump(i, -1)}
                    className="h-8 w-8 cursor-pointer rounded-full border border-line-2 bg-white text-lg leading-none text-sub disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    −
                  </button>
                  <span className="flex min-w-9 items-center justify-center gap-0.5 font-display text-2xl text-brown" aria-live="polite">
                    <Acorn size={14} ghost={plan[i] === 0} />
                    {plan[i]}
                  </span>
                  <button
                    type="button"
                    aria-label="목표 하나 늘리기"
                    disabled={planLocked || plan[i] >= max}
                    onClick={() => bump(i, 1)}
                    className="h-8 w-8 cursor-pointer rounded-full border border-line-2 bg-white text-lg leading-none text-sub disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    +
                  </button>
                </div>
                <span className="text-xs text-muted">
                  사용 {used[i]} / 목표 {plan[i]}
                </span>
              </div>
            </div>
          ))}
        </div>

        {planLocked && (
          <p className="m-0 rounded-xl bg-cream-3 px-4 py-2.5 text-sm text-sub">
            첫 질문을 했기 때문에 도토리 목표는 바꿀 수 없어요. 개요 글은 계속 고칠 수 있어요.
          </p>
        )}
        {error && <ErrorBox>{error}</ErrorBox>}

        <div className="flex flex-wrap items-center justify-end gap-3">
          <span className="mr-auto text-sm text-sub">목표 합계 {totalPlan}개</span>
          <button type="button" disabled={!filled || busy} onClick={save} className={btn.primary}>
            {busy ? "저장 중…" : "개요 저장하고 글쓰기로"}
          </button>
        </div>
        {!filled && <p className="m-0 text-right text-[13px] text-muted">네 칸을 모두 채우면 글쓰기로 넘어갈 수 있어요.</p>}
      </section>

      <aside className="flex min-w-0 flex-[1_1_280px] flex-col gap-4">
        <PassagePanel exam={exam} />
        <div className="flex items-center gap-2.5 rounded-[22px] border border-line bg-white px-4 py-3.5">
          <Squirrel size={64} />
          <span className="font-display text-[17px] leading-snug text-brown-dark">먼저 내 생각을 적어 두면 질문이 훨씬 좋아져!</span>
        </div>
        {exam.itemGuides && (
          <div className="flex flex-col gap-2.5 rounded-[18px] border border-line bg-white px-[18px] py-4">
            <span className="text-sm font-bold text-brown-dark">이 시험에서 AI가 도와줄 수 있는 일</span>
            <ol className="m-0 flex list-none flex-col gap-2 p-0 text-[13px] leading-snug text-sub">
              {exam.itemGuides.map((g, i) => (
                <li key={i} className="flex gap-2">
                  <span className="font-display text-brown">{i + 1}</span>
                  <span>{g.help}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
        <div className="flex flex-col gap-1.5 rounded-[18px] bg-leaf-bg px-[18px] py-4">
          <span className="text-sm font-bold text-leaf">도토리 목표는 한도가 아니에요</span>
          <span className="text-sm leading-normal text-leaf-2">
            이 항목에서 AI에게 몇 번쯤 물어볼지 미리 정해 보는 거예요. 목표보다 많이 써도 질문은 계속할 수 있고, 성찰지에서 계획과 실제를 비교해 봐요.
          </span>
        </div>
      </aside>
    </div>
  );
}
