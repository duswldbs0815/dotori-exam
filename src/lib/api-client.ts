// 브라우저에서 쓰는 API 호출 도우미. 형식은 docs/API.md, 타입은 ./types.ts 와 같습니다.
import type {
  AskRequest,
  AskResponse,
  AttemptStateResponse,
  ClassReportResponse,
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
  TeacherMeResponse,
} from "./types";

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
  try {
    res = await fetch(path, {
      method: init?.method ?? (init?.body === undefined ? "GET" : "POST"),
      headers: init?.body === undefined ? undefined : { "Content-Type": "application/json" },
      body: init?.body === undefined ? undefined : JSON.stringify(init.body),
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
  teacherLogin: (code: string) => call<OkResponse>("/api/teacher/login", { body: { code } }),
  teacherLogout: () => call<OkResponse>("/api/teacher/logout", { method: "POST", body: {} }),
  classReport: () => call<ClassReportResponse>("/api/report/class"),
  studentReport: (studentId: string) => call<StudentReportResponse>(`/api/report/${enc(studentId)}`),
};

/** ISO 시각이나 "HH:MM"을 "HH:MM"으로 */
export function hhmm(time: string | null | undefined): string {
  if (!time) return "";
  if (/^\d{1,2}:\d{2}$/.test(time)) return time;
  const d = new Date(time);
  if (Number.isNaN(d.getTime())) return time;
  return d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false });
}

/** 개요 항목 짧은 이름 (칩·그래프용) */
export const SHORT_ITEMS = ["주제·배경", "문법·어휘", "해석·근거", "비평·고쳐쓰기"] as const;

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
