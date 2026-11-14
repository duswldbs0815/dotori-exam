// 서버 전용: 교사 리포트 만들기 (전후 비교, 작성 경로 판정, 반 전체 집계)
import DiffMatchPatch from "diff-match-patch";
import { DEFAULT_MAX, DEFAULT_SCALE } from "./grading";
import { DEFAULT_CLASS_ID, toStudentExam } from "./school";
import { editOf, totalUsed, usedPerItem, type AttemptRecord } from "./store";
import {
  QUESTION_TYPES,
  STAGES,
  type ClassReportResponse,
  type ExamDef,
  type DiffPart,
  type PerItem,
  type ReportQuestion,
  type ReportSentence,
  type CheckFlag,
  type StudentReportResponse,
  type Timelapse,
  type TimelapseEdit,
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

/** 질문 뒤 문장이 AI 답의 "새 내용"과 이 정도 이상 겹치면 답을 반영한 것으로 봄 (글자 2개 묶음 개수) */
const NEW_CONTENT_OVERLAP = 3;

const bigrams = (s: string) => {
  const n = norm(s);
  const set = new Set<string>();
  for (let i = 0; i < n.length - 1; i++) set.add(n.slice(i, i + 2));
  return set;
};

/** 판정이 필요한 문장 하나: 어느 질문 뒤에 생겼는지와 그 질문의 답 */
export type PathCandidate = {
  text: string;
  /** null이면 첫 질문 전부터 있던 문장 (self 확정) */
  question: { acornNo: number | null; question: string; answer: string; before: string } | null;
  /** AI 답 문장과 거의 같음 (ai 확정) */
  nearCopy: boolean;
  /** 1차 판정: AI 답에서 처음 나온 내용과 겹침 */
  overlapsNewContent: boolean;
};

/** 제출한 글을 문장으로 나누고, 각 문장이 처음 생긴 시점과 1차 판정 근거를 계산 */
export function pathCandidates(rec: AttemptRecord, final: string): PathCandidate[] {
  const charged = rec.questions.filter((q) => q.charged);
  const snapshots = charged.map((q) => norm(q.before)); // 각 질문 직전 글
  return splitSentences(final).map((text) => {
    const n = norm(text);
    // 이 문장이 처음 나타난 시점: 몇 번째 질문 직전 글에 이미 있었나
    let firstIdx = snapshots.findIndex((snap) => n.length > 0 && snap.includes(n));
    if (firstIdx === -1) firstIdx = snapshots.length; // 마지막 질문 이후(제출 직전)에 생김
    if (firstIdx === 0) return { text, question: null, nearCopy: false, overlapsNewContent: false };

    const q = charged[firstIdx - 1]; // 이 문장이 생기기 직전 질문
    const best = Math.max(0, ...splitSentences(q.answer).map((a) => similarity(text, a)), similarity(text, q.answer));
    // AI 답에서 "처음 나온" 내용: 질문 직전 글에는 없던 글자 묶음만 셈 (원래 쓰던 말은 제외)
    const known = bigrams(q.before);
    const fresh = [...bigrams(q.answer)].filter((g) => !known.has(g));
    const mine = bigrams(text);
    const overlap = fresh.filter((g) => mine.has(g)).length;
    return {
      text,
      question: { acornNo: q.acornNo, question: q.question, answer: q.answer, before: q.before },
      nearCopy: best >= AI_SIMILARITY,
      overlapsNewContent: overlap >= NEW_CONTENT_OVERLAP,
    };
  });
}

/**
 * 1차 판정 (빠름): 문장마다 작성 경로를 정함.
 * - 첫 질문 전부터 있던 문장 → self
 * - 질문 뒤에 생긴 문장: AI 답과 거의 같으면 ai, AI 답의 새 내용과 겹치면 revised, 아니면 self
 * 판정은 교사가 볼 단서일 뿐, 표절 판정이 아닙니다.
 */
export function heuristicPaths(cands: PathCandidate[]): ReportSentence[] {
  return cands.map((c) => {
    if (!c.question) return { text: c.text, path: "self" };
    const acornNo = c.question.acornNo ?? undefined;
    if (c.nearCopy) return { text: c.text, path: "ai", acornNo };
    if (c.overlapsNewContent) return { text: c.text, path: "revised", acornNo };
    return { text: c.text, path: "self" };
  });
}

/** 제출 때 AI가 판정해 저장한 결과가 있으면 그걸, 없으면 1차 판정을 씀 */
function sentencePaths(rec: AttemptRecord, final: string): ReportSentence[] {
  if (rec.sentencePaths && rec.sentencePathsFor === final) return rec.sentencePaths;
  return heuristicPaths(pathCandidates(rec, final));
}

/** 한 번 저장에 이만큼 넘게 생기면 "한꺼번에 들어온 글"로 표시 (판정이 아니라 확인할 구간 표시) */
const PASTE_CHARS = 80;
const PASTE_WINDOW_MS = 20_000;

/** 타임랩스: 실제 저장 기록이 있으면 그걸, 없으면 질문 직전 글들과 최종 글로 만듦 */
export function buildTimelapse(rec: AttemptRecord, final: string): Timelapse {
  const log = rec.draftLog ?? [];
  if (log.length) {
    let prevT = Date.parse(rec.startedAt);
    const edits = log.map((e) => {
      const now = Date.parse(e.t);
      const paste = e.ins.length >= PASTE_CHARS && now - prevT <= PASTE_WINDOW_MS;
      prevT = now;
      return paste ? { ...e, paste } : e;
    });
    return { start: rec.startedAt, source: "log", edits };
  }
  const snaps: { t: string; text: string }[] = rec.questions.map((q) => ({ t: q.time, text: q.before }));
  snaps.push({ t: rec.submittedAt ?? rec.draftSavedAt ?? rec.startedAt, text: final });
  const edits: TimelapseEdit[] = [];
  let prev = "";
  for (const s of snaps) {
    const e = editOf(prev, s.text, s.t);
    if (e) edits.push(e);
    prev = s.text;
  }
  return { start: rec.startedAt, source: "snapshots", edits };
}

/** 먼저 확인할 학생 표시. 점수·판정이 아니라 "이 부분을 보세요" */
/** 선생님이 정한 권장 질문 수 합 (수행평가 만들 때 항목마다 정함) */
export const recommendedTotal = (exam: Pick<ExamDef, "itemGuides">) => exam.itemGuides.reduce((a, g) => a + (g.acorns || 0), 0);

/** 🔄 11/14 학생은 계획을 세우지 않으므로, "많이 물음"은 선생님 권장 질문 수와 비교 (예전 기록도 같은 기준) */
export function checkFlags(rec: AttemptRecord, exam?: Pick<ExamDef, "itemGuides">): CheckFlag[] {
  const flags: CheckFlag[] = [];
  const final = rec.final ?? rec.draft;
  const pastes = (rec.draftLog?.length ? buildTimelapse(rec, final).edits : []).filter((e) => e.paste).length;
  if (pastes) flags.push({ code: "paste", label: `한꺼번에 들어온 글 ${pastes}번` });
  const blocked = rec.questions.filter((q) => q.blocked).length;
  if (blocked >= 2) flags.push({ code: "blocked", label: `대신 써 달라는 요청 ${blocked}번` });
  const recommended = exam ? recommendedTotal(exam) : 0;
  const used = totalUsed(rec);
  if (exam && used - recommended >= 4) flags.push({ code: "over", label: `권장보다 질문 ${used - recommended}개 많음` });
  if (final) {
    const ai = sentencePaths(rec, final).filter((s) => s.path === "ai").length;
    if (ai >= 2) flags.push({ code: "ai", label: `AI 답과 비슷한 문장 ${ai}개` });
  }
  return flags;
}

export function buildStudentReport(rec: AttemptRecord, examDef: ExamDef): StudentReportResponse {
  const final = rec.final ?? rec.draft;
  const questions: ReportQuestion[] = rec.questions.map((q, i) => {
    // "질문 후" = 다음 답변 받은 질문 직전의 글 (차단된 요청은 답이 없으니 건너뜀). 없으면 최종 글
    const next = rec.questions.slice(i + 1).find((n) => !n.blocked);
    const after = next ? next.before : final;
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
    classId: rec.classId || DEFAULT_CLASS_ID,
    examId: examDef.id,
    exam: { ...toStudentExam(examDef), itemGuides: examDef.itemGuides },
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
    timelapse: buildTimelapse(rec, final),
    grade: rec.grade ?? null,
    grading: {
      scale: examDef.grading?.scale ?? DEFAULT_SCALE,
      max: examDef.grading?.max ?? DEFAULT_MAX,
      ...(examDef.grading?.itemMax ? { itemMax: examDef.grading.itemMax } : {}),
    },
    ...(examDef.criteria ? { criteria: examDef.criteria } : {}),
    aiGrade: rec.aiGrade && rec.aiGradeFor === final ? rec.aiGrade : null,
    flags: checkFlags(rec, examDef),
  };
}

export function buildClassReport(recs: AttemptRecord[], examDef?: ExamDef): ClassReportResponse {
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
    exam: examDef ? toStudentExam(examDef) : undefined,
    students: recs.map((r) => ({
      attemptId: r.attemptId,
      studentId: r.student.id,
      name: r.student.name,
      totalPlanned: r.acornPlan ? r.acornPlan.reduce((a, b) => a + b, 0) : 0,
      totalUsed: totalUsed(r),
      flags: checkFlags(r, examDef),
      grade: r.grade ?? null,
      aiGraded: !!r.aiGrade && r.aiGradeFor === (r.final ?? r.draft),
      blockedCount: r.questions.filter((q) => q.blocked).length,
      submitted: r.submittedAt !== null,
    })),
    matrix: { stages: STAGES, types: QUESTION_TYPES, counts },
    acornsByOutlineItem: { planned, used },
    blockedTotal,
  };
}
