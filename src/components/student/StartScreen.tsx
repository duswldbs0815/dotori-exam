"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, ApiError, rememberSession } from "@/lib/api-client";
import { CLASS_IDS, classLabel, DEFAULT_CLASS_ID, SCHOOL_NAME } from "@/lib/school";
import type { ClassExamsResponse } from "@/lib/types";
import { Acorn } from "../Acorn";
import { Squirrel } from "../Squirrel";
import { Brand, btn, card, ErrorBox, Pill } from "../ui";

type Phase = "intro" | "ready" | "scan" | "fail" | "ok";
const ID_RE = /^[A-Za-z0-9_-]{1,32}$/;

/** ① 시험 시작 + 페이스페이 본인 확인 모의 화면 */
export function StartScreen() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("intro");
  const [studentId, setStudentId] = useState("");
  const [name, setName] = useState("");
  const [fails, setFails] = useState(0);
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
      const res = await api.start({ studentId: id, name: name.trim(), verified: true, examId: examId ?? undefined, classId });
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
        <Link href="/me" className="rounded-full border border-line bg-white px-3.5 py-[7px] text-[13px] font-bold text-brown no-underline">
          내 학습 기록
        </Link>
      </div>
    </header>
  );

  if (phase !== "intro") {
    return (
      <Shell>
        {header}
        <FaceCheck
          phase={phase}
          name={name.trim()}
          fails={fails}
          agreed={agreed}
          busy={busy}
          error={error}
          onAgree={() => setAgreed((a) => !a)}
          onBack={() => setPhase("intro")}
          onScan={() => setPhase("scan")}
          onResult={(ok) => {
            if (ok) setPhase("ok");
            else {
              setFails((f) => f + 1);
              setPhase("fail");
            }
          }}
          onStart={start}
        />
      </Shell>
    );
  }

  return (
    <Shell>
      {header}
      <main className="flex flex-wrap items-stretch gap-7">
        <section className={`${card} flex min-w-0 flex-[999_1_560px] flex-col gap-6 p-10 max-sm:p-6`}>
          <div className="flex flex-col gap-2">
            <span className="text-[15px] font-bold text-brown">
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
                    className={`flex cursor-pointer flex-col items-start gap-1 rounded-2xl border-2 px-4 py-3 text-left transition ${e.id === examId ? "border-brown bg-cream-3" : "border-line bg-white hover:border-line-2"}`}
                  >
                    <span className="text-[12px] font-bold text-brown">{e.subject}</span>
                    <span className="text-[15px] font-bold leading-snug text-ink">{e.title}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <ol className="m-0 grid list-none grid-cols-3 gap-3 p-0 max-sm:grid-cols-1">
            {[
              ["1 개요", "네 칸에 생각 먼저 적기"],
              ["2 글쓰기", "쓰다가 도토리로 질문"],
              ["3 성찰지", "내 질문 돌아보기"],
            ].map(([t, d]) => (
              <li key={t} className="flex flex-col gap-1 rounded-[18px] bg-cream-2 p-4">
                <span className="font-display text-[22px] text-brown">{t}</span>
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
              if (idOk && nameOk && exam) setPhase("ready");
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
                placeholder="예: 가상학생07"
                autoComplete="off"
                className="min-h-12 rounded-2xl border border-line bg-paper px-4 text-[15px]"
              />
            </label>
            {studentId.trim() && !idOk && (
              <p className="m-0 w-full text-[13px] text-alert">학번은 영문·숫자·-·_ 1~32자로 적어 주세요.</p>
            )}

            <div className="flex w-full flex-wrap items-center gap-5 rounded-[22px] border border-dashed border-line-2 px-5 py-[18px]">
              <svg width="72" height="72" viewBox="0 0 104 104" aria-hidden="true">
                <rect x="6" y="6" width="92" height="92" rx="28" fill="#FFF7EC" stroke="#D9C3A5" strokeWidth="2" strokeDasharray="6 6" />
                <circle cx="52" cy="46" r="17" fill="none" stroke="#B48A5E" strokeWidth="2.5" />
                <path d="M26 86c6-14 46-14 52 0" fill="none" stroke="#B48A5E" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
              <div className="flex flex-[1_1_220px] flex-col gap-1.5">
                <span className="flex items-center gap-2 text-[17px] font-bold">
                  본인 확인 <span className="rounded-full bg-cream-2 px-2.5 py-0.5 text-xs text-brown">확인 전</span>
                </span>
                <span className="text-sm text-sub">시험 전에 페이스페이로 응시자 본인을 확인해요.</span>
              </div>
              <button type="submit" disabled={!idOk || !nameOk || !exam} className={`${btn.secondary} border-2 border-brown text-brown`}>
                본인 확인하기
              </button>
            </div>
          </form>
          <span className={btn.disabledBox}>본인 확인 후 시작할 수 있어요</span>
        </section>

        <aside className="flex min-w-0 flex-[1_1_320px] flex-col gap-4">
          <section aria-label="도토리 사용법" className={`${card} flex flex-col gap-4 p-7`}>
            <div className="flex items-center justify-between gap-2">
              <h2 className="m-0 font-display text-2xl font-normal">도토리 사용법</h2>
              <Squirrel size={72} />
            </div>
            <ol className="m-0 flex list-none flex-col gap-3.5 p-0 text-[15px] leading-relaxed">
              {[
                "개요를 쓰면서 항목마다 도토리를 몇 개 쓸지 목표를 정해요.",
                "글을 쓰다 막히는 부분을 드래그해서 질문해요. 질문 하나에 도토리 하나예요.",
                "목표보다 많이 써도 괜찮아요. 계획과 실제는 성찰지에서 다시 봐요.",
                "“대신 써 줘”는 받지 않아요. 도토리도 줄지 않아요.",
              ].map((t, i) => (
                <li key={t} className="flex gap-3">
                  <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-cream-2 font-display text-brown">{i + 1}</span>
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

function FaceCheck(props: {
  phase: Exclude<Phase, "intro">;
  name: string;
  fails: number;
  agreed: boolean;
  busy: boolean;
  error: string | null;
  onAgree: () => void;
  onBack: () => void;
  onScan: () => void;
  onResult: (ok: boolean) => void;
  onStart: () => void;
}) {
  const { phase } = props;
  const ring = phase === "ok" ? "#4CB66B" : phase === "fail" ? "#E05A5A" : phase === "scan" ? "#F6B36F" : "#FFFFFF";
  const stepIdx = phase === "ready" ? 0 : phase === "ok" ? 2 : 1;
  return (
    <main className={`${card} mx-auto mt-3 box-border flex w-full max-w-[1040px] flex-wrap items-center gap-10 p-10 max-sm:p-6`}>
      <div className="relative min-w-0 max-w-[420px] flex-[1_1_340px]">
        <svg viewBox="0 0 400 400" width="100%" role="img" aria-label="카메라 화면 (모의)" className="block rounded-[28px] bg-[#2B2119]">
          <rect width="400" height="400" fill="#2B2119" />
          <circle cx="200" cy="170" r="62" fill="#4A3A2E" />
          <path d="M90 400c10-90 210-90 220 0" fill="#4A3A2E" />
          <ellipse cx="200" cy="185" rx="118" ry="150" fill="none" stroke={ring} strokeWidth="5" strokeDasharray={phase === "ready" ? "8 8" : undefined} />
          {phase === "ok" && (
            <g transform="translate(300 300)">
              <circle r="34" fill="#4CB66B" />
              <path d="M-14 0l9 9 18-18" fill="none" stroke="#FFFFFF" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
            </g>
          )}
          {phase === "fail" && (
            <g transform="translate(300 300)">
              <circle r="34" fill="#E05A5A" />
              <path d="M-11-11l22 22M11-11l-22 22" stroke="#FFFFFF" strokeWidth="6" strokeLinecap="round" />
            </g>
          )}
          <circle cx="28" cy="28" r="7" fill="#E05A5A">
            <animate attributeName="opacity" values="1;.3;1" dur="1.4s" repeatCount="indefinite" />
          </circle>
          <text x="44" y="33" fontSize="14" fill="#FFFFFF" opacity=".8">카메라</text>
        </svg>
        {phase === "scan" && (
          <span aria-hidden="true" className="absolute left-[20%] h-1 w-[60%] rounded bg-[#F6B36F]" style={{ animation: "dotori-scan 2.2s ease-in-out infinite" }} />
        )}
      </div>

      <div className="flex min-w-0 flex-[1_1_340px] flex-col gap-5">
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center gap-2.5">
            <span className="text-sm font-bold text-brown">페이스페이 본인 확인</span>
            <span className="flex gap-1" aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <span key={i} className={`h-2 rounded-full ${i === stepIdx ? "w-7 bg-brown" : i < stepIdx ? "w-2 bg-brown" : "w-2 bg-line-3"}`} />
              ))}
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            <h1 className="m-0 font-display text-4xl font-normal">
              {phase === "ready" && "얼굴을 원 안에 맞춰 주세요"}
              {phase === "scan" && "확인하고 있어요"}
              {phase === "fail" && "얼굴을 확인하지 못했어요"}
              {phase === "ok" && `${props.name} 님, 확인됐어요`}
            </h1>
            {phase === "ok" && <Squirrel size={56} />}
          </div>
        </div>

        {phase === "ready" && (
          <>
            <ul className="m-0 flex list-none flex-col gap-2.5 p-0 text-[15px]">
              <li>· 밝은 곳에서 정면을 봐 주세요</li>
              <li>· 모자와 마스크는 잠깐 벗어 주세요</li>
              <li>· 화면에서 한 뼘 정도 떨어져 주세요</li>
            </ul>
            <div className="flex flex-wrap gap-2.5">
              <button type="button" onClick={props.onBack} className={btn.secondary}>이전</button>
              <button type="button" onClick={props.onScan} className={btn.primary}>인식 시작</button>
            </div>
          </>
        )}

        {phase === "scan" && (
          <>
            <div className="flex flex-col gap-2">
              <div className="h-3 overflow-hidden rounded-md bg-[#F3E6D3]" aria-hidden="true">
                <div className="h-3 rounded-md bg-nut" style={{ animation: "dotori-fill 2.4s linear infinite" }} />
              </div>
              <span className="text-[15px] text-sub">움직이지 말고 화면을 봐 주세요. 2~3초면 끝나요.</span>
            </div>
            <div className="flex flex-col gap-2 rounded-2xl border border-dashed border-line-2 px-4 py-3.5">
              <span className="text-xs text-muted">시연용 결과 선택</span>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => props.onResult(true)} className={`${btn.secondary} min-h-11 border-[#9FD3AE] text-[#23633A]`}>인식 성공</button>
                <button type="button" onClick={() => props.onResult(false)} className={`${btn.secondary} min-h-11 border-[#EBB0B0] text-del`}>인식 실패</button>
              </div>
            </div>
            <button type="button" onClick={props.onBack} className="w-fit cursor-pointer border-0 bg-transparent p-0 text-sm text-brown underline">취소</button>
          </>
        )}

        {phase === "fail" && (
          <>
            <div className="flex flex-col gap-1.5 rounded-2xl bg-alert-bg px-4 py-3.5 text-sm leading-relaxed text-alert">
              <strong>시도 {Math.min(props.fails, 3)}/3</strong>
              <span>조명이 어둡거나 얼굴이 원 밖에 있었어요. 다시 맞춰 볼까요?</span>
            </div>
            <div className="flex flex-wrap gap-2.5">
              <button type="button" onClick={props.onBack} className={btn.secondary}>처음으로</button>
              <button type="button" onClick={props.onScan} className={btn.primary}>다시 시도</button>
            </div>
            <span className="text-[13px] text-muted">3번 모두 실패하면 선생님이 직접 확인한 뒤 시험을 열어 줘요.</span>
          </>
        )}

        {phase === "ok" && (
          <>
            <button
              type="button"
              role="checkbox"
              aria-checked={props.agreed}
              onClick={props.onAgree}
              className={`flex cursor-pointer items-start gap-3 rounded-2xl border-2 bg-leaf-bg px-4 py-3.5 text-left text-leaf ${props.agreed ? "border-leaf" : "border-transparent"}`}
            >
              <span className={`flex h-[22px] w-[22px] flex-none items-center justify-center rounded-md border-2 border-leaf text-sm font-bold text-white ${props.agreed ? "bg-leaf" : "bg-white"}`}>
                {props.agreed ? "✓" : ""}
              </span>
              <span className="text-sm leading-relaxed">질문 내용과 글쓰기 과정이 기록되어 선생님께 전달된다는 것을 확인했어요.</span>
            </button>
            {props.error && <ErrorBox>{props.error}</ErrorBox>}
            {props.agreed ? (
              <button type="button" onClick={props.onStart} disabled={props.busy} className={`${btn.primary} min-h-[60px] text-[22px]`}>
                {props.busy ? "시험지를 여는 중…" : "시험 시작하기"}
              </button>
            ) : (
              <span className={btn.disabledBox}>위 내용을 확인하면 시작할 수 있어요</span>
            )}
          </>
        )}

        <span className="flex items-center gap-1.5 text-xs text-faint">
          <Acorn size={12} ghost /> 해커톤 시연용 페이스페이 모의 화면 · 얼굴 사진은 저장하지 않아요
        </span>
      </div>
    </main>
  );
}
