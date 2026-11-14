import { requireSubject, requireTeacher } from "@/lib/auth";
import { examOf } from "@/lib/exams";
import { DEFAULT_MAX, GRADE_SCALES, maxOf, validValue } from "@/lib/grading";
import { fail, handle, nowIso, readJson } from "@/lib/http";
import { isValidId, updateAttempt } from "@/lib/store";
import type { Grade, GradeRequest } from "@/lib/types";

// 교사 채점 저장 (항목별 단계·점수 + 평가 근거 한 줄). 화면에서 바꿀 때마다 저장
export const POST = handle(async (req: Request, ctx: RouteContext<"/api/report/[studentId]/grade">) => {
  const teacher = await requireTeacher();
  const { studentId } = await ctx.params;
  if (!isValidId(studentId)) fail(400, "studentId가 올바르지 않아요.");
  const body = await readJson<GradeRequest>(req);
  if (!GRADE_SCALES.some((s) => s.id === body.scale)) fail(400, "채점 단계가 올바르지 않아요.");
  const max = body.scale === "points" ? Number(body.max ?? DEFAULT_MAX) : undefined;
  if (max !== undefined && !(Number.isInteger(max) && max >= 1 && max <= 1000)) fail(400, "만점은 1~1000 사이 정수여야 해요.");
  if (!Array.isArray(body.items)) fail(400, "항목 점수가 필요해요.");
  const itemMax =
    body.scale === "points" && Array.isArray(body.itemMax) && body.itemMax.length === body.items.length && body.itemMax.every((m) => Number.isInteger(m) && m >= 1 && m <= 1000)
      ? body.itemMax
      : undefined;
  const lim = { max, itemMax };
  if (!body.items.every((v, i) => validValue(body.scale, maxOf(lim, i), v)) || (body.ai !== undefined && !validValue(body.scale, max ?? 0, body.ai)))
    fail(400, "채점 값이 단계와 맞지 않아요.");
  const comment = typeof body.comment === "string" ? body.comment.trim().slice(0, 500) : "";

  const grade = await updateAttempt(studentId, async (rec) => {
    if (!rec) fail(404, "응시 기록이 없어요.");
    const exam = await examOf(rec);
    requireSubject(teacher, exam);
    if (body.items.length !== exam.outlineItems.length) fail(400, "항목 수가 맞지 않아요.");
    const g: Grade = {
      scale: body.scale,
      ...(max !== undefined ? { max } : {}),
      ...(itemMax ? { itemMax } : {}),
      items: body.items,
      ...(body.ai !== undefined ? { ai: body.ai } : {}),
      comment,
      gradedAt: nowIso(),
    };
    return { rec: { ...rec, grade: g }, result: g };
  });
  return Response.json({ grade });
});
