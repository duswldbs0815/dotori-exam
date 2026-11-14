import { aiGradeText, gradingOf, sameSpec, type GradingSpec } from "@/lib/ai-grade";
import { requireSubject, requireTeacher } from "@/lib/auth";
import { examOf } from "@/lib/exams";
import { GRADE_SCALES } from "@/lib/grading";
import { fail, handle } from "@/lib/http";
import { isQuotaError } from "@/lib/llm";
import { isValidId, loadAttempt, updateAttempt } from "@/lib/store";
import type { AiGradeRequest, AiGradeResponse } from "@/lib/types";

// 🔄 11/14 AI 1차 채점 (교사): 교사가 정한 채점 기준만 보고 제출한 글을 채점한 "제안".
// 같은 글·같은 채점 방식이면 저장해 둔 제안을 그대로 돌려줌 (AI를 다시 부르지 않음). 확정은 교사가 grade로 저장
export const POST = handle(async (req: Request, ctx: RouteContext<"/api/report/[studentId]/ai-grade">) => {
  const teacher = await requireTeacher();
  const { studentId } = await ctx.params;
  if (!isValidId(studentId)) fail(400, "studentId가 올바르지 않아요.");
  const rec = await loadAttempt(studentId);
  if (!rec) fail(404, "응시 기록이 없어요.");
  const exam = await examOf(rec);
  requireSubject(teacher, exam);
  const final = rec.final;
  if (!final?.trim()) fail(400, "제출한 글이 있어야 AI 1차 채점을 할 수 있어요.");
  // 교사가 채점 칸에서 고른 단계 (없으면 수행평가 기본 단계)
  const body = ((await req.json().catch(() => null)) ?? {}) as AiGradeRequest;
  let spec: GradingSpec = gradingOf(exam);
  if (body.scale !== undefined) {
    if (!GRADE_SCALES.some((s) => s.id === body.scale)) fail(400, "채점 단계가 올바르지 않아요.");
    const okNum = (m: unknown) => Number.isInteger(m) && (m as number) >= 1 && (m as number) <= 1000;
    if (body.scale !== "points") spec = { scale: body.scale };
    else {
      const max = body.max ?? spec.max ?? 25;
      if (!okNum(max)) fail(400, "만점은 1~1000 사이 정수여야 해요.");
      const itemMax = Array.isArray(body.itemMax) && body.itemMax.length === exam.outlineItems.length && body.itemMax.every(okNum) ? body.itemMax : spec.itemMax;
      spec = { scale: "points", max, ...(itemMax ? { itemMax } : {}) };
    }
  }
  if (rec.aiGrade && rec.aiGradeFor === final && sameSpec(rec.aiGrade, spec)) return Response.json({ aiGrade: rec.aiGrade } satisfies AiGradeResponse);

  const aiGrade = await aiGradeText(exam, final, spec).catch((e) => {
    console.error("AI 1차 채점 실패", e);
    if (isQuotaError(e)) fail(402, "AI 사용 한도(크레딧)를 다 써서 지금은 AI 1차 채점을 할 수 없어요. 직접 채점은 그대로 할 수 있어요.");
    fail(502, "AI 1차 채점을 받지 못했어요. 잠시 뒤 다시 해 주세요.");
  });
  await updateAttempt(studentId, (cur) => {
    // 그사이 글이 바뀌었으면 저장하지 않음
    if (!cur || cur.final !== final) return { rec: null, result: null };
    return { rec: { ...cur, aiGrade, aiGradeFor: final }, result: null };
  });
  return Response.json({ aiGrade } satisfies AiGradeResponse);
});
