// 가상 학교(도토리중학교) 1~3학년 12개 반의 수행평가 응시 기록을 data/attempts/ 에 만듭니다.
// 모든 학생·이름·글은 지어낸 가상 데이터입니다. (실제 학생 정보 없음)
// 실행: npm run seed:school   (같은 ID는 덮어씀. 시드값이 고정이라 매번 같은 결과)
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const DIR = path.join(ROOT, "data", "attempts");
const school = JSON.parse(await readFile(path.join(ROOT, "src", "data", "school.json"), "utf8"));
const content = JSON.parse(await readFile(path.join(ROOT, "scripts", "demo-data", "school-content.json"), "utf8"));
if (!content.synthetic) throw new Error("가상 데이터(synthetic: true)만 넣을 수 있어요.");

// 학생 기록 본보기: 교사팀 가상 학생 S01~S03 + AI가 이들을 본보기로 만든 변형(npm run gen:variants)
// 본보기가 있는 시험은 본보기로, 없는 시험은 school-content.json 의 짧은 예시로 만듭니다.
const teacher = JSON.parse(await readFile(path.join(ROOT, "scripts", "demo-data", "teacher-demo-students.json"), "utf8"));
if (!teacher.datasetInfo?.synthetic) throw new Error("가상 데이터(synthetic: true)만 넣을 수 있어요.");
let generated = { exams: {} };
try {
  generated = JSON.parse(await readFile(path.join(ROOT, "scripts", "demo-data", "generated-variants.json"), "utf8"));
  if (!generated.synthetic) throw new Error("generated-variants.json 이 가상 데이터가 아니에요.");
} catch (e) {
  if (e.code !== "ENOENT") throw e;
}
const PROFILE_OF = { S01: "A", S02: "B", S03: "C" };
const fromTeacher = (st) => ({
  profile: PROFILE_OF[st.id] ?? "A",
  outline: st.outline,
  plan: st.aiUsePlan.expectedCountsByOutline,
  initialDraft: st.initialDraft,
  // 교사팀 자료는 질문마다 글 전체 스냅숏이 있음
  steps: st.questions.map((q) => ({ outlineItem: q.outlineItem, question: q.question, answer: q.answer, blocked: q.blocked, stage: q.stage, type: q.type, before: q.before })),
  final: st.final,
  reflection: st.reflection,
});
const POOLS = { ...generated.exams };
POOLS.kor2 = [...teacher.students.map(fromTeacher), ...(generated.exams.kor2 ?? [])];

// 기본 「진달래꽃」 수행평가 (src/lib/school.ts 의 KOR2와 같은 값)
const exams = [
  { id: "kor2", classIds: ["2-1", "2-2", "2-3", "2-4"], acorns: [2, 2, 1, 1] },
  ...school.exams.map((e) => ({ id: e.id, classIds: e.classIds, acorns: e.itemGuides.map((g) => g.acorns) })),
];

// 고정 시드 난수
let seed = 20261114;
const rand = () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const pick = (a) => a[Math.floor(rand() * a.length)];
const int = (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));

const SURNAMES = ["김", "이", "박", "최", "정", "강", "조", "윤", "장", "임", "한", "오", "서", "신", "권", "황", "안", "송", "전", "홍"];
const GIVEN = ["하늘", "준서", "서연", "지호", "민준", "서윤", "도윤", "하은", "시우", "지유", "예준", "수아", "주원", "지아", "은우", "하린", "유준", "서아", "건우", "채원", "우진", "윤서", "선우", "다은", "현우", "소율", "지환", "예린", "승민", "나윤", "태윤", "가은", "민재", "유나", "도현", "시은", "이준", "아린", "로운", "하율"];

// 학생 유형: 스스로 쓰는 학생 / 질문 뒤 고쳐 쓰는 학생 / AI 답을 옮겨 적는 학생 / 대신 써 달라고 하는 학생
const TYPES = [
  ["self", 0.42],
  ["reviser", 0.36],
  ["copier", 0.13],
  ["blocker", 0.09],
];
const pickType = () => {
  let r = rand();
  for (const [t, p] of TYPES) if ((r -= p) < 0) return t;
  return "self";
};
const QCOUNT = { self: [1, 3], reviser: [3, 6], copier: [4, 8], blocker: [2, 5] };

const iso = (day, minutes) => {
  const h = String(Math.floor(minutes / 60)).padStart(2, "0");
  const m = String(minutes % 60).padStart(2, "0");
  return `${day}T${h}:${m}:00+09:00`;
};

