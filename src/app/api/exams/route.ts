import { fail, handle } from "@/lib/http";
import { listExams } from "@/lib/exams";
import { CLASS_IDS } from "@/lib/school";
import type { ClassExamsResponse } from "@/lib/types";

// 학생 시작 화면: 우리 반에 열린 수행평가 목록 (제목·과목만)
export const GET = handle(async (req: Request) => {
  const classId = new URL(req.url).searchParams.get("classId") ?? "";
  if (!CLASS_IDS.includes(classId)) fail(400, "학년과 반을 골라 주세요.");
  const exams = (await listExams()).filter((e) => e.classIds.includes(classId));
  const res: ClassExamsResponse = {
    exams: exams.map((e) => ({ id: e.id, title: e.title, subject: e.subject, grade: e.grade })),
  };
  return Response.json(res);
});
