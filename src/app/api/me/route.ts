import { getMe } from "@/lib/auth";
import { examOf } from "@/lib/exams";
import { fail, handle } from "@/lib/http";
import { DEFAULT_CLASS_ID, shortLabels } from "@/lib/school";
import { listAttemptsByStudent, usedPerItem } from "@/lib/store";
import type { MyAttempt, MyPageResponse } from "@/lib/types";

// 학생 마이페이지: 내 응시 기록 (분류·작성 경로·전후 비교는 넣지 않음)
export const GET = handle(async () => {
  const me = await getMe();
  if (!me) fail(401, "본인 확인이 필요해요.");
  const recs = (await listAttemptsByStudent(me.studentId)).filter((r) => r.student.name === me.name);
  const attempts: MyAttempt[] = await Promise.all(
    recs.map(async (r) => {
      const exam = await examOf(r);
      const text = r.final ?? r.draft ?? "";
      return {
        attemptId: r.attemptId,
        examId: exam.id,
        classId: r.classId || DEFAULT_CLASS_ID,
        title: exam.title,
        subject: exam.subject,
        labels: [...shortLabels(exam)],
        startedAt: r.startedAt,
        submittedAt: r.submittedAt,
        recommended: exam.itemGuides.map((g) => g.acorns || 0),
        used: usedPerItem(r),
        questionCount: r.questions.filter((q) => !q.blocked).length,
        blockedCount: r.questions.filter((q) => q.blocked).length,
        reflectionDone: r.reflection ? r.reflection.filter((x) => x.trim()).length : 0,
        chars: text.replace(/\s/g, "").length,
        questions: r.questions.map((q) => ({ time: q.time, outlineItem: q.outlineItem, question: q.question, answer: q.answer, blocked: q.blocked })),
      };
    }),
  );
  attempts.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  const res: MyPageResponse = { student: { id: me.studentId, name: me.name }, attempts };
  return Response.json(res);
});
