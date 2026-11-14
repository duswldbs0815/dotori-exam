"use client";

import { useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import type { ReportQuestion, Timelapse as TL } from "@/lib/types";
import { Acorn } from "../Acorn";
import { card } from "../ui";

/** 재생 한 칸: edits[e]를 k글자까지 넣은 상태 (k = -1이면 지우기만 한 상태) */
type Step = { e: number; k: number };

const TICK_MS = 40;
const HOLD_TICKS = 32; // 질문 지점에서 잠깐 멈춤 (약 1.3초)

function hhmmss(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
}

/**
 * 글쓰기 과정 다시 보기 (교사 전용).
 * 슬라이더를 움직이거나 재생하면 글이 처음부터 써지는 과정이 나오고, 질문한 시점에는 도토리가, 한꺼번에 들어온 글에는 표시가 뜬다.
 */
export type TimelapseHandle = { seek: (time: string) => void };

export function Timelapse({ data, questions, ref }: { data: TL; questions: ReportQuestion[]; ref?: React.Ref<TimelapseHandle> }) {
  const { edits } = data;

  // 각 수정 직전의 글 (마지막 원소 = 최종 글)
  const frames = useMemo(() => {
    const out = [""];
    let text = "";
    for (const e of edits) {
      text = text.slice(0, e.at) + e.ins + text.slice(e.at + e.del);
      out.push(text);
    }
    return out;
  }, [edits]);

  // 재생 칸: 붙여 넣은 글은 한 번에, 나머지는 몇 글자씩
  const steps = useMemo(() => {
    const totalIns = edits.reduce((n, e) => n + (e.paste ? 1 : e.ins.length), 0);
    const chunk = Math.max(data.source === "log" ? 2 : 4, Math.ceil(totalIns / 2500));
    const out: Step[] = [{ e: -1, k: 0 }];
    edits.forEach((e, i) => {
      if (e.del > 0) out.push({ e: i, k: -1 });
      if (e.paste || e.ins.length === 0) {
        out.push({ e: i, k: e.ins.length });
        return;
      }
      for (let k = chunk; k < e.ins.length; k += chunk) out.push({ e: i, k });
      out.push({ e: i, k: e.ins.length });
    });
    return out;
  }, [edits, data.source]);

  // 질문 지점: 그 질문 시각까지의 마지막 수정이 끝난 칸
  const marks = useMemo(() => {
    return questions.map((q) => {
      const t = Date.parse(q.time);
      let last = -1;
      edits.forEach((e, i) => {
        if (Date.parse(e.t) <= t) last = i;
      });
      let pos = 0;
      steps.forEach((s, i) => {
        if (s.e === last && (last === -1 || s.k === edits[last].ins.length)) pos = i;
      });
      return { q, pos };
    });
  }, [questions, edits, steps]);
  const pasteMarks = useMemo(
    () => steps.map((s, i) => (s.e >= 0 && edits[s.e].paste && s.k === edits[s.e].ins.length ? i : -1)).filter((i) => i >= 0),
    [steps, edits],
  );

  const last = steps.length - 1;
  const [pos, setPos] = useState(last);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const hold = useRef(0);
  const posRef = useRef(pos);
  useEffect(() => {
    posRef.current = pos;
  }, [pos]);

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      if (hold.current > 0) {
        hold.current -= 1;
        return;
      }
      const cur = posRef.current;
      const next = Math.min(last, cur + speed);
      if (marks.some((m) => m.pos > cur && m.pos <= next) || pasteMarks.some((p) => p > cur && p <= next)) hold.current = HOLD_TICKS;
      setPos(next);
      if (next >= last) setPlaying(false);
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [playing, speed, last, marks, pasteMarks]);

  const play = () => {
    if (pos >= last) setPos(0);
    hold.current = 0;
    setPlaying((p) => !p);
  };

  // 지금 칸의 글과 방금 들어온 부분
  const step = steps[pos];
  let text = "";
  let hi: [number, number] | null = null;
  if (step.e >= 0) {
    const e = edits[step.e];
    const before = frames[step.e];
    const k = Math.max(0, step.k);
    text = before.slice(0, e.at) + e.ins.slice(0, k) + before.slice(e.at + e.del);
    if (k > 0) hi = [e.at, e.at + k];
  }
  const curEdit = step.e >= 0 ? edits[step.e] : null;
  const curTime = curEdit ? curEdit.t : data.start;
  const elapsedMin = Math.max(0, Math.round((Date.parse(curTime) - Date.parse(data.start)) / 60000));
  const pasted = !!curEdit?.paste && step.k === curEdit.ins.length;
  // 가장 최근에 지난 질문
  const recent = [...marks].reverse().find((m) => m.pos <= pos && pos - m.pos <= 60);

  // 채점 칸에서 질문을 누르면 그 순간으로 이동
  const section = useRef<HTMLElement>(null);
  useImperativeHandle(ref, () => ({
    seek: (time: string) => {
      const m = marks.find((x) => x.q.time === time);
      if (!m) return;
      setPlaying(false);
      setPos(m.pos);
      section.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    },
  }));

  // 글 끝을 따라 스크롤
  const box = useRef<HTMLDivElement>(null);
  const mark = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!playing || !mark.current || !box.current) return;
    const b = box.current.getBoundingClientRect();
    const m = mark.current.getBoundingClientRect();
    if (m.bottom > b.bottom - 16 || m.top < b.top) box.current.scrollTop += m.top - b.top - b.height / 2;
  }, [pos, playing]);

  if (edits.length === 0) return null;

  return (
    <section ref={section} aria-label="글쓰기 과정 다시 보기" className={`${card} flex flex-col gap-4 px-9 py-7 max-sm:px-5`}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="m-0 font-display text-2xl font-normal">글쓰기 과정 다시 보기</h2>
          <p className="m-0 text-[13px] text-muted">
            {data.source === "log"
              ? "10초마다 저장된 글을 이어 붙여 다시 보여 줘요. 도토리는 질문한 순간, 빨간 표시는 한꺼번에 들어온 글이에요."
              : "예전 기록이라 질문 직전 글과 제출한 글만 있어요. 그 사이는 이어서 보여 줘요."}
          </p>
        </div>
        <div className="flex items-center gap-2 text-[13px] text-muted tabular-nums">
          <span>{hhmmss(curTime)}</span>
          <span>·</span>
          <span>시작 후 {elapsedMin}분</span>
          <span>·</span>
          <span>{text.length.toLocaleString()}자</span>
        </div>
      </div>

      <div ref={box} className="relative max-h-[340px] min-h-[180px] overflow-y-auto rounded-lg bg-cream-3 px-5 py-4 text-[16px] leading-[1.9] whitespace-pre-wrap text-ink">
        {hi ? (
          <>
            {text.slice(0, hi[0])}
            <span ref={mark} className={`rounded-[3px] transition-colors ${pasted ? "bg-del-bg text-del" : "bg-add-bg text-add"}`}>
              {text.slice(hi[0], hi[1])}
            </span>
            {text.slice(hi[1])}
          </>
        ) : (
          text || <span className="text-faint">(아직 비어 있음)</span>
        )}
      </div>

      <div className="min-h-[44px]" aria-live="polite">
        {pasted ? (
          <p className="m-0 rounded-lg bg-alert-bg px-4 py-2.5 text-[14px] text-alert">
            <b>한꺼번에 들어온 글</b> · {hhmmss(curEdit!.t)}에 {curEdit!.ins.length}자가 한 번에 생겼어요. 붙여 넣었을 수 있어요. 학생에게 확인해 보세요.
          </p>
        ) : recent ? (
          <p className="m-0 flex items-start gap-2 rounded-lg bg-cream-2 px-4 py-2.5 text-[14px] text-sub" style={{ animation: "land-pop .35s both" }}>
            <Acorn size={16} ghost={recent.q.blocked} />
            <span>
              <b className="text-ink">{recent.q.blocked ? "차단된 요청" : `도토리 ${recent.q.acornNo}`}</b> · {hhmmss(recent.q.time)} · “{recent.q.question}”
            </span>
          </p>
        ) : null}
      </div>

      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={play}
          aria-label={playing ? "멈춤" : "재생"}
          className="grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-full border-0 bg-leaf text-white"
        >
          {playing ? (
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><rect x="2" y="1" width="3.5" height="12" rx="1" fill="currentColor" /><rect x="8.5" y="1" width="3.5" height="12" rx="1" fill="currentColor" /></svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M3 1.5 L12.5 7 L3 12.5 Z" fill="currentColor" /></svg>
          )}
        </button>
        <div className="relative flex-1">
          {/* 질문·붙여 넣기 표시 */}
          <div className="pointer-events-none relative mb-1 h-5">
            {marks.map(({ q, pos: p }, i) => (
              <span key={i} className="absolute -translate-x-1/2" style={{ left: `${(p / Math.max(1, last)) * 100}%` }} title={q.question}>
                <Acorn size={14} ghost={q.blocked} />
              </span>
            ))}
            {pasteMarks.map((p) => (
              <span key={`p${p}`} className="absolute top-1 h-3 w-1.5 -translate-x-1/2 rounded-full bg-del" style={{ left: `${(p / Math.max(1, last)) * 100}%` }} />
            ))}
          </div>
          <input
            type="range"
            min={0}
            max={last}
            value={pos}
            onChange={(e) => {
              setPlaying(false);
              setPos(Number(e.target.value));
            }}
            aria-label="글쓰기 과정 위치"
            className="w-full cursor-pointer accent-[var(--color-brown)]"
          />
        </div>
        <button
          type="button"
          onClick={() => setSpeed((s) => (s === 1 ? 4 : s === 4 ? 12 : 1))}
          className="min-h-9 shrink-0 cursor-pointer rounded-full border border-line bg-white px-3 text-[13px] font-bold text-sub tabular-nums"
        >
          {speed}배
        </button>
      </div>
    </section>
  );
}
