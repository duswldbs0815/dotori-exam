"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api-client";
import { CASES, similarity, type CommunityCase } from "@/lib/community";
import { GRADES } from "@/lib/school";
import type { ExamDef } from "@/lib/types";
import { Acorn } from "../Acorn";
import { homeCard } from "./TeacherHome";
import { TeacherGate, TeacherShell, useTeacher } from "./TeacherShell";

export function TeacherCases() {
  return (
    <TeacherGate>
      <Community />
    </TeacherGate>
  );
}

const LIKE_KEY = "dotori_case_likes";
const readLikes = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(LIKE_KEY) ?? "[]");
  } catch {
    return [];
  }
};

/** 선생님 커뮤니티: 다른 학교 선생님들의 수행평가 설계와 운영 후기. 내가 하려는 수행평가와 비슷한 순서로 */
function Community() {
  const me = useTeacher();
  const [mine, setMine] = useState<ExamDef[]>([]);
  const [text, setText] = useState("");
  const [subject, setSubject] = useState<string>(me?.subject ?? "");
  const [grade, setGrade] = useState<number | 0>(0);
  const [open, setOpen] = useState<string | null>(null);
  const [likes, setLikes] = useState<string[]>([]);

  useEffect(() => {
    api.school().then((s) => setMine(s.exams), () => null);
    setLikes(readLikes()); // eslint-disable-line react-hooks/set-state-in-effect -- 브라우저 저장소는 화면을 그린 뒤에만 읽을 수 있음
  }, []);

  const list = useMemo(
    () =>
      CASES.filter((c) => (!subject || c.subject === subject) && (!grade || c.grade === grade))
        .map((c) => ({ c, s: similarity(c, { subject: me?.subject, grade: grade || undefined, text }) }))
        .sort((a, b) => b.s - a.s || b.c.likes - a.c.likes),
    [subject, grade, text, me?.subject],
  );

  const toggleLike = (id: string) => {
    const next = likes.includes(id) ? likes.filter((x) => x !== id) : [...likes, id];
    setLikes(next);
    try {
      localStorage.setItem(LIKE_KEY, JSON.stringify(next));
    } catch {
      /* 저장 못 해도 화면에서는 반영 */
    }
  };

  const chip = (on: boolean) => `min-h-9 cursor-pointer rounded-full px-3.5 text-[14px] ${on ? "border border-leaf bg-leaf font-bold text-white" : "border border-line-2 bg-white text-sub"}`;

  return (
    <TeacherShell>
      <div className="flex flex-col gap-1">
        <span className="text-sm text-muted">다른 학교 선생님들은 AI에게 무엇을 맡기고, 무엇을 학생에게 남겼을까요?</span>
        <h1 className="m-0 font-display text-[34px] font-normal text-leaf">선생님 커뮤니티</h1>
      </div>

      <section className={`${homeCard} flex flex-col gap-4 p-6 max-sm:p-4`}>
        <label className="flex flex-col gap-2">
          <span className="text-[15px] font-bold">하려는 수행평가</span>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="예: 시 감상문, 실험 보고서, 찬반 논설문"
            className="min-h-12 rounded-2xl border border-line bg-paper px-4 text-[15px]"
          />
        </label>
        {mine.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[13px] text-muted">내 수행평가로 찾기</span>
            {mine.map((e) => (
              <button key={e.id} type="button" onClick={() => setText(`${e.title} ${e.task}`)} className={chip(text.startsWith(e.title))}>
                {e.title}
              </button>
            ))}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[13px] text-muted">과목</span>
          {["", ...new Set(CASES.map((c) => c.subject))].map((s) => (
            <button key={s || "all"} type="button" onClick={() => setSubject(s)} className={chip(subject === s)}>
              {s || "전체"}
            </button>
          ))}
          <span className="mr-1 ml-3 text-[13px] text-muted">학년</span>
          {[0, ...GRADES].map((g) => (
            <button key={g} type="button" onClick={() => setGrade(g)} className={chip(grade === g)}>
              {g ? `${g}학년` : "전체"}
            </button>
          ))}
        </div>
      </section>

      <span className="text-[13px] text-muted">
        사례 {list.length}개 · {text.trim() ? "하려는 수행평가와 비슷한 순서" : "같은 과목·추천 많은 순서"}
      </span>

      {list.map(({ c, s }) => (
        <CaseCard
          key={c.id}
          c={c}
          score={text.trim() ? s : null}
          open={open === c.id}
          onToggle={() => setOpen((o) => (o === c.id ? null : c.id))}
          liked={likes.includes(c.id)}
          onLike={() => toggleLike(c.id)}
          canCopy={c.subject === me?.subject}
        />
      ))}
      {list.length === 0 && <p className="m-0 text-sub">조건에 맞는 사례가 없어요. 과목이나 학년을 바꿔 보세요.</p>}
      <span className="text-xs text-muted">학교·선생님 이름과 운영 결과는 모두 시연용 가상 데이터예요.</span>
    </TeacherShell>
  );
}

function CaseCard(props: { c: CommunityCase; score: number | null; open: boolean; onToggle: () => void; liked: boolean; onLike: () => void; canCopy: boolean }) {
  const { c, score } = props;
  return (
    <article className={`${homeCard} flex flex-col gap-3.5 p-6 max-sm:p-4`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 text-[13px]">
          <span className="rounded-full bg-leaf-bg px-3 py-1 font-bold text-leaf">
            {c.subject} · {c.grade}학년
          </span>
          <span className="text-sub">
            {c.school} · {c.teacher} 선생님
          </span>
        </div>
        {score !== null && (
          <span className={`rounded-full px-3 py-1 text-[13px] font-bold ${score >= 60 ? "bg-[#FBF0D3] text-[#7C5300]" : "bg-cream-2 text-muted"}`}>비슷함 {score}%</span>
        )}
      </div>
      <h2 className="m-0 font-display text-[23px] font-normal">{c.title}</h2>
      <p className="m-0 text-[15px] leading-relaxed text-sub">{c.task}</p>
      <div className="flex flex-wrap gap-1.5">
        {c.tags.map((t) => (
          <span key={t} className="rounded-full border border-line px-2.5 py-0.5 text-[12px] text-muted">
            #{t}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2 max-sm:grid-cols-1">
        {[
          [`${c.result.students}명`, "응시 학생"],
          [`${c.result.avgQuestions}번`, "학생당 평균 질문"],
          [`${c.result.blockedRate}%`, "대신 써 달라는 요청"],
        ].map(([v, l]) => (
          <div key={l} className="rounded-2xl bg-cream-2 px-4 py-2.5">
            <div className="font-display text-xl text-leaf">{v}</div>
            <div className="text-[12px] text-muted">{l}</div>
          </div>
        ))}
      </div>
      <p className="m-0 rounded-2xl bg-leaf-bg px-4 py-3 text-[14px] leading-relaxed text-ink">
        <b className="text-leaf">운영 후기</b> {c.result.note}
      </p>

      {props.open && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-left text-[14px]">
            <thead>
              <tr className="text-[13px] text-muted">
                <th className="py-2 pr-3 font-bold">항목</th>
                <th className="py-2 pr-3 font-bold">AI에게 물어도 되는 것</th>
                <th className="py-2 pr-3 font-bold">AI가 하지 않는 것</th>
                <th className="py-2 font-bold">권장 질문</th>
              </tr>
            </thead>
            <tbody>
              {c.itemGuides.map((g, i) => (
                <tr key={i} className="border-t border-line align-top">
                  <td className="py-2.5 pr-3 font-bold">{c.shortItems[i]}</td>
                  <td className="py-2.5 pr-3 text-sub">{g.help}</td>
                  <td className="py-2.5 pr-3 text-sub">{g.avoid}</td>
                  <td className="py-2.5">
                    <span className="inline-flex items-center gap-1">
                      <Acorn size={14} /> {g.acorns}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="m-0 mt-2 text-[13px] text-sub">{c.rationale}</p>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3.5">
        <div className="flex items-center gap-4 text-[14px]">
          <button type="button" onClick={props.onToggle} aria-expanded={props.open} className="cursor-pointer border-0 bg-transparent p-0 font-bold text-ink underline underline-offset-4">
            {props.open ? "AI 활용 기준 접기" : "AI 활용 기준 보기"}
          </button>
          <button type="button" onClick={props.onLike} aria-pressed={props.liked} className={`cursor-pointer border-0 bg-transparent p-0 ${props.liked ? "font-bold text-leaf" : "text-sub"}`}>
            {props.liked ? "♥" : "♡"} 도움돼요 {c.likes + (props.liked ? 1 : 0)}
          </button>
          <span className="text-[13px] text-muted">가져간 선생님 {c.copies}명</span>
        </div>
        {props.canCopy ? (
          <Link href={`/teacher/new?case=${c.id}`} className="inline-flex min-h-11 items-center rounded-2xl bg-leaf px-5 text-[15px] font-bold text-white no-underline hover:bg-leaf-2">
            내 수행평가로 가져오기
          </Link>
        ) : (
          <span className="text-[13px] text-muted">담당 과목 사례만 가져올 수 있어요</span>
        )}
      </div>
    </article>
  );
}
