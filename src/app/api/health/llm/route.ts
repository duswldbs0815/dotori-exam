import { callLLM, callLLMJson } from "@/lib/llm";

// 개발용 연결 확인: GET /api/health/llm
export async function GET() {
  try {
    const text = await callLLM([{ role: "user", content: "한국어로 한 단어 인사만 해 주세요." }], {
      model: "fast",
      maxTokens: 20,
    });
    const json = await callLLMJson<{ ok: boolean }>(
      [{ role: "user", content: '{"ok": true} 를 그대로 출력하세요.' }],
      { model: "main", maxTokens: 20 },
    );
    return Response.json({ ok: true, text, json });
  } catch (e) {
    return Response.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
