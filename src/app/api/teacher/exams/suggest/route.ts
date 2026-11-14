import { requireTeacher } from "@/lib/auth";
import { suggestExam } from "@/lib/exams";
import { fail, handle } from "@/lib/http";
import { GRADES, SUBJECTS } from "@/lib/school";

const MAX_FILES = 5;
// Vercel 함수는 요청 본문이 4.5MB까지라 파일 전체 합을 4MB로 제한
const MAX_TOTAL_BYTES = 4 * 1024 * 1024;

/** 올린 파일에서 글자만 꺼냄 (PDF·텍스트). 못 읽는 형식은 이름만 남김 */
async function textOf(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf") || file.type === "application/pdf") {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(await file.arrayBuffer()));
    const { text } = await extractText(pdf, { mergePages: true });
    return text;
  }
  if (/\.(txt|md|csv|json)$/.test(name) || file.type.startsWith("text/")) return await file.text();
  return "";
}

// 과목·과제·수업 자료를 읽고 AI가 수행평가 기준 초안을 제안 (multipart/form-data)
export const POST = handle(async (req: Request) => {
  const teacher = await requireTeacher();
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    fail(400, "요청 형식이 올바르지 않아요.");
  }
  const subject = String(form.get("subject") ?? "");
  const grade = Number(form.get("grade"));
  const task = String(form.get("task") ?? "").trim().slice(0, 600);
  if (!SUBJECTS.includes(subject)) fail(400, "과목을 골라 주세요.");
  if (subject !== teacher.subject) fail(403, `${teacher.subject} 수행평가만 만들 수 있어요.`);
  if (!GRADES.includes(grade)) fail(400, "학년을 골라 주세요.");
  if (!task) fail(400, "과제를 한두 문장으로 적어 주세요.");

  const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0).slice(0, MAX_FILES);
  if (files.reduce((a, f) => a + f.size, 0) > MAX_TOTAL_BYTES) fail(413, "파일이 너무 커요. 모두 합쳐 4MB까지 올릴 수 있어요.");
  const materials: { name: string; text: string }[] = [];
  for (const f of files) {
    let text = "";
    try {
      text = (await textOf(f)).replace(/\s+\n/g, "\n").trim();
    } catch (e) {
      console.error("자료를 읽지 못했어요", f.name, e);
    }
    materials.push({ name: f.name, text });
  }
  const pasted = String(form.get("pasted") ?? "").trim();
  if (pasted) materials.push({ name: "붙여 넣은 자료", text: pasted.slice(0, 20000) });

  const suggestion = await suggestExam({
    subject,
    grade,
    task,
    unit: String(form.get("unit") ?? "").trim().slice(0, 60),
    notes: String(form.get("notes") ?? "").trim().slice(0, 400),
    materials,
  });
  return Response.json(suggestion);
});
