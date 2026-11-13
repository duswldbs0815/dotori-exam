"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { api, ApiError, hhmm, SHORT_ITEMS } from "@/lib/api-client";
import type { DiffPart, ReportQuestion, SentencePath, StudentReportResponse } from "@/lib/types";
import { card, ErrorBox, Loading } from "../ui";
import { TeacherLogin, TeacherShell } from "./TeacherShell";

const PATH_LABEL: Record<SentencePath, string> = { self: "스스로 작성", revised: "질문 후 수정", ai: "AI 답 활용" };
const PATH_CLASS: Record<SentencePath, string> = {
  self: "bg-path-self rounded py-0.5",
  revised: "bg-path-rev-bg shadow-[inset_0_-2px_0_var(--color-path-rev)] rounded py-0.5",
  ai: "bg-path-ai-bg shadow-[inset_0_-2px_0_var(--color-path-ai)] rounded py-0.5",
};
const SWATCH: Record<SentencePath, string> = {
  self: "bg-path-self",
  revised: "bg-path-rev-bg border-b-2 border-path-rev",
  ai: "bg-path-ai-bg border-b-2 border-path-ai",
};

type Segment = { text: string; sentence: number | null };

/** 제출 글을 문장 단위로 나눔 (원문 줄바꿈·공백은 그대로 둠) */
function segment(final: string, sentences: { text: string }[]): Segment[] {
  const out: Segment[] = [];
  let cur = 0;
  sentences.forEach((s, i) => {
    const at = final.indexOf(s.text, cur);
    if (at < 0) return;
    if (at > cur) out.push({ text: final.slice(cur, at), sentence: null });
    out.push({ text: s.text, sentence: i });
    cur = at + s.text.length;
  });
  if (cur < final.length) out.push({ text: final.slice(cur), sentence: null });
  return out;
}

/** 질문한 위치(selectedText)가 들어 있는 문장 번호. 못 찾으면 null (글 끝에 붙임) */
function anchorOf(q: ReportQuestion, final: string, segs: Segment[]): number | null {
  const needle = q.selectedText.trim();
  if (!needle) return null;
  let at = final.indexOf(needle);
  if (at < 0 && needle.length > 12) at = final.indexOf(needle.slice(0, 12));
  if (at < 0) return null;
  let pos = 0;
  for (let i = 0; i < segs.length; i++) {
    const end = pos + segs[i].text.length;
    if (at < end) {
      // 공백 구간이면 다음 문장에 붙임
      for (let j = i; j < segs.length; j++) if (segs[j].sentence !== null) return j;
      return null;
    }
    pos = end;
  }
  return null;
}

