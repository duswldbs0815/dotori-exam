"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api-client";
import { CLASS_IDS, classLabel } from "@/lib/school";
import type { ExamDef, SchoolOverviewResponse } from "@/lib/types";
import { ErrorBox, Loading } from "../ui";
import { homeCard } from "./TeacherHome";
import { TeacherGate, TeacherShell } from "./TeacherShell";

export function TeacherExams() {
  return (
    <TeacherGate>
      <ExamList />
    </TeacherGate>
  );
}

/** 내 수행평가: 수행평가마다 반별로 배포 · 진행 · 마감 */
function ExamList() {
  const [data, setData] = useState<SchoolOverviewResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    api.school().then(setData, (e) => setError(e instanceof ApiError ? e.message : "불러오지 못했어요."));
  }, []);

  if (!data) return <TeacherShell>{error ? <ErrorBox>{error}</ErrorBox> : <Loading />}</TeacherShell>;

  /** 반 상태 바꾸기: open(배포·다시 열기) / close(마감) / remove(배포 취소, 기록 없는 반만) */
  const change = async (e: ExamDef, classId: string, to: "open" | "close" | "remove") => {
    const classIds = to === "remove" ? e.classIds.filter((c) => c !== classId) : [...new Set([...e.classIds, classId])];
    const closed = new Set(e.closedClassIds ?? []);
    if (to === "close") closed.add(classId);
    else closed.delete(classId);
    setBusy(`${e.id}__${classId}`);
    setError(null);
    try {
      const r = await api.examClasses({ examId: e.id, classIds, closedClassIds: [...closed] });
      setData(await api.school().catch(() => ({ ...data, exams: data.exams.map((x) => (x.id === e.id ? { ...x, ...r } : x)) })));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "바꾸지 못했어요.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <TeacherShell>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-sm text-muted">
            {data.school} · {data.teacher.subject} · 2026학년도 2학기
          </span>
          <h1 className="m-0 font-display text-[34px] font-normal text-leaf">내 수행평가</h1>
          <span className="text-[15px] text-sub">반마다 열고, 진행 상황을 보고, 끝나면 마감해요.</span>
        </div>
        <Link href="/teacher/new" className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-leaf px-5 text-[16px] font-bold text-white no-underline hover:bg-leaf-2">
          + 수행평가 만들기
        </Link>
      </div>
      {error && <ErrorBox>{error}</ErrorBox>}
      {data.exams.length === 0 && <p className="m-0 text-sub">아직 만든 수행평가가 없어요.</p>}

      {data.exams.map((e) => {
        const gradeClasses = CLASS_IDS.filter((c) => c.startsWith(`${e.grade}-`));
        const stat = (classId: string) => data.classes.find((c) => c.classId === classId)?.exams.find((x) => x.examId === e.id);
        const openN = e.classIds.filter((c) => !e.closedClassIds?.includes(c)).length;
        return (
          <section key={e.id} className={`${homeCard} flex flex-col gap-4 p-6 max-sm:p-4`}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <div className="flex flex-wrap items-baseline gap-x-3">
                <h2 className="m-0 font-display text-[24px] font-normal">{e.title}</h2>
                <span className="text-sm text-muted">
                  {e.grade}학년{e.unit ? ` · ${e.unit}` : ""}
                </span>
              </div>
              <span className="text-[13px] text-sub">
                진행 중 {openN}반 · 마감 {e.classIds.length - openN}반
              </span>
            </div>
            <div className="grid grid-cols-4 gap-3 max-lg:grid-cols-2 max-sm:grid-cols-1">
              {gradeClasses.map((classId) => {
                const deployed = e.classIds.includes(classId);
                const closed = !!e.closedClassIds?.includes(classId);
                const x = stat(classId);
                const isBusy = busy === `${e.id}__${classId}`;
                if (!deployed)
                  return (
                    <button
                      key={classId}
                      type="button"
                      disabled={isBusy}
                      onClick={() => change(e, classId, "open")}
                      className="flex min-h-[120px] cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-line-2 bg-transparent text-sub transition-colors hover:border-leaf-2 hover:text-leaf"
                    >
                      <span className="font-display text-lg">{classLabel(classId)}</span>
                      <span className="text-[13px] font-bold">{isBusy ? "여는 중…" : "+ 이 반에 열기"}</span>
                    </button>
                  );
                const pct = x?.total ? Math.round((x.submitted / x.total) * 100) : 0;
                return (
                  <div key={classId} className={`flex flex-col gap-2 rounded-2xl border px-4 py-3.5 ${closed ? "border-line bg-cream-2" : "border-line bg-paper"}`}>
                    <div className="flex items-center justify-between gap-2">
                      <Link href={`/teacher/class/${classId}?exam=${e.id}`} className="font-display text-lg text-ink no-underline hover:text-leaf">
                        {classLabel(classId)} ›
                      </Link>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${closed ? "bg-line text-sub" : "bg-leaf-bg text-leaf"}`}>{closed ? "마감" : "진행 중"}</span>
                    </div>
                    <span className="h-1.5 overflow-hidden rounded-full bg-leaf-bg" aria-hidden="true">
                      <span className="block h-1.5 rounded-full bg-leaf-2" style={{ width: `${pct}%` }} />
                    </span>
                    <span className="flex flex-wrap gap-x-3 text-xs text-muted">
                      <span>
                        제출 {x?.submitted ?? 0}/{x?.total ?? 0}
                      </span>
                      <span>평균 질문 {x?.avgAcorns ?? 0}</span>
                      {(x?.blocked ?? 0) > 0 && <span className="font-bold text-alert">차단 {x?.blocked}</span>}
                    </span>
                    <div className="flex gap-3 text-[13px]">
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => change(e, classId, closed ? "open" : "close")}
                        className="cursor-pointer border-0 bg-transparent p-0 font-bold text-leaf underline underline-offset-4"
                      >
                        {isBusy ? "바꾸는 중…" : closed ? "다시 열기" : "마감하기"}
                      </button>
                      {!x?.total && e.classIds.length > 1 && (
                        <button type="button" disabled={isBusy} onClick={() => change(e, classId, "remove")} className="cursor-pointer border-0 bg-transparent p-0 text-muted underline underline-offset-4">
                          배포 취소
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
      <span className="text-xs text-muted">마감해도 학생 기록과 채점은 그대로 남아요. 가상 학교·가상 학생 데이터예요.</span>
    </TeacherShell>
  );
}
