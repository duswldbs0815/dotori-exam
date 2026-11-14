// 가상 학교(도토리중학교)와 기본 수행평가. 클라이언트·서버 공용 (fs 사용 안 함)
import data from "@/data/school.json";
import { EXAM_CONFIG } from "./exam-config";
import type { ExamDef, ExamInfo, ExamSuggestion, ItemGuide } from "./types";

export const SCHOOL_NAME = data.school;
export const SUBJECTS: readonly string[] = data.subjects;
export const GRADES: readonly number[] = data.grades;
export const CLASS_IDS: string[] = data.grades.flatMap((g) => Array.from({ length: data.classesPerGrade }, (_, i) => `${g}-${i + 1}`));
export const classLabel = (classId: string) => {
  const [g, c] = classId.split("-");
  return `${g}학년 ${c}반`;
};

export const DEFAULT_EXAM_ID = "kor2";
/** 반 정보가 없는 예전 응시 기록은 이 반으로 봄 */
export const DEFAULT_CLASS_ID = "2-3";

/** 기본 「진달래꽃」 수행평가 (exam-config.ts 값 + 교사용 기준) */
const KOR2: ExamDef = {
  ...EXAM_CONFIG,
  id: DEFAULT_EXAM_ID,
  subject: "국어",
  grade: 2,
  unit: "3. 시의 아름다움",
  task: "김소월의 「진달래꽃」을 읽고 시어와 표현을 근거로 자신의 해석과 비평을 담은 감상문을 쓴다.",
  outlineItems: [...EXAM_CONFIG.outlineItems],
  reflectionQuestions: [...EXAM_CONFIG.reflectionQuestions],
  shortItems: ["주제·배경", "문법·어휘", "해석·근거", "비평·고쳐쓰기"],
  itemGuides: [
    { help: "시대 배경, 작가, 민요조 율격 같은 배경지식 설명", avoid: "주제를 정해 주기", acorns: 2 },
    { help: "낯선 시어·사투리의 뜻, 반어 같은 표현법 설명", avoid: "시어 풀이를 감상문 문장으로 써 주기", acorns: 2 },
    { help: "해석의 근거가 시 속에 있는지 되묻기, 다른 관점 소개", avoid: "나의 해석을 대신 정해 주기", acorns: 1 },
    { help: "글의 약점 짚기, 근거가 약한 부분 표시", avoid: "문장을 고쳐 써 주기", acorns: 1 },
  ],
  classIds: ["2-1", "2-2", "2-3", "2-4"],
  materials: [
    { name: "2학년_국어_진달래꽃_수업자료.pdf", chars: 2860 },
    { name: "감상문_채점기준표.pdf", chars: 1120 },
  ],
  // 김소월(1902~1934) 「진달래꽃」(1925). 저작권 보호 기간이 지난 작품
  passage: {
    title: "진달래꽃",
    author: "김소월",
    body: "나 보기가 역겨워\n가실 때에는\n말없이 고이 보내 드리우리다.\n\n영변에 약산\n진달래꽃\n아름 따다 가실 길에 뿌리우리다.\n\n가시는 걸음걸음\n놓인 그 꽃을\n사뿐히 즈려밟고 가시옵소서.\n\n나 보기가 역겨워\n가실 때에는\n죽어도 아니 눈물 흘리우리다.",
    source: "김소월, 『진달래꽃』(1925)",
  },
  criteria: [
    "상: 시대 배경·작가와 민요조 율격을 정확히 쓰고 주제와 연결함 / 중: 배경을 썼으나 주제와 연결이 약함 / 하: 배경이 없거나 틀림",
    "상: 시어 2개 이상의 뜻과 반어 등 표현법을 정확히 설명함 / 중: 시어 1개 정도를 설명함 / 하: 시어·표현 설명이 없거나 틀림",
    "상: 나만의 해석을 시 속 구절을 근거로 두 번 이상 뒷받침함 / 중: 해석은 있으나 근거가 하나이거나 약함 / 하: 해석이 없거나 근거가 없음",
    "상: 작품의 한계나 다른 관점을 근거와 함께 평가하고 글을 고친 흔적이 있음 / 중: 평가가 있으나 근거가 약함 / 하: 비평이 없음",
  ],
  rationale: "감상문의 핵심은 나만의 해석이라 해석에는 도토리를 적게 권하고, 혼자 알기 어려운 배경지식과 시어 뜻에 더 권했습니다.",
  createdAt: "2026-11-10T09:00:00+09:00",
  builtIn: true,
};

