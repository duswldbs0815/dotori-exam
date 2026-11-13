"use client";

import { useState } from "react";
import type { ExamInfo } from "@/lib/types";

/** 시험지 옆 지문·자료 (예: 「진달래꽃」 전문). 지문이 없으면 과제 설명만 보여 줌 */
export function PassagePanel({ exam, defaultOpen = true }: { exam: ExamInfo; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const p = exam.passage;
  if (!p && !exam.task) return null;
  // 줄이 모두 짧으면 시로 보고 글자를 크게
  const poem = !!p && p.body.split("\n").every((l) => l.length <= 30);
  return (
    <section aria-label="지문과 과제" className="flex flex-col gap-3 rounded-[22px] border border-line bg-paper px-5 py-4">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex cursor-pointer items-center justify-between gap-2 border-0 bg-transparent p-0 text-left"
      >
        <span className="flex items-center gap-2">
          <span className="rounded-lg bg-brown px-2 py-0.5 text-xs font-bold text-white">{p ? "지문" : "과제"}</span>
          <span className="font-display text-[19px] text-brown-dark">
            {p ? `「${p.title}」` : "이번 과제"}
            {p?.author && <span className="ml-1.5 font-sans text-[13px] text-muted">{p.author}</span>}
          </span>
        </span>
        <span className="text-[13px] text-muted">{open ? "접기" : "펼치기"}</span>
      </button>
      {open && (
        <>
          {exam.task && p && <p className="m-0 rounded-xl bg-cream-3 px-3 py-2 text-[13px] leading-relaxed text-sub">과제 · {exam.task}</p>}
          <div className={`max-h-[360px] overflow-y-auto whitespace-pre-wrap text-ink ${poem ? "text-[16px] leading-[1.9]" : "text-[14px] leading-relaxed"}`}>
            {p ? p.body : exam.task}
          </div>
          {p?.source && <span className="text-[11px] text-faint">{p.source}</span>}
        </>
      )}
    </section>
  );
}
