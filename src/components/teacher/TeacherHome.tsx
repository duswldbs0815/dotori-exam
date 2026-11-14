"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { api, ApiError, shortLabels } from "@/lib/api-client";
import { classLabel } from "@/lib/school";
import { QUESTION_TYPES, type ClassReportResponse, type SchoolOverviewResponse } from "@/lib/types";
import { ErrorBox, Loading } from "../ui";
import { TeacherGate, TeacherShell, useTeacher } from "./TeacherShell";

export const homeCard = "rounded-[24px] border border-line bg-white shadow-[0_1px_2px_rgba(27,24,19,0.04)]";
const leafBtn =
  "inline-flex min-h-[52px] items-center justify-center gap-2 rounded-2xl bg-leaf px-6 text-[17px] font-bold text-white no-underline transition-colors hover:bg-leaf-2";

export function TeacherHome() {
  return (
    <TeacherGate>
      <Home />
    </TeacherGate>
  );
}

const today = () => {
  const d = new Date();
  return `${d.getMonth() + 1}월 ${d.getDate()}일(${"일월화수목금토"[d.getDay()]})`;
};

/** 교사 첫 화면: 수업 전(새 수행평가) · 수업 후(우리 반 과정 요약) */
function Home() {
  const me = useTeacher();
  const [school, setSchool] = useState<SchoolOverviewResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pick, setPick] = useState<string>(""); // "반__수행평가"
  const [loaded, setLoaded] = useState<{ key: string; r: ClassReportResponse | null } | null>(null);

  useEffect(() => {
    api.school().then(
      (s) => {
        setSchool(s);
        // 응시 기록이 가장 많은 반·수행평가를 먼저 보여 줌
        const best = s.classes
          .flatMap((c) => c.exams.map((x) => ({ key: `${c.classId}__${x.examId}`, n: x.total })))
          .sort((a, b) => b.n - a.n)[0];
        if (best) setPick(best.key);
      },
      (e) => setError(e instanceof ApiError ? e.message : "불러오지 못했어요."),
    );
  }, []);

  const [classId, examId] = pick.split("__");
  useEffect(() => {
    if (!classId || !examId) return;
    let alive = true;
    const key = `${classId}__${examId}`;
    api.classReport({ classId, examId }).then(
      (r) => alive && setLoaded({ key, r }),
      () => alive && setLoaded({ key, r: null }),
    );
    return () => {
      alive = false;
    };
  }, [classId, examId]);

  const options = useMemo(
    () =>
      school
        ? school.classes.flatMap((c) =>
            c.exams
              .filter((x) => x.total > 0)
              .map((x) => ({ key: `${c.classId}__${x.examId}`, label: `${classLabel(c.classId)} · ${school.exams.find((e) => e.id === x.examId)?.title ?? ""}` })),
          )
        : [],
    [school],
  );

  if (error) return <TeacherShell><ErrorBox>{error}</ErrorBox></TeacherShell>;
  if (!school) return <TeacherShell><Loading /></TeacherShell>;

  const exam = school.exams.find((e) => e.id === examId);
  const report = loaded?.key === pick ? loaded.r : undefined;
  const subject = me?.subject ?? school.teacher.subject;

  return (
    <TeacherShell>
      <header className="flex flex-col gap-2">
        <h1 className="m-0 flex items-start gap-2 font-display text-[38px] leading-tight font-normal text-leaf max-sm:text-[30px]">
          {me?.name ?? school.teacher.name} 선생님, 안녕하세요
          <Sparkle className="mt-1 text-gold" />
        </h1>
        <p className="m-0 text-[17px] text-sub">오늘 수업에 필요한 것부터 확인하세요.</p>
        <p className="m-0 mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[15px] text-ink">
          <span className="inline-flex items-center gap-1.5">
            <CalendarIcon /> 중학교 {subject}
            {exam ? ` · ${exam.title}` : ""}
          </span>
          <span aria-hidden="true" className="text-line-2">|</span>
          <span>오늘 {today()}</span>
        </p>
      </header>

      <div className="grid grid-cols-[minmax(0,5fr)_minmax(0,8fr)] gap-5 max-lg:grid-cols-1">
        {/* 수업 전 */}
        <section className={`${homeCard} flex flex-col gap-5 p-7 max-sm:p-5`}>
          <div className="flex items-center gap-3">
            <ClipBig />
            <Tag>수업 전</Tag>
          </div>
          <h2 className="m-0 flex items-start gap-1.5 font-display text-[28px] leading-tight font-normal">
            새 수행평가 만들기 <Sparkle className="text-gold" />
          </h2>
          <p className="m-0 text-[16px] leading-relaxed text-sub">과제와 자료를 넣으면 AI가 활용 기준을 제안해요.</p>
          <div className="flex items-start gap-2.5 rounded-2xl bg-leaf-bg px-4 py-4 text-[15px] font-bold leading-snug text-ink">
            <SparkIcon /> AI 제안은 선생님이 검토하고 확정합니다.
          </div>
          <Link href="/teacher/new" className={`${leafBtn} mt-auto`}>
            <span aria-hidden="true" className="text-xl leading-none">+</span> 수행평가 만들기
          </Link>
          <span className="text-center text-[13px] text-muted">
            {subject} 수행평가 {school.exams.length}개 진행 중 ·{" "}
            <Link href="/teacher/exams" className="text-sub">
              목록 보기
            </Link>
          </span>
        </section>

        {/* 수업 후 */}
        <section className={`${homeCard} flex flex-col gap-4 p-7 max-sm:p-5`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-3">
                <BookBig />
                <Tag>수업 후</Tag>
              </div>
              <h2 className="m-0 font-display text-[28px] leading-tight font-normal">우리 반 과정 요약</h2>
              <span className="text-[14px] text-muted">
                중학교 {subject}
                {exam ? ` · ${exam.title}` : ""}
              </span>
            </div>
            {options.length > 0 && (
              <label className="flex items-center gap-1.5 rounded-full bg-leaf-bg px-3 py-1.5 text-[13px] font-bold text-leaf">
                <SparkIcon small />
                <span className="sr-only">반 고르기</span>
                <select value={pick} onChange={(e) => setPick(e.target.value)} className="max-w-[220px] cursor-pointer border-0 bg-transparent font-bold text-leaf outline-none">
                  {options.map((o) => (
                    <option key={o.key} value={o.key}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>

          {options.length === 0 ? (
            <p className="m-0 rounded-2xl bg-cream-2 px-4 py-6 text-center text-[15px] text-sub">아직 응시한 학생이 없어요. 수업이 끝나면 여기에 반 요약이 생겨요.</p>
          ) : report === undefined ? (
            <Loading label="반 기록을 모으는 중" />
          ) : !report ? (
            <ErrorBox>반 기록을 불러오지 못했어요.</ErrorBox>
          ) : (
            <Summary report={report} />
          )}

          <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3.5">
            <span className="inline-flex items-center gap-1.5 text-[13px] text-sub">
              <InfoIcon /> 기록 요약 · 최종 판단은 교사
            </span>
            {classId && examId && (
              <Link href={`/teacher/class/${classId}?exam=${examId}`} className="text-[15px] font-bold text-ink underline underline-offset-4">
                학생별 기록 펼쳐 보기 <span aria-hidden="true">›</span>
              </Link>
            )}
          </div>
        </section>
      </div>
    </TeacherShell>
  );
}

/** 반 기록에서 바로 뽑는 요약 (AI 호출 없음). AI가 묶은 "다음 수업 단서"는 반 화면에 있음 */
function Summary({ report }: { report: ClassReportResponse }) {
  const labels = shortLabels(report.exam);
  const used = report.acornsByOutlineItem.used;
  const top = used.indexOf(Math.max(...used));
  const typeTotals = QUESTION_TYPES.map((_, ti) => report.matrix.counts.reduce((a, row) => a + (row[ti] ?? 0), 0));
  const topTypes = QUESTION_TYPES.map((t, i) => ({ t: t.replace(/ 요청$/, ""), n: typeTotals[i] }))
    .filter((x) => x.n > 0 && x.t !== "대신 작성")
    .sort((a, b) => b.n - a.n)
    .slice(0, 2);
  const flagged = report.students.filter((s) => s.flags.length > 0).length;
  const submitted = report.students.filter((s) => s.submitted).length;
  const totalQ = used.reduce((a, b) => a + b, 0);

  const rows: { icon: React.ReactNode; label: string; text: string }[] = [
    {
      icon: <QIcon />,
      label: "함께 막힌 부분",
      text: totalQ ? `「${labels[top]}」 항목에 질문이 가장 많았어요 (${used[top]}개)` : "아직 질문이 없어요",
    },
    {
      icon: <LaptopIcon />,
      label: "학생들이 활용한 도움",
      text: topTypes.length ? `${topTypes.map((x) => x.t).join(" · ")} 질문이 많았어요` : "아직 질문이 없어요",
    },
    {
      icon: <GearIcon />,
      label: "교사가 확인할 부분",
      text: `먼저 확인할 학생 ${flagged}명 · 대신 써 달라는 요청 ${report.blockedTotal}번 · 제출 ${submitted}/${report.students.length}`,
    },
  ];
  return (
    <div className="flex flex-col gap-2.5">
      {rows.map((r) => (
        <div key={r.label} className="grid grid-cols-[28px_150px_1fr] items-center gap-3 rounded-2xl border border-line px-4 py-3 max-sm:grid-cols-[28px_1fr]">
          <span className="text-sub">{r.icon}</span>
          <span className="border-line font-bold sm:border-r">{r.label}</span>
          <span className="text-[15px] text-sub max-sm:col-span-2">{r.text}</span>
        </div>
      ))}
      <div className="grid grid-cols-[28px_150px_1fr] items-center gap-3 rounded-2xl bg-leaf-bg px-4 py-3.5 max-sm:grid-cols-[28px_1fr]">
        <SproutIcon />
        <span className="border-leaf/20 font-bold sm:border-r">다음 수업 제안</span>
        <span className="text-[15px] text-ink max-sm:col-span-2">
          {totalQ ? `「${labels[top]}」에서 학생마다 다르게 쓴 근거를 함께 비교해 보세요.` : "학생들이 질문을 시작하면 제안이 생겨요."}
        </span>
      </div>
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-leaf-bg px-3 py-1 text-[13px] font-bold text-leaf">{children}</span>;
}

function Sparkle({ className = "" }: { className?: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M8 3v4M3.5 8.5l3 2M14 4l-2 3.5" />
    </svg>
  );
}
function SparkIcon({ small }: { small?: boolean }) {
  const s = small ? 14 : 18;
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" aria-hidden="true" className="mt-0.5 shrink-0 text-gold" fill="currentColor">
      <path d="M10 2.5 12 9l6.5 2-6.5 2-2 6.5L8 13l-6.5-2L8 9Zm9 11 .9 2.6 2.6.9-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9Z" />
    </svg>
  );
}
const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
function CalendarIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" {...stroke}>
      <rect x="3.5" y="5" width="17" height="15" rx="2" />
      <path d="M3.5 9.5h17M8 3v4M16 3v4M8 13h2M14 13h2M8 16.5h2" />
    </svg>
  );
}
function ClipBig() {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true" className="text-ink" {...stroke}>
      <rect x="8" y="7" width="22" height="28" rx="3" />
      <path d="M14 5h10v5H14zM13 17h12M13 22h12M13 27h7" />
      <path d="m29 24 6-6 2 2-6 6-3 1z" className="text-gold" stroke="currentColor" />
    </svg>
  );
}
function BookBig() {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true" className="text-ink" {...stroke}>
      <path d="M20 10c-3-2.5-8.5-3-14-2v22c5.5-1 11-.5 14 2 3-2.5 8.5-3 14-2V8c-5.5-1-11-.5-14 2ZM20 10v22M10 14h6M10 18h6M24 14h6M24 18h6" />
    </svg>
  );
}
function QIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" {...stroke}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.6v.4M12 17h.01" />
    </svg>
  );
}
function LaptopIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" {...stroke}>
      <rect x="4.5" y="5" width="15" height="10.5" rx="1.5" />
      <path d="M2.5 19h19" />
    </svg>
  );
}
function GearIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" {...stroke}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" />
    </svg>
  );
}
function SproutIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" className="text-leaf" {...stroke}>
      <path d="M12 21v-9M12 12C12 7.5 8.5 5 4 5c0 4.5 3.5 7 8 7ZM12 14c0-3.5 3-6 7.5-6 0 3.5-3 6-7.5 6Z" />
    </svg>
  );
}
function InfoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" {...stroke}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6M12 7.5h.01" />
    </svg>
  );
}
