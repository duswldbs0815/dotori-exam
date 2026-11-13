"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api-client";
import { classLabel, GRADES } from "@/lib/school";
import type { SchoolOverviewResponse } from "@/lib/types";
import { Acorn } from "../Acorn";
import { btn, card, ErrorBox, Loading } from "../ui";
import { TeacherGate, TeacherShell } from "./TeacherShell";

const SUBJECT_COLOR: Record<string, string> = {
  국어: "bg-[#FCE9D2] text-[#8A4B12]",
  과학: "bg-[#DDEFE3] text-[#23633A]",
  사회: "bg-[#E4EEFB] text-[#2F5E99]",
  영어: "bg-[#F3E3F3] text-[#7A3B7A]",
};
const subjectClass = (s: string) => SUBJECT_COLOR[s] ?? "bg-cream-2 text-brown";

export function TeacherHome() {
  const search = useSearchParams();
  return (
    <TeacherGate failed={search.get("login") === "failed"}>
      <SchoolHome />
    </TeacherGate>
  );
}

/** 교사 첫 화면: 학교 전체 → 학년 · 반별 수행평가 진행 상황 */
function SchoolHome() {
  const [data, setData] = useState<SchoolOverviewResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.school().then(setData, (e) => setError(e instanceof ApiError ? e.message : "불러오지 못했어요."));
  }, []);

  if (error) return <TeacherShell><ErrorBox>{error}</ErrorBox></TeacherShell>;
  if (!data) return <TeacherShell><Loading /></TeacherShell>;

  const examById = new Map(data.exams.map((e) => [e.id, e]));
  const all = data.classes.flatMap((c) => c.exams);
  const total = all.reduce((a, e) => a + e.total, 0);
  const submitted = all.reduce((a, e) => a + e.submitted, 0);
  const blocked = all.reduce((a, e) => a + e.blocked, 0);
  const stats: [string, string][] = [
    [String(data.exams.length), "열린 수행평가"],
    [String(total), "응시한 학생 기록"],
    [total ? `${Math.round((submitted / total) * 100)}%` : "–", "제출률"],
    [String(blocked), "대신 써 달라는 요청 (차단)"],
  ];

  return (
    <TeacherShell>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-sm text-muted">2026학년도 2학기 · 수행평가</span>
          <h1 className="m-0 font-display text-[38px] font-normal">{data.school}</h1>
        </div>
        <Link href="/teacher/new" className={`${btn.primary} min-h-12 text-lg`}>
          <Acorn size={18} /> 새 수행평가 만들기
        </Link>
      </div>

      <div className="grid grid-cols-4 gap-3 max-md:grid-cols-2">
        {stats.map(([v, l]) => (
          <div key={l} className={`${card} flex flex-col gap-1 px-5 py-4`}>
            <span className={`font-display text-[32px] leading-none ${l.includes("차단") && blocked > 0 ? "text-alert" : "text-brown"}`}>{v}</span>
            <span className="text-[13px] text-muted">{l}</span>
          </div>
        ))}
      </div>

      {GRADES.map((g) => (
        <section key={g} aria-label={`${g}학년`} className="flex flex-col gap-3">
          <h2 className="m-0 font-display text-2xl font-normal">{g}학년</h2>
          <div className="grid grid-cols-4 gap-3 max-lg:grid-cols-2 max-sm:grid-cols-1">
            {data.classes
              .filter((c) => c.classId.startsWith(`${g}-`))
              .map((c) => (
                <div key={c.classId} className={`${card} flex flex-col gap-3 p-5`}>
                  <span className="font-display text-xl">{classLabel(c.classId)}</span>
                  {c.exams.length === 0 && <span className="text-sm text-muted">열린 수행평가가 없어요</span>}
                  {c.exams.map((x) => {
                    const e = examById.get(x.examId);
                    if (!e) return null;
                    const pct = x.total ? Math.round((x.submitted / x.total) * 100) : 0;
                    return (
                      <Link
                        key={x.examId}
                        href={`/teacher/class/${c.classId}?exam=${x.examId}`}
                        className="flex flex-col gap-2 rounded-2xl border border-line bg-paper px-3.5 py-3 text-ink no-underline transition-colors hover:border-nut"
                      >
                        <span className="flex items-center gap-2">
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${subjectClass(e.subject)}`}>{e.subject}</span>
                          <span className="min-w-0 truncate text-sm font-bold">{e.title}</span>
                        </span>
                        <span className="h-1.5 overflow-hidden rounded-full bg-[#F3E6D3]" aria-hidden="true">
                          <span className="block h-1.5 rounded-full bg-nut" style={{ width: `${pct}%` }} />
                        </span>
                        <span className="flex flex-wrap gap-x-3 text-xs text-muted">
                          <span>제출 {x.submitted}/{x.total}</span>
                          <span>평균 도토리 {x.avgAcorns}</span>
                          {x.blocked > 0 && <span className="font-bold text-alert">차단 {x.blocked}</span>}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              ))}
          </div>
        </section>
      ))}
      <span className="text-xs text-muted">가상 학교·가상 학생 데이터예요. 실제 학생 정보는 없어요.</span>
    </TeacherShell>
  );
}
