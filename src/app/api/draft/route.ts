import { requireOwner } from "@/lib/auth";
import { MAX, checkLength } from "@/lib/limits";
import { fail, handle, nowIso, readJson } from "@/lib/http";
import { isValidId, updateAttempt } from "@/lib/store";
import type { DraftRequest, DraftResponse } from "@/lib/types";

export const POST = handle(async (req: Request) => {
  const body = await readJson<DraftRequest>(req);
  if (!isValidId(body.attemptId)) fail(400, "attemptId가 올바르지 않아요.");
  if (typeof body.text !== "string") fail(400, "text가 필요해요.");
  checkLength(body.text, MAX.draft, "글");

  const savedAt = await updateAttempt(body.attemptId, async (rec) => {
    if (!rec) fail(404, "응시 기록이 없어요.");
    await requireOwner(rec);
    if (rec.submittedAt) fail(409, "이미 제출한 시험이에요.");
    if (rec.draft === body.text) return { rec: null, result: rec.draftSavedAt ?? nowIso() }; // 바뀐 게 없으면 저장 생략
    const at = nowIso();
    return { rec: { ...rec, draft: body.text, draftSavedAt: at }, result: at };
  });

  const res: DraftResponse = { ok: true, savedAt };
  return Response.json(res);
});
