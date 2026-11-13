// 로컬 data/ 의 응시 기록·수행평가를 Supabase 표로 올립니다. (시드 후 배포 DB 채우기용)
// 실행: npm run seed:school && npm run push:supabase
// .env.local 의 SUPABASE_URL(또는 NEXT_PUBLIC_SUPABASE_URL)과 SUPABASE_SERVICE_ROLE_KEY를 씁니다.
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
try {
  for (const line of (await readFile(path.join(ROOT, ".env.local"), "utf8")).split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {}
const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error(".env.local 에 SUPABASE_URL 과 SUPABASE_SERVICE_ROLE_KEY 를 넣어 주세요.");

async function readAll(dir) {
  try {
    const names = (await readdir(dir)).filter((n) => n.endsWith(".json"));
    return Promise.all(names.map(async (n) => JSON.parse(await readFile(path.join(dir, n), "utf8"))));
  } catch (e) {
    if (e.code === "ENOENT") return [];
    throw e;
  }
}

async function upsert(table, rows) {
  for (let i = 0; i < rows.length; i += 200) {
    const res = await fetch(`${url}/rest/v1/${table}?on_conflict=id`, {
      method: "POST",
      headers: {
        apikey: key,
        ...(key.startsWith("eyJ") ? { Authorization: `Bearer ${key}` } : {}),
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(rows.slice(i, i + 200)),
    });
    if (!res.ok) throw new Error(`${table} 올리기 실패 (HTTP ${res.status}): ${(await res.text()).slice(0, 300)}`);
  }
  console.log(`${table}: ${rows.length}개`);
}

const now = new Date().toISOString();
const attempts = await readAll(path.join(ROOT, "data", "attempts"));
await upsert(
  "dotori_attempts",
  attempts.map((r) => ({ id: r.attemptId, class_id: r.classId || "2-3", exam_id: r.examId || "kor2", data: r, updated_at: now })),
);
const exams = await readAll(path.join(ROOT, "data", "exams"));
await upsert("dotori_exams", exams.map((e) => ({ id: e.id, data: e, updated_at: now })));