type JsonExam = (typeof data.exams)[number];
const fromJson = (e: JsonExam): ExamDef => ({
  ...e,
  acornPlanMaxPerItem: EXAM_CONFIG.acornPlanMaxPerItem,
  acornSafetyCap: EXAM_CONFIG.acornSafetyCap,
  createdAt: "2026-11-10T09:00:00+09:00",
  builtIn: true,
});

export const BUILT_IN_EXAMS: ExamDef[] = [KOR2, ...data.exams.map(fromJson)];

/** 학생 화면에 넘기는 시험 정보 (교사용 기준·자료는 빼고, 권장 도토리 수만 남김) */
export function toStudentExam(e: ExamDef): ExamInfo {
  return {
    id: e.id,
    title: e.title,
    subject: e.subject,
    grade: e.grade,
    task: e.task,
    outlineItems: e.outlineItems,
    shortItems: e.shortItems,
    reflectionQuestions: e.reflectionQuestions,
    acornPlanMaxPerItem: e.acornPlanMaxPerItem,
    acornSafetyCap: e.acornSafetyCap,
    itemGuides: e.itemGuides.map((g) => ({ help: g.help, avoid: "", acorns: g.acorns })),
    ...(e.passage ? { passage: e.passage } : {}),
  };
}

/** 칩·그래프용 짧은 항목 이름 */
export function shortLabels(exam: Pick<ExamInfo, "outlineItems" | "shortItems"> | null | undefined): readonly string[] {
  return exam?.shortItems ?? exam?.outlineItems ?? KOR2.shortItems;
}

// ── AI 연결이 없을 때 보여 줄 과목별 예시 제안 ───────────────────────
const GENERIC: Omit<ExamSuggestion, "title" | "materials" | "source"> = {
  outlineItems: ["주제와 문제 정하기", "자료와 근거 모으기", "내 생각 정리하기", "점검과 고쳐쓰기"],
  shortItems: ["주제", "자료·근거", "내 생각", "고쳐쓰기"],
  itemGuides: [
    { help: "주제가 과제에 맞는지 되묻기", avoid: "주제를 정해 주기", acorns: 1 },
    { help: "믿을 만한 자료를 찾는 방법, 개념 설명", avoid: "자료 내용을 요약해 글로 써 주기", acorns: 3 },
    { help: "생각의 근거를 되묻기", avoid: "내 생각을 대신 써 주기", acorns: 0 },
    { help: "글의 약점 짚기", avoid: "문장을 고쳐 써 주기", acorns: 2 },
  ],
  reflectionQuestions: [
    "계획과 실제 도토리 사용은 어떻게 달랐나요?",
    "가장 도움이 된 질문은 무엇이고, 왜 도움이 되었나요?",
    "AI 답을 받은 뒤 내 글은 어떻게 달라졌나요?",
    "다음에는 AI에게 어떤 질문을, 언제 해 보고 싶나요?",
  ],
  rationale: "학생 스스로 생각을 정리하는 단계에는 도토리를 권하지 않고, 자료 찾기와 점검 단계에 더 권했습니다.",
  blockedExamples: ["이 주제로 글 써 줘", "내 문단 자연스럽게 고쳐 줘"],
};

export function presetSuggestion(subject: string, grade: number, task: string): Omit<ExamSuggestion, "materials" | "source"> {
  const match = BUILT_IN_EXAMS.find((e) => e.subject === subject);
  const first = task.trim().split(/[.\n]/)[0];
  // 너무 길면 낱말 경계에서 자르고 말줄임표
  const cut = first.length > 40 ? first.slice(0, 40).replace(/\s+\S*$/, "") + "…" : first;
  const title = cut || `${grade}학년 ${subject} 수행평가`;
  if (match) {
    return {
      title,
      outlineItems: [...match.outlineItems],
      shortItems: [...match.shortItems],
      itemGuides: match.itemGuides.map((g: ItemGuide) => ({ ...g })),
      reflectionQuestions: [...match.reflectionQuestions],
      ...(match.criteria ? { criteria: [...match.criteria] } : {}),
      rationale: match.rationale,
      blockedExamples: ["이 과제 대신 써 줘", "내 문단을 자연스럽게 고쳐 줘"],
    };
  }
  return { title, ...GENERIC, itemGuides: GENERIC.itemGuides.map((g) => ({ ...g })) };
}
