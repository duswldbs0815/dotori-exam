import { setMeCookie } from "@/lib/auth";
import { fail, handle, readJson } from "@/lib/http";
import { isValidId, listAttemptsByStudent } from "@/lib/store";
import type { MeLoginRequest } from "@/lib/types";

// 마이페이지 로그인 (시연용: 학번 + 이름이 응시 기록과 맞으면 통과. 화면에서는 본인 확인 모의 단계를 거침)
export const POST = handle(async (req: Request) => {
  const b = await readJson<MeLoginRequest>(req);
  const name = typeof b.name === "string" ? b.name.trim() : "";
  if (!isValidId(b.studentId) || !name) fail(400, "학번과 이름을 적어 주세요.");
  const recs = await listAttemptsByStudent(b.studentId);
  if (recs.length === 0) fail(404, "아직 응시 기록이 없어요. 수행평가를 먼저 시작해 보세요.");
  if (!recs.some((r) => r.student.name === name)) fail(409, "학번과 이름이 맞지 않아요.");
  await setMeCookie(b.studentId, name);
  return Response.json({ ok: true });
});
