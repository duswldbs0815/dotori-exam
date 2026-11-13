import { EXAM_CONFIG } from "@/lib/exam-config";
import { fail, handle, readJson } from "@/lib/http";
import { isValidId, updateAttempt } from "@/lib/store";
import type { OkResponse, Outline, OutlineRequest, PerItem } from "@/lib/types";

export const POST = handle(async (req: Request) => {
  const body = await readJson<OutlineRequest>(req);
  if (!isValidId(body.attemptId)) fail(400, "attemptId가 올바르지 않아요.");
  if (!Array.isArray(body.outline) || body.outline.length !== 4 || !body.outline.every((s) => typeof s === "string"))
    fail(400, "개요는 4항목 문자열이어야 해요.");
  const max = EXAM_CONFIG.acornPlanMaxPerItem;
  if (
    !Array.isArray(body.acornPlan) ||
    body.acornPlan.length !== 4 ||
    !body.acornPlan.every((n) => Number.isInteger(n) && n >= 0 && n <= max)
  )
    fail(400, `도토리 목표는 항목마다 0~${max} 사이 정수여야 해요.`);

  await updateAttempt(body.attemptId, (rec) => {
    if (!rec) fail(404, "응시 기록이 없어요. 시험을 먼저 시작해 주세요.");
    if (rec.submittedAt) fail(409, "이미 제출한 시험이에요.");
    const planLocked = rec.questions.length > 0;
    return {
      rec: {
        ...rec,
        outline: body.outline.map((s) => s.trim()) as Outline,
        acornPlan: planLocked && rec.acornPlan ? rec.acornPlan : (body.acornPlan as PerItem),
      },
      result: null,
    };
  });

  const res: OkResponse = { ok: true };
  return Response.json(res);
});
