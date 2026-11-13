// 서버 전용: AI 호출은 모두 이 파일을 거칩니다. (클라이언트 컴포넌트에서 import 금지)
// BAZE API Gateway의 OpenAI 호환 엔드포인트(/chat/completions)를 씁니다.

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type CallOptions = {
  /** "main" = LLM_MODEL (답변·가채점), "fast" = LLM_MODEL_FAST (분류·테스트). 직접 모델명을 줘도 됩니다. */
  model?: "main" | "fast" | (string & {});
  maxTokens?: number;
  temperature?: number;
};

function resolveModel(model: CallOptions["model"] = "main"): string {
  if (model === "main") return requireEnv("LLM_MODEL");
  if (model === "fast") return process.env.LLM_MODEL_FAST || requireEnv("LLM_MODEL");
  return model;
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`환경 변수 ${name} 가 비어 있습니다 (.env.local 확인)`);
  return v;
}

/** 텍스트 답변 한 번 받기 */
export async function callLLM(messages: ChatMessage[], opts: CallOptions = {}): Promise<string> {
  const baseUrl = requireEnv("LLM_API_URL").replace(/\/$/, "");
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requireEnv("LLM_API_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: resolveModel(opts.model),
      messages,
      max_tokens: opts.maxTokens ?? 2000,
      ...(opts.temperature !== undefined ? { temperature: opts.temperature } : {}),
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`LLM 호출 실패 (HTTP ${res.status}): ${detail.slice(0, 300)}`);
  }

  const data = await res.json();
  const content: unknown = data?.choices?.[0]?.message?.content;
  // 생각(추론) 토큰도 max_tokens 안에서 쓰는 모델은 한도에 걸리면 빈 답이 옴 → 에러로 처리 (도토리 차감 안 됨)
  if (typeof content !== "string" || !content.trim()) {
    throw new Error(`LLM 응답에 텍스트가 없습니다 (finish_reason: ${data?.choices?.[0]?.finish_reason ?? "?"})`);
  }
  return content;
}

/**
 * JSON으로 답을 받기 (질문 분류, 가채점 등).
 * 게이트웨이에서 Claude 모델은 response_format을 지원하지 않아서,
 * 모든 모델에 공통으로 "JSON만 출력" 지시를 붙이고 응답에서 JSON을 꺼냅니다.
 */
export async function callLLMJson<T>(messages: ChatMessage[], opts: CallOptions = {}): Promise<T> {
  const guarded: ChatMessage[] = [
    ...messages,
    { role: "user", content: "설명 없이 JSON 객체 하나만 출력하세요. 코드 블록 표시도 쓰지 마세요." },
  ];
  const text = await callLLM(guarded, opts);
  return parseJsonLoose<T>(text);
}

function parseJsonLoose<T>(text: string): T {
  const cleaned = text.replace(/```(?:json)?/gi, "").trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start !== -1 && end > start) {
      const body = cleaned.slice(start, end + 1);
      try {
        return JSON.parse(body) as T;
      } catch (e) {
        const pos = Number(String(e).match(/position (\d+)/)?.[1] ?? 0);
        throw new Error(`LLM 응답을 JSON으로 읽지 못했습니다 (${String(e)}) …${body.slice(Math.max(0, pos - 120), pos + 60)}…`);
      }
    }
    throw new Error(`LLM 응답을 JSON으로 읽지 못했습니다: ${text.slice(0, 200)}`);
  }
}
