// 서버 전용: 반 전체 "수업 단서" — 학생들의 질문을 AI가 묶고, 다음 수업에 쓸 제안을 붙임.
// 학생 이름·학번은 AI에 보내지 않음. 숫자(몇 명, 몇 번)는 AI가 아니라 서버가 셈.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { dbGet, dbPut, hasDb } from "./db";
import { callLLMJson } from "./llm";
import type { AttemptRecord } from "./store";
import type { ClassInsightsResponse, ExamDef, InsightCard } from "./types";

const MAX_QUESTIONS = 300; // AI에 보내는 최대 질문 수 (최근 것부터)
const MAX_Q_CHARS = 160;
const MIN_QUESTIONS = 3;

type Q = { id: number; student: number; item: string; type: string; blocked: boolean; text: string; time: string };

const SYSTEM = `너는 중학교 교사를 돕는 수업 분석가다. 한 반 학생들이 수행평가 중 시험지 안 AI에게 한 질문 목록을 받는다.
비슷한 질문끼리 묶어서, 교사가 다음 수업에서 무엇을 다루면 좋을지 알려 준다.

규칙:
- 묶음은 3~5개. 질문이 많이 몰린 순서로.
- 각 묶음의 ids에는 그 묶음에 속한 질문 번호를 쉼표로 이어 쓴 문자열로 넣는다 (예: "3,8,15"). 한 질문은 한 묶음에만. 어디에도 안 맞는 질문은 빼도 된다.
- 대신 써 달라는 요청([차단])이 있으면, 어느 단계에서 막혔는지를 보여 주는 묶음으로 따로 다룬다.
- 학생을 평가하거나 탓하지 않는다. "학생들이 어디서 막혔는지"와 "수업에서 무엇을 해 볼지"만 쓴다.
- 숫자(몇 명, 몇 번)는 쓰지 않는다. 숫자는 화면이 따로 보여 준다.
- title: 무엇을 물었는지 한 줄 (25자 안팎)
- detail: 이 질문들이 보여 주는 학생들의 어려움 한 문장
- suggestion: 다음 수업에서 해 볼 구체적인 활동 한 문장 (5~10분 안에 할 수 있는 것)
- 쉬운 한국어, 해요체.
JSON {"groups":[{"title":"","detail":"","suggestion":"","ids":"1,2"}]} 로만 답한다. 생각 과정은 쓰지 말고 바로 답한다.`;

function collect(recs: AttemptRecord[], exam: ExamDef): Q[] {
  const labels = exam.shortItems?.length ? exam.shortItems : exam.outlineItems;
  const out: Q[] = [];
  recs.forEach((r, si) => {
    for (const q of r.questions) {
      const text = q.question.replace(/\s+/g, " ").trim();
      if (!text) continue;
      out.push({
        id: 0,
        student: si,
        item: labels[q.outlineItem - 1] ?? `항목 ${q.outlineItem}`,
        type: q.type ?? "",
        blocked: q.blocked,
        text: text.length > MAX_Q_CHARS ? `${text.slice(0, MAX_Q_CHARS)}…` : text,
        time: q.time,
      });
    }
  });
  // 너무 많으면 최근 질문부터
  out.sort((a, b) => b.time.localeCompare(a.time));
  return out.slice(0, MAX_QUESTIONS).map((q, i) => ({ ...q, id: i + 1 }));
}

function mostCommon(values: string[]): string | null {
  const c = new Map<string, number>();
  for (const v of values) c.set(v, (c.get(v) ?? 0) + 1);
  let best: string | null = null;
  let n = 0;
  for (const [k, v] of c) if (v > n) [best, n] = [k, v];
  return best;
}

// ── 저장 ─────────────────────────────────────────────────
// 한 번 만든 결과는 저장해 두고 바로 보여 줌. 서버가 바뀌어도(배포 환경) 다시 20초 기다리지 않게
// Supabase가 있으면 dotori_insights 표, 없으면 data/insights/ JSON 파일. 서버 메모리에도 함께 둠.
// 표가 아직 없으면(SQL 미실행) 메모리만 쓰고 계속 동작.
type Saved = { sig: string; res: ClassInsightsResponse };
const TABLE = "dotori_insights";
const DIR = path.join(process.cwd(), "data", "insights");
const memory = new Map<string, Saved>();
const refreshing = new Set<string>();
let dbWarned = false;

const fileOf = (key: string) => path.join(DIR, `${key.replace(/[^A-Za-z0-9_-]/g, "_")}.json`);

async function loadSaved(key: string): Promise<Saved | null> {
  const m = memory.get(key);
  if (m) return m;
  try {
    const v = hasDb()
      ? await dbGet<Saved>(TABLE, key)
      : (JSON.parse(await readFile(fileOf(key), "utf8")) as Saved);
    if (v?.res) memory.set(key, v);
    return v?.res ? v : null;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") warnDb(e);
    return null;
  }
}

