// 교사 커뮤니티: 다른 학교(가상) 선생님들이 공유한 수행평가 사례와 "내 수행평가와 비슷한 사례" 찾기.
// 클라이언트·서버 공용 (AI 호출 없음, 글자 겹침으로 비슷한 정도를 셈)
import data from "@/data/community.json";
import type { ExamSuggestion, ItemGuide } from "./types";

export type CommunityCase = {
  id: string;
  school: string;
  teacher: string;
  subject: string;
  grade: number;
  unit: string;
  title: string;
  task: string;
  outlineItems: string[];
  shortItems: string[];
  itemGuides: ItemGuide[];
  rationale: string;
  tags: string[];
  likes: number;
  copies: number;
  result: { students: number; avgQuestions: number; blockedRate: number; note: string };
};

export const CASES: CommunityCase[] = data.cases;
export const findCase = (id: string | null | undefined) => CASES.find((c) => c.id === id) ?? null;

/** 두 글자씩 끊은 조각 (띄어쓰기·문장부호 무시) */
const grams = (s: string) => {
  const t = s.replace(/[^\p{L}\p{N}]/gu, "");
  const out = new Set<string>();
  for (let i = 0; i < t.length - 1; i++) out.add(t.slice(i, i + 2));
  return out;
};

/** 내가 하려는 수행평가와 비슷한 정도 (0~100) */
export function similarity(c: CommunityCase, want: { subject?: string; grade?: number; text?: string }): number {
  let score = 0;
  if (want.subject && c.subject === want.subject) score += 40;
  if (want.grade && c.grade === want.grade) score += 15;
  const text = (want.text ?? "").trim();
  if (text) {
    const a = grams(text);
    const b = grams(`${c.title} ${c.task} ${c.unit} ${c.tags.join(" ")}`);
    let hit = 0;
    a.forEach((g) => b.has(g) && hit++);
    score += Math.round(Math.min(1, hit / Math.max(6, a.size * 0.5)) * 45);
  }
  return Math.min(100, score);
}

/** 사례를 새 수행평가 초안으로 (교사가 고쳐서 배포) */
export function caseToSuggestion(c: CommunityCase, reflectionQuestions: string[]): ExamSuggestion {
  return {
    title: c.title,
    outlineItems: [...c.outlineItems],
    shortItems: [...c.shortItems],
    itemGuides: c.itemGuides.map((g) => ({ ...g })),
    reflectionQuestions: [...reflectionQuestions],
    rationale: c.rationale,
    blockedExamples: [],
    materials: [],
    source: "community",
  };
}
