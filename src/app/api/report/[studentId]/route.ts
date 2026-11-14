import { after } from "next/server";
import { requireSubject, requireTeacher } from "@/lib/auth";
import { fail, handle, readJson } from "@/lib/http";
import { forgetInsights } from "@/lib/insights";
import { DEFAULT_CLASS_ID, DEFAULT_EXAM_ID } from "@/lib/school";
import { judgeSentencePaths } from "@/lib/judge";
import { examOf } from "@/lib/exams";
import { buildStudentReport } from "@/lib/report";
import { deleteAttempts, isValidId, loadAttempt } from "@/lib/store";

// 교사용 학생 리포트 (분류, 전후 비교, 작성 경로 포함)
export const GET = handle(async (_req: Request, ctx: RouteContext<"/api/report/[studentId]">) => {
  const teacher = await requireTeacher();
  const { studentId } = await ctx.params;
  if (!isValidId(studentId)) fail(400, "studentId가 올바르지 않아요.");
  const rec = await loadAttempt(studentId);
  if (!rec) fail(404, "응시 기록이 없어요.");
  const exam = await examOf(rec);
  requireSubject(teacher, exam); // 다른 과목 학생 기록은 없는 것처럼

  // 제출했는데 AI 판정이 아직 없으면 (예: 시연 데이터) 뒤에서 판정해 두고, 이번엔 1차 판정으로 응답
  if (rec.final && !(rec.sentencePaths && rec.sentencePathsFor === rec.final)) {
    after(() => judgeSentencePaths(studentId));
  }
  return Response.json(buildStudentReport(rec, exam));
});

// 교사용: 학생 한 명의 응시 기록을 영구히 지움 (전학, 응시 취소, 잘못 들어온 테스트 기록)
// DELETE { confirm: "<학번 또는 응시 ID>" } — 실수 방지로 ID를 한 번 더 받음
export const DELETE = handle(async (req: Request, ctx: RouteContext<"/api/report/[studentId]">) => {
  const teacher = await requireTeacher();
  const { studentId } = await ctx.params;
  if (!isValidId(studentId)) fail(400, "studentId가 올바르지 않아요.");
  const b = await readJson<{ confirm?: string }>(req);
  const rec = await loadAttempt(studentId);
  if (!rec) fail(404, "응시 기록이 없어요.");
  requireSubject(teacher, await examOf(rec)); // 다른 과목 기록은 지울 수 없음
  if (String(b.confirm ?? "").trim() !== studentId && String(b.confirm ?? "").trim() !== rec.student.id)
    fail(400, `확인을 위해 학번 "${rec.student.id}"를 그대로 입력해 주세요.`);
  const deleted = await deleteAttempts([studentId]);
  await forgetInsights(`${rec.classId || DEFAULT_CLASS_ID}__${rec.examId || DEFAULT_EXAM_ID}`);
  return Response.json({ ok: true, deleted });
});

