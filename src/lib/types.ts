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
  /** 아래는 교사가 만든 수행평가에서 채워짐 (기본 「진달래꽃」에도 채워 둠) */
  id?: string;
  subject?: string;
  grade?: number;
  /** 과제 설명 (AI 지시문에 들어감) */
  task?: string;
  /** 개요 항목 짧은 이름 (칩·그래프용) */
  shortItems?: readonly string[];
  /** 항목별 AI가 도와도 되는 범위와 권장 도토리 (교사용 기준. 학생 화면에는 권장 수만 안내) */
  itemGuides?: readonly ItemGuide[];
  /** 학생에게 보여 줄 지문·자료 (예: 「진달래꽃」 전문, 실험 안내). 없으면 과제 설명만 보여 줌 */
  passage?: Passage;
};

/** 시험지 옆에 펼쳐 보는 지문·자료 */
export type Passage = { title: string; author?: string; body: string; source?: string };

/** 개요 항목 하나에 대한 AI 활용 기준 */
export type ItemGuide = { help: string; avoid: string; acorns: number };

/** 교사가 만든(또는 기본 제공) 수행평가 */
export type ExamDef = ExamInfo & {
  id: string;
  subject: string;
  grade: number;
  task: string;
  unit: string;
  shortItems: string[];
  itemGuides: ItemGuide[];
  /** 배포한 반 ("2-3" 형식) */
  classIds: string[];
  /** 🔄 11/14 배포한 반 중 마감한 반 (새로 시작 불가, 기록·채점은 그대로) */
  closedClassIds?: string[];
  /** 교사가 올린 자료 (이름과 글자 수만 저장) */
  materials: { name: string; chars: number }[];
  /** 🔄 기본 채점 단계 (없으면 상·중·하). itemMax: 점수 채점일 때 항목별 배점 (없으면 모두 max) */
  grading?: { scale: GradeScale; max?: number; itemMax?: number[] };
  /** 🔄 11/14 평가 항목별 채점 기준 (예: "상: … / 중: … / 하: …"). 교사 전용, 학생 화면에 안 보냄 */
  criteria?: string[];
  /** AI가 이 기준을 제안한 이유 */
  rationale: string;
  createdAt: string;
  builtIn?: boolean;
};

// POST /api/teacher/exams/suggest (multipart: subject, grade, task, unit, notes, files)
export type ExamSuggestion = {
  title: string;
  outlineItems: string[];
  shortItems: string[];
  itemGuides: ItemGuide[];
  reflectionQuestions: string[];
  /** 🔄 항목별 채점 기준 초안 */
  criteria?: string[];
  /** 🔄 채점기준표에 항목별 배점이 있으면 그대로 (점수 채점) */
  itemMax?: number[];
  rationale: string;
  blockedExamples: string[];
  materials: { name: string; chars: number }[];
  /** ai: LLM이 만듦 / preset: AI 연결이 없어 과목별 예시를 보여 줌 */
  source: "ai" | "preset" | "community";
};
// POST /api/teacher/exams
export type SaveExamRequest = Omit<ExamDef, "id" | "createdAt" | "builtIn" | "acornPlanMaxPerItem" | "acornSafetyCap">;
export type SaveExamResponse = { exam: ExamDef };
// GET /api/exams?classId=2-3 (학생 시작 화면)
export type ClassExamsResponse = { exams: { id: string; title: string; subject: string; grade: number }[] };
// GET /api/teacher/school (교사 홈)
// POST /api/teacher/exams/classes (교사): 반 배포·마감
export type ExamClassesRequest = { examId: string; classIds: string[]; closedClassIds: string[] };

export type SchoolOverviewResponse = {
  school: string;
  /** 로그인한 교사. exams·classes는 이 교사 과목 것만 */
  teacher: TeacherAccount;
  exams: ExamDef[];
  classes: {
    classId: string;
    exams: { examId: string; total: number; submitted: number; blocked: number; avgAcorns: number }[];
  }[];
};

export type ApiError = { error: string };

// POST /api/exam/start
export type StartRequest = { studentId: string; name: string; verified: boolean; examId?: string; classId?: string };
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
/** 🔄 채점 (교사 전용). scale: 3 상·중·하 / 5 A~E / pf 통과·미통과 / points 점수 */
export type GradeScale = "3" | "5" | "pf" | "points";
export type Grade = {
  scale: GradeScale;
  /** 점수 채점일 때 항목별 만점 */
  max?: number;
  /** 🔄 점수 채점일 때 항목별 배점 (있으면 max 대신) */
  itemMax?: number[];
  /** 개요 항목별 값 (단계 이름 또는 점수). 아직 안 매기면 null */
  items: (string | number | null)[];
  /** "AI 활용" 항목을 켰을 때만 있음 */
  ai?: string | number | null;
  /** 나이스·세특에 옮길 평가 근거 한 줄 (교사가 씀) */
  comment: string;
  gradedAt: string;
};
export type GradeRequest = Omit<Grade, "gradedAt">;
/** 🔄 11/14 AI 1차 채점: 교사가 정한 채점 기준만 보고 매긴 제안. 확정은 교사가 (Grade) */
export type AiGrade = {
  scale: GradeScale;
  max?: number;
  itemMax?: number[];
  items: (string | number | null)[];
  /** 항목별 이유 한 문장 (학생 글 근거) */
  reasons: string[];
  at: string;
};
// POST /api/report/:studentId/ai-grade (교사)
/** 본문 생략 가능. 주면 그 채점 단계로 (교사가 채점 칸에서 고른 단계) */
export type AiGradeRequest = { scale?: GradeScale; max?: number; itemMax?: number[] };
export type AiGradeResponse = { aiGrade: AiGrade };
// POST /api/report/class/accept-ai (교사): 확인할 점 없는 학생의 AI 제안을 교사 채점으로 확정
export type AcceptAiRequest = { classId: string; examId: string };
export type AcceptAiResponse = { accepted: string[]; skipped: { flagged: number; graded: number; noAi: number } };
/** 학생 확인이 필요한 이유 (판정이 아니라 먼저 볼 학생 표시) */
export type CheckFlag = { code: "paste" | "blocked" | "over" | "ai"; label: string };

