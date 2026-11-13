// 서버 전용: 교사 리포트 만들기 (전후 비교, 작성 경로 판정, 반 전체 집계)
import DiffMatchPatch from "diff-match-patch";
import { EXAM_CONFIG } from "./exam-config";
import { totalUsed, usedPerItem, type AttemptRecord } from "./store";
import {
  QUESTION_TYPES,
  STAGES,
  type ClassReportResponse,
  type DiffPart,
  type PerItem,
  type ReportQuestion,
  type ReportSentence,
  type StudentReportResponse,
} from "./types";

/** AI 답과 이 정도 이상 비슷하면 "AI 답변 활용" */
const AI_SIMILARITY = 0.7;

const dmp = new DiffMatchPatch();

export function diffText(before: string, after: string): DiffPart[] {
  const d = dmp.diff_main(before, after);
  dmp.diff_cleanupSemantic(d);
  return d.map(([op, text]) => ({ op: op === 0 ? "same" : op === 1 ? "add" : "del", text }));
}

export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?。…])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

const norm = (s: string) => s.replace(/[\s"'“”‘’.,!?。…·「」『』()]/g, "");

/** 글자 2개씩 묶어 비교하는 유사도 (0~1) */
export function similarity(a: string, b: string): number {
  const x = norm(a);
  const y = norm(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  const grams = (s: string) => {
    const m = new Map<string, number>();
    for (let i = 0; i < s.length - 1; i++) m.set(s.slice(i, i + 2), (m.get(s.slice(i, i + 2)) ?? 0) + 1);
    return m;
  };
  const gx = grams(x);
  const gy = grams(y);
  let hit = 0;
  for (const [g, n] of gx) hit += Math.min(n, gy.get(g) ?? 0);
  const total = Math.max(1, x.length - 1) + Math.max(1, y.length - 1);
  return (2 * hit) / total;
}

/**
 * 제출한 글의 문장마다 작성 경로를 판정.
 * - 첫 질문 전부터 있던 문장: self (스스로 작성)
 * - k번째 질문 직후 구간에 처음 생긴 문장: AI 답과 70% 이상 비슷하면 ai, 아니면 revised (질문 후 수정)
 * 판정은 교사가 볼 단서일 뿐, 표절 판정이 아닙니다.
 */
function sentencePaths(rec: AttemptRecord, final: string): ReportSentence[] {
  const charged = rec.questions.filter((q) => q.charged);
  const snapshots = charged.map((q) => q.before); // 각 질문 직전 글
  const appearsIn = (sentence: string, text: string) => {
    const n = norm(sentence);
    return n.length > 0 && norm(text).includes(n);
  };

  return splitSentences(final).map((text) => {
    // 이 문장이 처음 나타난 시점: 몇 번째 질문 직전 글에 이미 있었나
    let firstIdx = snapshots.findIndex((snap) => appearsIn(text, snap));
    if (firstIdx === -1) firstIdx = snapshots.length; // 마지막 질문 이후(제출 직전)에 생김
    if (firstIdx === 0) return { text, path: "self" as const };

    const q = charged[firstIdx - 1]; // 이 문장이 생기기 직전 질문
    const best = Math.max(0, ...splitSentences(q.answer).map((a) => similarity(text, a)), similarity(text, q.answer));
    return { text, path: best >= AI_SIMILARITY ? ("ai" as const) : ("revised" as const), acornNo: q.acornNo ?? undefined };
  });
}

export function buildStudentReport(rec: AttemptRecord): StudentReportResponse {
  const final = rec.final ?? rec.draft;
  const questions: ReportQuestion[] = rec.questions.map((q, i) => {
    const after = i + 1 < rec.questions.length ? rec.questions[i + 1].before : final;
    return {
      acornNo: q.acornNo,
      time: q.time,
      outlineItem: q.outlineItem,
      question: q.question,
      answer: q.answer,
      blocked: q.blocked,
      selectedText: q.selectedText,
      stage: q.stage,
      type: q.type,
      before: q.before,
      after,
      diff: diffText(q.before, after),
    };
  });

  const planned = rec.acornPlan;
  const used = usedPerItem(rec);
  return {
    student: rec.student,
    exam: EXAM_CONFIG,
    outline: rec.outline,
    final,
    reflection: rec.reflection,
    submittedAt: rec.submittedAt,
    acorns: {
      planned,
      used,
      totalPlanned: planned ? planned.reduce((a, b) => a + b, 0) : 0,
      totalUsed: totalUsed(rec),
    },
    blockedCount: rec.questions.filter((q) => q.blocked).length,
    questions,
    sentences: final ? sentencePaths(rec, final) : [],
  };
}

export function buildClassReport(recs: AttemptRecord[]): ClassReportResponse {
  const counts = STAGES.map(() => QUESTION_TYPES.map(() => 0));
  const planned: PerItem = [0, 0, 0, 0];
  const used: PerItem = [0, 0, 0, 0];
  let blockedTotal = 0;

  for (const rec of recs) {
    for (const q of rec.questions) {
      if (q.blocked) blockedTotal++;
      const si = q.stage ? STAGES.indexOf(q.stage) : -1;
      const ti = q.type ? QUESTION_TYPES.indexOf(q.type) : -1;
      if (si >= 0 && ti >= 0) counts[si][ti]++;
    }
    const u = usedPerItem(rec);
    for (let i = 0; i < 4; i++) {
      used[i] += u[i];
      planned[i] += rec.acornPlan?.[i] ?? 0;
    }
  }

  return {
    students: recs.map((r) => ({
      studentId: r.student.id,
      name: r.student.name,
      totalPlanned: r.acornPlan ? r.acornPlan.reduce((a, b) => a + b, 0) : 0,
      totalUsed: totalUsed(r),
      blockedCount: r.questions.filter((q) => q.blocked).length,
      submitted: r.submittedAt !== null,
    })),
    matrix: { stages: STAGES, types: QUESTION_TYPES, counts },
    acornsByOutlineItem: { planned, used },
    blockedTotal,
  };
}
