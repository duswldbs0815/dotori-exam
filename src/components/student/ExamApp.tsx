"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError, recallSession } from "@/lib/api-client";
import type { AttemptStateResponse, ExamInfo, PerItem, StudentQuestion } from "@/lib/types";
import { Brand, btn, card, ErrorBox, Loading, Pill, StepNav, type StepKey } from "../ui";
import { DoneStep } from "./DoneStep";
import { OutlineStep } from "./OutlineStep";
import { ReflectStep } from "./ReflectStep";
import { WriteStep } from "./WriteStep";

type Step = StepKey | "done";
export type SaveState = { at: string | null; saving: boolean; error: string | null };
export type DoneInfo = { submittedAt: string | null; chars: number; reflectionCount: number | null };

/** 학생 시험지: 개요 → 글쓰기 → 성찰지 → 제출 완료 */
export function ExamApp() {
  const params = useParams<{ attemptId: string }>();
  const attemptId = decodeURIComponent(params.attemptId);

  const [exam, setExam] = useState<ExamInfo | null>(null);
  const [state, setState] = useState<AttemptStateResponse | null>(null);
  const [loadError, setLoadError] = useState<{ status: number; message: string } | null>(null);
  const [step, setStep] = useState<Step>("outline");
  const [draft, setDraft] = useState("");
  const [save, setSave] = useState<SaveState>({ at: null, saving: false, error: null });
  const [done, setDone] = useState<DoneInfo | null>(null);
  const savedText = useRef("");

  const [name, setName] = useState(attemptId);

  // 처음 불러오기: 시작 화면이 이 탭에 남긴 시험 설정 + 응시 상태(학생 열쇠 쿠키 필요)
  // exam/start는 다시 부르지 않음 — 부르면 학생 열쇠가 새로 바뀜
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const session = recallSession(attemptId);
        if (!session) throw new ApiError(403, "처음 화면에서 시험을 다시 시작해 주세요.");
        const st = await api.attempt(attemptId);
        if (!alive) return;
        setName(session.name);
        setState(st);
        setExam(session.exam);
        setDraft(st.draft);
        savedText.current = st.draft;
        setStep(st.submitted ? "done" : st.outline && st.acornPlan ? "write" : "outline");
        if (st.submitted) setDone({ submittedAt: null, chars: st.draft.length, reflectionCount: null });
      } catch (e) {
        if (!alive) return;
        setLoadError(e instanceof ApiError ? { status: e.status, message: e.message } : { status: 0, message: "불러오지 못했어요." });
      }
    })();
    return () => {
      alive = false;
    };
  }, [attemptId]);

  /** 현재 글 저장 (바뀐 게 없으면 건너뜀) */
  const saveDraft = useCallback(
    async (text: string, force = false) => {
      if (!force && text === savedText.current) return true;
      setSave((s) => ({ ...s, saving: true }));
      try {
        const res = await api.draft(attemptId, text);
        savedText.current = text;
        setSave({ at: res.savedAt, saving: false, error: null });
        return true;
      } catch (e) {
        setSave((s) => ({ ...s, saving: false, error: e instanceof ApiError ? e.message : "저장하지 못했어요." }));
        return false;
      }
    },
    [attemptId],
  );

  // 글쓰기 단계: 10초마다 자동 저장
  const draftRef = useRef(draft);
  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);
  useEffect(() => {
    if (step !== "write" || state?.submitted) return;
    const t = window.setInterval(() => void saveDraft(draftRef.current), 10_000);
    return () => window.clearInterval(t);
  }, [step, state?.submitted, saveDraft]);

  if (loadError) {
    return (
      <Shell>
        <header className="flex items-center justify-between">
          <Brand />
        </header>
        <div className={`${card} mx-auto flex w-full max-w-[640px] flex-col items-center gap-4 p-10 text-center`}>
          <h1 className="m-0 font-display text-3xl font-normal">
            {loadError.status === 404 || loadError.status === 403 ? "본인 확인이 필요해요" : "시험지를 열지 못했어요"}
          </h1>
          <p className="m-0 text-sub">
            {loadError.status === 404 || loadError.status === 403
              ? "처음 화면에서 학번과 이름으로 다시 시작하면 쓰던 글을 이어서 쓸 수 있어요."
              : loadError.message}
          </p>
          <Link href="/" className={btn.primary}>처음 화면으로</Link>
        </div>
      </Shell>
    );
  }
  if (!state || !exam) {
    return (
      <Shell>
        <Loading label="시험지를 펴는 중" />
      </Shell>
    );
  }

  const used = state.acornsUsed;
  const go = async (s: StepKey) => {
    if (step === "write") await saveDraft(draftRef.current);
    setStep(s);
    window.scrollTo({ top: 0 });
  };

  const onAsked = (q: StudentQuestion, item: number, usedNow: number, text: string) => {
    savedText.current = text; // /api/ask가 질문 순간의 글을 함께 저장함
    setState((st) => {
      if (!st) return st;
      const acornsUsed = [...st.acornsUsed] as PerItem;
      acornsUsed[item - 1] = usedNow;
      return { ...st, acornsUsed, questions: [...st.questions, q] };
    });
  };

  return (
    <Shell>
      <header className="flex flex-wrap items-center justify-between gap-4">
        <Brand subtitle={exam.title} />
        <nav aria-label="응시 정보" className="flex flex-wrap items-center gap-2">
          {step !== "done" && (
            <StepNav
              current={step}
              done={{ outline: !!state.outline, write: step === "reflect" }}
              disabled={{ write: !state.outline || !state.acornPlan, reflect: !state.outline || !state.acornPlan }}
              onGo={(s) => void go(s)}
            />
          )}
          <span className="w-3" />
          <Pill>
            {name}
            {name !== attemptId ? ` · ${attemptId}` : ""}
          </Pill>
        </nav>
      </header>
      {save.error && step === "write" && <ErrorBox>글 자동 저장이 안 되고 있어요: {save.error}</ErrorBox>}

      {step === "outline" && (
        <OutlineStep
          attemptId={attemptId}
          exam={exam}
          initialOutline={state.outline}
          initialPlan={state.acornPlan}
          used={used}
          planLocked={state.questions.length > 0}
          onSaved={(outline, plan) => {
            setState((st) => (st ? { ...st, outline, acornPlan: plan } : st));
            void go("write");
          }}
        />
      )}
      {step === "write" && state.outline && state.acornPlan && (
        <WriteStep
          attemptId={attemptId}
          exam={exam}
          plan={state.acornPlan}
          used={used}
          questions={state.questions}
          draft={draft}
          onDraft={setDraft}
          save={save}
          onAsked={onAsked}
          onOutline={() => void go("outline")}
          onReflect={() => void go("reflect")}
        />
      )}
      {step === "reflect" && state.acornPlan && (
        <ReflectStep
          attemptId={attemptId}
          exam={exam}
          plan={state.acornPlan}
          used={used}
          questions={state.questions}
          draft={draft}
          saveDraft={saveDraft}
          onBack={() => void go("write")}
          onSubmitted={(info) => {
            setState((st) => (st ? { ...st, submitted: true } : st));
            setDone(info);
            setStep("done");
            window.scrollTo({ top: 0 });
          }}
        />
      )}
      {step === "done" && <DoneStep name={name} used={used} info={done} />}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen w-full bg-cream px-8 pt-6 pb-10 max-sm:px-4">
      <div className="mx-auto flex max-w-[1280px] flex-col gap-5">{children}</div>
    </div>
  );
}
