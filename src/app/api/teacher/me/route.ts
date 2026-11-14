import { getTeacher } from "@/lib/auth";
import { handle } from "@/lib/http";
import type { TeacherMeResponse } from "@/lib/types";

// 교사 화면 첫 진입 시: 로그인 상태와 담당 과목 확인
export const GET = handle(async () => {
  const t = await getTeacher();
  const res: TeacherMeResponse = t ? { teacher: true, account: t } : { teacher: false };
  return Response.json(res);
});
