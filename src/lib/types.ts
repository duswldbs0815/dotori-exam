// 프론트·백엔드 공용 타입. 형식 설명은 docs/API.md 참고.

export const OUTLINE_ITEMS = ["주제·배경지식", "문법·어휘", "해석과 근거", "비평과 고쳐쓰기"] as const;

export const STAGES = ["계획하기", "내용 생성", "내용 조직", "표현하기", "고쳐쓰기"] as const;
export const QUESTION_TYPES = ["사실 확인 요청", "생각 확장 요청", "글 점검 요청", "대신 작성 요청"] as const;

export type Stage = (typeof STAGES)[number];
export type QuestionType = (typeof QUESTION_TYPES)[number];
/** 1~4: 어느 개요 항목에 대한 질문인지 */
export type OutlineItemNo = 1 | 2 | 3 | 4;
export type Outline = [string, string, string, string];
export type Reflection = [string, string, string, string];

export type ExamInfo = {
  title: string;
  outlineItems: readonly string[];
  acornTotal: number;
  maxAnswerSentences: number;
};

export type ApiError = { error: string };

// POST /api/exam/start
export type StartRequest = { studentId: string; name: string; verified: boolean };
export type StartResponse = { attemptId: string; exam: ExamInfo; acornsLeft: number };

// POST /api/outline
export type OutlineRequest = { attemptId: string; outline: Outline };
export type OkResponse = { ok: true };

// POST /api/draft
export type DraftRequest = { attemptId: string; text: string };
export type DraftResponse = { ok: true; savedAt: string };

// POST /api/ask
export type AskRequest = {
  attemptId: string;
  question: string;
  outlineItem: OutlineItemNo;
  selectedText: string;
  selection: { start: number; end: number } | null;
  draft: string;
};
export type AskResponse = {
  blocked: boolean;
  charged: boolean;
  acornNo: number | null;
  answer: string;
  acornsLeft: number;
};

// GET /api/attempt/:attemptId (학생 화면용: 분류·비교 정보 없음)
export type StudentQuestion = {
  acornNo: number | null;
  time: string;
  outlineItem: OutlineItemNo;
  question: string;
  answer: string;
  blocked: boolean;
};
export type AttemptStateResponse = {
  attemptId: string;
  outline: Outline | null;
  draft: string;
  acornsLeft: number;
  acornsByOutlineItem: [number, number, number, number];
  questions: StudentQuestion[];
  submitted: boolean;
};

// POST /api/submit
export type SubmitRequest = { attemptId: string; final: string; reflection: Reflection };
export type SubmitResponse = { ok: true; submittedAt: string };

// GET /api/report/:studentId (교사용)
export type DiffPart = { op: "same" | "add" | "del"; text: string };
export type ReportQuestion = StudentQuestion & {
  selectedText: string;
  stage: Stage | null;
  type: QuestionType | null;
  before: string;
  after: string;
  diff: DiffPart[];
};
export type SentencePath = "self" | "revised" | "ai";
export type ReportSentence = { text: string; path: SentencePath; acornNo?: number };
export type StudentReportResponse = {
  student: { id: string; name: string };
  exam: ExamInfo;
  outline: Outline | null;
  final: string;
  reflection: Reflection | null;
  submittedAt: string | null;
  acorns: { used: number; byOutlineItem: [number, number, number, number] };
  blockedCount: number;
  questions: ReportQuestion[];
  sentences: ReportSentence[];
};

// GET /api/report/class (교사용, P2)
export type ClassReportResponse = {
  students: { studentId: string; name: string; acornsUsed: number; blockedCount: number; submitted: boolean }[];
  matrix: { stages: readonly Stage[]; types: readonly QuestionType[]; counts: number[][] };
  acornsByOutlineItem: [number, number, number, number];
  blockedTotal: number;
};
