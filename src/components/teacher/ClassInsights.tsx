"use client";

// 반 화면 위쪽 "수업 단서" 카드: 학생들의 질문을 AI가 묶어서 다음 수업 제안을 보여 줌.
// 빼고 싶으면 ClassView.tsx 에서 <ClassInsights … /> 한 줄만 지우면 됨.
import { useEffect, useState } from "react";
import type { ClassInsightsResponse } from "@/lib/types";
import { card } from "../ui";

type State = { key: string; data: ClassInsightsResponse | null; error: string | null };

export function ClassInsights({ classId, examId }: { classId: string; examId: string }) {
  const key = `${classId}:${examId}`;
  const [state, setState] = useState<State | null>(null);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    let alive = true;
    const q = new URLSearchParams({ classId, examId });
    fetch(`/api/report/class/insights?${q}`, { cache: "no-store" })
      .then(async (r) => {
        const body = await r.json().catch(() => null);
        if (!r.ok) throw new Error(body?.error ?? "수업 단서를 불러오지 못했어요.");
        return body as ClassInsightsResponse;
      })
      .then(
        (data) => alive && setState({ key: `${classId}:${examId}`, data, error: null }),
        (e: Error) => alive && setState({ key: `${classId}:${examId}`, data: null, error: e.message }),
      );
    return () => {
      alive = false;
    };
  }, [classId, examId]);

  const cur = state?.key === key ? state : null;
  const data = cur?.data ?? null;
  // 질문이 너무 적으면 카드 자체를 숨김
  if (data && data.source === "none") return null;

  return (
    <section aria-label="수업 단서" className={`${card} flex flex-col gap-4 p-6 max-sm:p-4`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex flex-wrap items-baseline gap-2">
          <h2 className="m-0 font-display text-xl font-normal">📌 다음 수업 단서</h2>
          {data && (
            <span className="text-[12px] text-muted">
              학생 {data.basedOn.students}명의 질문 {data.basedOn.questions}개
              {data.basedOn.blocked ? ` · 차단 ${data.basedOn.blocked}번` : ""}을 AI가 묶었어요
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="min-h-[34px] cursor-pointer rounded-full border border-line-3 bg-white px-3 text-[12px] text-sub"
        >
          {open ? "접기" : "펼치기"}
        </button>
      </div>

      {open &&
        (cur === null ? (
          <p className="m-0 animate-pulse py-6 text-center text-sm text-muted">
            AI가 이 반의 질문을 읽고 묶는 중이에요… (처음 한 번은 20초쯤 걸려요)
          </p>
        ) : cur.error || data?.source === "error" ? (
          <p className="m-0 py-4 text-center text-sm text-muted">
            {cur.error ?? "지금은 AI 정리를 불러오지 못했어요. 잠시 뒤 새로고침해 주세요."}
          </p>
        ) : (
          <>
            <ol className="m-0 grid list-none grid-cols-2 gap-3 p-0 max-md:grid-cols-1">
              {data!.cards.map((c, i) => (
                <li
                  key={i}
                  className={`flex flex-col gap-2 rounded-2xl border px-4 py-3.5 ${c.blocked ? "border-alert-bg bg-alert-bg/40" : "border-line bg-paper"}`}
                >
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={`rounded-full px-2 py-0.5 text-[12px] font-bold ${c.blocked ? "bg-alert-bg text-alert" : "bg-cream-2 text-brown"}`}>
                      {c.students}명 · 질문 {c.questions}개
                    </span>
                    {c.item && <span className="rounded-full border border-line px-2 py-0.5 text-[12px] text-sub">{c.item}</span>}
                    {c.blocked && <span className="text-[12px] text-alert">대신 써 달라는 요청</span>}
                  </div>
                  <b className="text-[15px] leading-snug text-ink">{c.title}</b>
                  <p className="m-0 text-[13px] leading-relaxed text-sub">{c.detail}</p>
                  <p className="m-0 rounded-xl bg-leaf-bg px-3 py-2 text-[13px] leading-relaxed text-leaf">→ {c.suggestion}</p>
                  {c.examples.length > 0 && (
                    <p className="m-0 text-[12px] leading-relaxed text-muted">
                      예: {c.examples.map((e) => `“${e}”`).join("  ")}
                    </p>
                  )}
                </li>
              ))}
            </ol>
            <p className="m-0 text-[12px] text-muted">
              학생 이름 없이 질문만 AI에 보내 정리한 참고 자료예요. 몇 명·몇 개는 기록에서 직접 센 값이고, 수업 판단은 선생님이 해요.
            </p>
          </>
        ))}
    </section>
  );
}
