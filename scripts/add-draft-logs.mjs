// 가상 학생 응시 기록에 타임랩스용 글 변화 기록(draftLog)을 만들어 넣습니다. (LLM 호출 없음)
// 시드 데이터에는 10초 저장 기록이 없으므로, 질문 직전 글(before)과 최종 글 사이를
// 10초에 15~30자씩 쓴 것처럼 나눠서 만듭니다. 일부 학생(약 8%)은 한 번에 붙여 넣은 구간을 넣습니다.
//
// 실행: node scripts/add-draft-logs.mjs           → Supabase(.env.local 값이 있으면) 또는 data/attempts/
//       node scripts/add-draft-logs.mjs --force   → 이미 draftLog가 있어도 다시 만듦
// 대상: 시드로 만든 기록만 (학생 열쇠 keyHash가 없는 것). 실제로 화면에서 응시한 기록은 건드리지 않습니다.
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const FORCE = process.argv.includes("--force");
const DRY = process.argv.includes("--dry");
try {
  for (const line of (await readFile(path.join(ROOT, ".env.local"), "utf8")).split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {}
const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const useDb = Boolean(url && key);
const headers = { apikey: key, ...(key.startsWith("eyJ") ? { Authorization: `Bearer ${key}` } : {}), "Content-Type": "application/json" };
const DIR = path.join(ROOT, "data", "attempts");

// 학번으로 정해지는 난수 (다시 돌려도 같은 결과)
function rng(seed) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

function editOf(prev, next) {
  if (prev === next) return null;
  let p = 0;
  const max = Math.min(prev.length, next.length);
  while (p < max && prev[p] === next[p]) p++;
  let s = 0;
  while (s < max - p && prev[prev.length - 1 - s] === next[next.length - 1 - s]) s++;
  return { at: p, del: prev.length - p - s, ins: next.slice(p, next.length - s) };
}

function buildLog(rec) {
  const rand = rng(rec.attemptId);
  const final = rec.final ?? rec.draft ?? "";
  const snaps = rec.questions.map((q) => ({ t: Date.parse(q.time), text: q.before }));
  snaps.push({ t: Date.parse(rec.submittedAt ?? rec.draftSavedAt ?? rec.startedAt), text: final });
  // 이 학생은 한 구간을 붙여 넣은 것으로 (약 8%)
  const paster = rand() < 0.08;
  let pasteDone = false;
  const log = [];
  let prev = "";
  let prevT = Date.parse(rec.startedAt) + 4 * 60_000; // 개요 쓰고 4분 뒤부터 글쓰기
  for (const snap of snaps) {
    const e = editOf(prev, snap.text);
    if (!e) {
      prev = snap.text;
      continue;
    }
    // 이 구간에 쓸 수 있는 10초 저장 횟수
    const slots = Math.max(1, Math.floor((snap.t - prevT) / 10_000) - 1);
    const pieces = [];
    let rest = e.ins;
    const pasteHere = paster && !pasteDone && e.ins.length > 220;
    if (pasteHere) pasteDone = true;
    while (rest.length) {
      const n = pasteHere && pieces.length === 1 ? Math.min(rest.length, 160 + Math.floor(rand() * 120)) : 15 + Math.floor(rand() * 16);
      pieces.push(rest.slice(0, n));
      rest = rest.slice(n);
    }
    // 저장 횟수보다 조각이 많으면 합침
    while (pieces.length > slots && pieces.length > 1) {
      const i = Math.floor(rand() * (pieces.length - 1));
      pieces.splice(i, 2, pieces[i] + pieces[i + 1]);
    }
    const gap = Math.max(10_000, Math.floor((snap.t - prevT) / (pieces.length + 1)));
    let t = prevT;
    let at = e.at;
    let del = e.del;
    for (const piece of pieces) {
      t += Math.max(10_000, Math.round(gap * (0.6 + rand() * 0.8)));
      if (t >= snap.t) t = snap.t - 1000 * (pieces.length - pieces.indexOf(piece));
      log.push({ t: new Date(t).toISOString(), at, del, ins: piece });
      at += piece.length;
      del = 0;
    }
    if (pieces.length === 0 && del) log.push({ t: new Date(snap.t - 5000).toISOString(), at, del, ins: "" });
    prev = snap.text;
    prevT = snap.t;
  }
  // 시간 순서 보장
  for (let i = 1; i < log.length; i++) if (log[i].t <= log[i - 1].t) log[i].t = new Date(Date.parse(log[i - 1].t) + 1000).toISOString();
  return log;
}

async function loadAll() {
  if (useDb) {
    const out = [];
    for (let from = 0; ; from += 1000) {
      const res = await fetch(`${url}/rest/v1/dotori_attempts?select=id,class_id,exam_id,data&order=id`, { headers: { ...headers, Range: `${from}-${from + 999}` } });
      if (!res.ok) throw new Error(`읽기 실패 (HTTP ${res.status})`);
      const rows = await res.json();
      out.push(...rows);
      if (rows.length < 1000) return out;
    }
  }
  const names = (await readdir(DIR)).filter((n) => n.endsWith(".json"));
  return Promise.all(names.map(async (n) => ({ id: n.slice(0, -5), data: JSON.parse(await readFile(path.join(DIR, n), "utf8")) })));
}

const rows = await loadAll();
// 시드 기록만: 실제 화면에서 시작한 기록은 학생 열쇠(keyHash)가 있으므로 건드리지 않음
const targets = rows.filter((r) => !r.data.keyHash && !/^ZZ/.test(r.id) && (FORCE || !r.data.draftLog?.length));
let pastes = 0;
let broken = 0;
const updated = targets
  .map((r) => {
    const draftLog = buildLog(r.data);
    // 기록을 처음부터 적용하면 최종 글이 나와야 함
    let text = "";
    for (const e of draftLog) text = text.slice(0, e.at) + e.ins + text.slice(e.at + e.del);
    if (text !== (r.data.final ?? r.data.draft ?? "")) {
      broken++;
      return null;
    }
    if (draftLog.some((e) => e.ins.length >= 80)) pastes++;
    return { ...r, data: { ...r.data, draftLog } };
  })
  .filter(Boolean);
if (DRY) {
  console.log(`(시험 실행) 대상 ${targets.length}건, 만들 수 있음 ${updated.length}건, 맞지 않음 ${broken}건, 붙여 넣기 구간 ${pastes}명`);
  process.exit(0);
}

if (useDb) {
  for (let i = 0; i < updated.length; i += 100) {
    const res = await fetch(`${url}/rest/v1/dotori_attempts?on_conflict=id`, {
      method: "POST",
      headers: { ...headers, Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(updated.slice(i, i + 100).map((r) => ({ id: r.id, class_id: r.class_id, exam_id: r.exam_id, data: r.data, updated_at: new Date().toISOString() }))),
    });
    if (!res.ok) throw new Error(`저장 실패 (HTTP ${res.status}): ${(await res.text()).slice(0, 300)}`);
  }
} else {
  for (const r of updated) await writeFile(path.join(DIR, `${r.id}.json`), JSON.stringify(r.data, null, 2), "utf8");
}
console.log(`${useDb ? "Supabase" : "data/attempts/"}: 전체 ${rows.length}건 중 ${updated.length}건에 글 변화 기록을 넣었어요. (한꺼번에 들어온 구간이 있는 학생 ${pastes}명)`);