async function save(key: string, v: Saved) {
  memory.set(key, v);
  try {
    if (hasDb()) await dbPut(TABLE, key, v);
    else {
      await mkdir(DIR, { recursive: true });
      await writeFile(fileOf(key), JSON.stringify(v, null, 2), "utf8");
    }
  } catch (e) {
    warnDb(e);
  }
}

function warnDb(e: unknown) {
  if (dbWarned) return;
  dbWarned = true;
  console.warn(`수업 단서 저장소를 쓰지 못해 서버 메모리에만 둡니다 (supabase/insights.sql 실행 필요할 수 있음): ${(e as Error).message}`);
}

// ── AI 정리 ───────────────────────────────────────────────
async function generate(qs: Q[], exam: ExamDef, basedOn: ClassInsightsResponse["basedOn"]): Promise<ClassInsightsResponse> {
  const now = new Date().toISOString();
  const list = qs.map((q) => `[${q.id}] (${q.item}${q.blocked ? " · 차단" : q.type ? ` · ${q.type}` : ""}) ${q.text}`).join("\n");
  const user = `수행평가: ${exam.subject ? `${exam.subject} · ` : ""}${exam.title}
개요 항목: ${(exam.shortItems?.length ? exam.shortItems : exam.outlineItems).join(" / ")}

질문 목록 (학생 이름 없음):
${list}`;

  try {
    const out = await callLLMJson<{ groups?: { title?: string; detail?: string; suggestion?: string; ids?: unknown }[] }>(
      [
        { role: "system", content: SYSTEM },
        { role: "user", content: user },
      ],
      { model: "main", maxTokens: 8000 },
    );
    const byId = new Map(qs.map((q) => [q.id, q]));
    const used = new Set<number>();
    const cards: InsightCard[] = [];
    for (const g of out.groups ?? []) {
      const raw = Array.isArray(g.ids) ? g.ids.join(",") : String(g.ids ?? "");
      const ids = raw
        .split(/[^0-9]+/)
        .filter(Boolean)
        .map((x) => Number(x))
        .filter((x) => byId.has(x) && !used.has(x));
      if (!ids.length || !g.title) continue;
      ids.forEach((x) => used.add(x));
      const members = ids.map((x) => byId.get(x)!);
      const blockedShare = members.filter((m) => m.blocked).length / members.length;
      cards.push({
        title: String(g.title).slice(0, 80),
        detail: String(g.detail ?? "").slice(0, 200),
        suggestion: String(g.suggestion ?? "").slice(0, 200),
        students: new Set(members.map((m) => m.student)).size,
        questions: members.length,
        item: mostCommon(members.map((m) => m.item)),
        examples: [...new Set(members.filter((m) => !m.blocked).map((m) => m.text))].slice(0, 2),
        blocked: blockedShare >= 0.5,
      });
    }
    // 학생이 많이 겹친 묶음부터
    cards.sort((a, b) => b.students - a.students || b.questions - a.questions);
    return { cards: cards.slice(0, 5), basedOn, generatedAt: now, source: "ai" };
  } catch (e) {
    console.error("수업 단서 AI 정리 실패", e);
    return { cards: [], basedOn, generatedAt: now, source: "error" };
  }
}

/**
 * 반 수업 단서.
 * - 저장된 결과가 지금 질문과 같으면 바로 돌려줌
 * - 저장된 결과가 있지만 그사이 질문이 늘었으면, 저장된 것을 바로 보여 주고(stale) 새 결과는 refresh로 뒤에서 만듦
 * - 저장된 게 없으면 지금 만듦 (처음 한 번 15~20초)
 */
export async function classInsights(
  recs: AttemptRecord[],
  exam: ExamDef,
  key: string,
): Promise<{ res: ClassInsightsResponse; refresh?: () => Promise<void> }> {
  const qs = collect(recs, exam);
  const basedOn = {
    students: new Set(qs.map((q) => q.student)).size,
    questions: qs.filter((q) => !q.blocked).length,
    blocked: qs.filter((q) => q.blocked).length,
  };
  if (qs.length < MIN_QUESTIONS) return { res: { cards: [], basedOn, generatedAt: new Date().toISOString(), source: "none" } };

  const sig = `${qs.length}|${qs[0]?.time ?? ""}`; // 질문이 새로 생기면 바뀜
  const saved = await loadSaved(key);
  if (saved && saved.sig === sig) return { res: saved.res };

  const make = async () => {
    const res = await generate(qs, exam, basedOn);
    if (res.source === "ai") await save(key, { sig, res }); // 실패는 저장하지 않음
    return res;
  };

  if (saved) {
    const refresh = refreshing.has(key)
      ? undefined
      : async () => {
          refreshing.add(key);
          try {
            await make();
          } finally {
            refreshing.delete(key);
          }
        };
    return { res: { ...saved.res, stale: true }, refresh };
  }
  return { res: await make() };
}
