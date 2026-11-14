"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api, ApiError, shortLabels } from "@/lib/api-client";
import { classLabel } from "@/lib/school";
import type { ClassReportResponse, SchoolOverviewResponse } from "@/lib/types";
import { BackLink, card, ErrorBox, Loading } from "../ui";
import { gradeDone } from "@/lib/grading";
import { TeacherGate, TeacherShell } from "./TeacherShell";
import { ClassInsights } from "./ClassInsights";
import { DeleteRecords } from "./DeleteRecords";

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

  // 🔄 11/14 AI 1차 채점 (반 전체): 제출한 학생 중 제안이 없는 학생만 하나씩 요청
  const [aiRun, setAiRun] = useState<{ done: number; total: number } | null>(null);
  const [aiMsg, setAiMsg] = useState<string | null>(null);
  const runAi = async () => {
    const todo = (data?.students ?? []).filter((r) => r.submitted && !r.aiGraded);
    if (!todo.length) return;
    setAiMsg(null);
    let fail = 0;
    for (let i = 0; i < todo.length; i++) {
      setAiRun({ done: i, total: todo.length });
      await api.aiGrade(todo[i].attemptId).catch(() => fail++);
    }
    setAiRun(null);
    setAiMsg(fail ? `${todo.length - fail}명 완료, ${fail}명은 받지 못했어요. 다시 눌러 주세요.` : `${todo.length}명 AI 1차 채점 완료. 학생마다 제안을 확인해 주세요.`);
    load();
  };
  const acceptAi = async () => {
    if (!examId) return;
    const ok = window.confirm(
      "확인할 점이 없는 학생은 AI 제안을 그대로 선생님 채점으로 확정해요.\n" +
        "확인할 점이 있는 학생과 이미 채점한 학생은 건너뛰니 직접 확인해 주세요.\n" +
        "확정한 점수의 책임은 선생님께 있어요. 언제든 학생 리포트에서 고칠 수 있어요. 확정할까요?",
    );
    if (!ok) return;
    try {
      const r = await api.acceptAi({ classId, examId });
      setAiMsg(`${r.accepted.length}명 확정 · 직접 확인할 학생 ${r.skipped.flagged}명 · 이미 채점 ${r.skipped.graded}명${r.skipped.noAi ? ` · AI 제안 없음 ${r.skipped.noAi}명` : ""}`);
      load();
    } catch (e) {
      setAiMsg(e instanceof ApiError ? e.message : "확정하지 못했어요.");
    }
  };

  const list = data?.students ?? [];
  const recTotal = (data?.exam?.itemGuides ?? []).reduce((a, g) => a + g.acorns, 0) ?? 0; // 선생님 권장 질문 수 합
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
      <BackLink href="/teacher/exams">← 수행평가 목록</BackLink>
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
                className={`min-h-[38px] cursor-pointer rounded-full px-3.5 text-[13px] ${e.id === examId ? "border-0 bg-leaf font-bold text-white" : "border border-line-3 bg-white text-brown-dark"}`}
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
        {data !== null && examId && list.some((r) => r.submitted) && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-leaf/25 bg-leaf-bg/50 px-4 py-3 text-[13px]">
            <span className="mr-auto flex flex-col gap-0.5">
              <b className="text-ink">AI 1차 채점 → 선생님 확정</b>
              <span className="text-muted">
                AI는 채점 기준만 보고 제안해요 (제안 {list.filter((r) => r.aiGraded).length} / 제출 {list.filter((r) => r.submitted).length}). 확인할 점(●)이 있는 학생은 과정을 보고 직접 정해 주세요.
              </span>
            </span>
            <button
              type="button"
              disabled={!!aiRun || !list.some((r) => r.submitted && !r.aiGraded)}
              onClick={() => void runAi()}
              className="min-h-[38px] cursor-pointer rounded-full border-0 bg-leaf px-3.5 text-[13px] font-bold text-white disabled:cursor-default disabled:opacity-50"
            >
              {aiRun ? `AI 채점 중 ${aiRun.done} / ${aiRun.total}` : "제출한 학생 AI 1차 채점"}
            </button>
            <button
              type="button"
              disabled={!!aiRun || !list.some((r) => r.aiGraded && !r.grade && r.flags.length === 0)}
              onClick={() => void acceptAi()}
              className="min-h-[38px] cursor-pointer rounded-full border border-leaf bg-white px-3.5 text-[13px] font-bold text-leaf disabled:cursor-default disabled:opacity-50"
            >
              확인할 점 없는 학생 확정
            </button>
            {aiMsg && <span className="w-full font-bold text-sub">{aiMsg}</span>}
          </div>
        )}
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
                  <th className="px-3 py-2.5 font-medium">질문 (실제 / 권장)</th>
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
                        <Link href={href} className="text-ink no-underline hover:text-leaf">
                          {r.name}
                        </Link>
                      </td>
                      <td className="px-3 py-3">
                        <span className={`rounded-full px-2.5 py-1 text-xs ${r.submitted ? "bg-leaf-bg text-leaf" : "bg-cream-2 text-leaf"}`}>
                          {r.submitted ? "제출" : "작성 중"}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <span className="font-display text-lg text-leaf">{r.totalUsed}</span>
                        <span className="text-muted"> / {recTotal}</span>
                      </td>
                      <td className={`px-3 py-3 ${r.blockedCount > 0 ? "font-bold text-alert" : "text-muted"}`}>{r.blockedCount}</td>
                      <td className="px-3 py-3">
                        {gradeDone(r.grade) ? (
                          <span className="text-[13px] font-bold text-leaf">{r.grade!.items.join(" · ")}</span>
                        ) : r.grade ? (
                          <span className="text-[13px] text-leaf">채점 중</span>
                        ) : r.aiGraded ? (
                          <span className="rounded-full bg-cream-2 px-2 py-0.5 text-[12px] text-sub">AI 제안 · 확인 전</span>
                        ) : (
                          <span className="text-[13px] text-faint">—</span>
                        )}
                        {r.flags.length > 0 && <span className="ml-1.5 inline-block h-2 w-2 rounded-full bg-del align-middle" title={r.flags.map((f) => f.label).join(", ")} />}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <Link href={href} className="text-leaf">
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
      {data && examId && <DeleteRecords classId={classId} examId={examId} examTitle={exam?.title ?? ""} count={list.length} onDone={load} />}
    </TeacherShell>
  );
}

