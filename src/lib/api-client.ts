// 브라우저에서 쓰는 API 호출 도우미. 형식은 docs/API.md, 타입은 ./types.ts 와 같습니다.
import type {
  Grade,
  GradeRequest,
  AskRequest,
  AskResponse,
  AttemptStateResponse,
  ClassExamsResponse,
  ClassReportResponse,
  ExamSuggestion,
  SaveExamRequest,
  SaveExamResponse,
  SchoolOverviewResponse,
  DraftResponse,
  ExamInfo,
  OkResponse,
  Outline,
  PerItem,
  Reflection,
  StartRequest,
  StartResponse,
  StudentReportResponse,
  SubmitResponse,
  TeacherMeResponse, MeLoginRequest, MyPageResponse, ExamClassesRequest } from "./types";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function call<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  let res: Response;
  const form = init?.body instanceof FormData;
  try {
    res = await fetch(path, {
      method: init?.method ?? (init?.body === undefined ? "GET" : "POST"),
      headers: init?.body === undefined || form ? undefined : { "Content-Type": "application/json" },
      body: init?.body === undefined ? undefined : form ? (init.body as FormData) : JSON.stringify(init.body),
      cache: "no-store",
    });
  } catch {
    throw new ApiError(0, "서버에 연결하지 못했어요. 네트워크를 확인해 주세요.");
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = data && typeof data.error === "string" ? data.error : `요청이 실패했어요 (${res.status})`;
    throw new ApiError(res.status, msg);
  }
  return data as T;
}

const enc = encodeURIComponent;

export const api = {
  start: (body: StartRequest) => call<StartResponse>("/api/exam/start", { body }),
  attempt: (attemptId: string) => call<AttemptStateResponse>(`/api/attempt/${enc(attemptId)}`),
  outline: (attemptId: string, outline: Outline, acornPlan: PerItem) =>
    call<OkResponse>("/api/outline", { body: { attemptId, outline, acornPlan } }),
  draft: (attemptId: string, text: string) => call<DraftResponse>("/api/draft", { body: { attemptId, text } }),
  ask: (body: AskRequest) => call<AskResponse>("/api/ask", { body }),
  submit: (attemptId: string, final: string, reflection: Reflection) =>
    call<SubmitResponse>("/api/submit", { body: { attemptId, final, reflection } }),

  teacherMe: () => call<TeacherMeResponse>("/api/teacher/me"),
  teacherLogin: (id: string, password: string) => call<TeacherMeResponse>("/api/teacher/login", { body: { id, password } }),
  teacherLogout: () => call<OkResponse>("/api/teacher/logout", { method: "POST", body: {} }),
  classReport: (q?: { classId?: string; examId?: string }) =>
    call<ClassReportResponse>(`/api/report/class?${new URLSearchParams(Object.entries(q ?? {}).filter(([, v]) => v) as [string, string][])}`),
  me: () => call<MyPageResponse>("/api/me"),
  meLogin: (studentId: string, name: string) => call<{ ok: true }>("/api/me/login", { body: { studentId, name } satisfies MeLoginRequest }),
  meLogout: () => call<{ ok: true }>("/api/me/logout", { method: "POST" }),
  classExams: (classId: string) => call<ClassExamsResponse>(`/api/exams?classId=${enc(classId)}`),
  school: () => call<SchoolOverviewResponse>("/api/teacher/school"),
  examClasses: (body: ExamClassesRequest) => call<{ classIds: string[]; closedClassIds: string[] }>("/api/teacher/exams/classes", { body }),
  suggestExam: (form: FormData) => call<ExamSuggestion>("/api/teacher/exams/suggest", { body: form }),
  saveExam: (body: SaveExamRequest) => call<SaveExamResponse>("/api/teacher/exams", { body }),
  studentReport: (studentId: string) => call<StudentReportResponse>(`/api/report/${enc(studentId)}`),
  saveGrade: (studentId: string, body: GradeRequest) => call<{ grade: Grade }>(`/api/report/${enc(studentId)}/grade`, { body }),
  classCsvUrl: (classId: string, examId: string) => `/api/report/class/csv?${new URLSearchParams({ classId, examId })}`,
};

/** ISO 시각이나 "HH:MM"을 "HH:MM"으로 */
export function hhmm(time: string | null | undefined): string {
  if (!time) return "";
  if (/^\d{1,2}:\d{2}$/.test(time)) return time;
  const d = new Date(time);
  if (Number.isNaN(d.getTime())) return time;
  return d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false });
}

/** 개요 항목 짧은 이름 (칩·그래프용). 시험마다 다르므로 shortLabels(exam)를 쓰세요 */
export { shortLabels } from "./school";

/** 시작 화면에서 받은 이름·시험 설정을 이 탭에 보관 (시험 화면은 exam/start를 다시 부르지 않음: 다시 부르면 학생 열쇠가 바뀜) */
export type StudentSession = { name: string; exam: ExamInfo };
const SESSION_KEY = (id: string) => `dotori:session:${id}`;
export function rememberSession(id: string, session: StudentSession) {
  try {
    sessionStorage.setItem(SESSION_KEY(id), JSON.stringify(session));
  } catch {}
}
export function recallSession(id: string): StudentSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY(id));
    return raw ? (JSON.parse(raw) as StudentSession) : null;
  } catch {
    return null;
  }
}
