import { requireTeacher } from "@/lib/auth";
import { getExam } from "@/lib/exams";
import { handle } from "@/lib/http";
import { buildClassReport } from "@/lib/report";
import { listAttempts } from "@/lib/store";

// 교사용 반 전체 집계. ?classId=2-3&examId=kor2 로 한 반·한 수행평가만 볼 수 있음
// (요청할 때마다 새로 계산. 쿠키를 읽으므로 미리 만들어 두지 않음)
export const GET = handle(async (req: Request) => {
  await requireTeacher();
  const url = new URL(req.url);
  const classId = url.searchParams.get("classId");
  const examId = url.searchParams.get("examId");
  const recs = await listAttempts({ classId: classId || undefined, examId: examId || undefined });
  return Response.json(buildClassReport(recs, examId ? await getExam(examId) : undefined));
});