function makeAttempt({ exam, classId, studentId, name, period }) {
  const c = content.exams[exam.id];
  const type = pickType();
  const essayNo = Math.floor(rand() * c.essays.length);
  const base = c.essays[essayNo];
  // 이 글과 맞는 질문만 (e가 없으면 어느 글에나 맞음)
  const poolOf = (item) => {
    const qs = c.questions[item - 1].filter((q) => q.e === undefined || q.e === essayNo);
    return qs.length ? qs : c.questions[item - 1];
  };
  const plan = exam.acorns.map((a) => Math.max(0, a + int(-1, 1)));

  // 질문 고르기: 항목 순서대로, 유형별 개수만큼
  const n = int(...QCOUNT[type]);
  const asks = [];
  // 항목은 선생님 권장 도토리에 비례해 고름 (권장이 0이어도 가끔은 물음)
  const weights = exam.acorns.map((a) => a + 0.4);
  const wsum = weights.reduce((x, y) => x + y, 0);
  for (let k = 0; k < n; k++) {
    let r = rand() * wsum;
    let item = 1;
    for (let i = 0; i < 4; i++) if ((r -= weights[i]) < 0) { item = i + 1; break; }
    asks.push({ item, ...pick(poolOf(item)) });
  }
  asks.sort((a, b) => a.item - b.item);
  const blockedN = type === "blocker" ? int(1, 2) : type === "copier" ? int(0, 1) : rand() < 0.03 ? 1 : 0;
  for (let k = 0; k < blockedN; k++) {
    const at = int(0, asks.length);
    asks.splice(at, 0, { item: int(2, 4), q: pick(c.blocked), blocked: true });
  }

  // 글을 문장 단위로 쓰면서 질문 위치마다 직전 글을 남김
  const positions = asks.map((_, k) => Math.min(base.length - 1, 1 + Math.floor(((k + rand() * 0.8) / asks.length) * (base.length - 1))));
  const cur = [];
  const questions = [];
  let acorn = 0;
  let minute = period + 8;
  let qi = 0;
  const used = [0, 0, 0, 0];
  for (let s = 0; s < base.length; s++) {
    cur.push(base[s]);
    while (qi < asks.length && positions[qi] === s) {
      const a = asks[qi++];
      minute += int(3, 6);
      const before = cur.join(" ");
      const selectedText = rand() < 0.7 ? cur[cur.length - 1] : "";
      if (a.blocked) {
        questions.push({
          acornNo: null, time: iso(c.day, minute), outlineItem: a.item, selectedText, selection: null,
          question: a.q, answer: "이 시험에서는 글을 대신 써 줄 수 없어요. 어느 부분에서 막혔는지 알려 주세요.",
          blocked: true, charged: false, overPlan: false, stage: null, type: "대신 작성 요청", before,
        });
        continue;
      }
      acorn++;
      used[a.item - 1]++;
      questions.push({
        acornNo: acorn, time: iso(c.day, minute), outlineItem: a.item, selectedText, selection: null,
        question: a.q, answer: a.a, blocked: false, charged: true, overPlan: used[a.item - 1] > plan[a.item - 1],
        stage: a.stage, type: a.type, before,
      });
      // 질문 뒤 글이 어떻게 바뀌는지: 유형마다 다름
      if (type === "reviser" && !cur.includes(a.rev)) cur.push(a.rev);
      if (type === "copier") cur.push(a.a.split(/(?<=[.!?요])\s+/)[0]);
    }
  }

  const submitted = rand() < 0.88;
  const final = cur.join(" ");
  const endMin = minute + int(6, 14);
  const draft = submitted ? final : cur.slice(0, Math.max(2, cur.length - int(1, 3))).join(" ");
  return {
    attemptId: exam.id === "kor2" ? studentId : `${studentId}_${exam.id}`,
    student: { id: studentId, name },
    examId: exam.id,
    classId,
    verified: true,
    keyHash: null, // 가상 데이터는 학생 화면으로 열 일이 없음 (교사 리포트로만 봄)
    startedAt: iso(c.day, period),
    outline: pick(c.outlines),
    acornPlan: plan,
    draft,
    draftSavedAt: iso(c.day, endMin),
    questions,
    final: submitted ? final : null,
    reflection: submitted ? pick(c.reflections) : null,
    submittedAt: submitted ? iso(c.day, endMin) : null,
    synthetic: true,
  };
}

// 본보기 하나로 학생 한 명의 기록 만들기 (계획·시간·제출 여부는 조금씩 다르게)
const PROFILE_W = [["A", 0.45], ["B", 0.35], ["C", 0.2]];
function pickVariant(pool) {
  let r = rand();
  let want = "A";
  for (const [k, w] of PROFILE_W) if ((r -= w) < 0) { want = k; break; }
  const same = pool.filter((v) => v.profile === want);
  return pick(same.length ? same : pool);
}
const sentences = (t) => t.split(/(?<=[.!?。])\s+/).filter(Boolean);

