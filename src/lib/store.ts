// 서버 전용: 응시 기록 저장소.
// 배포: Supabase (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY 설정 시) / 로컬 시연: data/attempts/ JSON 파일
import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Outline, OutlineItemNo, PerItem, QuestionType, ReportSentence, Reflection, Stage } from "./types";

export type QuestionRecord = {
  acornNo: number | null;
  time: string; // ISO
  outlineItem: OutlineItemNo;
  selectedText: string;
  selection: { start: number; end: number } | null;
  question: string;
  answer: string;
  blocked: boolean;
  charged: boolean;
  overPlan: boolean;
  stage: Stage | null;
  type: QuestionType | null;
  before: string; // 질문 직전 글 전체
};

export type AttemptRecord = {
  attemptId: string;
  student: { id: string; name: string };
  verified: boolean;
  /** 학생 열쇠의 해시 (쿠키에 든 열쇠와 맞아야 조회·저장 가능) */
  keyHash?: string | null;
  startedAt: string;
  outline: Outline | null;
  acornPlan: PerItem | null;
  draft: string;
  draftSavedAt: string | null;
  questions: QuestionRecord[];
  final: string | null;
  reflection: Reflection | null;
  submittedAt: string | null;
  /** 제출 후 AI가 판정한 문장별 작성 경로 (없으면 리포트에서 1차 판정 사용) */
  sentencePaths?: ReportSentence[] | null;
  /** 위 판정을 어떤 글로 했는지 (글이 바뀌면 다시 판정) */
  sentencePathsFor?: string | null;
};

const ID_RE = /^[A-Za-z0-9_-]{1,32}$/;

export function isValidId(id: unknown): id is string {
  return typeof id === "string" && ID_RE.test(id);
}

// ── 어디에 저장할지 ─────────────────────────────────────────
// SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY 가 있으면 Supabase (배포용),
// 없으면 data/attempts/ 의 JSON 파일 (로컬 시연용).
type Row = { rec: AttemptRecord; version: number };

interface Backend {
  load(id: string): Promise<Row | null>;
  /** 저장 성공이면 true, 그사이 다른 요청이 먼저 고쳤으면 false (다시 시도) */
  save(rec: AttemptRecord, prev: Row | null): Promise<boolean>;
  list(): Promise<AttemptRecord[]>;
}

// ── 파일 저장 (로컬) ─────────────────────────────────────────
const DATA_DIR = path.join(process.cwd(), "data", "attempts");

function fileOf(id: string) {
  if (!isValidId(id)) throw new Error("잘못된 ID");
  return path.join(DATA_DIR, `${id}.json`);
}

const fileBackend: Backend = {
  async load(id) {
    try {
      return { rec: JSON.parse(await readFile(fileOf(id), "utf8")) as AttemptRecord, version: 0 };
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw e;
    }
  },
  async save(rec) {
    await mkdir(DATA_DIR, { recursive: true });
    const file = fileOf(rec.attemptId);
    const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(tmp, JSON.stringify(rec, null, 2), "utf8");
    await rename(tmp, file); // 쓰는 도중 끊겨도 파일이 깨지지 않게
    return true; // 한 서버 안에서는 아래 학생별 순서 처리로 충분
  },
  async list() {
    let names: string[] = [];
    try {
      names = await readdir(DATA_DIR);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw e;
    }
    const ids = names.filter((n) => n.endsWith(".json")).map((n) => n.slice(0, -5)).filter(isValidId);
    const rows = await Promise.all(ids.map((id) => fileBackend.load(id)));
    return rows.filter((r): r is Row => r !== null).map((r) => r.rec);
  },
};

// ── Supabase 저장 (배포) ────────────────────────────────────
// 표: supabase/attempts.sql (id, data, version). REST API를 직접 부릅니다.
function supabaseConfig() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? { url: url.replace(/\/$/, ""), key } : null;
}

