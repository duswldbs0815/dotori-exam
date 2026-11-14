import { requireTeacher } from "@/lib/auth";
import { classIdOf, examIdOf, listExams } from "@/lib/exams";
import { handle } from "@/lib/http";
import { CLASS_IDS, SCHOOL_NAME } from "@/lib/school";
import { listAttempts, totalUsed } from "@/lib/store";
import type { SchoolOverviewResponse } from "@/lib/types";

// 교사 홈: 로그인한 교사 과목의 수행평가와 반별 진행 상황
export const GET = handle(async () => {
  const teacher = await requireTeacher();
  const [all, recs] = await Promise.all([listExams(), listAttempts()]);
  const exams = all.filter((e) => e.subject === teacher.subject); // 담당 과목 수행평가만
  const res: SchoolOverviewResponse = {
    school: SCHOOL_NAME,
    teacher,
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
