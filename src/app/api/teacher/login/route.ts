import { setTeacherCookie } from "@/lib/auth";
import { fail, handle, readJson } from "@/lib/http";
import { clearLoginFails, clientKey, loginLockedMinutes, recordLoginFail } from "@/lib/limits";
import { verifyTeacher } from "@/lib/teachers";
import type { TeacherLoginRequest, TeacherMeResponse } from "@/lib/types";

// 교사 아이디·비밀번호 확인 → 로그인 쿠키. 5번 틀리면 5분 잠금
export const POST = handle(async (req: Request) => {
  const who = clientKey(req);
  const locked = loginLockedMinutes(who);
  if (locked) fail(429, `여러 번 틀렸어요. ${locked}분 뒤에 다시 시도해 주세요.`);

  const body = await readJson<TeacherLoginRequest>(req);
  const t = verifyTeacher(body.id, body.password);
  if (!t) {
    recordLoginFail(who);
    fail(401, "아이디나 비밀번호가 맞지 않아요.");
  }
  clearLoginFails(who);
  await setTeacherCookie(t.id);
  const res: TeacherMeResponse = { teacher: true, account: t };
  return Response.json(res);
});
