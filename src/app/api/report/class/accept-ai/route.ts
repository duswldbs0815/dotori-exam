import { requireSubject, requireTeacher } from "@/lib/auth";
import { getExam } from "@/lib/exams";
import { fail, handle, nowIso, readJson } from "@/lib/http";
import { checkFlags } from "@/lib/report";
import { CLASS_IDS } from "@/lib/school";
import { listAttempts, updateAttempt } from "@/lib/store";
import type { AcceptAiRequest, AcceptAiResponse, Grade } from "@/lib/types";

// 🔄 11/14 (교사) 확인할 점이 없는 학생의 AI 1차 채점 제안을 교사 채점으로 확정.
// 확인할 점(붙여넣기·차단·권장보다 많은 질문·AI 답과 비슷한 문장)이 있는 학생과 이미 교사가 채점한 학생은 건너뜀 → 교사가 직접 봄
export const POST = handle(async (req: Request) => {
  const teacher = await requireTeacher();
  const body = await readJson<AcceptAiRequest>(req);
  if (!CLASS_IDS.includes(body.classId)) fail(400, "반을 골라 주세요.");
  const exam = await getExam(body.examId);
  if (exam.id !== body.examId) fail(404, "수행평가를 찾지 못했어요.");
  requireSubject(teacher, exam);

  const recs = await listAttempts({ classId: body.classId, examId: exam.id });
  const res: AcceptAiResponse = { accepted: [], skipped: { flagged: 0, graded: 0, noAi: 0 } };
  for (const r of recs) {
    if (!r.final) continue;
    if (r.grade) { res.skipped.graded++; continue; }
    if (!r.aiGrade || r.aiGradeFor !== r.final || r.aiGrade.items.some((v) => v === null)) { res.skipped.noAi++; continue; }
    if (checkFlags(r, exam).length) { res.skipped.flagged++; continue; }
    const ok = await updateAttempt(r.attemptId, (cur) => {
      if (!cur || cur.grade || !cur.aiGrade || cur.aiGradeFor !== cur.final) return { rec: null, result: false };
      const a = cur.aiGrade;
      const g: Grade = {
        scale: a.scale,
        ...(a.max !== undefined ? { max: a.max } : {}),
        ...(a.itemMax ? { itemMax: a.itemMax } : {}),
        items: a.items,
        comment: "",
        gradedAt: nowIso(),
      };
      return { rec: { ...cur, grade: g }, result: true };
    });
    if (ok) res.accepted.push(r.attemptId);
  }
  return Response.json(res);
});
