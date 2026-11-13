// 서버 전용: Supabase(Postgres) 저장소. 표마다 "id + data(jsonb)" 한 줄씩 넣는 단순한 방식.
// SUPABASE_URL(또는 NEXT_PUBLIC_SUPABASE_URL)과 SUPABASE_SERVICE_ROLE_KEY(service_role 또는 sb_secret_ 키)가 있으면 이걸 쓰고,
// 없으면 store.ts / exams.ts가 로컬 JSON 파일(data/)에 저장합니다.
// 표 만들기: supabase/schema.sql

const url = () => (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
const key = () => process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export const hasDb = () => Boolean(url() && key());

type Row<T> = { id: string; data: T };

async function rest(pathAndQuery: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(`${url()}/rest/v1/${pathAndQuery}`, {
    ...init,
    cache: "no-store",
    headers: {
      apikey: key(),
      // 예전 service_role 키(JWT)만 Bearer로도 보냄. 새 sb_secret_ 키는 apikey 헤더만
      ...(key().startsWith("eyJ") ? { Authorization: `Bearer ${key()}` } : {}),
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Supabase ${init.method ?? "GET"} ${pathAndQuery.split("?")[0]} 실패 (HTTP ${res.status}): ${detail.slice(0, 300)}`);
  }
  return res;
}

export async function dbGet<T>(table: string, id: string): Promise<T | null> {
  const res = await rest(`${table}?id=eq.${encodeURIComponent(id)}&select=data`);
  const rows = (await res.json()) as Row<T>[];
  return rows[0]?.data ?? null;
}

/** id가 같으면 덮어쓰기. extra는 검색용 칸 (class_id 등) */
export async function dbPut<T>(table: string, id: string, data: T, extra: Record<string, unknown> = {}) {
  await rest(`${table}?on_conflict=id`, {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ id, data, ...extra, updated_at: new Date().toISOString() }),
  });
}

/** filters 예: { class_id: "2-3" } — 값이 같은 줄만. raw는 PostgREST 조건을 그대로 붙임 (예: "or=(id.eq.a,id.like.a_*)") */
export async function dbList<T>(table: string, filters: Record<string, string> = {}, raw = ""): Promise<T[]> {
  const q =
    Object.entries(filters)
      .map(([k, v]) => `&${k}=eq.${encodeURIComponent(v)}`)
      .join("") + (raw ? `&${raw}` : "");
  const out: T[] = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const res = await rest(`${table}?select=data&order=id${q}`, { headers: { Range: `${from}-${from + PAGE - 1}` } });
    const rows = (await res.json()) as Row<T>[];
    out.push(...rows.map((r) => r.data));
    if (rows.length < PAGE) return out;
  }
}