/** 반 전체 요약: 숫자 카드 4개 + 항목별 질문(학생당 평균 vs 선생님 권장) + 질문 방식 분포 */
export function ClassSummary({ data }: { data: ClassReportResponse }) {
  const SHORT_ITEMS = shortLabels(data.exam);
  const n = data.students.length;
  const submitted = data.students.filter((s) => s.submitted).length;
  const totalUsed = data.students.reduce((a, s) => a + s.totalUsed, 0);
  const avg = n ? (totalUsed / n).toFixed(1) : "0";
  const blockedStudents = data.students.filter((s) => s.blockedCount > 0).length;
  const { planned, used } = data.acornsByOutlineItem;
  const itemMax = Math.max(1, ...planned, ...used);
  // 🔄 11/14 학생 계획 대신 선생님 권장 질문 수와 비교 (학생당 평균 vs 권장)
  const rec = (i: number) => data.exam?.itemGuides?.[i]?.acorns ?? 0;
  const avgOf = (i: number) => (n ? used[i] / n : 0);
  const avgMax = Math.max(1, ...SHORT_ITEMS.map((_, i) => Math.max(avgOf(i), rec(i))));
  void planned;
  void itemMax;
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
            <span className={`font-display text-[32px] leading-none ${tone ?? "text-leaf"}`}>{v}</span>
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
                가장 많이 물은 항목: <b className="text-leaf">{SHORT_ITEMS[busiest]}</b>
              </span>
            )}
          </div>
          {SHORT_ITEMS.map((label, i) => (
            <div key={label} className="flex items-center gap-3 text-sm">
              <span className="w-24 flex-none text-sub">{label}</span>
              <div className="relative h-3.5 flex-1 rounded-full bg-leaf-bg">
                <div className="absolute inset-y-0 left-0 rounded-full border-2 border-dashed border-nut" style={{ width: `${(rec(i) / avgMax) * 100}%` }} />
                <div className={`absolute inset-y-0.5 left-0 rounded-full ${i === busiest && used[i] > 0 ? "bg-leaf" : "bg-nut"}`} style={{ width: `${(avgOf(i) / avgMax) * 100}%` }} />
              </div>
              <span className="w-28 flex-none text-right text-xs text-muted">
                평균 {avgOf(i).toFixed(1)} / 권장 {rec(i)}
              </span>
            </div>
          ))}
          <span className="text-xs text-muted">채운 막대는 학생당 평균 질문, 점선은 선생님이 정한 권장 수예요. 수업에서 더 다룰 부분을 찾는 데 써 보세요.</span>
        </div>
        <div className={`${card} flex min-w-0 flex-[1_1_320px] flex-col gap-3 p-6`}>
          <h2 className="m-0 font-display text-xl font-normal">어떤 질문을 했나</h2>
          {typeSum === 0 ? (
            <span className="text-sm text-muted">아직 분류된 질문이 없어요.</span>
          ) : (
            data.matrix.types.map((t, i) => (
              <div key={t} className="flex items-center gap-3 text-sm">
                <span className="w-28 flex-none text-sub">{t}</span>
                <div className="h-3.5 flex-1 rounded-full bg-leaf-bg">
                  <div className={`h-3.5 rounded-full ${t === "대신 작성 요청" ? "bg-alert" : "bg-leaf"}`} style={{ width: `${(typeTotals[i] / typeSum) * 100}%` }} />
                </div>
                <span className="w-10 flex-none text-right text-xs text-muted">{typeTotals[i]}</span>
              </div>
            ))
          )}
          <span className="text-xs text-muted">질문 수가 많거나 권장과 다르다고 부적절한 것은 아니에요. 판정이 아닌 수업 단서예요.</span>
        </div>
      </div>
    </section>
  );
}
