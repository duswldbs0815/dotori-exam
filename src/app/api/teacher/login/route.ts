import { checkCode, setTeacherCookie } from "@/lib/auth";
import { fail, handle, readJson } from "@/lib/http";
import type { OkResponse, TeacherLoginRequest } from "@/lib/types";

// 교사 코드 확인 → 로그인 쿠키
export const POST = handle(async (req: Request) => {
  const body = await readJson<TeacherLoginRequest>(req);
  if (!checkCode(body.code)) fail(401, "교사 코드가 맞지 않아요.");
  await setTeacherCookie();
  const res: OkResponse = { ok: true };
  return Response.json(res);
});
