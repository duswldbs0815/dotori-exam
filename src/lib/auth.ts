// 서버 전용: 교사 코드 로그인 (해커톤용 간이 인증)
// 실제 도입 시에는 슈퍼스쿨 계정 로그인으로 바꿉니다.
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { fail } from "./http";

export const TEACHER_COOKIE = "dotori_teacher";
const MAX_AGE = 60 * 60 * 12; // 12시간

function teacherCode(): string {
  const code = process.env.TEACHER_CODE;
  if (!code) throw new Error("환경 변수 TEACHER_CODE 가 비어 있습니다 (.env.local 확인)");
  return code;
}

/** 쿠키에 넣는 값: 교사 코드로 서명한 값 (코드를 모르면 만들 수 없음) */
function token(): string {
  return createHmac("sha256", teacherCode()).update("dotori-teacher-v1").digest("hex");
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
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function clearTeacherCookie() {
  (await cookies()).delete(TEACHER_COOKIE);
}

export async function isTeacher(): Promise<boolean> {
  const v = (await cookies()).get(TEACHER_COOKIE)?.value;
  return typeof v === "string" && same(v, token());
}

/** 교사가 아니면 401 */
export async function requireTeacher() {
  if (!(await isTeacher())) fail(401, "교사 코드로 로그인해 주세요.");
}
