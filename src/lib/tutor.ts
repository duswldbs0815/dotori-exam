// 서버 전용: 시험지 안 AI의 답변·차단·분류
import { callLLM, callLLMJson } from "./llm";
import { EXAM_CONFIG } from "./exam-config";
import { QUESTION_TYPES, STAGES, type OutlineItemNo, type QuestionType, type Stage } from "./types";

export const BLOCKED_MESSAGE = "이 시험에서는 글을 대신 써 줄 수 없어요. 어느 부분에서 막혔는지 알려 주세요.";

const BLOCK_TAG = "[BLOCKED]";
const MAX_DRAFT_CHARS = 4000;

type AskInput = {
  question: string;
  outlineItem: OutlineItemNo;
  selectedText: string;
  draft: string;
};

function context(input: AskInput) {
  const item = EXAM_CONFIG.outlineItems[input.outlineItem - 1];
  const draft = input.draft.length > MAX_DRAFT_CHARS ? `…${input.draft.slice(-MAX_DRAFT_CHARS)}` : input.draft;
  return [
    `개요 항목: ${input.outlineItem}. ${item}`,
    input.selectedText ? `학생이 선택한 부분:\n"""${input.selectedText}"""` : "학생이 선택한 부분: 없음",
    `학생의 현재 글:\n"""${draft || "(아직 비어 있음)"}"""`,
  ].join("\n\n");
}

// 시 원문 (저작권 만료). AI가 구절을 틀리게 인용하지 않도록 지시문에 넣음
const POEM = `나 보기가 역겨워
가실 때에는
말없이 고이 보내 드리우리다.

영변에 약산
진달래꽃
아름 따다 가실 길에 뿌리우리다.

가시는 걸음걸음
놓인 그 꽃을
사뿐히 즈려밟고 가시옵소서.

나 보기가 역겨워
가실 때에는
죽어도 아니 눈물 흘리우리다.`;

const ANSWER_SYSTEM = `너는 중학생의 「진달래꽃」(김소월) 감상문 수행평가 시험지 안에 있는 AI 도우미다.

시 원문 (구절을 인용할 때는 반드시 이 원문 그대로 쓴다):
"""
${POEM}
"""

지켜야 할 것:
- 학생이 글, 문단, 문장을 대신 써 달라고 하거나 고쳐 쓴 문장을 달라고 하면 답하지 말고, 첫 줄에 ${BLOCK_TAG} 만 쓴다.
- 학생의 글을 대신 쓰거나, 그대로 옮겨 쓸 수 있는 완성된 문장·문단·예시 글을 주지 않는다.
- 학생 글의 문장을 직접 고쳐 쓰지 않는다. 어디가 왜 아쉬운지 짚어 주고, 고치는 일은 학생에게 맡긴다.
- 개념 설명, 시어의 뜻, 해석의 관점, 근거를 찾는 방향, 글의 약점 짚기, 되묻기는 해도 된다.
- 중학생이 이해할 수 있는 쉬운 말로, 최대 세 문장으로 답한다.
- 존댓말(해요체)로만 답한다.
- 제목(#), 굵은 글씨(**), 표 같은 마크다운 기호 없이 평범한 문장으로 답한다.`;

/** AI 답변. 차단이면 null */
async function answer(input: AskInput): Promise<string | null> {
  const text = await callLLM(
    [
      { role: "system", content: ANSWER_SYSTEM },
      { role: "user", content: `${context(input)}\n\n학생의 질문:\n${input.question}` },
    ],
    { model: "main", maxTokens: 400 },
  );
  if (text.trimStart().startsWith(BLOCK_TAG)) return null;
  return text.trim();
}

export type Classification = { stage: Stage | null; type: QuestionType | null; reason: string };

const CLASSIFY_SYSTEM = `너는 학생이 글쓰기 시험 중 AI에게 한 질문을 분류한다.
stage (쓰기 단계): ${STAGES.join(" / ")}
type (질문 방식):
- 사실 확인 요청: 맞는지, 뜻이 무엇인지 확인만 함
- 생각 확장 요청: 자기 생각을 말하고 다른 관점·근거를 넓혀 달라고 함
- 글 점검 요청: 자기 글을 주고 약점·문제를 짚어 달라고 함
- 대신 작성 요청: 글·문단·문장을 대신 써 달라거나 고쳐 쓴 문장을 달라고 함
reason: 한 문장
JSON {"stage": "...", "type": "...", "reason": "..."} 로만 답한다.`;

export async function classify(input: AskInput): Promise<Classification> {
  try {
    const out = await callLLMJson<{ stage?: string; type?: string; reason?: string }>(
      [
        { role: "system", content: CLASSIFY_SYSTEM },
        {
          role: "user",
          content: `개요 항목: ${input.outlineItem}. ${EXAM_CONFIG.outlineItems[input.outlineItem - 1]}\n선택한 부분: ${input.selectedText || "없음"}\n질문: ${input.question}`,
        },
      ],
      { model: "fast", maxTokens: 200 },
    );
    return {
      stage: (STAGES as readonly string[]).includes(out.stage ?? "") ? (out.stage as Stage) : null,
      type: (QUESTION_TYPES as readonly string[]).includes(out.type ?? "") ? (out.type as QuestionType) : null,
      reason: out.reason ?? "",
    };
  } catch (e) {
    console.error("질문 분류 실패", e);
    return { stage: null, type: null, reason: "" };
  }
}

/**
 * 질문 처리: 분류와 답변을 동시에 돌린 뒤
 * ① 분류가 "대신 작성 요청"이거나 ② AI가 [BLOCKED]로 답하면 차단.
 */
export async function tutor(input: AskInput) {
  const [cls, ans] = await Promise.all([classify(input), answer(input)]);
  const blocked = ans === null || cls.type === "대신 작성 요청";
  return {
    blocked,
    answer: blocked ? BLOCKED_MESSAGE : (ans as string),
    stage: cls.stage,
    type: blocked && !cls.type ? ("대신 작성 요청" as QuestionType) : cls.type,
  };
}
