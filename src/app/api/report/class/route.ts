import { requireSubject, requireTeacher } from "@/lib/auth";
import { examIdOf, getExam, listExams } from "@/lib/exams";
import { handle } from "@/lib/http";
import { buildClassReport } from "@/lib/report";
import { listAttempts } from "@/lib/store";

// 교사용 반 전체 집계. ?classId=2-3&examId=kor2 로 한 반·한 수행평가만 볼 수 있음
// 로그인한 교사 과목의 수행평가 기록만 집계 (요청할 때마다 새로 계산. 쿠키를 읽으므로 미리 만들어 두지 않음)
export const GET = handle(async (req: Request) => {
  const teacher = await requireTeacher();
  const url = new URL(req.url);
  const classId = url.searchParams.get("classId");
  const examId = url.searchParams.get("examId");
  const exam = examId ? await getExam(examId) : undefined;
  if (exam) requireSubject(teacher, exam);
  const mine = new Set((await listExams()).filter((e) => e.subject === teacher.subject).map((e) => e.id));
  const recs = (await listAttempts({ classId: classId || undefined, examId: examId || undefined })).filter((r) => mine.has(examIdOf(r)));
  return Response.json(buildClassReport(recs, exam));
});
