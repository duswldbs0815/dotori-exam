import { checkCode, setTeacherCookie } from "@/lib/auth";
import { clearLoginFails, clientKey, loginLockedMinutes, recordLoginFail } from "@/lib/limits";

// 슈퍼스쿨 교사 홈 "바로가기" 링크용: /api/teacher/enter?code=…&next=/teacher
// 코드가 맞으면 로그인 쿠키를 남기고 교사 화면으로 보냅니다. 로그인과 같은 잠금 규칙을 씁니다.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const nextPath = url.searchParams.get("next") ?? "/teacher";
  const safeNext = nextPath.startsWith("/") && !nextPath.startsWith("//") ? nextPath : "/teacher";
  const who = clientKey(req);

  if (loginLockedMinutes(who)) return Response.redirect(new URL(`${safeNext}?login=locked`, url.origin), 303);
  if (!checkCode(url.searchParams.get("code"))) {
    recordLoginFail(who);
    return Response.redirect(new URL(`${safeNext}?login=failed`, url.origin), 303);
  }
  clearLoginFails(who);
  await setTeacherCookie();
  return Response.redirect(new URL(safeNext, url.origin), 303);
}