export function TeacherReport() {
  const params = useParams<{ studentId: string }>();
  const studentId = decodeURIComponent(params.studentId);
  const [data, setData] = useState<StudentReportResponse | null>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "login" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [pathOn, setPathOn] = useState(false);
  const [open, setOpen] = useState<number | null>(null);
  const itemRefs = useRef<(HTMLLIElement | null)[]>([]);

  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    let alive = true;
    api.studentReport(studentId).then(
      (r) => {
        if (!alive) return;
        setData(r);
        setStatus("ok");
      },
      (e) => {
        if (!alive) return;
        if (e instanceof ApiError && e.status === 401) setStatus("login");
        else {
          setError(e instanceof ApiError ? e.message : "리포트를 불러오지 못했어요.");
          setStatus("error");
        }
      },
    );
    return () => {
      alive = false;
    };
  }, [studentId, nonce]);

  const view = useMemo(() => {
    if (!data) return null;
    const final = data.final ?? "";
    const segs = segment(final, data.sentences);
    const markers = new Map<number | "end", number[]>();
    data.questions.forEach((q, qi) => {
      if (q.blocked) return;
      const key = anchorOf(q, final, segs) ?? "end";
      markers.set(key, [...(markers.get(key) ?? []), qi]);
    });
    const counts: Record<SentencePath, number> = { self: 0, revised: 0, ai: 0 };
    data.sentences.forEach((s) => (counts[s.path] += 1));
    return { final, segs, markers, counts };
  }, [data]);

  if (status === "login") return <TeacherLogin onDone={() => setNonce((n) => n + 1)} />;
  if (status === "loading") return <TeacherShell><Loading label="리포트를 불러오는 중" /></TeacherShell>;
  if (status === "error" || !data || !view)
    return (
      <TeacherShell>
        <Link href="/teacher" className="text-sm text-brown">← 학생 목록</Link>
        <ErrorBox>{error ?? "리포트를 불러오지 못했어요."}</ErrorBox>
      </TeacherShell>
    );

  const charged = data.questions.filter((q) => !q.blocked).length;
  const openQ = (qi: number) => {
    setOpen((o) => (o === qi ? null : qi));
    requestAnimationFrame(() => itemRefs.current[qi]?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
  };
  const marker = (qi: number) => {
    const q = data.questions[qi];
    const on = open === qi;
    return (
      <button
        key={qi}
        type="button"
        aria-label={`질문 ${q.acornNo} 보기`}
        aria-expanded={on}
        onClick={() => openQ(qi)}
        className={`mx-0.5 ml-1 inline-flex h-[22px] w-[22px] cursor-pointer items-center justify-center rounded-full border-0 align-[2px] font-display text-[13px] text-white ${on ? "bg-brown shadow-[0_0_0_3px_#F6D7B3]" : "bg-nut"}`}
      >
        {q.acornNo}
      </button>
    );
  };

  return (
    <TeacherShell>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/teacher" className="text-sm text-brown">← 학생 목록</Link>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="m-0 font-display text-[34px] font-normal">{data.student.name}</h1>
          <span className="text-sm text-muted">
            {data.student.id} · {data.submittedAt ? `제출 ${hhmm(data.submittedAt)}` : "작성 중 (아직 제출 전)"}
          </span>
        </div>
        <div className="flex gap-2.5">
          {[
            [String(charged), "질문"],
            [String(data.blockedCount), "차단"],
            [`${view.counts.ai} / ${data.sentences.length}`, "AI 답 활용 문장"],
          ].map(([v, l]) => (
            <div key={l} className="flex min-w-[88px] flex-col items-center rounded-2xl border border-line bg-white px-4 py-2.5">
              <span className={`font-display text-2xl ${l === "차단" && data.blockedCount > 0 ? "text-alert" : "text-brown"}`}>{v}</span>
              <span className="text-xs text-muted">{l}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-start gap-6">
        <section aria-label="제출한 글" className={`${card} flex min-w-0 flex-[999_1_560px] flex-col gap-4 px-9 py-7 max-sm:px-5`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="m-0 font-display text-2xl font-normal">{data.submittedAt ? "제출한 글" : "작성 중인 글"}</h2>
            <button
              type="button"
              role="switch"
              aria-checked={pathOn}
              onClick={() => setPathOn((p) => !p)}
              className={`inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-full py-0 pr-3.5 pl-1.5 text-[13px] font-bold ${pathOn ? "border-0 bg-ink text-white" : "border border-line-3 bg-white text-brown-dark"}`}
            >
              <span className={`h-6 w-6 rounded-full ${pathOn ? "bg-white" : "bg-line-3"}`} />
              작성 경로 표시
            </button>
          </div>
          {pathOn && (
            <div className="flex flex-col gap-2 rounded-2xl bg-teacher-bg px-4 py-3">
              <div className="flex flex-wrap gap-4 text-[13px]">
                {(Object.keys(PATH_LABEL) as SentencePath[]).map((p) => (
                  <span key={p} className="flex items-center gap-1.5">
                    <span className={`h-3.5 w-3.5 rounded ${SWATCH[p]}`} />
                    {PATH_LABEL[p]} {view.counts[p]}
                  </span>
                ))}
              </div>
              <span className="text-xs text-muted">참고용이에요. 문장이 생긴 시점과 AI 답의 비슷한 정도로 추정한 단서이고, 판정이 아니에요.</span>
            </div>
          )}
          {view.final ? (
            <p className="m-0 whitespace-pre-wrap text-[17px] leading-loose">
              {view.segs.map((s, i) => {
                const path = s.sentence !== null ? data.sentences[s.sentence].path : null;
                return (
                  <span key={i}>
                    <span className={pathOn && path ? PATH_CLASS[path] : undefined}>{s.text}</span>
                    {view.markers.get(i)?.map(marker)}
                  </span>
                );
              })}
              {view.markers.get("end")?.map(marker)}
            </p>
          ) : (
            <p className="m-0 text-sm text-muted">아직 쓴 글이 없어요.</p>
          )}
          {charged > 0 && <p className="m-0 text-[13px] text-muted">글 속 동그라미 숫자를 누르면 그 질문이 열려요.</p>}
        </section>

        <aside className="flex min-w-0 flex-[1_1_400px] flex-col gap-4">
          <section aria-label="질문 기록" className={`${card} flex flex-col gap-3 p-[22px]`}>
            <h2 className="m-0 font-display text-[22px] font-normal">질문 기록</h2>
            {data.questions.length === 0 && <span className="text-sm text-muted">질문하지 않았어요.</span>}
            <ol className="m-0 flex list-none flex-col gap-2 p-0">
              {data.questions.map((q, qi) => (
                <li key={qi} ref={(el) => void (itemRefs.current[qi] = el)}>
                  {q.blocked ? (
                    <div className="flex gap-2.5 rounded-2xl bg-alert-bg px-3.5 py-3 text-sm text-alert">
                      <span className="flex-none font-bold">차단</span>
                      <span className="flex flex-col gap-0.5">
                        <span>“{q.question}”</span>
                        <span className="text-xs opacity-80">{hhmm(q.time)} · {SHORT_ITEMS[q.outlineItem - 1]} · 도토리 안 씀</span>
                      </span>
                    </div>
                  ) : (
                    <QuestionItem q={q} open={open === qi} onToggle={() => openQ(qi)} />
                  )}
                </li>
              ))}
            </ol>
          </section>

          <section aria-label="도토리 목표와 사용" className={`${card} flex flex-col gap-2.5 p-[22px]`}>
            <h2 className="m-0 font-display text-xl font-normal">도토리 목표와 사용</h2>
            {SHORT_ITEMS.map((label, i) => {
              const p = data.acorns.planned?.[i] ?? 0;
              const u = data.acorns.used[i];
              const max = Math.max(1, ...(data.acorns.planned ?? [0]), ...data.acorns.used);
              return (
                <div key={label} className="flex items-center gap-3 text-sm">
                  <span className="w-24 flex-none text-sub">{label}</span>
                  <div className="relative h-3 flex-1 rounded-full bg-[#F3E6D3]">
                    <div className="absolute inset-y-0 left-0 rounded-full border-2 border-dashed border-nut" style={{ width: `${(p / max) * 100}%` }} />
                    <div className={`absolute inset-y-0.5 left-0 rounded-full ${u > p ? "bg-brown" : "bg-nut"}`} style={{ width: `${(u / max) * 100}%` }} />
                  </div>
                  <span className="w-16 flex-none text-right text-xs text-muted">
                    {u} / 목표 {p}
                  </span>
                </div>
              );
            })}
          </section>
        </aside>
      </div>

      <section aria-label="개요와 성찰지" className={`${card} grid grid-cols-2 gap-6 px-9 py-7 max-md:grid-cols-1 max-sm:px-5`}>
        <div className="flex flex-col gap-3">
          <h2 className="m-0 font-display text-xl font-normal">개요</h2>
          {data.outline ? (
            <ol className="m-0 flex list-none flex-col gap-2 p-0 text-sm">
              {data.outline.map((o, i) => (
                <li key={i} className="flex gap-2">
                  <span className="w-24 flex-none text-muted">{data.exam.outlineItems[i]}</span>
                  <span>{o}</span>
                </li>
              ))}
            </ol>
          ) : (
            <span className="text-sm text-muted">작성하지 않았어요.</span>
          )}
        </div>
        <div className="flex flex-col gap-3">
          <h2 className="m-0 font-display text-xl font-normal">성찰지</h2>
          {data.reflection ? (
            <ol className="m-0 flex list-none flex-col gap-2.5 p-0 text-sm">
              {["도토리를 가장 많이 쓴 항목과 이유", "가장 도움이 된 질문", "AI 답을 받고 글이 어떻게 달라졌나", "다음엔 도토리를 어떻게 쓰고 싶나"].map((t, i) => (
                <li key={t} className="flex flex-col gap-0.5">
                  <span className="text-xs text-muted">
                    {i + 1}. {t}
                  </span>
                  <span>{data.reflection?.[i] || <span className="text-faint">(빈칸)</span>}</span>
                </li>
              ))}
            </ol>
          ) : (
            <span className="text-sm text-muted">아직 제출하지 않았어요.</span>
          )}
        </div>
      </section>
    </TeacherShell>
  );
}

function QuestionItem({ q, open, onToggle }: { q: ReportQuestion; open: boolean; onToggle: () => void }) {
  return (
    <div className={`rounded-2xl border ${open ? "border-nut bg-cream-3" : "border-line bg-white"}`}>
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full cursor-pointer items-start gap-2.5 border-0 bg-transparent px-3.5 py-3 text-left">
        <span className={`flex h-6 w-6 flex-none items-center justify-center rounded-full font-display text-[13px] text-white ${open ? "bg-brown" : "bg-nut"}`}>{q.acornNo}</span>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-sm font-bold leading-normal">{q.question}</span>
          <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
            {hhmm(q.time)} · {SHORT_ITEMS[q.outlineItem - 1]}
            {q.type && <span className="rounded-full bg-[#F3E6D3] px-2 py-0.5 text-sub">{q.type}</span>}
            {q.stage && <span className="rounded-full border border-line-3 px-2 py-0.5 text-sub">{q.stage}</span>}
          </span>
        </span>
        <span className="flex-none text-xs text-brown">{open ? "접기" : "열기"}</span>
      </button>
      {open && (
        <div className="flex flex-col gap-3 px-3.5 pb-3.5 text-sm leading-relaxed">
          {q.selectedText && (
            <div>
              <b className="text-xs text-muted">선택한 부분</b>
              <blockquote className="m-0 mt-1 rounded-r-lg border-l-4 border-gold bg-white px-3 py-1.5">{q.selectedText}</blockquote>
            </div>
          )}
          <div className="rounded-xl bg-leaf-bg px-3 py-2.5">
            <b className="text-xs text-leaf">AI 답</b>
            <p className="m-0 mt-1 whitespace-pre-wrap">{q.answer}</p>
          </div>
          <div className="rounded-xl bg-white px-3 py-2.5">
            <b className="text-xs text-muted">질문 전 → 후</b>
            <DiffView parts={q.diff} />
          </div>
        </div>
      )}
    </div>
  );
}

/** 추가는 초록, 삭제는 빨강. 바뀌지 않은 긴 부분은 앞뒤만 보여 줌 */
function DiffView({ parts }: { parts: DiffPart[] }) {
  const changed = parts.some((p) => p.op !== "same");
  if (!changed) return <p className="m-0 mt-1 text-muted">질문 뒤에 글이 바뀌지 않았어요.</p>;
  return (
    <p className="m-0 mt-1 whitespace-pre-wrap">
      {parts.map((p, i) => {
        if (p.op === "del")
          return (
            <del key={i} className="rounded bg-del-bg text-del">
              {p.text}
            </del>
          );
        if (p.op === "add")
          return (
            <ins key={i} className="rounded bg-add-bg text-add no-underline">
              {p.text}
            </ins>
          );
        const t = p.text;
        if (t.length <= 120) return <span key={i} className="text-muted">{t}</span>;
        const head = i === 0 ? "" : t.slice(0, 50);
        const tail = i === parts.length - 1 ? "" : t.slice(-50);
        return (
          <span key={i} className="text-muted">
            {head}
            <span className="text-faint"> … </span>
            {tail}
          </span>
        );
      })}
    </p>
  );
}
