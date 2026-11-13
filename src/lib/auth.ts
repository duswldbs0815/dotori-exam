// 서버 전용: 교사 코드 로그인 (해커톤용 간이 인증)
// 실제 도입 시에는 슈퍼스쿨 계정 로그인으로 바꿉니다.
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";
import { fail } from "./http";

/** https로 들어온 요청이면 쿠키에 Secure 표시. (시연 때 http://192.168.x.x 로 접속해도 로그인되게) */
async function isHttps(): Promise<boolean> {
  return (await headers()).get("x-forwarded-proto")?.split(",")[0]?.trim() === "https";
}

export const TEACHER_COOKIE = "dotori_teacher";
const MAX_AGE = 60 * 60 * 12; // 12시간

function teacherCode(): string {
  const code = process.env.TEACHER_CODE;
  if (!code) throw new Error("환경 변수 TEACHER_CODE 가 비어 있습니다 (.env.local 확인)");
  return code;
}

/** 쿠키에 넣는 값: "만료시각.서명". 교사 코드로 서명해서 코드를 모르면 만들 수 없고, 시간이 지나면 안 통함 */
function sign(exp: number): string {
  return createHmac("sha256", teacherCode()).update(`dotori-teacher-v2:${exp}`).digest("hex");
}

function token(): string {
  const exp = Date.now() + MAX_AGE * 1000;
  return `${exp}.${sign(exp)}`;
}

function validToken(v: string): boolean {
  const [expStr, sig] = v.split(".");
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp <= Date.now() || !sig) return false;
  return same(sig, sign(exp));
}

function same(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function checkCode(code: unknown): boolean {
  return typeof code === "string" && same(code, teacherCode());
}

export async function setTeacherCookie() {
  (await cookies()).set(TEACHER_COOKIE, token(), {
    httpOnly: true,
    sameSite: "lax",
    secure: await isHttps(),
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function clearTeacherCookie() {
  (await cookies()).delete(TEACHER_COOKIE);
}

export async function isTeacher(): Promise<boolean> {
  const v = (await cookies()).get(TEACHER_COOKIE)?.value;
  return typeof v === "string" && validToken(v);
}

/** 교사가 아니면 401 */
export async function requireTeacher() {
  if (!(await isTeacher())) fail(401, "교사 코드로 로그인해 주세요.");
}

// ── 학생 열쇠 ──────────────────────────────────────────────
// 시험을 시작(본인 확인)하면 그 브라우저에만 무작위 열쇠를 쿠키로 줍니다.
// 이후 조회·저장·질문·제출은 이 열쇠가 있어야만 됩니다. (학번만 알아서는 남의 시험지를 못 엶)
// 서버에는 열쇠 자체가 아니라 해시만 저장합니다.

export const STUDENT_COOKIE = "dotori_student";
const STUDENT_MAX_AGE = 60 * 60 * 6; // 6시간

export function newStudentKey(): { key: string; keyHash: string } {
  const key = randomBytes(24).toString("hex");
  return { key, keyHash: hashKey(key) };
}

function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export async function setStudentCookie(attemptId: string, key: string) {
  (await cookies()).set(STUDENT_COOKIE, `${attemptId}.${key}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: await isHttps(),
    path: "/",
    maxAge: STUDENT_MAX_AGE,
  });
}

/** 이 요청을 보낸 브라우저가 이 응시 기록의 주인인지 확인. 아니면 403 */
export async function requireOwner(rec: { attemptId: string; keyHash?: string | null }) {
  const v = (await cookies()).get(STUDENT_COOKIE)?.value ?? "";
  const dot = v.lastIndexOf(".");
  const id = dot > 0 ? v.slice(0, dot) : "";
  const key = dot > 0 ? v.slice(dot + 1) : "";
  if (!rec.keyHash || id !== rec.attemptId || !key || !same(hashKey(key), rec.keyHash))
    fail(403, "이 시험지를 열 권한이 없어요. 처음 화면에서 시험을 다시 시작해 주세요.");
}