async function sb(method: string, query: string, body?: unknown, prefer?: string): Promise<Response> {
  const cfg = supabaseConfig()!;
  const res = await fetch(`${cfg.url}/rest/v1/attempts${query}`, {
    method,
    cache: "no-store",
    headers: {
      apikey: cfg.key,
      // 예전 service_role 키(JWT, "eyJ…")만 Authorization에도 넣음. 새 키(sb_secret_…)는 apikey만으로 됨
      ...(cfg.key.startsWith("eyJ") ? { Authorization: `Bearer ${cfg.key}` } : {}),
      "Content-Type": "application/json",
      ...(prefer ? { Prefer: prefer } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok && res.status !== 409) {
    throw new Error(`Supabase ${method} 실패 (${res.status}): ${(await res.text()).slice(0, 300)}`);
  }
  return res;
}

const supabaseBackend: Backend = {
  async load(id) {
    const rows = (await (await sb("GET", `?id=eq.${encodeURIComponent(id)}&select=data,version`)).json()) as {
      data: AttemptRecord;
      version: number;
    }[];
    return rows[0] ? { rec: rows[0].data, version: rows[0].version } : null;
  },
  async save(rec, prev) {
    const now = new Date().toISOString();
    if (!prev) {
      // 새 기록: 같은 학번이 그사이 먼저 만들어졌으면 409 → 다시 시도
      const res = await sb("POST", "", { id: rec.attemptId, data: rec, version: 0, updated_at: now }, "return=minimal");
      return res.status !== 409;
    }
    // 읽었던 version 그대로일 때만 고침 (그사이 다른 요청이 고쳤으면 0줄 → 다시 시도)
    const res = await sb(
      "PATCH",
      `?id=eq.${encodeURIComponent(rec.attemptId)}&version=eq.${prev.version}`,
      { data: rec, version: prev.version + 1, updated_at: now },
      "return=representation",
    );
    return ((await res.json()) as unknown[]).length === 1;
  },
  async list() {
    const rows = (await (await sb("GET", "?select=data&order=id")).json()) as { data: AttemptRecord }[];
    return rows.map((r) => r.data);
  },
};

function backend(): Backend {
  return supabaseConfig() ? supabaseBackend : fileBackend;
}

/** 지금 어디에 저장하는지 (상태 확인용) */
export function storageKind(): "supabase" | "file" {
  return supabaseConfig() ? "supabase" : "file";
}

export async function loadAttempt(id: string): Promise<AttemptRecord | null> {
  if (!isValidId(id)) throw new Error("잘못된 ID");
  return (await backend().load(id))?.rec ?? null;
}

// 같은 학생 기록을 동시에 고치지 않도록 학생별로 순서대로 처리 (한 서버 안).
// 서버가 여러 대(배포)일 때는 Supabase의 version 비교로 덮어쓰기를 막고 다시 시도합니다.
const locks = new Map<string, Promise<unknown>>();
const MAX_TRIES = 5;

/** 기록을 읽어서 고친 뒤 저장. fn이 던진 에러는 그대로 전달되고 저장하지 않음 */
export async function updateAttempt<T>(
  id: string,
  fn: (rec: AttemptRecord | null) => Promise<{ rec: AttemptRecord | null; result: T }> | { rec: AttemptRecord | null; result: T },
): Promise<T> {
  if (!isValidId(id)) throw new Error("잘못된 ID");
  const prevLock = locks.get(id) ?? Promise.resolve();
  const run = prevLock.catch(() => {}).then(async () => {
    const store = backend();
    for (let i = 0; i < MAX_TRIES; i++) {
      const row = await store.load(id);
      const { rec, result } = await fn(row?.rec ?? null);
      if (!rec) return result;
      if (await store.save(rec, row)) return result;
      await new Promise((r) => setTimeout(r, 50 * (i + 1))); // 잠깐 쉬고 다시
    }
    throw new Error("다른 요청과 겹쳐서 저장하지 못했어요. 다시 시도해 주세요.");
  });
  locks.set(id, run);
  try {
    return await run;
  } finally {
    if (locks.get(id) === run) locks.delete(id);
  }
}

export async function listAttempts(): Promise<AttemptRecord[]> {
  const recs = await backend().list();
  return recs.sort((a, b) => a.attemptId.localeCompare(b.attemptId));
}

/** 개요 항목별 사용한 도토리 수 (차감된 질문만) */
export function usedPerItem(rec: AttemptRecord): PerItem {
  const used: PerItem = [0, 0, 0, 0];
  for (const q of rec.questions) if (q.charged) used[q.outlineItem - 1]++;
  return used;
}

export function totalUsed(rec: AttemptRecord): number {
  return rec.questions.filter((q) => q.charged).length;
}
