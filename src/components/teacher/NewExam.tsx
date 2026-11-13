"use client";

import Link from "next/link";
import { useState } from "react";
import { api, ApiError } from "@/lib/api-client";
import { CLASS_IDS, classLabel, GRADES, SCHOOL_NAME, SUBJECTS } from "@/lib/school";
import type { ExamDef, ExamSuggestion } from "@/lib/types";
import { Acorn } from "../Acorn";
import { Squirrel } from "../Squirrel";
import { BackLink, btn, card, ErrorBox } from "../ui";
import { DEFAULT_MAX, DEFAULT_SCALE, GRADE_SCALES } from "@/lib/grading";
import type { GradeScale } from "@/lib/types";
import { TeacherGate, TeacherShell } from "./TeacherShell";

export function NewExam() {
  return (
    <TeacherGate>
      <NewExamInner />
    </TeacherGate>
  );
}

const input = "min-h-12 w-full rounded-2xl border border-line bg-paper px-4 text-[15px]";
const area = "w-full resize-y rounded-2xl border border-line bg-paper px-4 py-3 text-[15px] leading-relaxed";
const label = "text-[13px] font-bold text-sub";

const STEPS = ["과제 정하기", "자료 올리기", "AI 기준 확인", "배포"];

/** 새 수행평가: 과목·과제 → 수업 자료 업로드 → AI가 기준 초안 제안 → 교사가 고쳐서 반에 배포 */
function NewExamInner() {
  const [step, setStep] = useState(0);
  const [subject, setSubject] = useState("국어");
  const [grade, setGrade] = useState(2);
  const [unit, setUnit] = useState("");
  const [task, setTask] = useState("");
  const [notes, setNotes] = useState("");
  const [classIds, setClassIds] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [pasted, setPasted] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<ExamSuggestion | null>(null);
  const [saved, setSaved] = useState<ExamDef | null>(null);
  // 학생 시험지 옆에 보여 줄 지문·자료 (예: 시 전문, 실험 안내)
  const [passageTitle, setPassageTitle] = useState("");
  const [passageBody, setPassageBody] = useState("");
  const [scale, setScale] = useState<GradeScale>(DEFAULT_SCALE);
  const [maxPts, setMaxPts] = useState(DEFAULT_MAX);

  const gradeClasses = CLASS_IDS.filter((c) => c.startsWith(`${grade}-`));
  const step1Ok = task.trim().length > 0 && classIds.length > 0;

  async function suggest() {
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("subject", subject);
      form.set("grade", String(grade));
      form.set("unit", unit);
      form.set("task", task);
      form.set("notes", notes);
      form.set("pasted", pasted);
      files.forEach((f) => form.append("files", f));
      setDraft(await api.suggestExam(form));
      setStep(2);
      window.scrollTo({ top: 0 });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "제안을 받지 못했어요.");
    } finally {
      setBusy(false);
    }
  }

  async function deploy() {
    if (!draft) return;
    setBusy(true);
    setError(null);
    try {
      const { exam } = await api.saveExam({
        title: draft.title,
        subject,
        grade,
        unit,
        task,
        outlineItems: draft.outlineItems,
        shortItems: draft.shortItems,
        itemGuides: draft.itemGuides,
        reflectionQuestions: draft.reflectionQuestions,
        classIds,
        materials: draft.materials,
        rationale: draft.rationale,
        ...(passageBody.trim() ? { passage: { title: passageTitle.trim() || "지문", body: passageBody.trim() } } : {}),
        grading: { scale, ...(scale === "points" ? { max: maxPts } : {}) },
      });
      setSaved(exam);
      setStep(3);
      window.scrollTo({ top: 0 });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "배포하지 못했어요.");
    } finally {
      setBusy(false);
    }
  }

  const setGuide = (i: number, patch: Partial<ExamSuggestion["itemGuides"][number]>) =>
    setDraft((d) => (d ? { ...d, itemGuides: d.itemGuides.map((g, j) => (j === i ? { ...g, ...patch } : g)) } : d));
  const setList = (key: "outlineItems" | "shortItems" | "reflectionQuestions", i: number, v: string) =>
    setDraft((d) => (d ? { ...d, [key]: d[key].map((x, j) => (j === i ? v : x)) } : d));

  return (
    <TeacherShell>
      <BackLink href="/teacher">← {SCHOOL_NAME} 전체</BackLink>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-sm text-muted">새 수행평가</span>
          <h1 className="m-0 font-display text-[34px] font-normal">AI 활용 기준, 초안부터 시작하세요</h1>
        </div>
        <ol aria-label="진행 단계" className="m-0 flex list-none flex-wrap gap-2 p-0">
          {STEPS.map((s, i) => (
            <li
              key={s}
              aria-current={i === step ? "step" : undefined}
              className={`rounded-full px-3.5 py-1.5 text-[13px] ${i === step ? "bg-brown font-bold text-white" : i < step ? "bg-[#F3E6D3] text-sub" : "border border-line bg-white text-muted"}`}
            >
              {i + 1} {s}
            </li>
          ))}
        </ol>
      </div>
      {error && <ErrorBox>{error}</ErrorBox>}

      {step === 0 && (
        <section className={`${card} flex flex-col gap-5 p-8 max-sm:p-5`}>
          <div className="grid grid-cols-[1fr_1fr_2fr] gap-4 max-md:grid-cols-1">
            <label className="flex flex-col gap-1.5">
              <span className={label}>과목</span>
              <select value={subject} onChange={(e) => setSubject(e.target.value)} className={input}>
                {SUBJECTS.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <div className="flex flex-col gap-1.5">
              <span className={label}>학년</span>
              <div className="flex gap-1.5">
                {GRADES.map((g) => (
                  <button
                    key={g}
                    type="button"
                    aria-pressed={grade === g}
                    onClick={() => {
                      setGrade(g);
                      setClassIds([]);
                    }}
                    className={`min-h-12 flex-1 cursor-pointer rounded-2xl text-[15px] ${grade === g ? "border-2 border-brown bg-brown font-bold text-white" : "border border-line bg-paper text-sub"}`}
                  >
                    중{g}
                  </button>
                ))}
              </div>
            </div>
            <label className="flex flex-col gap-1.5">
              <span className={label}>단원 (선택)</span>
              <input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="예: 3. 시의 아름다움" className={input} />
            </label>
          </div>
          <label className="flex flex-col gap-1.5">
            <span className={label}>과제</span>
            <textarea
              rows={3}
              value={task}
              onChange={(e) => setTask(e.target.value)}
              placeholder="예: 김소월의 「진달래꽃」을 읽고 시어와 표현을 근거로 자신의 해석과 비평을 담은 감상문을 쓴다."
              className={area}
            />
          </label>
          <div className="flex flex-col gap-1.5">
            <span className={label}>배포할 반</span>
            <div className="flex flex-wrap gap-2">
              {gradeClasses.map((c) => {
                const on = classIds.includes(c);
                return (
                  <button
                    key={c}
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    onClick={() => setClassIds((ids) => (on ? ids.filter((x) => x !== c) : [...ids, c]))}
                    className={`min-h-11 cursor-pointer rounded-full px-4 text-sm ${on ? "border-2 border-brown bg-cream-2 font-bold text-brown" : "border border-line bg-white text-sub"}`}
                  >
                    {on ? "✓ " : ""}
                    {classLabel(c)}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setClassIds(gradeClasses)}
                className="min-h-11 cursor-pointer rounded-full border border-dashed border-line-2 bg-transparent px-4 text-sm text-sub"
              >
                {grade}학년 전체
              </button>
            </div>
          </div>
          <label className="flex flex-col gap-1.5">
            <span className={label}>AI에게 전할 메모 (선택)</span>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="예: 해석은 반드시 학생 스스로. 배경지식 질문은 많이 허용"
              className={input}
            />
          </label>
          <div className="flex justify-end">
            <button type="button" disabled={!step1Ok} onClick={() => setStep(1)} className={btn.primary}>
              다음: 자료 올리기
            </button>
          </div>
        </section>
      )}

      {step === 1 && (
        <section className={`${card} flex flex-col gap-5 p-8 max-sm:p-5`}>
          <div className="flex flex-col gap-1">
            <h2 className="m-0 font-display text-2xl font-normal">쓰던 자료를 그대로 올려 주세요</h2>
            <p className="m-0 text-sm text-sub">강의자료, 활동지, 수행평가 채점기준표를 AI가 읽고 평가 요소에 맞춰 기준을 제안해요. 자료가 없어도 괜찮아요.</p>
          </div>
          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-[22px] border-2 border-dashed border-line-2 bg-paper px-6 py-8 text-center">
            <Acorn size={32} />
            <span className="font-display text-xl text-brown">파일 고르기</span>
            <span className="text-sm text-muted">PDF · TXT · MD, 한 번에 5개, 모두 합쳐 4MB까지</span>
            <input
              type="file"
              multiple
              accept=".pdf,.txt,.md,.csv,application/pdf,text/plain"
              className="sr-only"
              onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, 5))}
            />
          </label>
          {files.length > 0 && (
            <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
              {files.map((f) => (
                <li key={f.name} className="flex items-center justify-between gap-3 rounded-xl bg-cream-3 px-3.5 py-2 text-sm">
                  <span className="min-w-0 truncate">{f.name}</span>
                  <span className="flex-none text-xs text-muted">{Math.max(1, Math.round(f.size / 1024))}KB</span>
                </li>
              ))}
            </ul>
          )}
          <label className="flex flex-col gap-1.5">
            <span className={label}>또는 내용 붙여 넣기 (한글 파일 내용, 채점기준표 표 등)</span>
            <textarea rows={5} value={pasted} onChange={(e) => setPasted(e.target.value)} className={area} />
          </label>
          <div className="flex flex-wrap justify-between gap-3">
            <button type="button" onClick={() => setStep(0)} className={btn.secondary}>
              이전
            </button>
            <button type="button" disabled={busy} onClick={suggest} className={btn.primary}>
              {busy ? "자료를 읽고 있어요…" : "AI에게 기준 제안받기"}
            </button>
          </div>
          {busy && (
            <div role="status" className="flex items-center gap-3 rounded-2xl bg-cream-3 px-4 py-3 text-sm text-sub">
              <Squirrel size={48} eats={1} />
              과목과 자료를 읽고 개요 항목, 항목별 AI 범위, 권장 도토리를 정리하고 있어요.
            </div>
          )}
        </section>
      )}

      {step === 2 && draft && (
        <div className="flex flex-col gap-4">
          {draft.source === "preset" && (
            <p className="m-0 rounded-2xl bg-cream-2 px-4 py-3 text-sm text-brown">
              지금은 AI 연결이 없어 같은 과목의 예시 기준을 보여 드려요. 아래에서 그대로 고쳐 쓸 수 있어요.
            </p>
          )}
          <section className={`${card} flex flex-col gap-4 p-7 max-sm:p-5`}>
            <label className="flex flex-col gap-1.5">
              <span className={label}>수행평가 제목</span>
              <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} className={`${input} font-bold`} />
            </label>
            <div className="flex gap-3 rounded-2xl bg-leaf-bg px-4 py-3.5">
              <Squirrel size={44} />
              <div className="flex flex-col gap-1">
                <span className="text-sm font-bold text-leaf">AI가 이렇게 제안한 이유</span>
                <span className="text-sm leading-relaxed text-leaf-2">{draft.rationale || "과제와 자료를 바탕으로 정리했어요."}</span>
                {draft.materials.length > 0 && (
                  <span className="text-xs text-leaf-2">읽은 자료: {draft.materials.map((m) => m.name).join(", ")}</span>
                )}
              </div>
            </div>
          </section>

          <section className={`${card} flex flex-col gap-3 p-7 max-sm:p-5`}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="m-0 font-display text-2xl font-normal">개요 항목과 AI 활용 범위</h2>
              <span className="text-sm text-sub">
                권장 도토리 합계 <b className="text-brown">{draft.itemGuides.reduce((a, g) => a + g.acorns, 0)}</b>개
              </span>
            </div>
            {draft.outlineItems.map((item, i) => (
              <div key={i} className="grid grid-cols-[48px_1.1fr_1.4fr_1.4fr_120px] items-start gap-3 rounded-2xl border border-line bg-paper p-3.5 max-lg:grid-cols-1">
                <span className="font-display text-3xl text-nut">{i + 1}</span>
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-muted">항목 이름</span>
                  <input value={item} onChange={(e) => setList("outlineItems", i, e.target.value)} className={`${input} min-h-10 font-bold`} />
                  <input
                    value={draft.shortItems[i]}
                    onChange={(e) => setList("shortItems", i, e.target.value)}
                    aria-label="짧은 이름"
                    className={`${input} min-h-9 text-[13px]`}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-bold text-leaf">AI가 도와도 되는 일</span>
                  <textarea rows={3} value={draft.itemGuides[i].help} onChange={(e) => setGuide(i, { help: e.target.value })} className={`${area} text-sm`} />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-bold text-alert">AI가 하지 않을 일</span>
                  <textarea rows={3} value={draft.itemGuides[i].avoid} onChange={(e) => setGuide(i, { avoid: e.target.value })} className={`${area} text-sm`} />
                </label>
                <div className="flex flex-col items-center gap-1.5">
                  <span className="text-xs text-muted">권장 도토리</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      aria-label="하나 줄이기"
                      onClick={() => setGuide(i, { acorns: Math.max(0, draft.itemGuides[i].acorns - 1) })}
                      className="h-8 w-8 cursor-pointer rounded-full border border-line-2 bg-white text-lg leading-none text-sub"
                    >
                      −
                    </button>
                    <span className="flex min-w-8 items-center justify-center gap-0.5 font-display text-2xl text-brown">{draft.itemGuides[i].acorns}</span>
                    <button
                      type="button"
                      aria-label="하나 늘리기"
                      onClick={() => setGuide(i, { acorns: Math.min(10, draft.itemGuides[i].acorns + 1) })}
                      className="h-8 w-8 cursor-pointer rounded-full border border-line-2 bg-white text-lg leading-none text-sub"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {draft.blockedExamples.length > 0 && (
              <p className="m-0 text-[13px] text-muted">
                차단될 요청 예: {draft.blockedExamples.map((b) => `“${b}”`).join(" · ")} — 도토리는 줄지 않고 기록만 남아요.
              </p>
            )}
          </section>

          <section className={`${card} flex flex-col gap-3 p-7 max-sm:p-5`}>
            <div className="flex flex-col gap-1">
              <h2 className="m-0 font-display text-2xl font-normal">학생에게 보여 줄 지문·자료</h2>
              <span className="text-[13px] text-muted">시 전문, 읽기 자료, 실험 안내처럼 학생이 시험지 옆에 펼쳐 볼 글이에요. AI도 이 글을 참고해 답해요. 비워 두면 과제 설명만 보여요.</span>
            </div>
            <input value={passageTitle} onChange={(e) => setPassageTitle(e.target.value)} placeholder="제목 (예: 진달래꽃 — 김소월)" className={input} />
            <textarea rows={6} value={passageBody} onChange={(e) => setPassageBody(e.target.value)} placeholder="지문을 붙여 넣으세요" className={`${area} text-sm`} />
          </section>

          <section className={`${card} flex flex-col gap-3 p-7 max-sm:p-5`}>
            <div className="flex flex-col gap-1">
              <h2 className="m-0 font-display text-2xl font-normal">채점 단계</h2>
              <span className="text-[13px] text-muted">학생 리포트에서 개요 항목마다 이 단계로 채점해요. 채점하면서 언제든 바꿀 수 있어요.</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {GRADE_SCALES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  aria-pressed={scale === s.id}
                  onClick={() => setScale(s.id)}
                  className={`min-h-10 cursor-pointer rounded-full px-4 text-[14px] font-bold ${scale === s.id ? "border-0 bg-brown text-white" : "border border-line-3 bg-white text-sub"}`}
                >
                  {s.label}
                  {s.levels && s.id !== "pf" && s.id !== "3" ? <span className="ml-1.5 font-normal opacity-70">({s.levels.join("·")})</span> : null}
                </button>
              ))}
              {scale === "points" && (
                <label className="flex items-center gap-1.5 text-[14px] text-muted">
                  항목당
                  <input type="number" min={1} max={1000} value={maxPts} onChange={(e) => setMaxPts(Math.max(1, Math.min(1000, Math.round(Number(e.target.value) || 1))))} className="h-10 w-16 rounded-lg border border-line-2 bg-white px-2 text-right font-bold text-ink" />
                  점
                </label>
              )}
            </div>
          </section>

          <section className={`${card} flex flex-col gap-3 p-7 max-sm:p-5`}>
            <h2 className="m-0 font-display text-2xl font-normal">성찰 질문</h2>
            {draft.reflectionQuestions.map((q, i) => (
              <label key={i} className="flex items-start gap-3">
                <span className="mt-2.5 font-display text-xl text-nut">{i + 1}</span>
                <textarea rows={2} value={q} onChange={(e) => setList("reflectionQuestions", i, e.target.value)} className={`${area} text-sm`} />
              </label>
            ))}
          </section>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <button type="button" onClick={() => setStep(1)} className={btn.secondary}>
              자료 다시 올리기
            </button>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm text-sub">{classIds.map(classLabel).join(", ")}에 배포</span>
              <button type="button" disabled={busy} onClick={deploy} className={btn.primary}>
                {busy ? "배포하는 중…" : "확정하고 배포하기"}
              </button>
            </div>
          </div>
        </div>
      )}

      {step === 3 && saved && (
        <section className={`${card} mx-auto flex w-full max-w-[720px] flex-col items-center gap-4 p-10 text-center`}>
          <Squirrel size={88} eats={1} />
          <h2 className="m-0 font-display text-3xl font-normal">「{saved.title}」 시험지가 열렸어요</h2>
          <p className="m-0 text-sub">{saved.classIds.map(classLabel).join(", ")} 학생들이 시작 화면에서 반을 고르면 바로 볼 수 있어요.</p>
          <div className="flex flex-wrap justify-center gap-2.5">
            <Link href={`/teacher/class/${saved.classIds[0]}?exam=${saved.id}`} className={btn.primary}>
              반 리포트 보기
            </Link>
            <Link href="/start" target="_blank" className={btn.secondary}>
              학생 화면 열기
            </Link>
          </div>
        </section>
      )}
    </TeacherShell>
  );
}
