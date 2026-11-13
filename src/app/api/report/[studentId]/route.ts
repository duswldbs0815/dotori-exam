import { after } from "next/server";
import { requireTeacher } from "@/lib/auth";
import { fail, handle } from "@/lib/http";
import { judgeSentencePaths } from "@/lib/judge";
import { buildStudentReport } from "@/lib/report";
import { isValidId, loadAttempt } from "@/lib/store";

// 교사용 학생 리포트 (분류, 전후 비교, 작성 경로 포함)
export const GET = handle(async (_req: Request, ctx: RouteContext<"/api/report/[studentId]">) => {
  await requireTeacher();
  const { studentId } = await ctx.params;
  if (!isValidId(studentId)) fail(400, "studentId가 올바르지 않아요.");
  const rec = await loadAttempt(studentId);
  if (!rec) fail(404, "응시 기록이 없어요.");

  // 제출했는데 AI 판정이 아직 없으면 (예: 시연 데이터) 뒤에서 판정해 두고, 이번엔 1차 판정으로 응답
  if (rec.final && !(rec.sentencePaths && rec.sentencePathsFor === rec.final)) {
    after(() => judgeSentencePaths(studentId));
  }
  return Response.json(buildStudentReport(rec));
});
