// 교사팀 가상 학생 데이터(S01~S03, scripts/demo-data/teacher-demo-students.json)를 본보기로
// AI가 수행평가마다 "다른 학생" 기록을 여러 개 만들어 scripts/demo-data/generated-variants.json 에 저장합니다.
// seed-school.mjs 가 이 파일로 가상 학교 응시 기록을 만듭니다. (글·질문을 코드에 직접 쓰지 않음)
//
// 실행: npm run gen:variants            (모든 시험, 학생 유형마다 4개)
//       npm run gen:variants -- kor2 6  (한 시험만, 유형마다 6개)
// 필요: .env.local 의 LLM_API_URL, LLM_API_KEY, LLM_MODEL (BAZE API Gateway)
// 결과물은 모두 가상 데이터입니다. 실제 학생 정보를 넣지 않습니다.
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const OUT = path.join(ROOT, "scripts", "demo-data", "generated-variants.json");

// .env.local 읽기
try {
  for (const line of (await readFile(path.join(ROOT, ".env.local"), "utf8")).split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {}
const { LLM_API_URL, LLM_API_KEY, LLM_MODEL } = process.env;
if (!LLM_API_URL || !LLM_API_KEY || !LLM_MODEL) throw new Error(".env.local 에 LLM_API_URL, LLM_API_KEY, LLM_MODEL 이 필요해요.");

const teacher = JSON.parse(await readFile(path.join(ROOT, "scripts", "demo-data", "teacher-demo-students.json"), "utf8"));
if (!teacher.datasetInfo?.synthetic) throw new Error("본보기 데이터가 가상 데이터(synthetic: true)가 아니에요.");
const school = JSON.parse(await readFile(path.join(ROOT, "src", "data", "school.json"), "utf8"));
const typesSrc = await readFile(path.join(ROOT, "src", "lib", "types.ts"), "utf8");
const pick = (name) => JSON.parse(typesSrc.match(new RegExp(`export const ${name} = (\\[[^\\]]*\\])`))[1]);
const OUTLINE_ITEMS = pick("OUTLINE_ITEMS");
const STAGES = pick("STAGES");
const TYPES = pick("QUESTION_TYPES");

// 시험 정보: 기본 「진달래꽃」 + school.json
const exams = [
  {
    id: "kor2",
    grade: 2,
    subject: "국어",
    title: teacher.datasetInfo.taskTitle,
    task: "김소월의 「진달래꽃」을 읽고 시어와 표현을 근거로 자신의 해석과 비평을 담은 감상문을 쓴다.",
    outlineItems: OUTLINE_ITEMS,
    itemGuides: null,
    passage: null,
  },
  ...school.exams,
];

// 학생 유형 = 교사팀 본보기 3명
const PROFILES = {
  A: { example: "S01", desc: "필요한 질문만 1~3번 하고 스스로 해석을 보완하는 학생. 차단 요청 없음.", allowed: [1, 3], blocked: [0, 0] },
  B: { example: "S02", desc: "계획보다 질문이 크게 늘어나는 학생(6~10번). 고쳐쓰기에서 질문이 많고, 비슷한 확인 질문을 되풀이하기도 함. 차단 요청 없음.", allowed: [6, 10], blocked: [0, 0] },
  C: { example: "S03", desc: "빨리 끝내려고 글을 대신 써 달라고 했다가 차단(1~2번)된 뒤, 허용되는 질문(4~6번)으로 바꿔 묻는 학생. AI 답의 표현을 비슷하게 옮겨 쓴 부분도 조금 있음.", allowed: [4, 6], blocked: [1, 2] },
};
// 같은 유형이라도 글이 겹치지 않게 주는 관점·경험 힌트
const ANGLES = [
  "가족(할머니·동생 등)과의 경험을 떠올리는 학생",
  "운동부·동아리 활동 경험이 있는 학생",
  "이사·전학 경험이 있는 학생",
  "반려동물을 키워 본 학생",
  "처음 생각을 끝까지 지키되 근거를 보강하는 학생",
  "처음 생각이 질문 뒤에 크게 바뀌는 학생",
];

const example = (id) => {
  const s = teacher.students.find((x) => x.id === id);
  return {
    outline: s.outline,
    plan: s.aiUsePlan.expectedCountsByOutline,
    initialDraft: s.initialDraft,
    questions: s.questions.map((q) => ({ outlineItem: q.outlineItem, question: q.question, answer: q.answer, blocked: q.blocked, stage: q.stage, type: q.type })),
    final: s.final,
    reflection: s.reflection,
  };
};

const SYSTEM = `너는 중학교 수행평가 연구용 "가상" 학생 기록을 만드는 도우미다. 실제 학생이 아닌 지어낸 데이터다.
도토리 시험지: 학생은 개요를 쓰고 항목마다 예상 질문 수(plan)를 적은 뒤, 글을 쓰다 막히면 AI에게 질문한다(질문 1번 = 도토리 1개).
AI는 글을 대신 써 주지 않는다. 대신 써 달라는 요청은 차단되고 답은 항상 "이 시험에서는 글을 대신 써 줄 수 없어요. 어느 부분에서 막혔는지 알려 주세요."이다.
허용된 질문의 AI 답은 해요체 1~3문장이고, 완성 문장을 주지 않고 어디를 다시 볼지 짚어 준다.
본보기(교사팀이 만든 가상 학생)의 말투·분량·질문 흐름을 따르되, 내용·경험·표현은 새로 지어서 본보기와 겹치지 않게 한다.
학생 글은 중학생 수준의 자연스러운 문장으로 쓴다.
stage는 ${STAGES.join(" / ")} 중 하나, type은 ${TYPES.join(" / ")} 중 하나(차단은 "대신 작성 요청").
문자열 안에서는 큰따옴표 대신 작은따옴표나 ‘ ’를 쓴다. 설명 없이 JSON 객체 하나만 출력한다.`;

function userPrompt(exam, profileKey, angle) {
  const p = PROFILES[profileKey];
  const english = exam.subject === "영어";
  return [
    `시험: 중${exam.grade} ${exam.subject} 「${exam.title}」`,
    `과제: ${exam.task}`,
    `개요 항목 4개: ${exam.outlineItems.map((x, i) => `${i + 1}. ${x}`).join(" / ")}`,
    exam.itemGuides ? `항목별 교사 권장 도토리: ${exam.itemGuides.map((g) => g.acorns).join(", ")}` : "",
    exam.passage ? `학생이 받은 자료 「${exam.passage.title}」:\n${exam.passage.body.slice(0, 1500)}` : "",
    english ? "이 시험은 영어 에세이다: initialDraft, steps[].addedText, closing 은 영어(중2 수준, 쉬운 문장)로 쓰고, 개요·질문·성찰은 한국어로 쓴다." : "",
    "",
    `학생 유형: ${p.desc}`,
    `이번 학생의 특징: ${angle}`,
    `허용 질문 ${p.allowed[0]}~${p.allowed[1]}개, 차단 요청 ${p.blocked[0]}~${p.blocked[1]}개.`,
    "",
    `본보기 학생 (다른 과제일 수 있음, 흐름만 참고):\n${JSON.stringify(example(p.example))}`,
    "",
    `출력 JSON 형식:
{"outline":["","","",""],"plan":[0,0,0,0],"initialDraft":"질문 전 첫 초안 3~6문장",
"steps":[{"outlineItem":1,"question":"","answer":"","blocked":false,"stage":"","type":"","addedText":"이 질문 뒤에 학생이 스스로 덧붙인 문단(2~5문장). 바뀐 게 없거나 차단이면 빈 문자열"}],
"closing":"마지막 문단 2~4문장","reflection":["","","",""]}
- steps는 시간 순서. 차단 요청도 steps에 넣는다(blocked:true).
- 최종 글 = initialDraft + 각 addedText + closing 이 이어 붙은 것이며, 합쳐서 ${english ? "150~250 words" : "900~1300자"} 정도.
- reflection 4개는 순서대로: 계획과 실제 비교 / 가장 도움이 된 질문 / 답을 받은 뒤 글의 변화 / 다음 계획. 실제 질문 수와 맞게 쓴다.`,
  ]
    .filter(Boolean)
    .join("\n");
}

async function callLLM(messages, model = LLM_MODEL, maxTokens = 8000) {
  const res = await fetch(`${LLM_API_URL.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${LLM_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, max_tokens: maxTokens }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (typeof text !== "string" || !text.trim()) throw new Error(`빈 답 (${data?.choices?.[0]?.finish_reason})`);
  return text;
}

const parse = (text) => {
  const s = text.replace(/```(?:json)?/gi, "");
  return JSON.parse(s.slice(s.indexOf("{"), s.lastIndexOf("}") + 1));
};

/** JSON 답 받기. 문법이 깨지면(문장 속 큰따옴표 등) 빠른 모델에게 문법만 고치게 함 */
async function callJson(messages) {
  const text = await callLLM(messages);
  try {
    return parse(text);
  } catch {
    const fixed = await callLLM(
      [
        { role: "system", content: "깨진 JSON의 문법만 고친다. 문자열 안의 큰따옴표는 작은따옴표로 바꾼다. 내용은 한 글자도 바꾸거나 빼지 않는다. JSON만 출력한다." },
        { role: "user", content: text },
      ],
      process.env.LLM_MODEL_FAST || LLM_MODEL,
      10000,
    );
    return parse(fixed);
  }
}

const BLOCK_ANSWER = "이 시험에서는 글을 대신 써 줄 수 없어요. 어느 부분에서 막혔는지 알려 주세요.";
function validate(v, profileKey) {
  const four = (a) => Array.isArray(a) && a.length === 4 && a.every((x) => typeof x === "string" && x.trim());
  if (!four(v.outline) || !four(v.reflection)) throw new Error("개요·성찰 4개가 아님");
  if (!Array.isArray(v.plan) || v.plan.length !== 4) throw new Error("plan 4개가 아님");
  if (typeof v.initialDraft !== "string" || !v.initialDraft.trim() || typeof v.closing !== "string") throw new Error("글이 비었음");
  if (!Array.isArray(v.steps) || v.steps.length === 0) throw new Error("질문이 없음");
  const steps = v.steps.map((q) => {
    const blocked = q.blocked === true;
    const item = Math.min(4, Math.max(1, Math.round(Number(q.outlineItem) || 1)));
    return {
      outlineItem: item,
      question: String(q.question ?? "").trim(),
      answer: blocked ? BLOCK_ANSWER : String(q.answer ?? "").trim(),
      blocked,
      stage: STAGES.includes(q.stage) ? q.stage : STAGES[1],
      type: blocked ? "대신 작성 요청" : TYPES.includes(q.type) && q.type !== "대신 작성 요청" ? q.type : TYPES[0],
      addedText: blocked ? "" : String(q.addedText ?? "").trim(),
    };
  });
  if (steps.some((q) => !q.question || !q.answer)) throw new Error("질문·답이 빈 칸");
  return {
    profile: profileKey,
    outline: v.outline.map((x) => x.trim()),
    plan: v.plan.map((n) => Math.max(0, Math.min(9, Math.round(Number(n) || 0)))),
    initialDraft: v.initialDraft.trim(),
    steps,
    closing: v.closing.trim(),
    reflection: v.reflection.map((x) => x.trim()),
  };
}

async function one(exam, profileKey, angle) {
  const messages = [
    { role: "system", content: SYSTEM },
    { role: "user", content: userPrompt(exam, profileKey, angle) },
  ];
  for (let tries = 1; ; tries++) {
    try {
      return validate(await callJson(messages), profileKey);
    } catch (e) {
      if (tries >= 3) throw e;
      console.warn(`  다시 시도 (${exam.id} ${profileKey}): ${String(e).slice(0, 100)}`);
    }
  }
}

// ── 실행 ──
const [onlyExam, perArg] = process.argv.slice(2);
const per = Math.max(1, Math.min(ANGLES.length, Number(perArg) || 4));
const targets = exams.filter((e) => !onlyExam || e.id === onlyExam);
if (targets.length === 0) throw new Error(`시험 ${onlyExam} 이 없어요.`);

let prev = { synthetic: true, exams: {} };
try {
  prev = JSON.parse(await readFile(OUT, "utf8"));
} catch {}

const jobs = [];
for (const exam of targets) for (const key of Object.keys(PROFILES)) for (let i = 0; i < per; i++) jobs.push({ exam, key, angle: ANGLES[i] });

const results = {};
let done = 0;
const CONCURRENCY = 8;
async function worker() {
  while (jobs.length) {
    const job = jobs.shift();
    try {
      const v = await one(job.exam, job.key, job.angle);
      (results[job.exam.id] ??= []).push(v);
    } catch (e) {
      console.error(`  실패 (${job.exam.id} ${job.key}): ${String(e).slice(0, 160)}`);
    }
    done++;
    if (done % 6 === 0) console.log(`  ${done}개 완료`);
  }
}
console.log(`가상 학생 기록 ${jobs.length}개를 만들어요 (시험 ${targets.map((e) => e.id).join(", ")}, 유형마다 ${per}개)`);
await Promise.all(Array.from({ length: CONCURRENCY }, worker));

const out = {
  _note: "AI가 교사팀 가상 학생 S01~S03을 본보기로 만든 가상 학생 기록 (scripts/gen-variants.mjs). 실제 학생 아님",
  synthetic: true,
  generatedAt: new Date().toISOString(),
  model: LLM_MODEL,
  exams: { ...prev.exams },
};
for (const [id, list] of Object.entries(results)) {
  out.exams[id] = list.sort((a, b) => a.profile.localeCompare(b.profile));
  console.log(`${id}: ${list.length}개 (A ${list.filter((v) => v.profile === "A").length} · B ${list.filter((v) => v.profile === "B").length} · C ${list.filter((v) => v.profile === "C").length})`);
}
await writeFile(OUT, JSON.stringify(out, null, 2) + "\n", "utf8");
console.log(`저장: ${path.relative(ROOT, OUT)}`);
