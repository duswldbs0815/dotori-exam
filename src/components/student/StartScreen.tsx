"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, ApiError, rememberSession } from "@/lib/api-client";
import { CLASS_IDS, classLabel, DEFAULT_CLASS_ID, SCHOOL_NAME } from "@/lib/school";
import type { ClassExamsResponse } from "@/lib/types";
import { Squirrel } from "../Squirrel";
import { Brand, btn, card, ErrorBox, Pill } from "../ui";

const ID_RE = /^[A-Za-z0-9_-]{1,32}$/;

/** ① 시험 시작: 학번·이름 + 기록 안내 동의 */
export function StartScreen() {
  const router = useRouter();
  const [studentId, setStudentId] = useState("");
  const [name, setName] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [classId, setClassId] = useState(DEFAULT_CLASS_ID);
  const [exams, setExams] = useState<ClassExamsResponse["exams"] | null>(null);
  const [examId, setExamId] = useState<string | null>(null);

  // 우리 반에 열린 수행평가 불러오기
  useEffect(() => {
    let alive = true;
    api.classExams(classId).then(
      (r) => {
        if (!alive) return;
        setExams(r.exams);
        setExamId(r.exams[0]?.id ?? null);
      },
      () => alive && setExams([]),
    );
    return () => {
      alive = false;
    };
  }, [classId]);
  const exam = exams?.find((e) => e.id === examId) ?? null;

  const idOk = ID_RE.test(studentId.trim());
  const nameOk = name.trim().length > 0;
  const who = nameOk ? `${name.trim()}${studentId.trim() ? ` · ${studentId.trim()}` : ""}` : null;

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const id = studentId.trim();
      const res = await api.start({ studentId: id, name: name.trim(), examId: examId ?? undefined, classId });
      rememberSession(res.attemptId, { name: name.trim(), exam: res.exam });
      router.push(`/exam/${encodeURIComponent(res.attemptId)}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "시험을 시작하지 못했어요.");
      setBusy(false);
    }
  }

  const header = (
    <header className="flex flex-wrap items-center justify-between gap-4">
      <Link href="/" className="no-underline" aria-label="도토리 시험지 소개로">
        <Brand />
      </Link>
      <div className="flex items-center gap-2">
        {who && <Pill>{who}</Pill>}
        <Link href="/me" className="rounded-full border border-line bg-white px-3.5 py-[7px] text-[13px] font-bold text-leaf no-underline">
          내 학습 기록
        </Link>
      </div>
    </header>
  );

  return (
    <Shell>
      {header}
      <main className="flex flex-wrap items-stretch gap-7">
        <section className={`${card} flex min-w-0 flex-[999_1_560px] flex-col gap-6 p-10 max-sm:p-6`}>
          <div className="flex flex-col gap-2">
            <span className="text-[15px] font-bold text-leaf">
              {SCHOOL_NAME} · {classLabel(classId)} · 오늘의 수행평가{exam ? ` · ${exam.subject}` : ""}
            </span>
            <h1 className="m-0 font-display text-5xl font-normal leading-tight max-sm:text-4xl">
              {exams === null ? "수행평가를 불러오는 중…" : exam ? exam.title : "이 반에 열린 수행평가가 없어요"}
            </h1>
          </div>
          <div className="flex flex-wrap gap-3">
            <label className="flex min-w-0 flex-[0_1_200px] flex-col gap-1.5">
              <span className="text-[13px] font-bold text-sub">우리 반</span>
              <select
                value={classId}
                onChange={(e) => setClassId(e.target.value)}
                className="min-h-12 rounded-2xl border border-line bg-paper px-4 text-[15px]"
              >
                {CLASS_IDS.map((c) => (
                  <option key={c} value={c}>
                    {classLabel(c)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {exams && exams.length > 1 && (
            <div className="flex flex-col gap-2" role="radiogroup" aria-label="오늘 볼 수행평가">
              <span className="text-[13px] font-bold text-sub">우리 반에 열린 수행평가 {exams.length}개 · 하나를 골라요</span>
              <div className="grid grid-cols-2 gap-2.5 max-sm:grid-cols-1">
                {exams.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    role="radio"
                    aria-checked={e.id === examId}
                    onClick={() => setExamId(e.id)}
                    className={`flex cursor-pointer flex-col items-start gap-1 rounded-2xl border-2 px-4 py-3 text-left transition ${e.id === examId ? "border-leaf bg-cream-3" : "border-line bg-white hover:border-line-2"}`}
                  >
                    <span className="text-[12px] font-bold text-leaf">{e.subject}</span>
                    <span className="text-[15px] font-bold leading-snug text-ink">{e.title}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <ol className="m-0 grid list-none grid-cols-2 gap-3 p-0 max-sm:grid-cols-1">
            {[
              ["수행평가", "과제·지문을 보며 바로 내 글 쓰기"],
              ["AI 질문", "막히면 문장을 드래그해서 질문"],
            ].map(([t, d]) => (
              <li key={t} className="flex flex-col gap-1 rounded-[18px] bg-cream-2 p-4">
                <span className="font-display text-[22px] text-leaf">{t}</span>
                <span className="text-sm text-sub">{d}</span>
              </li>
            ))}
          </ol>
          <div className="flex items-start gap-3.5 rounded-[18px] bg-leaf-bg px-5 py-[18px]">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3E6B2E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
              <rect x="5" y="11" width="14" height="10" rx="2" />
              <path d="M8 11V7a4 4 0 0 1 8 0v4" />
            </svg>
            <div className="flex flex-col gap-1">
              <p className="m-0 text-base font-bold text-leaf">질문과 글쓰기 과정은 기록되어 선생님께만 전달됩니다.</p>
              <p className="m-0 text-sm text-leaf-2">AI에게 편하게 물어봐도 돼요. 단, 글을 대신 써 달라는 요청은 받지 않아요.</p>
            </div>
          </div>

          <form
            className="flex flex-wrap gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (idOk && nameOk && exam && agreed && !busy) void start();
            }}
          >
            <label className="flex min-w-0 flex-[1_1_180px] flex-col gap-1.5">
              <span className="text-[13px] font-bold text-sub">학번</span>
              <input
                value={studentId}
                onChange={(e) => {
                  const v = e.target.value;
                  setStudentId(v);
                  // 학번 5자리(학년 1 + 반 2 + 번호 2)면 반을 자동으로 맞춤
                  const m = v.trim().match(/^([1-3])(\d{2})\d{2}$/);
                  const cls = m ? `${m[1]}-${Number(m[2])}` : null;
                  if (cls && CLASS_IDS.includes(cls) && cls !== classId) setClassId(cls);
                }}
                placeholder="예: 20307 (2학년 3반 7번)"
                autoComplete="off"
                className="min-h-12 rounded-2xl border border-line bg-paper px-4 text-[15px]"
              />
            </label>
            <label className="flex min-w-0 flex-[1_1_180px] flex-col gap-1.5">
              <span className="text-[13px] font-bold text-sub">이름</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="예: 김서진"
                autoComplete="off"
                className="min-h-12 rounded-2xl border border-line bg-paper px-4 text-[15px]"
              />
            </label>
            {studentId.trim() && !idOk && (
              <p className="m-0 w-full text-[13px] text-alert">학번은 영문·숫자·-·_ 1~32자로 적어 주세요.</p>
            )}

            <button
              type="button"
              role="checkbox"
              aria-checked={agreed}
              onClick={() => setAgreed((v) => !v)}
              className={`flex w-full cursor-pointer items-start gap-3 rounded-2xl border-2 bg-leaf-bg px-4 py-3.5 text-left text-leaf ${agreed ? "border-leaf" : "border-transparent"}`}
            >
              <span className={`flex h-[22px] w-[22px] flex-none items-center justify-center rounded-md border-2 border-leaf text-sm font-bold text-white ${agreed ? "bg-leaf" : "bg-white"}`}>
                {agreed ? "✓" : ""}
              </span>
              <span className="text-sm leading-relaxed">질문 내용과 글쓰기 과정이 기록되어 선생님께 전달된다는 것을 확인했어요.</span>
            </button>
            {error && (
              <div className="w-full">
                <ErrorBox>{error}</ErrorBox>
              </div>
            )}
            {idOk && nameOk && exam && agreed ? (
              <button type="submit" disabled={busy} className={`${btn.primary} min-h-[60px] w-full text-[22px]`}>
                {busy ? "시험지를 여는 중…" : "시험 시작하기"}
              </button>
            ) : (
              <span className={`${btn.disabledBox} w-full`}>
                {!idOk || !nameOk ? "학번과 이름을 적으면 시작할 수 있어요" : !exam ? "열린 수행평가가 없어요" : "위 내용을 확인하면 시작할 수 있어요"}
              </span>
            )}
          </form>
        </section>

        <aside className="flex min-w-0 flex-[1_1_320px] flex-col gap-4">
          <section aria-label="도토리 사용법" className={`${card} flex flex-col gap-4 p-7`}>
            <div className="flex items-center justify-between gap-2">
              <h2 className="m-0 font-display text-2xl font-normal">도토리 사용법</h2>
              <Squirrel size={72} />
            </div>
            <ol className="m-0 flex list-none flex-col gap-3.5 p-0 text-[15px] leading-relaxed">
              {[
                "글을 쓰다 막히는 부분을 드래그해서 AI 질문 탭에서 물어봐요.",
                "AI는 답을 대신 써 주지 않고, 뜻·근거·방향을 알려 줘요.",
                "질문할 때마다 다람쥐가 도토리를 먹어요. 다 쓰면 제출!",
                "“대신 써 줘”는 받지 않아요. 도토리도 줄지 않아요.",
              ].map((t, i) => (
                <li key={t} className="flex gap-3">
                  <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-cream-2 font-display text-leaf">{i + 1}</span>
                  <span>{t}</span>
                </li>
              ))}
            </ol>
          </section>
          <p className="m-0 px-2 text-xs text-muted">시연용 서비스예요. 실제 학생 정보 대신 가상 학생 정보를 써 주세요.</p>
        </aside>
      </main>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen w-full bg-cream px-8 pt-6 pb-12 max-sm:px-4">
      <div className="mx-auto flex max-w-[1280px] flex-col gap-[22px]">{children}</div>
    </div>
  );
}
