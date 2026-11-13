import { requireTeacher } from "@/lib/auth";
import { getExam } from "@/lib/exams";
import { fail, handle } from "@/lib/http";
import { classInsights } from "@/lib/insights";
import { CLASS_IDS } from "@/lib/school";
import { listAttempts } from "@/lib/store";

// 교사용 반 "수업 단서": GET /api/report/class/insights?classId=2-1&examId=kor2
// 반 학생들의 질문을 AI가 묶어 다음 수업 제안을 붙임 (학생 이름·학번은 AI에 보내지 않음)
export const GET = handle(async (req: Request) => {
  await requireTeacher();
  const url = new URL(req.url);
  const classId = url.searchParams.get("classId") ?? "";
  const examId = url.searchParams.get("examId") ?? "";
  if (!CLASS_IDS.includes(classId)) fail(400, "반을 골라 주세요.");
  const exam = await getExam(examId);
  if (examId && exam.id !== examId) fail(404, "수행평가를 찾지 못했어요.");
  const recs = await listAttempts({ classId, examId: exam.id });
  return Response.json(await classInsights(recs, exam, `${classId}:${exam.id}`));
});
