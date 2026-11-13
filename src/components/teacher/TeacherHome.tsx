"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api-client";
import type { ClassReportResponse } from "@/lib/types";
import { card, ErrorBox, Loading } from "../ui";
import { TeacherLogin, TeacherShell } from "./TeacherShell";

type Row = ClassReportResponse["students"][number];
type Filter = "all" | "submitted" | "writing";

/** 교사 첫 화면: 로그인 확인 → 학생 목록 (반 전체 집계 화면은 P2라 만들지 않음) */
export function TeacherHome() {
  const search = useSearchParams();
  const [auth, setAuth] = useState<"checking" | "in" | "out">("checking");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  const load = useCallback(async () => {
    setError(null);
    try {
      const r = await api.classReport();
      setRows(r.students);
      setAuth("in");
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) setAuth("out");
      else setError(e instanceof ApiError ? e.message : "불러오지 못했어요.");
    }
  }, []);

  useEffect(() => {
    api
      .teacherMe()
      .then((m) => (m.teacher ? load() : setAuth("out")))
      .catch(() => setAuth("out"));
  }, [load]);

  if (auth === "checking" && !error) return <TeacherShell loggedIn={false}><Loading /></TeacherShell>;
  if (auth === "out") return <TeacherLogin failed={search.get("login") === "failed"} onDone={() => void load()} />;

  const list = rows ?? [];
  const submitted = list.filter((r) => r.submitted).length;
  const shown = list.filter((r) => filter === "all" || (filter === "submitted" ? r.submitted : !r.submitted));
  const tabs: [Filter, string][] = [
    ["all", `전체 ${list.length}`],
    ["submitted", `제출 ${submitted}`],
    ["writing", `작성 중 ${list.length - submitted}`],
  ];

  return (
    <TeacherShell>
      <div className="flex flex-col gap-1">
        <span className="text-sm text-muted">국어 수행평가</span>
        <h1 className="m-0 font-display text-[34px] font-normal">「진달래꽃」 감상문 리포트</h1>
      </div>
      {error && <ErrorBox>{error}</ErrorBox>}
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
          <button type="button" onClick={() => void load()} className="min-h-[38px] cursor-pointer rounded-full border border-line-3 bg-white px-3.5 text-[13px] text-sub">
            새로고침
          </button>
        </div>
        {rows === null ? (
          <Loading />
        ) : shown.length === 0 ? (
          <p className="m-0 py-8 text-center text-sm text-muted">
            {list.length === 0 ? "아직 응시한 학생이 없어요. 시연 데이터는 npm run seed:demo 로 만들 수 있어요." : "해당하는 학생이 없어요."}
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
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => {
                  const href = `/teacher/${encodeURIComponent(r.studentId)}`;
                  return (
                    <tr key={r.studentId} className="border-b border-dashed border-line last:border-0">
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
