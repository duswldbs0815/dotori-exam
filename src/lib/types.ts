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
/** 개요 항목 4개에 대한 숫자 (도토리 계획 수, 사용 수 등) */
export type PerItem = [number, number, number, number];

export type ExamInfo = {
  title: string;
  outlineItems: readonly string[];
  /** 성찰지 4문항 (화면에 그대로 띄움) */
  reflectionQuestions: readonly string[];
  /** 예상 질문 횟수 입력칸의 최대값 (입력 오류 방지용, 화면에 상한으로 표시하지 않음) */
  acornPlanMaxPerItem: number;
  /** 장난 방지용 안전장치 (학생에게 안 보임) */
  acornSafetyCap: number;
};

export type ApiError = { error: string };

// POST /api/exam/start
export type StartRequest = { studentId: string; name: string; verified: boolean };
export type StartResponse = { attemptId: string; exam: ExamInfo };

// POST /api/outline : 개요 4항목 + 항목별 도토리 계획
export type OutlineRequest = { attemptId: string; outline: Outline; acornPlan: PerItem };
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
  /** 질문한 개요 항목의 계획과 사용 (차감 반영 후) */
  item: { outlineItem: OutlineItemNo; planned: number; used: number };
  /** 그 항목이 목표치(acornPlan)보다 많이 쓰였는지. 기록용이며 질문을 막지 않음 */
  overPlan: boolean;
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
  acornPlan: PerItem | null;
  acornsUsed: PerItem;
  draft: string;
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
  /** 계획 vs 실제 사용 (성찰지 그래프와 같은 데이터) */
  acorns: { planned: PerItem | null; used: PerItem; totalPlanned: number; totalUsed: number };
  blockedCount: number;
  questions: ReportQuestion[];
  sentences: ReportSentence[];
};

// 교사 로그인: POST /api/teacher/login, GET /api/teacher/me
export type TeacherLoginRequest = { code: string };
export type TeacherMeResponse = { teacher: boolean };

// GET /api/report/class (교사용, P2)
export type ClassReportResponse = {
  students: {
    studentId: string;
    name: string;
    totalPlanned: number;
    totalUsed: number;
    blockedCount: number;
    submitted: boolean;
  }[];
  matrix: { stages: readonly Stage[]; types: readonly QuestionType[]; counts: number[][] };
  acornsByOutlineItem: { planned: PerItem; used: PerItem };
  blockedTotal: number;
};
