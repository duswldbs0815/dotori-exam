// 시연용 가상 학생 S01~S03 기록을 data/attempts/ 에 만듭니다.
// 원본: scripts/demo-data/teacher-demo-students.json (교사팀이 만든 가상 데이터, 실제 학생 아님)
// 실행: npm run seed:demo   (같은 ID 기록은 덮어쓰고, 예전 시연 데이터 DEMO-A/B/C는 지웁니다.)
// .env.local 에 SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY 가 있으면 Supabase에, 없으면 data/attempts/ 파일에 넣습니다.
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const DIR = path.join(process.cwd(), "data", "attempts");
const SRC = path.join(process.cwd(), "scripts", "demo-data", "teacher-demo-students.json");
const DAY = "2026-11-14";
const t = (hhmm) => `${DAY}T${hhmm}:00+09:00`;
const plusMin = (hhmm, m) => {
  const [h, mm] = hhmm.split(":").map(Number);
  const total = h * 60 + mm + m;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
};

const data = JSON.parse(await readFile(SRC, "utf8"));
if (!data.datasetInfo?.synthetic) throw new Error("가상 데이터(synthetic: true)만 넣을 수 있어요.");

const SB_URL = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const useSupabase = Boolean(SB_URL && SB_KEY);
const sbHeaders = {
  apikey: SB_KEY,
  ...(SB_KEY.startsWith("eyJ") ? { Authorization: `Bearer ${SB_KEY}` } : {}), // 새 키(sb_secret_…)는 apikey만
  "Content-Type": "application/json",
};

async function save(rec) {
  if (!useSupabase) {
    await writeFile(path.join(DIR, `${rec.attemptId}.json`), JSON.stringify(rec, null, 2), "utf8");
    return;
  }
  // 같은 id가 있으면 덮어씀 (upsert)
  const res = await fetch(`${SB_URL}/rest/v1/dotori_attempts?on_conflict=id`, {
    method: "POST",
    headers: { ...sbHeaders, Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ id: rec.attemptId, data: rec, class_id: rec.classId || "2-3", exam_id: rec.examId || "kor2", updated_at: new Date().toISOString() }),
  });
  if (!res.ok) throw new Error(`Supabase 저장 실패 (${res.status}): ${await res.text()}`);
}

console.log(`저장 위치: ${useSupabase ? "Supabase" : "data/attempts/ 파일"}`);
if (useSupabase) {
  await fetch(`${SB_URL}/rest/v1/dotori_attempts?id=in.(DEMO-A,DEMO-B,DEMO-C)`, { method: "DELETE", headers: sbHeaders });
} else {
  await mkdir(DIR, { recursive: true });
  for (const old of ["DEMO-A", "DEMO-B", "DEMO-C"]) await rm(path.join(DIR, `${old}.json`), { force: true });
}

for (const s of data.students) {
  const plan = s.aiUsePlan.expectedCountsByOutline;
  const used = [0, 0, 0, 0];
  const questions = s.questions.map((q) => {
    const charged = !q.blocked;
    if (charged) used[q.outlineItem - 1]++;
    return {
      acornNo: charged ? q.acornNo : null,
      time: t(q.time),
      outlineItem: q.outlineItem,
      selectedText: q.selectedText ?? "",
      selection: null,
      question: q.question,
      answer: q.answer,
      blocked: q.blocked,
      charged,
      overPlan: charged && used[q.outlineItem - 1] > plan[q.outlineItem - 1],
      stage: q.stage ?? null,
      type: q.type ?? null,
      before: q.before,
    };
  });
  const first = s.questions[0]?.time ?? "10:00";
  const last = s.questions.at(-1)?.time ?? "10:30";
  const submittedAt = t(plusMin(last, 12));

  const rec = {
    attemptId: s.id,
    student: { id: s.id, name: s.name },
    keyHash: null, // 시연 데이터는 학생 화면으로 열 일이 없음 (교사 리포트로만 봄)
    startedAt: t(plusMin(first, -8)),
    outline: s.outline,
    acornPlan: plan,
    draft: s.final,
    draftSavedAt: submittedAt,
    questions,
    final: s.final,
    reflection: s.reflection,
    submittedAt,
  };
  await save(rec);
  const blocked = questions.filter((q) => q.blocked).length;
  console.log(`${s.id} ${s.name}: 계획 ${plan.reduce((a, b) => a + b, 0)} / 허용 ${questions.length - blocked} / 차단 ${blocked}`);
}
