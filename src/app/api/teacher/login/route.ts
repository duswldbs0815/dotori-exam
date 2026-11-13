import { checkCode, setTeacherCookie } from "@/lib/auth";
import { fail, handle, readJson } from "@/lib/http";
import { clearLoginFails, clientKey, loginLockedMinutes, recordLoginFail } from "@/lib/limits";
import type { OkResponse, TeacherLoginRequest } from "@/lib/types";

// 교사 코드 확인 → 로그인 쿠키. 5번 틀리면 5분 잠금
export const POST = handle(async (req: Request) => {
  const who = clientKey(req);
  const locked = loginLockedMinutes(who);
  if (locked) fail(429, `교사 코드를 여러 번 틀렸어요. ${locked}분 뒤에 다시 시도해 주세요.`);

  const body = await readJson<TeacherLoginRequest>(req);
  if (!checkCode(body.code)) {
    recordLoginFail(who);
    fail(401, "교사 코드가 맞지 않아요.");
  }
  clearLoginFails(who);
  await setTeacherCookie();
  const res: OkResponse = { ok: true };
  return Response.json(res);
});
