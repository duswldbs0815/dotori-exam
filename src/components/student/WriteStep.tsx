"use client";

import { useRef, useState } from "react";
import { api, ApiError, hhmm, SHORT_ITEMS } from "@/lib/api-client";
import type { ExamInfo, OutlineItemNo, PerItem, StudentQuestion } from "@/lib/types";
import { Acorn } from "../Acorn";
import { Squirrel } from "../Squirrel";
import { btn, card, ErrorBox } from "../ui";
import type { SaveState } from "./ExamApp";

type Sel = { start: number; end: number; text: string };

/** ② 글쓰기: 왼쪽 글쓰기 창, 오른쪽 질문 상자 · 도토리 창고 · 나의 질문 기록 */
export function WriteStep(props: {
  attemptId: string;
  exam: ExamInfo;
  plan: PerItem;
  used: PerItem;
  questions: StudentQuestion[];
  draft: string;
  onDraft: (t: string) => void;
  save: SaveState;
  onAsked: (q: StudentQuestion, item: number, usedNow: number, text: string) => void;
  onOutline: () => void;
  onReflect: () => void;
}) {
  const { exam, plan, used, questions, draft } = props;
  const [item, setItem] = useState<OutlineItemNo>(1);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<Sel | null>(null);
  const [modal, setModal] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** 질문 상자에 펼쳐 보여 줄 질문 (questions의 인덱스) */
  const [shown, setShown] = useState<number | null>(null);
  const [dropKey, setDropKey] = useState(0);
  const editor = useRef<HTMLTextAreaElement>(null);

  const totalUsed = used.reduce((a, b) => a + b, 0);
  const totalPlan = plan.reduce((a, b) => a + b, 0);
  const slots = Math.max(totalPlan, totalUsed);
  const canAsk = q.trim().length > 0 && !thinking;

  // 글이 바뀌어 선택한 부분이 더는 그 자리에 없으면 선택이 없는 것으로 봄
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

  async function confirmAsk() {
    setModal(false);
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
  const saveLabel = props.save.saving
    ? "저장 중…"
    : props.save.at
      ? `자동 저장됨 · ${hhmm(props.save.at)}`
      : "10초마다 자동 저장";

  return (
    <div className="relative">
      <div className="flex flex-wrap items-start gap-6">
        <section aria-label="글쓰기" className={`${card} flex min-w-0 flex-[999_1_560px] flex-col gap-[18px] px-10 py-8 max-sm:px-5`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h1 className="m-0 font-display text-[30px] font-normal">내 감상문</h1>
            <span className="text-[13px] text-muted">
              {draft.length}자 · {saveLabel}
            </span>
          </div>
          <div className="flex items-center gap-2 rounded-[14px] bg-cream-3 px-3.5 py-2.5 text-sm text-sub">
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
              <path d="M3 2v12M3 2l9 5-9 5" fill="none" stroke="#8A4B12" strokeWidth="2" strokeLinejoin="round" />
            </svg>
            막히는 부분을 드래그하면 오른쪽 질문 상자에 담겨요.
          </div>
          <label htmlFor="essay" className="sr-only">
            감상문 쓰기
          </label>
          <textarea
            id="essay"
            ref={editor}
            value={draft}
            onChange={(e) => props.onDraft(e.target.value)}
            onSelect={captureSelection}
            onMouseUp={captureSelection}
            onKeyUp={captureSelection}
            placeholder="「진달래꽃」에 대한 나의 비평을 써 보세요."
            className="min-h-[520px] w-full resize-y rounded-2xl border border-transparent bg-transparent p-0 text-[17px] leading-loose text-ink outline-none selection:bg-[#FFE3A3] focus:border-transparent"
          />
          <div className="flex flex-wrap justify-between gap-3 border-t border-dashed border-line pt-[18px]">
            <button type="button" onClick={props.onOutline} className={`${btn.secondary} min-h-12`}>
              개요 다시 보기
            </button>
            <button type="button" onClick={props.onReflect} disabled={!draft.trim()} className={`${btn.primary} min-h-12 text-[19px]`}>
              성찰지로 가기
            </button>
          </div>
        </section>

        <aside className="flex min-w-0 flex-[1_1_400px] flex-col gap-4">
          <section aria-label="질문 상자" className="flex flex-col gap-3.5 rounded-[26px] border-2 border-gold bg-white p-[22px]">
            <div className="flex items-center justify-between">
              <h2 className="m-0 font-display text-[22px] font-normal">AI에게 질문하기</h2>
              <span className="text-[13px] text-muted">질문 1번 = 도토리 1개</span>
            </div>
            <div className="flex flex-col gap-1.5">
              <span id="item-label" className="text-[13px] font-bold text-sub">어느 항목에 대한 질문인가요?</span>
              <div role="radiogroup" aria-labelledby="item-label" className="flex flex-wrap gap-1.5">
                {SHORT_ITEMS.map((label, i) => {
                  const on = item === i + 1;
                  return (
                    <button
                      key={label}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => setItem((i + 1) as OutlineItemNo)}
                      className={`min-h-9 cursor-pointer rounded-full px-3 text-[13px] ${on ? "border-2 border-brown bg-brown font-bold text-white" : "border border-line-2 bg-white font-medium text-sub"}`}
                    >
                      {i + 1} {label}
                      <span className={on ? "ml-1 opacity-80" : "ml-1 text-muted"}>
                        {used[i]}/{plan[i]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
            {curSel ? (
              <div className="flex items-start gap-2">
                <blockquote className="m-0 flex-1 rounded-r-xl border-l-4 border-gold bg-cream-3 px-3.5 py-2.5 text-sm text-brown-dark">
                  “{curSel.text.length > 140 ? `${curSel.text.slice(0, 140)}…` : curSel.text}”
                </blockquote>
                <button type="button" onClick={() => setSel(null)} aria-label="선택한 부분 지우기" className="cursor-pointer border-0 bg-transparent p-1 text-lg leading-none text-muted">
                  ×
                </button>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-line-2 px-3.5 py-2.5 text-sm text-faint">
                글에서 막히는 문장을 드래그하면 여기에 담겨요
              </div>
            )}
            <label htmlFor="q" className="text-[13px] font-bold text-sub">
              무엇이 궁금한가요?
            </label>
            <textarea
              id="q"
              rows={3}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="resize-y rounded-2xl border border-line bg-paper px-3.5 py-3 text-[15px] text-ink"
            />
            <button type="button" disabled={!canAsk} onClick={() => setModal(true)} className={`${btn.primary} text-[19px]`}>
              <Acorn size={18} />
              도토리 1개로 질문하기
            </button>

            {error && <ErrorBox>{error}</ErrorBox>}
            {thinking && (
              <div role="status" className="flex items-center gap-2.5 rounded-2xl bg-cream-3 px-4 py-3.5 text-sm text-sub">
                <span className="flex gap-1.5" aria-hidden="true">
                  {[0, 0.15, 0.3].map((d) => (
                    <span key={d} className="h-2 w-2 rounded-full bg-nut" style={{ animation: `dotori-bob .8s ${d}s ease-in-out infinite` }} />
                  ))}
                </span>
                다람쥐가 답을 찾고 있어요
              </div>
            )}
            {shownQ && !thinking && (
              shownQ.blocked ? (
                <div role="alert" className="flex gap-2.5 rounded-2xl bg-alert-bg px-4 py-3.5 text-sm leading-relaxed text-alert">
                  <strong className="flex-none">차단</strong>
                  <span>{shownQ.answer} 도토리는 쓰지 않았어요.</span>
                </div>
              ) : (
                <div className="flex flex-col gap-2 rounded-2xl bg-leaf-bg p-4">
                  <span className="text-xs font-bold text-leaf">
                    도토리 {shownQ.acornNo}번 답변 · {exam.outlineItems[shownQ.outlineItem - 1]}
                  </span>
                  <p className="m-0 whitespace-pre-wrap text-[15px] leading-[1.75] text-[#2D3B26]">{shownQ.answer}</p>
                </div>
              )
            )}
          </section>

          <section aria-label="도토리 창고" className="relative flex items-center gap-3 overflow-hidden rounded-[26px] border border-line bg-white px-[22px] py-[18px]">
            <div className="h-[88px] w-[88px] flex-none">
              <Squirrel size={88} eats={totalUsed} />
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="m-0 font-display text-xl font-normal">도토리 창고</h2>
                <span className="text-sm text-sub">
                  쓴 도토리 <strong className="font-display text-[22px] font-normal text-brown">{totalUsed}</strong>개 · 목표 {totalPlan}개
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5" aria-hidden="true">
                {Array.from({ length: slots }, (_, i) => (
                  <Acorn key={i} size={22} faded={i < totalUsed} />
                ))}
              </div>
              <span className="text-xs text-muted">질문할 때마다 다람쥐가 도토리를 하나씩 먹어요. 질문 내용은 선생님께 기록돼요.</span>
            </div>
            {dropKey > 0 && (
              <Acorn
                key={dropKey}
                size={34}
                className="pointer-events-none absolute left-[49px] top-0"
                style={{ animation: "dotori-fall .9s cubic-bezier(.5,0,.75,1.3) forwards" }}
              />
            )}
          </section>

          <section aria-label="나의 질문 기록" className="flex flex-col gap-2.5 rounded-[26px] border border-line bg-white px-[22px] py-[18px]">
            <h2 className="m-0 font-display text-xl font-normal">나의 질문 기록</h2>
            {questions.length === 0 ? (
              <span className="text-sm text-muted">아직 질문하지 않았어요.</span>
            ) : (
              <ol className="m-0 flex max-h-72 list-none flex-col gap-1 overflow-y-auto p-0">
                {questions.map((qq, i) => (
                  <li key={i}>
                    <button
                      type="button"
                      onClick={() => setShown(i)}
                      aria-pressed={shown === i}
                      className={`flex w-full cursor-pointer gap-2.5 rounded-xl border-0 px-2 py-1.5 text-left text-sm leading-normal ${shown === i ? "bg-cream-3" : "bg-transparent"} ${qq.blocked ? "text-alert" : "text-ink"}`}
                    >
                      <span className={`flex-none ${qq.blocked ? "font-bold" : "font-display text-brown"}`}>{qq.blocked ? "차단" : `#${qq.acornNo}`}</span>
                      <span className="min-w-0">
                        {SHORT_ITEMS[qq.outlineItem - 1]} · {qq.question}
                        {qq.blocked && " · 도토리 안 씀"}
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </aside>
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(58,42,28,.35)] p-6" onClick={() => setModal(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.key === "Escape" && setModal(false)}
            className="flex w-[420px] max-w-full flex-col items-center gap-3.5 rounded-[28px] bg-white p-7 text-center shadow-[0_24px_60px_rgba(58,42,28,.25)]"
          >
            <Acorn size={64} style={{ animation: "dotori-wobble 1.2s ease-in-out infinite" }} />
            <h2 id="confirm-title" className="m-0 font-display text-[26px] font-normal">
              도토리 1개를 사용할까요?
            </h2>
            <p className="m-0 text-sm leading-relaxed text-sub">질문 내용과 지금 쓰고 있는 글은 기록되어 선생님께 전달돼요.</p>
            <div className="flex w-full gap-2.5">
              <button type="button" autoFocus onClick={() => setModal(false)} className={`${btn.secondary} min-h-[50px] flex-1`}>
                다시 생각할래요
              </button>
              <button type="button" onClick={confirmAsk} className={`${btn.primary} min-h-[50px] flex-1 text-[19px]`}>
                사용하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
