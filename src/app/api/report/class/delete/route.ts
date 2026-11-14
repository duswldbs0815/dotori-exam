import { requireSubject, requireTeacher } from "@/lib/auth";
import { getExam } from "@/lib/exams";
import { fail, handle, readJson } from "@/lib/http";
import { forgetInsights } from "@/lib/insights";
import { CLASS_IDS } from "@/lib/school";
import { deleteAttempts, listAttempts } from "@/lib/store";

// 교사용 "기록 지우기": 한 반·한 수행평가의 학생 응시 기록을 영구히 지움 (학기 말 정리)
// POST { classId: "2-1", examId: "kor2", confirm: "2-1" } — 실수 방지로 반 이름을 한 번 더 받음
// 수행평가 자체(과제·기준)는 남아서 다음에 다시 쓸 수 있음
export const POST = handle(async (req: Request) => {
  const teacher = await requireTeacher();
  const b = await readJson<{ classId?: string; examId?: string; confirm?: string }>(req);
  const classId = String(b.classId ?? "");
  if (!CLASS_IDS.includes(classId)) fail(400, "반을 골라 주세요.");
  if (String(b.confirm ?? "").trim() !== classId) fail(400, `확인을 위해 반 이름 "${classId}"를 그대로 입력해 주세요.`);
  const exam = await getExam(String(b.examId ?? ""));
  if (b.examId && exam.id !== b.examId) fail(404, "수행평가를 찾지 못했어요.");
  requireSubject(teacher, exam); // 담당 과목 기록만 지울 수 있음

  const recs = await listAttempts({ classId, examId: exam.id });
  const deleted = await deleteAttempts(recs.map((r) => r.attemptId));
  await forgetInsights(`${classId}__${exam.id}`);
  return Response.json({ ok: true, deleted });
});
