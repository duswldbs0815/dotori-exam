// 서버 전용: 응시 기록 저장소.
// Supabase 환경 변수가 있으면 dotori_attempts 표에, 없으면 로컬 JSON 파일(data/attempts/)에 저장합니다.
import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { dbGet, dbGetVersioned, dbList, dbPut, dbSaveIfUnchanged, hasDb } from "./db";
import { DEFAULT_CLASS_ID, DEFAULT_EXAM_ID } from "./school";
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
  /** 어느 수행평가인지 (없으면 기본 「진달래꽃」) */
  examId?: string;
  /** 학년-반 ("2-3"). 없으면 기본 반 */
  classId?: string;
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

const DATA_DIR = path.join(process.cwd(), "data", "attempts");
const ID_RE = /^[A-Za-z0-9_-]{1,32}$/;

export function isValidId(id: unknown): id is string {
  return typeof id === "string" && ID_RE.test(id);
}

function fileOf(id: string) {
  if (!isValidId(id)) throw new Error("잘못된 ID");
  return path.join(DATA_DIR, `${id}.json`);
}

const TABLE = "dotori_attempts";

export async function loadAttempt(id: string): Promise<AttemptRecord | null> {
  if (!isValidId(id)) throw new Error("잘못된 ID");
  if (hasDb()) return dbGet<AttemptRecord>(TABLE, id);
  try {
    return JSON.parse(await readFile(fileOf(id), "utf8")) as AttemptRecord;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw e;
  }
}

export async function saveAttempt(rec: AttemptRecord) {
  if (hasDb()) {
    if (!isValidId(rec.attemptId)) throw new Error("잘못된 ID");
    await dbPut(TABLE, rec.attemptId, rec, extraCols(rec));
    return;
  }
  await mkdir(DATA_DIR, { recursive: true });
  const file = fileOf(rec.attemptId);
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tmp, JSON.stringify(rec, null, 2), "utf8");
  await rename(tmp, file); // 쓰는 도중 끊겨도 파일이 깨지지 않게
}

/** 지금 어디에 저장하는지 (GET /api/health/storage) */
export function storageKind(): "supabase" | "file" {
  return hasDb() ? "supabase" : "file";
}

const extraCols = (rec: AttemptRecord) => ({
  class_id: rec.classId || DEFAULT_CLASS_ID,
  exam_id: rec.examId || DEFAULT_EXAM_ID,
});

// 같은 학생 기록을 동시에 고치지 않도록 학생별로 순서대로 처리 (한 서버 안).
// 서버가 여러 대(배포)일 때는 Supabase의 updated_at 비교로 덮어쓰기를 막고 다시 시도합니다.
const locks = new Map<string, Promise<unknown>>();
const MAX_TRIES = 5;

/** 기록을 읽어서 고친 뒤 저장. fn이 던진 에러는 그대로 전달되고 저장하지 않음 */
export async function updateAttempt<T>(
  id: string,
  fn: (rec: AttemptRecord | null) => Promise<{ rec: AttemptRecord | null; result: T }> | { rec: AttemptRecord | null; result: T },
): Promise<T> {
  if (!isValidId(id)) throw new Error("잘못된 ID");
  const prev = locks.get(id) ?? Promise.resolve();
  const run = prev.catch(() => {}).then(async () => {
    if (!hasDb()) {
      const { rec, result } = await fn(await loadAttempt(id));
      if (rec) await saveAttempt(rec);
      return result;
    }
    for (let i = 0; i < MAX_TRIES; i++) {
      const row = await dbGetVersioned<AttemptRecord>(TABLE, id);
      const { rec, result } = await fn(row?.data ?? null);
      if (!rec) return result;
      if (await dbSaveIfUnchanged(TABLE, rec.attemptId, rec, row?.version ?? null, extraCols(rec))) return result;
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

/** filter를 주면 그 반·시험 기록만 (DB에서는 해당 줄만 읽음) */
export async function listAttempts(filter: { classId?: string; examId?: string } = {}): Promise<AttemptRecord[]> {
  const keep = (r: AttemptRecord) =>
    (!filter.classId || (r.classId || DEFAULT_CLASS_ID) === filter.classId) &&
    (!filter.examId || (r.examId || DEFAULT_EXAM_ID) === filter.examId);
  if (hasDb()) {
    const f: Record<string, string> = {};
    if (filter.classId) f.class_id = filter.classId;
    if (filter.examId) f.exam_id = filter.examId;
    return (await dbList<AttemptRecord>(TABLE, f)).filter(keep);
  }
  let names: string[] = [];
  try {
    names = await readdir(DATA_DIR);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw e;
  }
  const ids = names.filter((n) => n.endsWith(".json")).map((n) => n.slice(0, -5));
  const recs = await Promise.all(ids.map((id) => loadAttempt(id)));
  return recs.filter((r): r is AttemptRecord => r !== null && keep(r)).sort((a, b) => a.attemptId.localeCompare(b.attemptId));
}

/** 한 학생(학번)의 모든 응시 기록. attemptId는 학번 또는 학번_시험ID */
export async function listAttemptsByStudent(studentId: string): Promise<AttemptRecord[]> {
  if (!isValidId(studentId)) return [];
  const mine = (r: AttemptRecord) => r.student.id === studentId;
  if (hasDb()) {
    const rows = await dbList<AttemptRecord>(TABLE, {}, `or=(id.eq.${studentId},id.like.${studentId}_*)`);
    return rows.filter(mine);
  }
  return (await listAttempts()).filter(mine);
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
