import { setMeCookie } from "@/lib/auth";
import { fail, handle, readJson } from "@/lib/http";
import { clearLoginFails, clientKey, loginLockedMinutes, recordLoginFail } from "@/lib/limits";
import { isValidId, listAttemptsByStudent } from "@/lib/store";
import type { MeLoginRequest } from "@/lib/types";

// 마이페이지 로그인 (시연용: 학번 + 이름이 응시 기록과 맞으면 통과. 화면에서는 본인 확인 모의 단계를 거침)
export const POST = handle(async (req: Request) => {
  const b = await readJson<MeLoginRequest>(req);
  const name = typeof b.name === "string" ? b.name.trim() : "";
  if (!isValidId(b.studentId) || !name) fail(400, "학번과 이름을 적어 주세요.");
  // 같은 곳에서 같은 학번으로 5번 틀리면 5분 잠금 (이름을 계속 찍어 남의 기록을 여는 것 방지).
  // 학교는 IP 하나를 같이 쓰므로 반 전체가 아니라 그 학번만 잠김
  const who = `me:${clientKey(req)}:${b.studentId}`;
  const locked = loginLockedMinutes(who);
  if (locked) fail(429, `여러 번 틀렸어요. ${locked}분 뒤에 다시 시도해 주세요.`);
  const recs = await listAttemptsByStudent(b.studentId);
  if (recs.length === 0) {
    recordLoginFail(who);
    fail(404, "아직 응시 기록이 없어요. 수행평가를 먼저 시작해 보세요.");
  }
  if (!recs.some((r) => r.student.name === name)) {
    recordLoginFail(who);
    fail(409, "학번과 이름이 맞지 않아요.");
  }
  clearLoginFails(who);
  await setMeCookie(b.studentId, name);
  return Response.json({ ok: true });
});
