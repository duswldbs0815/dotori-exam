// 서버 전용: 반 전체 "수업 단서" — 학생들의 질문을 AI가 묶고, 다음 수업에 쓸 제안을 붙임.
// 학생 이름·학번은 AI에 보내지 않음. 숫자(몇 명, 몇 번)는 AI가 아니라 서버가 셈.
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

// 같은 반·같은 시험·같은 질문 묶음이면 다시 만들지 않음 (서버 메모리, 30분)
const cache = new Map<string, { at: number; res: ClassInsightsResponse }>();
const TTL_MS = 30 * 60 * 1000;

export async function classInsights(recs: AttemptRecord[], exam: ExamDef, cacheKey: string): Promise<ClassInsightsResponse> {
  const qs = collect(recs, exam);
  const basedOn = {
    students: new Set(qs.map((q) => q.student)).size,
    questions: qs.filter((q) => !q.blocked).length,
    blocked: qs.filter((q) => q.blocked).length,
  };
  const now = new Date().toISOString();
  if (qs.length < MIN_QUESTIONS) return { cards: [], basedOn, generatedAt: now, source: "none" };

  // 질문이 새로 생기면 키가 바뀌어 다시 만듦
  const sig = `${cacheKey}|${qs.length}|${qs[0]?.time ?? ""}`;
  const hit = cache.get(sig);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.res;

  const list = qs.map((q) => `[${q.id}] (${q.item}${q.blocked ? " · 차단" : q.type ? ` · ${q.type}` : ""}) ${q.text}`).join("\n");
  const user = `수행평가: ${exam.subject ? `${exam.subject} · ` : ""}${exam.title}
개요 항목: ${(exam.shortItems?.length ? exam.shortItems : exam.outlineItems).join(" / ")}

질문 목록 (학생 이름 없음):
${list}`;

  let res: ClassInsightsResponse;
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
    res = { cards: cards.slice(0, 5), basedOn, generatedAt: now, source: "ai" };
  } catch (e) {
    console.error("수업 단서 AI 정리 실패", e);
    return { cards: [], basedOn, generatedAt: now, source: "error" }; // 실패는 저장하지 않음
  }
  cache.set(sig, { at: Date.now(), res });
  return res;
}