function makeFromVariant({ exam, classId, studentId, name, period }) {
  const c = content.exams[exam.id];
  const v = pickVariant(POOLS[exam.id]);
  const plan = v.plan.map((n) => (rand() < 0.4 ? Math.max(0, n + int(-1, 1)) : n));
  // 질문 직전 글: 스냅숏이 있으면 그대로, 없으면 초안 + 덧붙인 문단을 차례로 이어 붙임
  let cur = v.initialDraft;
  const befores = v.steps.map((q) => {
    const b = q.before ?? cur;
    if (!q.before && q.addedText) cur = `${cur}\n\n${q.addedText}`;
    return b;
  });
  const fullFinal = v.final ?? `${cur}\n\n${v.closing ?? ""}`.trim();
  const submitted = rand() < 0.88;
  const stepCount = submitted ? v.steps.length : Math.max(1, Math.floor(v.steps.length * (0.4 + rand() * 0.3)));
  let minute = period + int(4, 9);
  let acorn = 0;
  const used = [0, 0, 0, 0];
  const questions = v.steps.slice(0, stepCount).map((q, k) => {
    minute += int(2, 6);
    const before = befores[k];
    const last = sentences(before).at(-1) ?? "";
    const selectedText = !q.blocked && rand() < 0.7 ? last : "";
    if (q.blocked) {
      return { acornNo: null, time: iso(c.day, minute), outlineItem: q.outlineItem, selectedText, selection: null, question: q.question, answer: q.answer, blocked: true, charged: false, overPlan: false, stage: q.stage ?? null, type: "대신 작성 요청", before };
    }
    acorn++;
    used[q.outlineItem - 1]++;
    return { acornNo: acorn, time: iso(c.day, minute), outlineItem: q.outlineItem, selectedText, selection: null, question: q.question, answer: q.answer, blocked: false, charged: true, overPlan: used[q.outlineItem - 1] > plan[q.outlineItem - 1], stage: q.stage ?? null, type: q.type ?? null, before };
  });
  const endMin = minute + int(6, 14);
  const draft = submitted ? fullFinal : (befores[stepCount] ?? cur);
  return {
    attemptId: exam.id === "kor2" ? studentId : `${studentId}_${exam.id}`,
    student: { id: studentId, name },
    examId: exam.id,
    classId,
    verified: true,
    keyHash: null,
    startedAt: iso(c.day, period),
    outline: v.outline,
    acornPlan: plan,
    draft,
    draftSavedAt: iso(c.day, endMin),
    questions,
    final: submitted ? fullFinal : null,
    reflection: submitted ? v.reflection : null,
    submittedAt: submitted ? iso(c.day, endMin) : null,
    synthetic: true,
    source: v.profile,
  };
}

await mkdir(DIR, { recursive: true });
const pending = [];
const save = (rec) => pending.push(writeFile(path.join(DIR, `${rec.attemptId}.json`), JSON.stringify(rec, null, 2), "utf8"));
let total = 0;
const classIds = school.grades.flatMap((g) => Array.from({ length: school.classesPerGrade }, (_, i) => `${g}-${i + 1}`));
for (const classId of classIds) {
  const [g, c] = classId.split("-").map(Number);
  const size = int(24, 27);
  const roster = Array.from({ length: size }, (_, i) => ({
    studentId: `${g}${String(c).padStart(2, "0")}${String(i + 1).padStart(2, "0")}`,
    name: `${pick(SURNAMES)}${pick(GIVEN)}`,
  }));
  const classExams = exams.filter((e) => e.classIds.includes(classId));
  classExams.forEach((exam, ei) => {
    const period = 9 * 60 + c * 50 + ei * 120; // 반마다 다른 교시
    for (const st of roster) {
      const rec = POOLS[exam.id]?.length ? makeFromVariant({ exam, classId, ...st, period }) : makeAttempt({ exam, classId, ...st, period });
      save(rec);
      total++;
    }
  });
  console.log(`${classId}: 학생 ${size}명 · 수행평가 ${classExams.map((e) => e.id).join(", ")}`);
}
await Promise.all(pending);
console.log(`가상 응시 기록 ${total}개를 만들었어요. (본보기 사용: ${Object.entries(POOLS).filter(([, l]) => l?.length).map(([id, l]) => `${id} ${l.length}개`).join(", ")})`);
