"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api, ApiError, shortLabels } from "@/lib/api-client";
import { classLabel, SCHOOL_NAME } from "@/lib/school";
import type { ClassReportResponse, SchoolOverviewResponse } from "@/lib/types";
import { BackLink, card, ErrorBox, Loading } from "../ui";
import { gradeDone } from "@/lib/grading";
import { TeacherGate, TeacherShell } from "./TeacherShell";
import { ClassInsights } from "./ClassInsights";

type Row = ClassReportResponse["students"][number];
type Filter = "all" | "check" | "submitted" | "writing" | "ungraded";

export function ClassView() {
  return (
    <TeacherGate>
      <ClassViewInner />
    </TeacherGate>
  );
}

/** 한 반 · 한 수행평가 리포트: 반 요약 + 학생 목록 */
function ClassViewInner() {
  const { classId } = useParams<{ classId: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const [school, setSchool] = useState<SchoolOverviewResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    api.school().then(setSchool, (e) => setError(e instanceof ApiError ? e.message : "불러오지 못했어요."));
  }, []);
  const classExams = school?.exams.filter((e) => e.classIds.includes(classId)) ?? [];
  const examId = search.get("exam") ?? classExams[0]?.id ?? null;
  const exam = classExams.find((e) => e.id === examId) ?? null;

  // 반·수행평가가 바뀌면 다시 불러옴. key가 다르면 아직 이전 데이터이므로 보여 주지 않음
  const key = `${classId}:${examId}`;
  const [loaded, setLoaded] = useState<{ key: string; data: ClassReportResponse } | null>(null);
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    if (!examId) return;
    let alive = true;
    api.classReport({ classId, examId }).then(
      (r) => alive && setLoaded({ key: `${classId}:${examId}`, data: r }),
      (e) => alive && setError(e instanceof ApiError ? e.message : "불러오지 못했어요."),
    );
    return () => {
      alive = false;
    };
  }, [classId, examId, nonce]);
  const data = loaded?.key === key ? loaded.data : null;
  const load = () => {
    setError(null);
    setNonce((n) => n + 1);
  };

  const list = data?.students ?? [];
  const submitted = list.filter((r) => r.submitted).length;
  const checkN = list.filter((r) => r.flags.length > 0).length;
  const ungradedN = list.filter((r) => r.submitted && !gradeDone(r.grade)).length;
  const shown = list.filter((r) =>
    filter === "all"
      ? true
      : filter === "check"
        ? r.flags.length > 0
        : filter === "submitted"
          ? r.submitted
          : filter === "writing"
            ? !r.submitted
            : r.submitted && !gradeDone(r.grade),
  );
  const tabs: [Filter, string][] = [
    ["all", `전체 ${list.length}`],
    ["check", `먼저 확인 ${checkN}`],
    ["ungraded", `채점 남음 ${ungradedN}`],
    ["submitted", `제출 ${submitted}`],
    ["writing", `작성 중 ${list.length - submitted}`],
  ];
  const checkList = list.filter((r) => r.flags.length > 0);

  return (
    <TeacherShell>
      <BackLink href="/teacher">← {SCHOOL_NAME} 전체</BackLink>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-sm text-muted">
            {classLabel(classId)} · {exam ? `${exam.subject} 수행평가` : "수행평가"}
          </span>
          <h1 className="m-0 font-display text-[34px] font-normal">{exam?.title ?? (school ? "열린 수행평가가 없어요" : "불러오는 중…")}</h1>
        </div>
        {classExams.length > 1 && (
          <div role="tablist" aria-label="수행평가 고르기" className="flex flex-wrap gap-1.5">
            {classExams.map((e) => (
              <button
                key={e.id}
                type="button"
                role="tab"
                aria-selected={e.id === examId}
                onClick={() => router.replace(`/teacher/class/${classId}?exam=${e.id}`)}
                className={`min-h-[38px] cursor-pointer rounded-full px-3.5 text-[13px] ${e.id === examId ? "border-0 bg-brown font-bold text-white" : "border border-line-3 bg-white text-brown-dark"}`}
              >
                {e.subject} · {e.title}
              </button>
            ))}
          </div>
        )}
      </div>
      {error && <ErrorBox>{error}</ErrorBox>}
      {data && data.students.length > 0 && <ClassSummary data={data} />}
      {data && data.students.length > 0 && examId && <ClassInsights classId={classId} examId={examId} />}
      {data && checkList.length > 0 && (
        <section aria-label="먼저 확인할 학생" className={`${card} flex flex-col gap-3 p-6 max-sm:p-4`}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="m-0 font-display text-xl font-normal">먼저 확인할 학생 {checkList.length}명</h2>
            <span className="text-[12px] text-muted">판정이 아니라 먼저 볼 구간이에요. 나머지 학생은 평소처럼 채점하면 돼요.</span>
          </div>
          <ul className="m-0 grid list-none grid-cols-2 gap-2 p-0 max-md:grid-cols-1">
            {checkList.map((r) => (
              <li key={r.attemptId}>
                <Link href={`/teacher/${encodeURIComponent(r.attemptId)}`} className="flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-paper px-4 py-3 text-ink no-underline hover:border-nut">
                  <b className="text-[15px]">{r.name}</b>
                  <span className="text-[12px] text-muted">{r.studentId}</span>
                  <span className="flex flex-1 flex-wrap justify-end gap-1">
                    {r.flags.map((f) => (
                      <span key={f.code} className="rounded-full bg-alert-bg px-2 py-0.5 text-[12px] font-bold text-alert">
                        {f.label}
                      </span>
                    ))}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section aria-label="학생 목록" className={`${card} flex flex-col gap-4 p-6 max-sm:p-4`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div role="tablist" className="flex flex-wrap gap-1.5">
            {tabs.map(([k, label]) => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={filter === k}
                onClick={() => setFilter(k)}
                className={`min-h-[38px] cursor-pointer rounded-full px-3.5 text-[13px] ${filter === k ? "border-0 bg-ink font-bold text-white" : "border border-line-3 bg-white text-brown-dark"}`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex gap-1.5">
            {examId && (
              <a href={api.classCsvUrl(classId, examId)} download className="inline-flex min-h-[38px] items-center rounded-full border-0 bg-ink px-3.5 text-[13px] font-bold text-white no-underline">
                채점표 내려받기 (CSV)
              </a>
            )}
            <button type="button" onClick={() => void load()} className="min-h-[38px] cursor-pointer rounded-full border border-line-3 bg-white px-3.5 text-[13px] text-sub">
              새로고침
            </button>
          </div>
        </div>
        {data === null ? (
          <Loading />
        ) : shown.length === 0 ? (
          <p className="m-0 py-8 text-center text-sm text-muted">
            {list.length === 0 ? "아직 응시한 학생이 없어요. 시연 데이터는 npm run seed:school 로 만들 수 있어요." : "해당하는 학생이 없어요."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-line text-[13px] text-muted">
                  <th className="px-3 py-2.5 font-medium">학번</th>
                  <th className="px-3 py-2.5 font-medium">이름</th>
                  <th className="px-3 py-2.5 font-medium">상태</th>
                  <th className="px-3 py-2.5 font-medium">도토리 (사용 / 목표)</th>
                  <th className="px-3 py-2.5 font-medium">차단</th>
                  <th className="px-3 py-2.5 font-medium">채점</th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {shown.map((r: Row) => {
                  const href = `/teacher/${encodeURIComponent(r.attemptId)}`;
                  return (
                    <tr key={r.attemptId} className="border-b border-dashed border-line last:border-0">
                      <td className="px-3 py-3 text-muted">{r.studentId}</td>
                      <td className="px-3 py-3 font-bold">
                        <Link href={href} className="text-ink no-underline hover:text-brown">
                          {r.name}
                        </Link>
                      </td>
                      <td className="px-3 py-3">
                        <span className={`rounded-full px-2.5 py-1 text-xs ${r.submitted ? "bg-leaf-bg text-leaf" : "bg-cream-2 text-brown"}`}>
                          {r.submitted ? "제출" : "작성 중"}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <span className="font-display text-lg text-brown">{r.totalUsed}</span>
                        <span className="text-muted"> / {r.totalPlanned}</span>
                      </td>
                      <td className={`px-3 py-3 ${r.blockedCount > 0 ? "font-bold text-alert" : "text-muted"}`}>{r.blockedCount}</td>
                      <td className="px-3 py-3">
                        {gradeDone(r.grade) ? (
                          <span className="text-[13px] font-bold text-leaf">{r.grade!.items.join(" · ")}</span>
                        ) : r.grade ? (
                          <span className="text-[13px] text-brown">채점 중</span>
                        ) : (
                          <span className="text-[13px] text-faint">—</span>
                        )}
                        {r.flags.length > 0 && <span className="ml-1.5 inline-block h-2 w-2 rounded-full bg-del align-middle" title={r.flags.map((f) => f.label).join(", ")} />}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <Link href={href} className="text-brown">
                          보기 →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <span className="text-xs text-muted">가상 학생 데이터만 사용해요.</span>
      </section>
    </TeacherShell>
  );
}

/** 반 전체 요약: 숫자 카드 4개 + 항목별 질문(목표 vs 실제) + 질문 방식 분포 */
export function ClassSummary({ data }: { data: ClassReportResponse }) {
  const SHORT_ITEMS = shortLabels(data.exam);
  const n = data.students.length;
  const submitted = data.students.filter((s) => s.submitted).length;
  const totalUsed = data.students.reduce((a, s) => a + s.totalUsed, 0);
  const avg = n ? (totalUsed / n).toFixed(1) : "0";
  const blockedStudents = data.students.filter((s) => s.blockedCount > 0).length;
  const { planned, used } = data.acornsByOutlineItem;
  const itemMax = Math.max(1, ...planned, ...used);
  const busiest = used.indexOf(Math.max(...used));
  const typeTotals = data.matrix.types.map((_, ti) => data.matrix.counts.reduce((a, row) => a + row[ti], 0));
  const typeSum = typeTotals.reduce((a, b) => a + b, 0);

  const stats: [string, string, string?][] = [
    [`${submitted} / ${n}`, "제출"],
    [avg, "평균 도토리"],
    [String(data.blockedTotal), "대신 써 달라는 요청 (차단)", data.blockedTotal > 0 ? "text-alert" : undefined],
    [String(blockedStudents), "차단이 있었던 학생", blockedStudents > 0 ? "text-alert" : undefined],
  ];

  return (
    <section aria-label="반 전체 요약" className="flex flex-col gap-4">
      <div className="grid grid-cols-4 gap-3 max-md:grid-cols-2">
        {stats.map(([v, l, tone]) => (
          <div key={l} className={`${card} flex flex-col gap-1 px-5 py-4`}>
            <span className={`font-display text-[32px] leading-none ${tone ?? "text-brown"}`}>{v}</span>
            <span className="text-[13px] text-muted">{l}</span>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-4">
        <div className={`${card} flex min-w-0 flex-[1_1_420px] flex-col gap-3 p-6`}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="m-0 font-display text-xl font-normal">어디서 질문이 많았나</h2>
            {used[busiest] > 0 && (
              <span className="text-[13px] text-sub">
                가장 많이 물은 항목: <b className="text-brown">{SHORT_ITEMS[busiest]}</b>
              </span>
            )}
          </div>
          {SHORT_ITEMS.map((label, i) => (
            <div key={label} className="flex items-center gap-3 text-sm">
              <span className="w-24 flex-none text-sub">{label}</span>
              <div className="relative h-3.5 flex-1 rounded-full bg-[#F3E6D3]">
                <div className="absolute inset-y-0 left-0 rounded-full border-2 border-dashed border-nut" style={{ width: `${(planned[i] / itemMax) * 100}%` }} />
                <div className={`absolute inset-y-0.5 left-0 rounded-full ${i === busiest && used[i] > 0 ? "bg-brown" : "bg-nut"}`} style={{ width: `${(used[i] / itemMax) * 100}%` }} />
              </div>
              <span className="w-20 flex-none text-right text-xs text-muted">
                {used[i]} / 목표 {planned[i]}
              </span>
            </div>
          ))}
          <span className="text-xs text-muted">채운 막대는 실제 질문, 점선은 학생들이 정한 목표의 합이에요. 수업에서 더 다룰 부분을 찾는 데 써 보세요.</span>
        </div>
        <div className={`${card} flex min-w-0 flex-[1_1_320px] flex-col gap-3 p-6`}>
          <h2 className="m-0 font-display text-xl font-normal">어떤 질문을 했나</h2>
          {typeSum === 0 ? (
            <span className="text-sm text-muted">아직 분류된 질문이 없어요.</span>
          ) : (
            data.matrix.types.map((t, i) => (
              <div key={t} className="flex items-center gap-3 text-sm">
                <span className="w-28 flex-none text-sub">{t}</span>
                <div className="h-3.5 flex-1 rounded-full bg-[#F3E6D3]">
                  <div className={`h-3.5 rounded-full ${t === "대신 작성 요청" ? "bg-alert" : "bg-leaf"}`} style={{ width: `${(typeTotals[i] / typeSum) * 100}%` }} />
                </div>
                <span className="w-10 flex-none text-right text-xs text-muted">{typeTotals[i]}</span>
              </div>
            ))
          )}
          <span className="text-xs text-muted">질문 수가 많거나 목표와 다르다고 부적절한 것은 아니에요. 판정이 아닌 수업 단서예요.</span>
        </div>
      </div>
    </section>
  );
}
