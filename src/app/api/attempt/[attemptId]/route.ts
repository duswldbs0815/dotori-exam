import { fail, handle } from "@/lib/http";
import { isValidId, loadAttempt, usedPerItem } from "@/lib/store";
import type { AttemptStateResponse } from "@/lib/types";

// 학생 화면용: 분류·작성 경로·전후 비교는 넣지 않음
export const GET = handle(async (_req: Request, ctx: RouteContext<"/api/attempt/[attemptId]">) => {
  const { attemptId } = await ctx.params;
  if (!isValidId(attemptId)) fail(400, "attemptId가 올바르지 않아요.");
  const rec = await loadAttempt(attemptId);
  if (!rec) fail(404, "응시 기록이 없어요.");

  const res: AttemptStateResponse = {
    attemptId: rec.attemptId,
    outline: rec.outline,
    acornPlan: rec.acornPlan,
    acornsUsed: usedPerItem(rec),
    draft: rec.draft,
    questions: rec.questions.map((q) => ({
      acornNo: q.acornNo,
      time: q.time,
      outlineItem: q.outlineItem,
      question: q.question,
      answer: q.answer,
      blocked: q.blocked,
    })),
    submitted: rec.submittedAt !== null,
  };
  return Response.json(res);
});
