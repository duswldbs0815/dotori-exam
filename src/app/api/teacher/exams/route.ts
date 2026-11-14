import { requireTeacher } from "@/lib/auth";
import { saveExam } from "@/lib/exams";
import { fail, handle, readJson } from "@/lib/http";
import { CLASS_IDS, GRADES, SUBJECTS } from "@/lib/school";
import { DEFAULT_MAX, GRADE_SCALES } from "@/lib/grading";
import type { SaveExamRequest, SaveExamResponse } from "@/lib/types";

const str = (v: unknown, max = 300) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const four = (a: unknown, max = 200) =>
  Array.isArray(a) && a.length === 4 && a.every((s) => typeof s === "string" && s.trim()) ? a.map((s: string) => s.trim().slice(0, max)) : null;

// 교사가 확정한 수행평가를 저장하고 반에 배포
export const POST = handle(async (req: Request) => {
  const teacher = await requireTeacher();
  const b = await readJson<SaveExamRequest>(req);
  const title = str(b.title, 80);
  const subject = str(b.subject, 20);
  const outlineItems = four(b.outlineItems, 40);
  const shortItems = four(b.shortItems, 20) ?? outlineItems;
  const reflectionQuestions = four(b.reflectionQuestions, 200);
  const classIds = Array.isArray(b.classIds) ? b.classIds.filter((c) => CLASS_IDS.includes(c)) : [];
  if (!title) fail(400, "수행평가 제목을 적어 주세요.");
  if (!SUBJECTS.includes(subject)) fail(400, "과목을 골라 주세요.");
  if (subject !== teacher.subject) fail(403, `${teacher.subject} 수행평가만 만들 수 있어요.`);
  if (!GRADES.includes(b.grade)) fail(400, "학년을 골라 주세요.");
  if (!outlineItems || !shortItems) fail(400, "개요 항목 4개를 모두 채워 주세요.");
  if (!reflectionQuestions) fail(400, "성찰 질문 4개를 모두 채워 주세요.");
  if (!Array.isArray(b.itemGuides) || b.itemGuides.length !== 4) fail(400, "항목별 AI 기준이 필요해요.");
  if (classIds.length === 0) fail(400, "배포할 반을 하나 이상 골라 주세요.");

  const exam = await saveExam({
    title,
    subject,
    grade: b.grade,
    unit: str(b.unit, 60),
    task: str(b.task, 600),
    outlineItems,
    shortItems,
    reflectionQuestions,
    itemGuides: b.itemGuides.map((g) => ({
      help: str(g?.help, 120),
      avoid: str(g?.avoid, 120),
      acorns: Math.max(0, Math.min(10, Math.round(Number(g?.acorns) || 0))),
    })),
    classIds,
    materials: Array.isArray(b.materials) ? b.materials.slice(0, 10).map((m) => ({ name: str(m?.name, 120), chars: Number(m?.chars) || 0 })) : [],
    rationale: str(b.rationale, 400),
    ...(b.passage && str(b.passage.body, 8000)
      ? { passage: { title: str(b.passage.title, 80) || "지문", author: str(b.passage.author, 60) || undefined, body: str(b.passage.body, 8000), source: str(b.passage.source, 120) || undefined } }
      : {}),
    ...(b.grading && GRADE_SCALES.some((s) => s.id === b.grading?.scale)
      ? {
          grading: {
            scale: b.grading.scale,
            ...(b.grading.scale === "points" ? { max: Math.max(1, Math.min(1000, Math.round(Number(b.grading.max) || DEFAULT_MAX))) } : {}),
            // 🔄 항목별 배점 (점수 채점일 때만)
            ...(b.grading.scale === "points" && Array.isArray(b.grading.itemMax) && b.grading.itemMax.length === 4
              ? { itemMax: b.grading.itemMax.map((m) => Math.max(1, Math.min(1000, Math.round(Number(m) || DEFAULT_MAX)))) }
              : {}),
          },
        }
      : {}),
    // 🔄 항목별 채점 기준 (AI 1차 채점과 교사 채점 칸에서 씀)
    ...(Array.isArray(b.criteria) && b.criteria.length === 4 && b.criteria.some((c) => str(c, 400))
      ? { criteria: b.criteria.map((c) => str(c, 400)) }
      : {}),
  });
  const res: SaveExamResponse = { exam };
  return Response.json(res);
});
