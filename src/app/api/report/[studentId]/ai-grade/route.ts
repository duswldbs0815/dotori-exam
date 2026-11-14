import { aiGradeText, sameGrading } from "@/lib/ai-grade";
import { requireSubject, requireTeacher } from "@/lib/auth";
import { examOf } from "@/lib/exams";
import { fail, handle } from "@/lib/http";
import { isValidId, loadAttempt, updateAttempt } from "@/lib/store";
import type { AiGradeResponse } from "@/lib/types";

// 🔄 11/14 AI 1차 채점 (교사): 교사가 정한 채점 기준만 보고 제출한 글을 채점한 "제안".
// 같은 글·같은 채점 방식이면 저장해 둔 제안을 그대로 돌려줌 (AI를 다시 부르지 않음). 확정은 교사가 grade로 저장
export const POST = handle(async (_req: Request, ctx: RouteContext<"/api/report/[studentId]/ai-grade">) => {
  const teacher = await requireTeacher();
  const { studentId } = await ctx.params;
  if (!isValidId(studentId)) fail(400, "studentId가 올바르지 않아요.");
  const rec = await loadAttempt(studentId);
  if (!rec) fail(404, "응시 기록이 없어요.");
  const exam = await examOf(rec);
  requireSubject(teacher, exam);
  const final = rec.final;
  if (!final?.trim()) fail(400, "제출한 글이 있어야 AI 1차 채점을 할 수 있어요.");
  if (rec.aiGrade && rec.aiGradeFor === final && sameGrading(rec.aiGrade, exam)) return Response.json({ aiGrade: rec.aiGrade } satisfies AiGradeResponse);

  const aiGrade = await aiGradeText(exam, final).catch((e) => {
    console.error("AI 1차 채점 실패", e);
    fail(502, "AI 1차 채점을 받지 못했어요. 잠시 뒤 다시 해 주세요.");
  });
  await updateAttempt(studentId, (cur) => {
    // 그사이 글이 바뀌었으면 저장하지 않음
    if (!cur || cur.final !== final) return { rec: null, result: null };
    return { rec: { ...cur, aiGrade, aiGradeFor: final }, result: null };
  });
  return Response.json({ aiGrade } satisfies AiGradeResponse);
});
