// 서버 전용: 수행평가 목록·저장 (기본 제공 + 교사가 만든 것).
// 교사가 만든 것은 Supabase dotori_exams 표에, 환경 변수가 없으면 data/exams/ JSON 파일에 저장
import { randomBytes } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { dbList, dbPut, hasDb } from "./db";
import { callLLMJson } from "./llm";
import { BUILT_IN_EXAMS, DEFAULT_CLASS_ID, DEFAULT_EXAM_ID, presetSuggestion } from "./school";
import type { AttemptRecord } from "./store";
import type { ExamDef, ExamSuggestion, ItemGuide, SaveExamRequest } from "./types";
import { EXAM_CONFIG } from "./exam-config";

const DIR = path.join(process.cwd(), "data", "exams");

async function customExams(): Promise<ExamDef[]> {
  if (hasDb()) return (await dbList<ExamDef>("dotori_exams")).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  let names: string[] = [];
  try {
    names = await readdir(DIR);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw e;
  }
  const out: ExamDef[] = [];
  for (const n of names.filter((n) => n.endsWith(".json"))) {
    try {
      out.push(JSON.parse(await readFile(path.join(DIR, n), "utf8")) as ExamDef);
    } catch (e) {
      console.error("수행평가 파일을 읽지 못했어요", n, e);
    }
  }
  return out.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function listExams(): Promise<ExamDef[]> {
  return [...BUILT_IN_EXAMS, ...(await customExams())];
}

export async function getExam(id: string | undefined | null): Promise<ExamDef> {
  const all = await listExams();
  return all.find((e) => e.id === (id || DEFAULT_EXAM_ID)) ?? BUILT_IN_EXAMS[0];
}

export const examIdOf = (rec: Pick<AttemptRecord, "examId">) => rec.examId || DEFAULT_EXAM_ID;
export const classIdOf = (rec: Pick<AttemptRecord, "classId">) => rec.classId || DEFAULT_CLASS_ID;
export const examOf = (rec: Pick<AttemptRecord, "examId">) => getExam(rec.examId);

/** 응시 기록 ID: 기본 시험은 학번 그대로 (예전 기록과 호환), 다른 시험은 학번_시험ID */
export const attemptIdFor = (studentId: string, examId: string) =>
  examId === DEFAULT_EXAM_ID ? studentId : `${studentId}_${examId}`;

export async function saveExam(req: SaveExamRequest): Promise<ExamDef> {
  const id = `t${randomBytes(3).toString("hex")}`;
  const exam: ExamDef = {
    ...req,
    id,
    acornPlanMaxPerItem: EXAM_CONFIG.acornPlanMaxPerItem,
    acornSafetyCap: EXAM_CONFIG.acornSafetyCap,
    createdAt: new Date().toISOString(),
  };
  if (hasDb()) {
    await dbPut("dotori_exams", id, exam);
  } else {
    await mkdir(DIR, { recursive: true });
    await writeFile(path.join(DIR, `${id}.json`), JSON.stringify(exam, null, 2), "utf8");
  }
  return exam;
}

// ── AI가 수행평가 기준 초안을 제안 ───────────────────────────────

const SUGGEST_SYSTEM = `너는 중학교 교사가 수행평가를 준비하도록 돕는 평가 설계 도우미다.
학생은 시험지 안의 AI에게 질문할 때마다 "도토리" 1개를 쓴다. 질문 기록은 교사에게 리포트로 간다.
교사가 준 과목·학년·과제와 수업 자료·채점기준표를 읽고, 이 과제에 맞는 AI 활용 기준 초안을 만든다.

원칙:
- 개요 항목은 정확히 4개. 학생이 글을 쓰기 전에 생각을 정리하는 단계 순서로.
- 항목마다 help(AI가 도와도 되는 일)와 avoid(AI가 하지 않을 일)를 한 줄로, acorns(권장 도토리 수, 0~5)를 정한다.
- 과제의 핵심 평가 요소(학생 스스로 해야 하는 판단)에는 도토리를 적게, 혼자 알기 어려운 지식·점검에는 많이 권한다.
- 채점기준표가 있으면 그 평가 요소를 개요 항목과 이유에 반영한다.
- 성찰 질문 4개: 계획과 실제 비교, 도움이 된 질문, AI 답 검증, 다음 계획.
- 학생에게 쓸 말은 해요체, 교사에게 쓸 말(rationale)은 두 문장 이내.
- 문자열 안에서 큰따옴표(")를 쓰지 말고 작은따옴표(')를 쓴다.
JSON 형식 (itemGuides는 개요 항목 순서대로 정확히 4개):
{"title":"","outlineItems":["","","",""],"shortItems":["","","",""],"itemGuides":[{"help":"","avoid":"","acorns":0},{"help":"","avoid":"","acorns":0},{"help":"","avoid":"","acorns":0},{"help":"","avoid":"","acorns":0}],"reflectionQuestions":["","","",""],"rationale":"","blockedExamples":["",""]}`;

const MAX_MATERIAL_CHARS = 12000;

export async function suggestExam(input: {
  subject: string;
  grade: number;
  task: string;
  unit: string;
  notes: string;
  materials: { name: string; text: string }[];
}): Promise<ExamSuggestion> {
  const materials = input.materials.map((m) => ({ name: m.name, chars: m.text.length }));
  const preset = () => ({ ...presetSuggestion(input.subject, input.grade, input.task), materials, source: "preset" as const });
  if (!process.env.LLM_API_URL || !process.env.LLM_API_KEY) return preset();

  let budget = MAX_MATERIAL_CHARS;
  const docs = input.materials
    .map((m) => {
      const t = m.text.slice(0, Math.max(0, budget));
      budget -= t.length;
      return t ? `[자료: ${m.name}]\n${t}` : "";
    })
    .filter(Boolean)
    .join("\n\n");

  try {
    const ask = () => callLLMJson<Partial<ExamSuggestion>>(
      [
        { role: "system", content: SUGGEST_SYSTEM },
        {
          role: "user",
          content: [
            `과목: ${input.subject} / 학년: 중${input.grade}`,
            input.unit ? `단원: ${input.unit}` : "",
            `과제: ${input.task}`,
            input.notes ? `교사 메모: ${input.notes}` : "",
            docs ? `\n교사가 올린 자료:\n${docs}` : "\n교사가 올린 자료: 없음",
          ]
            .filter(Boolean)
            .join("\n"),
        },
      ],
      { model: "main", maxTokens: 4000 },
    );
    // JSON이 깨져 오는 경우가 가끔 있어 한 번 더 물어봄
    const out = await ask().catch((e) => {
      console.warn("수행평가 제안 JSON 오류, 한 번 더 시도", String(e).slice(0, 120));
      return ask();
    });
    const four = (a: unknown): a is string[] => Array.isArray(a) && a.length === 4 && a.every((s) => typeof s === "string" && s.trim());
    const guides = Array.isArray(out.itemGuides) && out.itemGuides.length === 4 ? out.itemGuides : null;
    if (!four(out.outlineItems) || !four(out.reflectionQuestions) || !guides) return preset();
    return {
      title: (out.title || "").trim() || preset().title,
      outlineItems: out.outlineItems,
      shortItems: four(out.shortItems) ? out.shortItems : out.outlineItems,
      itemGuides: guides.map((g: Partial<ItemGuide>) => ({
        help: String(g.help ?? ""),
        avoid: String(g.avoid ?? ""),
        acorns: Math.max(0, Math.min(5, Math.round(Number(g.acorns) || 0))),
      })),
      reflectionQuestions: out.reflectionQuestions,
      rationale: String(out.rationale ?? ""),
      blockedExamples: Array.isArray(out.blockedExamples) ? out.blockedExamples.map(String).slice(0, 3) : [],
      materials,
      source: "ai",
    };
  } catch (e) {
    console.error("수행평가 제안 실패, 예시 제안으로 대신함", e);
    return preset();
  }
}
