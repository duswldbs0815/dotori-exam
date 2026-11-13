// 서버 전용: 제출된 글의 문장별 작성 경로를 AI로 판정해서 저장 (2차 판정)
import { callLLMJson } from "./llm";
import { heuristicPaths, pathCandidates } from "./report";
import { loadAttempt, updateAttempt } from "./store";
import type { ReportSentence, SentencePath } from "./types";

const JUDGE_SYSTEM = `너는 중학생 감상문의 문장마다, 그 문장이 직전에 학생이 받은 AI 답의 내용을 반영한 것인지 판단한다.
각 문장에 대해 하나를 고른다:
- "ai": AI 답의 문장을 거의 그대로 옮겼다
- "revised": AI 답에서 얻은 내용(관점, 근거, 시어 풀이, 지적받은 점 등)을 학생이 자기 말로 바꿔 반영했다
- "self": AI 답과 관계없이 학생이 스스로 쓴 문장이다 (원래 생각을 이어 쓴 문장, 일반적인 감상, 연결 문장 등)
판단이 애매하면 "self"를 고른다. 이 판단은 교사가 참고할 단서일 뿐이다.
JSON {"results": [{"i": 번호, "path": "ai|revised|self"}]} 로만 답한다.`;

/** 제출된 글을 AI로 판정. 실패하면 null (리포트는 1차 판정을 씀) */
export async function judgeSentencePaths(attemptId: string): Promise<void> {
  const rec = await loadAttempt(attemptId);
  if (!rec || !rec.final) return;
  const final = rec.final;
  if (rec.sentencePaths && rec.sentencePathsFor === final) return; // 이미 판정함

  const cands = pathCandidates(rec, final);
  const base = heuristicPaths(cands);

  // AI에게 물을 문장: 질문 뒤에 생겼고, 거의 그대로 옮긴 게 확실하지 않은 문장
  const ask = cands
    .map((c, idx) => ({ c, idx }))
    .filter(({ c }) => c.question && !c.nearCopy);

  let paths: ReportSentence[] = base;
  if (ask.length > 0) {
    try {
      const list = ask
        .map(
          ({ c }, k) =>
            `[${k + 1}]\n직전 질문: ${c.question!.question}\nAI 답: ${c.question!.answer}\n판단할 문장: ${c.text}`,
        )
        .join("\n\n");
      const out = await callLLMJson<{ results?: { i?: number; path?: string }[] }>(
        [
          { role: "system", content: JUDGE_SYSTEM },
          { role: "user", content: list },
        ],
        { model: "fast", maxTokens: 2000 },
      );
      const valid: SentencePath[] = ["ai", "revised", "self"];
      paths = base.map((s) => ({ ...s }));
      for (const r of out.results ?? []) {
        const hit = typeof r.i === "number" ? ask[r.i - 1] : undefined;
        if (!hit || !valid.includes(r.path as SentencePath)) continue;
        const path = r.path as SentencePath;
        const acornNo = hit.c.question!.acornNo ?? undefined;
        paths[hit.idx] = path === "self" ? { text: hit.c.text, path } : { text: hit.c.text, path, acornNo };
      }
    } catch (e) {
      console.error("작성 경로 AI 판정 실패, 1차 판정 사용", e);
      return; // 저장하지 않음 → 리포트는 1차 판정
    }
  }

  await updateAttempt(attemptId, (cur) => {
    if (!cur || cur.final !== final) return { rec: null, result: null }; // 그사이 바뀌었으면 버림
    return { rec: { ...cur, sentencePaths: paths, sentencePathsFor: final }, result: null };
  });
}
