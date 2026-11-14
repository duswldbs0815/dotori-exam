"use client";

import { useRef, useState } from "react";
import { api, ApiError, hhmm, shortLabels } from "@/lib/api-client";
import type { ExamInfo, OutlineItemNo, PerItem, StudentQuestion } from "@/lib/types";
import { Acorn } from "../Acorn";
import { Squirrel } from "../Squirrel";
import { PassagePanel } from "./PassagePanel";
import { btn, card, ErrorBox } from "../ui";
import type { SaveState } from "./ExamApp";

type Sel = { start: number; end: number; text: string };
type Tab = "work" | "ask";

/** 🔄 11/14 학생 화면은 두 탭뿐: [수행평가] 과제·지문·내 글 · [AI 질문] 질문·답·내 질문 기록 */
export function WriteStep(props: {
  attemptId: string;
  exam: ExamInfo;
  used: PerItem;
  questions: StudentQuestion[];
  draft: string;
  onDraft: (t: string) => void;
  save: SaveState;
  onAsked: (q: StudentQuestion, item: number, usedNow: number, text: string) => void;
  onSubmit: () => Promise<void>;
}) {
  const { exam, used, questions, draft } = props;
  const [tab, setTab] = useState<Tab>("work");
  const [item, setItem] = useState<OutlineItemNo>(1);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<Sel | null>(null);
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shown, setShown] = useState<number | null>(null);
  const [dropKey, setDropKey] = useState(0);
  const [confirm, setConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const editor = useRef<HTMLTextAreaElement>(null);

  const totalUsed = used.reduce((a, b) => a + b, 0);
  const labels = shortLabels(exam);
  const canAsk = q.trim().length > 0 && !thinking;
  const curSel = sel && draft.slice(sel.start, sel.end) === sel.text ? sel : null;

  function captureSelection() {
    const el = editor.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e } = el;
    if (e > s) {
      const text = el.value.slice(s, e);
      if (text.trim()) setSel({ start: s, end: e, text });
    }
  }

  async function ask() {
    setThinking(true);
    setError(null);
    setShown(null);
    const text = draft;
    try {
      const res = await api.ask({
        attemptId: props.attemptId,
        question: q.trim(),
        outlineItem: item,
        selectedText: curSel?.text ?? "",
        selection: curSel ? { start: curSel.start, end: curSel.end } : null,
        draft: text,
      });
      const newQ: StudentQuestion = {
        acornNo: res.acornNo,
        time: new Date().toISOString(),
        outlineItem: item,
        question: q.trim(),
        answer: res.answer,
        blocked: res.blocked,
      };
      props.onAsked(newQ, item, res.item.used, text);
      setShown(questions.length);
      if (res.charged) {
        setDropKey((k) => k + 1);
        setQ("");
        setSel(null);
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "질문을 보내지 못했어요.");
    } finally {
      setThinking(false);
    }
  }

  const shownQ = shown !== null ? questions[shown] : null;
  const saveLabel = props.save.saving ? "저장 중…" : props.save.at ? `자동 저장됨 · ${hhmm(props.save.at)}` : "10초마다 자동 저장";
  const tabBtn = (t: Tab, label: React.ReactNode) => (
    <button
      type="button"
      role="tab"
      aria-selected={tab === t}
      onClick={() => setTab(t)}
      className={`flex min-h-12 flex-1 cursor-pointer items-center justify-center gap-2 rounded-2xl border-0 px-5 text-[17px] font-bold transition-colors ${
        tab === t ? "bg-leaf text-white" : "bg-transparent text-sub hover:bg-leaf-bg"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="relative flex flex-col gap-4">
      <div role="tablist" aria-label="시험지" className="mx-auto flex w-full max-w-[520px] gap-1 rounded-[20px] border border-line bg-white p-1">
        {tabBtn("work", "수행평가")}
        {tabBtn(
          "ask",
          <>
            AI 질문
            <span className={`rounded-full px-2 py-0.5 text-xs ${tab === "ask" ? "bg-white/20" : "bg-cream-2"}`}>{questions.length}</span>
          </>,
        )}
      </div>

      {tab === "work" && (
        <div className="flex flex-wrap items-start gap-5">
          <aside className="flex min-w-0 flex-[1_1_340px] flex-col gap-4">
            <PassagePanel exam={exam} />
          </aside>
          <section aria-label="내 글" className={`${card} flex min-w-0 flex-[999_1_560px] flex-col gap-4 px-9 py-7 max-sm:px-5`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h1 className="m-0 font-display text-[28px] font-normal">내 글</h1>
              <span className="text-[13px] text-muted">
                {draft.length}자 · {saveLabel}
              </span>
            </div>
            <label htmlFor="essay" className="sr-only">
              {exam.title} 쓰기
            </label>
            <textarea
              id="essay"
              ref={editor}
              value={draft}
              onChange={(e) => props.onDraft(e.target.value)}
              onSelect={captureSelection}
              onMouseUp={captureSelection}
              onKeyUp={captureSelection}
              placeholder={exam.passage ? `「${exam.passage.title}」을(를) 읽고 내 생각을 써 보세요.` : "과제에 맞게 내 생각을 써 보세요."}
              className="min-h-[480px] w-full resize-y rounded-2xl border border-transparent bg-transparent p-0 text-[17px] leading-loose text-ink outline-none selection:bg-[#FFE3A3]"
            />
            {curSel && (
              <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-leaf-bg px-4 py-3 text-sm">
                <span className="min-w-0 flex-1 truncate text-sub">“{curSel.text}”</span>
                <button type="button" onClick={() => setTab("ask")} className="cursor-pointer rounded-full border-0 bg-leaf px-4 py-2 text-[14px] font-bold text-white">
                  이 부분 AI에게 묻기 →
                </button>
              </div>
            )}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-dashed border-line pt-4">
              <span className="text-[13px] text-muted">막히는 문장을 드래그하면 AI에게 바로 물어볼 수 있어요.</span>
              <button type="button" onClick={() => setConfirm(true)} disabled={!draft.trim()} className={`${btn.primary} min-h-12 text-[19px]`}>
                제출하기
              </button>
            </div>
          </section>
        </div>
      )}

      {tab === "ask" && (
        <div className="flex flex-wrap items-start gap-5">
          <section aria-label="AI에게 질문하기" className={`${card} flex min-w-0 flex-[999_1_560px] flex-col gap-4 px-8 py-7 max-sm:px-5`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h1 className="m-0 font-display text-[28px] font-normal">AI에게 질문하기</h1>
              <span className="text-[13px] text-muted">AI는 대신 써 주지 않고, 스스로 쓰도록 도와줘요</span>
            </div>
            {curSel ? (
              <div className="flex items-start gap-2">
                <blockquote className="m-0 flex-1 rounded-r-xl border-l-4 border-gold bg-cream-3 px-3.5 py-2.5 text-sm text-ink">
                  “{curSel.text.length > 160 ? `${curSel.text.slice(0, 160)}…` : curSel.text}”
                </blockquote>
                <button type="button" onClick={() => setSel(null)} aria-label="선택한 부분 지우기" className="cursor-pointer border-0 bg-transparent p-1 text-lg leading-none text-muted">
                  ×
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => setTab("work")} className="cursor-pointer rounded-xl border border-dashed border-line-2 bg-transparent px-3.5 py-2.5 text-left text-sm text-faint">
                내 글에서 막히는 문장을 드래그하면 여기에 담겨요 (선택)
              </button>
            )}
            <div className="flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label="어느 부분 질문인가요">
              <span className="mr-1 text-[13px] font-bold text-sub">어느 부분?</span>
              {labels.map((label, i) => {
                const on = item === i + 1;
                return (
                  <button
                    key={label}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setItem((i + 1) as OutlineItemNo)}
                    className={`min-h-8 cursor-pointer rounded-full px-3 text-[13px] ${on ? "border border-leaf bg-leaf font-bold text-white" : "border border-line-2 bg-white text-sub"}`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <label htmlFor="q" className="sr-only">
              무엇이 궁금한가요?
            </label>
            <textarea
              id="q"
              rows={3}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="예: 이 시어가 무슨 뜻인지 모르겠어요 / 내 근거가 충분한지 봐 주세요"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && canAsk) void ask();
              }}
              className="resize-y rounded-2xl border border-line bg-paper px-4 py-3 text-[16px] text-ink"
            />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-[13px] text-muted">질문과 지금 쓰는 글은 선생님께 기록돼요.</span>
              <button type="button" disabled={!canAsk} onClick={() => void ask()} className={`${btn.primary} min-h-12 text-[18px]`}>
                <Acorn size={18} /> 질문하기
              </button>
            </div>

            {error && <ErrorBox>{error}</ErrorBox>}
            {thinking && (
              <div role="status" className="flex items-center gap-2.5 rounded-2xl bg-cream-3 px-4 py-3.5 text-sm text-sub">
                <span className="flex gap-1.5" aria-hidden="true">
                  {[0, 0.15, 0.3].map((d) => (
                    <span key={d} className="h-2 w-2 rounded-full bg-leaf-2" style={{ animation: `dotori-bob .8s ${d}s ease-in-out infinite` }} />
                  ))}
                </span>
                다람쥐가 답을 찾고 있어요
              </div>
            )}
            {shownQ &&
              !thinking &&
              (shownQ.blocked ? (
                <div role="alert" className="flex gap-2.5 rounded-2xl bg-alert-bg px-4 py-3.5 text-sm leading-relaxed text-alert">
                  <strong className="flex-none">대신 써 주지 않아요</strong>
                  <span>{shownQ.answer}</span>
                </div>
              ) : (
                <div className="flex flex-col gap-2 rounded-2xl bg-leaf-bg p-5">
                  <span className="text-xs font-bold text-leaf">
                    {shownQ.acornNo}번째 질문 · {labels[shownQ.outlineItem - 1]}
                  </span>
                  <p className="m-0 whitespace-pre-wrap text-[16px] leading-[1.8] text-ink">{shownQ.answer}</p>
                  <button type="button" onClick={() => setTab("work")} className="mt-1 w-fit cursor-pointer border-0 bg-transparent p-0 text-sm font-bold text-leaf underline underline-offset-4">
                    내 글로 돌아가서 고쳐 쓰기 →
                  </button>
                </div>
              ))}
          </section>

          <aside className="flex min-w-0 flex-[1_1_320px] flex-col gap-4">
            <section aria-label="내 도토리" className="relative flex items-center gap-3 overflow-hidden rounded-[24px] border border-line bg-white px-5 py-4">
              <div className="h-[80px] w-[80px] flex-none">
                <Squirrel size={80} eats={totalUsed} />
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="text-sm text-sub">
                  질문한 횟수 <strong className="font-display text-[24px] font-normal text-leaf">{totalUsed}</strong>번
                </span>
                <span className="text-xs leading-relaxed text-muted">질문할 때마다 다람쥐가 도토리를 먹어요. “대신 써 줘”는 세지 않아요.</span>
              </div>
              {dropKey > 0 && (
                <Acorn
                  key={dropKey}
                  size={30}
                  className="pointer-events-none absolute left-[45px] top-0"
                  style={{ animation: "dotori-fall .9s cubic-bezier(.5,0,.75,1.3) forwards" }}
                />
              )}
            </section>
            <section aria-label="내 질문 기록" className="flex flex-col gap-2.5 rounded-[24px] border border-line bg-white px-5 py-4">
              <h2 className="m-0 font-display text-xl font-normal">내 질문 기록</h2>
              {questions.length === 0 ? (
                <span className="text-sm text-muted">아직 질문하지 않았어요.</span>
              ) : (
                <ol className="m-0 flex max-h-96 list-none flex-col gap-1 overflow-y-auto p-0">
                  {questions.map((qq, i) => (
                    <li key={i}>
                      <button
                        type="button"
                        onClick={() => setShown(i)}
                        aria-pressed={shown === i}
                        className={`flex w-full cursor-pointer gap-2.5 rounded-xl border-0 px-2 py-1.5 text-left text-sm leading-normal ${shown === i ? "bg-cream-3" : "bg-transparent"} ${qq.blocked ? "text-alert" : "text-ink"}`}
                      >
                        <span className={`flex-none ${qq.blocked ? "font-bold" : "font-display text-leaf"}`}>{qq.blocked ? "차단" : `#${qq.acornNo}`}</span>
                        <span className="min-w-0">{qq.question}</span>
                      </button>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </aside>
        </div>
      )}

      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(27,24,19,.35)] p-6" onClick={() => !submitting && setConfirm(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="submit-title"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.key === "Escape" && !submitting && setConfirm(false)}
            className="flex w-[420px] max-w-full flex-col items-center gap-3.5 rounded-[28px] bg-white p-7 text-center shadow-[0_24px_60px_rgba(27,24,19,.25)]"
          >
            <Squirrel size={72} />
            <h2 id="submit-title" className="m-0 font-display text-[26px] font-normal">
              이대로 제출할까요?
            </h2>
            <p className="m-0 text-sm leading-relaxed text-sub">
              {draft.length}자 · 질문 {totalUsed}번. 제출하면 더는 고칠 수 없어요.
            </p>
            <div className="flex w-full gap-2.5">
              <button type="button" autoFocus disabled={submitting} onClick={() => setConfirm(false)} className={`${btn.secondary} min-h-[50px] flex-1`}>
                더 쓸래요
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={async () => {
                  setSubmitting(true);
                  try {
                    await props.onSubmit();
                  } finally {
                    setSubmitting(false);
                    setConfirm(false);
                  }
                }}
                className={`${btn.primary} min-h-[50px] flex-1 text-[19px]`}
              >
                {submitting ? "제출 중…" : "제출하기"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
