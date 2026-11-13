import { fail, handle } from "@/lib/http";
import { buildStudentReport } from "@/lib/report";
import { isValidId, loadAttempt } from "@/lib/store";

// 교사용 학생 리포트 (분류, 전후 비교, 작성 경로 포함)
export const GET = handle(async (_req: Request, ctx: RouteContext<"/api/report/[studentId]">) => {
  const { studentId } = await ctx.params;
  if (!isValidId(studentId)) fail(400, "studentId가 올바르지 않아요.");
  const rec = await loadAttempt(studentId);
  if (!rec) fail(404, "응시 기록이 없어요.");
  return Response.json(buildStudentReport(rec));
});