/** 🔄 타임랩스: 글이 저장될 때마다 바뀐 부분. 처음 빈 글에 edits를 차례로 적용하면 최종 글 */
export type TimelapseEdit = { t: string; at: number; del: number; ins: string; paste?: boolean };
export type Timelapse = {
  start: string;
  /** log: 10초마다 저장한 실제 기록 / snapshots: 기록이 없는 예전 응시라 질문 직전 글과 최종 글로 만든 것 (구간이 큼) */
  source: "log" | "snapshots";
  edits: TimelapseEdit[];
};
export type StudentReportResponse = {
  student: { id: string; name: string };
  /** 학년-반, 수행평가 ID (반 리포트로 돌아가는 링크용) */
  classId?: string;
  examId?: string;
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
  timelapse: Timelapse;
  /** 🔄 교사 채점 (아직 안 했으면 null) */
  grade: Grade | null;
  /** 이 수행평가의 기본 채점 단계 */
  grading: { scale: GradeScale; max: number; itemMax?: number[] };
  /** 🔄 항목별 채점 기준 (교사가 수행평가 만들 때 정함) */
  criteria?: string[];
  /** 🔄 AI 1차 채점 제안 (제출한 글이 그 뒤 바뀌지 않았을 때만) */
  aiGrade: AiGrade | null;
  flags: CheckFlag[];
};

// 교사 로그인: POST /api/teacher/login, GET /api/teacher/me
export type TeacherLoginRequest = { id: string; password: string };
/** 로그인한 교사 (과목 하나 담당) */
export type TeacherAccount = { id: string; name: string; subject: string };
export type TeacherMeResponse = { teacher: boolean; account?: TeacherAccount };

// GET /api/report/class?classId=&examId= (교사용)
export type ClassReportResponse = {
  exam?: ExamInfo;
  students: {
    attemptId: string;
    studentId: string;
    name: string;
    totalPlanned: number;
    totalUsed: number;
    blockedCount: number;
    submitted: boolean;
    /** 🔄 먼저 확인할 이유 */
    flags: CheckFlag[];
    grade: Grade | null;
    /** 🔄 AI 1차 채점 제안이 있는지 */
    aiGraded: boolean;
  }[];
  matrix: { stages: readonly Stage[]; types: readonly QuestionType[]; counts: number[][] };
  acornsByOutlineItem: { planned: PerItem; used: PerItem };
  blockedTotal: number;
};

// ── 학생 마이페이지 ─────────────────────────────────────────
// GET /api/me (학생 본인 쿠키 필요). 학생에게 보여도 되는 값만: 분류·작성 경로·전후 비교는 넣지 않음
export type MyAttempt = {
  attemptId: string;
  examId: string;
  classId: string;
  title: string;
  subject: string;
  labels: string[];
  startedAt: string;
  submittedAt: string | null;
  /** 🔄 11/14 선생님 권장 도토리 (항목별). 학생이 정하는 계획은 없앰 */
  recommended: number[];
  used: PerItem;
  questionCount: number;
  blockedCount: number;
  reflectionDone: number;
  chars: number;
  questions: { time: string; outlineItem: OutlineItemNo; question: string; answer: string; blocked: boolean }[];
};
export type MyPageResponse = { student: { id: string; name: string }; attempts: MyAttempt[] };
// POST /api/me/login
export type MeLoginRequest = { studentId: string; name: string };

// GET /api/report/class/insights : 반 전체 "수업 단서" (AI가 질문을 묶고 다음 수업 제안)
export type InsightCard = {
  /** 한 줄 제목 (예: "'즈려밟고' 같은 옛말 시어 뜻을 물었어요") */
  title: string;
  /** 이 질문들이 보여 주는 것 */
  detail: string;
  /** 다음 수업 제안 */
  suggestion: string;
  /** 이 묶음에 해당하는 학생 수 / 질문 수 (서버가 셈) */
  students: number;
  questions: number;
  /** 개요 항목 (가장 많이 나온 것) */
  item: string | null;
  /** 실제 질문 예시 1~2개 */
  examples: string[];
  /** 대신 써 달라는 요청 묶음인지 */
  blocked: boolean;
};

export type ClassInsightsResponse = {
  cards: InsightCard[];
  basedOn: { students: number; questions: number; blocked: number };
  generatedAt: string;
  /** ai: AI가 정리 / none: 질문이 너무 적어서 정리하지 않음 / error: AI 연결 실패 */
  source: "ai" | "none" | "error";
  /** 저장된 결과를 먼저 보여 주는 중 (그사이 새 질문이 생겨 뒤에서 다시 만드는 중) */
  stale?: boolean;
};
