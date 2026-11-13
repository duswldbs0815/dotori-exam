import { requireTeacher } from "@/lib/auth";
import { classIdOf, examIdOf, listExams } from "@/lib/exams";
import { handle } from "@/lib/http";
import { CLASS_IDS, SCHOOL_NAME } from "@/lib/school";
import { listAttempts, totalUsed } from "@/lib/store";
import type { SchoolOverviewResponse } from "@/lib/types";

// 교사 홈: 학년·반별로 열린 수행평가와 진행 상황
export const GET = handle(async () => {
  await requireTeacher();
  const [exams, recs] = await Promise.all([listExams(), listAttempts()]);
  const res: SchoolOverviewResponse = {
    school: SCHOOL_NAME,
    exams,
    classes: CLASS_IDS.map((classId) => ({
      classId,
      exams: exams
        .filter((e) => e.classIds.includes(classId))
        .map((e) => {
          const rs = recs.filter((r) => classIdOf(r) === classId && examIdOf(r) === e.id);
          const used = rs.reduce((a, r) => a + totalUsed(r), 0);
          return {
            examId: e.id,
            total: rs.length,
            submitted: rs.filter((r) => r.submittedAt).length,
            blocked: rs.reduce((a, r) => a + r.questions.filter((q) => q.blocked).length, 0),
            avgAcorns: rs.length ? Math.round((used / rs.length) * 10) / 10 : 0,
          };
        }),
    })),
  };
  return Response.json(res);
});
