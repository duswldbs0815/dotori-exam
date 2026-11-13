import { requireOwner } from "@/lib/auth";
import { after } from "next/server";
import { MAX, checkLength } from "@/lib/limits";
import { fail, handle, nowIso, readJson } from "@/lib/http";
import { judgeSentencePaths } from "@/lib/judge";
import { isValidId, updateAttempt } from "@/lib/store";
import type { Reflection, SubmitRequest, SubmitResponse } from "@/lib/types";

export const POST = handle(async (req: Request) => {
  const body = await readJson<SubmitRequest>(req);
  if (!isValidId(body.attemptId)) fail(400, "attemptId가 올바르지 않아요.");
  if (typeof body.final !== "string" || !body.final.trim()) fail(400, "제출할 글이 비어 있어요.");
  if (
    !Array.isArray(body.reflection) ||
    body.reflection.length !== 4 ||
    !body.reflection.every((s) => typeof s === "string")
  )
    fail(400, "성찰지는 4문항 문자열이어야 해요.");
  checkLength(body.final, MAX.draft, "글");
  body.reflection.forEach((r) => checkLength(r, MAX.reflection, "성찰지 답"));

  const submittedAt = await updateAttempt(body.attemptId, async (rec) => {
    if (!rec) fail(404, "응시 기록이 없어요.");
    await requireOwner(rec);
    if (rec.submittedAt) fail(409, "이미 제출한 시험이에요.");
    const at = nowIso();
    return {
      rec: {
        ...rec,
        final: body.final,
        draft: body.final,
        draftSavedAt: at,
        reflection: body.reflection.map((s) => s.trim()) as Reflection,
        submittedAt: at,
      },
      result: at,
    };
  });

  // 응답을 먼저 보내고, 문장별 작성 경로 AI 판정은 뒤에서 처리해 저장
  after(() => judgeSentencePaths(body.attemptId));

  const res: SubmitResponse = { ok: true, submittedAt };
  return Response.json(res);
});
