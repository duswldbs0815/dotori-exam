import { checkCode, setTeacherCookie } from "@/lib/auth";

// 슈퍼스쿨 교사 홈 "바로가기" 링크용: /api/teacher/enter?code=…&next=/teacher
// 코드가 맞으면 로그인 쿠키를 남기고 교사 화면으로 보냅니다.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const nextPath = url.searchParams.get("next") ?? "/teacher";
  const safeNext = nextPath.startsWith("/") && !nextPath.startsWith("//") ? nextPath : "/teacher";
  if (!checkCode(url.searchParams.get("code"))) {
    return Response.redirect(new URL(`${safeNext}?login=failed`, url.origin), 303);
  }
  await setTeacherCookie();
  return Response.redirect(new URL(safeNext, url.origin), 303);
}
