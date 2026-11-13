import { isTeacher } from "@/lib/auth";
import { handle } from "@/lib/http";
import type { TeacherMeResponse } from "@/lib/types";

// 교사 화면 첫 진입 시: 로그인 상태 확인
export const GET = handle(async () => {
  const res: TeacherMeResponse = { teacher: await isTeacher() };
  return Response.json(res);
});
