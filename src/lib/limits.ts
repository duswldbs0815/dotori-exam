// 서버 전용: 입력 길이 제한과 간단한 속도 제한 (해커톤용, 서버 메모리에 보관)
import { fail } from "./http";

/** 입력 최대 길이 (글자 수) */
export const MAX = {
  name: 20,
  draft: 5000, // 글(초안·최종). 감상문은 1,000자 안팎
  question: 500,
  selectedText: 2000,
  outlineItem: 500,
  reflection: 2000,
} as const;

/** 문자열이 너무 길면 413 (label은 받침 있는 말로: 이름, 글, 질문 …) */
export function checkLength(value: string, max: number, label: string) {
  if (value.length > max) fail(413, `${label}은 ${max.toLocaleString()}자까지 쓸 수 있어요.`);
}

// ── 교사 코드 로그인 잠금 ─────────────────────────────────
// 같은 곳(IP)에서 5번 틀리면 5분 동안 로그인 시도를 막습니다. (코드를 계속 찍어 보는 것 방지)
const LOGIN_MAX_FAILS = 5;
const LOGIN_LOCK_MS = 5 * 60 * 1000;
const loginFails = new Map<string, { count: number; until: number }>();

export function clientKey(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return fwd || req.headers.get("x-real-ip") || "local";
}

/** 잠겨 있으면 남은 분, 아니면 0 */
export function loginLockedMinutes(key: string): number {
  const e = loginFails.get(key);
  if (!e || e.until <= Date.now()) return 0;
  return Math.ceil((e.until - Date.now()) / 60000);
}

export function recordLoginFail(key: string) {
  const now = Date.now();
  const e = loginFails.get(key);
  const lockExpired = e && e.until !== 0 && e.until <= now; // 잠금이 풀린 뒤면 처음부터 다시 셈
  const next = (e && !lockExpired ? e.count : 0) + 1;
  loginFails.set(key, { count: next, until: next >= LOGIN_MAX_FAILS ? now + LOGIN_LOCK_MS : 0 });
}

export function clearLoginFails(key: string) {
  loginFails.delete(key);
}

// ── 질문 한 번에 하나 ─────────────────────────────────────
// 같은 학생이 답을 기다리는 중에 또 질문을 보내면 막습니다. (연타로 비용이 새는 것 방지)
const asking = new Set<string>();

export async function oneAtATime<T>(attemptId: string, fn: () => Promise<T>): Promise<T> {
  if (asking.has(attemptId)) fail(429, "앞 질문의 답을 기다리는 중이에요. 답이 나온 뒤에 다시 질문해 주세요.");
  asking.add(attemptId);
  try {
    return await fn();
  } finally {
    asking.delete(attemptId);
  }
}
