import { requireSubject, requireTeacher } from "@/lib/auth";
import { getExam, saveClassSetting } from "@/lib/exams";
import { fail, handle, readJson } from "@/lib/http";
import { CLASS_IDS } from "@/lib/school";
import type { ExamClassesRequest } from "@/lib/types";

// 🔄 11/14 담당 교사가 수행평가를 반별로 배포·마감 (기록은 지우지 않음)
export const POST = handle(async (req: Request) => {
  const teacher = await requireTeacher();
  const b = await readJson<ExamClassesRequest>(req);
  const exam = await getExam(b.examId);
  if (exam.id !== b.examId) fail(404, "수행평가를 찾지 못했어요.");
  requireSubject(teacher, exam);
  const pick = (a: unknown) => (Array.isArray(a) ? [...new Set(a.filter((c): c is string => typeof c === "string" && CLASS_IDS.includes(c)))] : []);
  const classIds = pick(b.classIds).sort();
  if (classIds.length === 0) fail(400, "반을 하나 이상 남겨 주세요.");
  const s = await saveClassSetting(exam.id, classIds, pick(b.closedClassIds));
  return Response.json({ classIds: s.classIds, closedClassIds: s.closedClassIds });
});
