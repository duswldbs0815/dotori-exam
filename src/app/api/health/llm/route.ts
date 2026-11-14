import { isTeacher } from "@/lib/auth";
import { callLLM, callLLMJson } from "@/lib/llm";

// 개발용 연결 확인: GET /api/health/llm (교사 로그인 필요 — 열 때마다 AI를 불러 비용이 들기 때문)
export async function GET() {
  if (!(await isTeacher())) return Response.json({ error: "교사 코드로 로그인해 주세요." }, { status: 401 });
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
