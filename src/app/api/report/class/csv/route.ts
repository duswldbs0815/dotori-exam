import { requireTeacher } from "@/lib/auth";
import { getExam } from "@/lib/exams";
import { GRADE_SCALES, pointsTotal } from "@/lib/grading";
import { fail, handle } from "@/lib/http";
import { checkFlags } from "@/lib/report";
import { classLabel, CLASS_IDS } from "@/lib/school";
import { listAttempts, totalUsed } from "@/lib/store";

const cell = (v: unknown) => {
  let s = v === null || v === undefined ? "" : String(v);
  // 엑셀 수식 주입 막기: 학생이 이름을 "=HYPERLINK(…)"처럼 넣어도 수식으로 실행되지 않게 글자로 바꿈
  if (typeof v === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

// 반 채점표 내려받기 (나이스·학교 양식에 옮기기 쉬운 CSV, 엑셀에서 바로 열림)
export const GET = handle(async (req: Request) => {
  await requireTeacher();
  const url = new URL(req.url);
  const classId = url.searchParams.get("classId") ?? "";
  const examId = url.searchParams.get("examId") ?? "";
  if (!CLASS_IDS.includes(classId)) fail(400, "반을 골라 주세요.");
  const exam = await getExam(examId);
  const recs = (await listAttempts({ classId, examId: exam.id })).sort((a, b) => a.student.id.localeCompare(b.student.id));
  const labels = exam.shortItems ?? exam.outlineItems;
  const hasAi = recs.some((r) => r.grade?.ai !== undefined);
  const hasPoints = recs.some((r) => r.grade?.scale === "points");

  const head = ["학번", "이름", "제출", "채점 단계", ...labels, ...(hasAi ? ["AI 활용"] : []), ...(hasPoints ? ["합계"] : []), "평가 근거", "질문(도토리)", "차단", "확인할 점"];
  const lines = [head.map(cell).join(",")];
  for (const r of recs) {
    const g = r.grade;
    const scale = g ? GRADE_SCALES.find((s) => s.id === g.scale)?.label + (g.scale === "points" ? ` (${g.max}점 만점)` : "") : "";
    lines.push(
      [
        r.student.id,
        r.student.name,
        r.submittedAt ? "제출" : "미제출",
        scale,
        ...labels.map((_, i) => g?.items[i] ?? ""),
        ...(hasAi ? [g?.ai ?? ""] : []),
        ...(hasPoints ? [g ? (pointsTotal(g) ?? "") : ""] : []),
        g?.comment ?? "",
        totalUsed(r),
        r.questions.filter((q) => q.blocked).length,
        checkFlags(r).map((f) => f.label).join(" / "),
      ]
        .map(cell)
        .join(","),
    );
  }
  const name = `도토리_${classLabel(classId)}_${exam.title}.csv`.replace(/[\\/:*?"<>|]/g, "");
  return new Response("﻿" + lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="dotori.csv"; filename*=UTF-8''${encodeURIComponent(name)}`,
    },
  });
});
