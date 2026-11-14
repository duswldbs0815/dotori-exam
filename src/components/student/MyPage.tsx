"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, ApiError, hhmm, rememberSession } from "@/lib/api-client";
import { growthOf, ITEMS, pointsOf, wearFrom, type ItemId } from "@/lib/growth";
import { classLabel } from "@/lib/school";
import type { MyAttempt, MyPageResponse } from "@/lib/types";
import { Acorn } from "../Acorn";
import { Squirrel } from "../Squirrel";
import { Brand, btn, card, ErrorBox, Loading } from "../ui";

const SUBJECT_TONE: Record<string, string> = { 국어: "#C27C3E", 과학: "#4A6B3C", 영어: "#2F6DB5", 사회: "#8A4B12", 수학: "#6B4F9E", 도덕: "#3E7C7A" };
const wearKey = (id: string) => `dotori-wear-${id}`;

function readEquipped(id: string): ItemId[] {
  try {
    const v = JSON.parse(localStorage.getItem(wearKey(id)) ?? "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

/** 학생 마이페이지: 내 학습 기록 + 다람쥐 꾸미기 */
export function MyPage() {
  const [data, setData] = useState<MyPageResponse | null>(null);
  const [needLogin, setNeedLogin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [equipped, setEquipped] = useState<ItemId[]>([]);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let alive = true;
    api.me().then(
      (r) => {
        if (!alive) return;
        setData(r);
        setNeedLogin(false);
        setEquipped(readEquipped(r.student.id));
      },
      (e) => {
        if (!alive) return;
        if (e instanceof ApiError && e.status === 401) setNeedLogin(true);
        else setError(e instanceof ApiError ? e.message : "기록을 불러오지 못했어요.");
      },
    );
    return () => {
      alive = false;
    };
  }, [nonce]);

  const logout = async () => {
    await api.meLogout().catch(() => {});
    setData(null);
    setNeedLogin(true);
  };

  return (
    <div className="min-h-screen w-full bg-cream px-8 pt-6 pb-16 max-sm:px-4">
      <div className="mx-auto flex max-w-[1180px] flex-col gap-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/" className="no-underline" aria-label="도토리 시험지 소개로">
            <Brand subtitle="내 학습 기록" />
          </Link>
          <nav className="flex items-center gap-2">
            <Link href="/start" className="rounded-full bg-leaf px-4 py-2 text-[15px] font-bold text-white no-underline">
              시험 시작
            </Link>
            {data && (
              <button type="button" onClick={logout} className="cursor-pointer rounded-full border border-line bg-white px-4 py-2 text-[14px] text-sub">
                로그아웃
              </button>
            )}
          </nav>
        </header>
        {error && <ErrorBox>{error}</ErrorBox>}
        {needLogin && <Login onDone={() => setNonce((n) => n + 1)} />}
        {!needLogin && !error && !data && <Loading label="내 기록을 불러오는 중" />}
        {data && <Dashboard data={data} equipped={equipped} setEquipped={setEquipped} />}
      </div>
    </div>
  );
}

/* ── 로그인 (본인 확인 모의) ── */

function Login({ onDone }: { onDone: () => void }) {
  const [studentId, setStudentId] = useState("");
  const [name, setName] = useState("");
  const [phase, setPhase] = useState<"form" | "scan">("form");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPhase("scan");
    try {
      await Promise.all([api.meLogin(studentId.trim(), name.trim()), new Promise((r) => setTimeout(r, 1200))]);
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "들어가지 못했어요.");
      setPhase("form");
    }
  }

  return (
    <main className={`${card} mx-auto flex w-full max-w-[560px] flex-col items-center gap-5 px-10 py-12 text-center max-sm:px-5`}>
      <Squirrel size={110} />
      <h1 className="m-0 font-display text-[36px] font-normal">내 학습 기록 보기</h1>
      <p className="m-0 text-[15px] leading-relaxed text-sub">
        학번과 이름으로 본인 확인을 하면 지금까지 푼 수행평가와 내 다람쥐를 볼 수 있어요.
        <br />
        시험을 시작했던 브라우저라면 바로 들어가져요.
      </p>
      {phase === "scan" ? (
        <div className="flex flex-col items-center gap-3 py-4">
          <div className="relative h-24 w-24 overflow-hidden rounded-3xl border-2 border-dashed border-line-2 bg-paper">
            <div className="absolute right-2 left-2 h-0.5 bg-leaf-2" style={{ animation: "dotori-scan 1.2s ease-in-out infinite" }} />
          </div>
          <span className="text-[14px] text-sub">페이스페이로 본인 확인 중…</span>
        </div>
      ) : (
        <form onSubmit={submit} className="flex w-full flex-col gap-3">
          <input
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            placeholder="학번 (예: 20105)"
            autoComplete="off"
            className="min-h-12 rounded-2xl border border-line bg-paper px-4 text-[15px]"
          />
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="이름"
            autoComplete="off"
            className="min-h-12 rounded-2xl border border-line bg-paper px-4 text-[15px]"
          />
          {error && <p className="m-0 text-[13px] text-alert">{error}</p>}
          <button type="submit" disabled={!studentId.trim() || !name.trim()} className={btn.primary}>
            본인 확인하고 들어가기
          </button>
          <p className="m-0 text-xs text-muted">시연용이에요. 가상 학생 정보로 들어가요 (예: S01 · 가상학생A).</p>
        </form>
      )}
    </main>
  );
}

/* ── 대시보드 ── */

function Dashboard({ data, equipped, setEquipped }: { data: MyPageResponse; equipped: ItemId[]; setEquipped: (v: ItemId[]) => void }) {
  const g = growthOf(data.attempts);
  const wear = wearFrom(equipped, g.unlocked);
  const pct = g.next ? Math.min(100, Math.round(((g.points - g.level.min) / (g.next.min - g.level.min)) * 100)) : 100;
  const submitted = data.attempts.filter((a) => a.submittedAt).length;
  const questions = data.attempts.reduce((s, a) => s + a.questionCount, 0);
  const chars = data.attempts.reduce((s, a) => s + a.chars, 0);
  const [poke, setPoke] = useState(0);

  const toggle = (id: ItemId) => {
    const item = ITEMS.find((i) => i.id === id)!;
    const on = equipped.includes(id);
    // 같은 자리(머리 등)에 있던 것은 빼고 새로 씀
    const next = on ? equipped.filter((x) => x !== id) : [...equipped.filter((x) => ITEMS.find((i) => i.id === x)?.slot !== item.slot), id];
    setEquipped(next);
    setPoke((n) => n + 1);
    try {
      localStorage.setItem(wearKey(data.student.id), JSON.stringify(next));
    } catch {}
  };

  return (
    <>
      <section className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] gap-6 max-md:grid-cols-1">
        <div className={`${card} relative flex flex-col items-center gap-3 overflow-hidden px-6 pt-8 pb-6`}>
          <div className="absolute inset-x-0 top-0 h-40 bg-cream-2" />
          <div className="relative">
            <Squirrel size={180} wear={wear} eats={poke} />
          </div>
          <span className="relative rounded-full bg-ink px-3 py-1 text-[13px] font-bold text-white">Lv.{g.level.level}</span>
          <h1 className="relative m-0 font-display text-[30px] font-normal">{g.level.name}</h1>
          <p className="relative m-0 text-[15px] text-sub">
            {data.student.name} · {data.student.id}
          </p>
          <div className="relative flex w-full flex-col gap-1.5">
            <div className="flex justify-between text-[13px] text-muted">
              <span>성장 도토리 {g.points}개</span>
              <span>{g.next ? `다음 단계까지 ${g.next.min - g.points}개` : "최고 단계예요!"}</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-cream-2">
              <div className="h-full rounded-full bg-nut transition-[width] duration-700" style={{ width: `${pct}%` }} />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-4 gap-3 max-sm:grid-cols-2">
            {[
              [String(data.attempts.length), "수행평가"],
              [String(submitted), "제출"],
              [String(questions), "AI 질문"],
              [chars.toLocaleString(), "쓴 글자"],
            ].map(([v, l]) => (
              <div key={l} className="flex flex-col items-center gap-0.5 rounded-[22px] border border-line bg-white px-2 py-4">
                <span className="font-display text-[28px] text-leaf">{v}</span>
                <span className="text-[13px] text-sub">{l}</span>
              </div>
            ))}
          </div>

          <div className={`${card} flex flex-col gap-3 p-5`}>
            <div className="flex items-center justify-between">
              <h2 className="m-0 font-display text-[22px] font-normal">다람쥐 꾸미기</h2>
              <span className="text-[12px] text-muted">누르면 입히고 다시 누르면 벗어요</span>
            </div>
            <div className="grid grid-cols-4 gap-2.5 max-sm:grid-cols-2">
              {ITEMS.map((it) => {
                const open = g.unlocked.includes(it.id);
                const on = equipped.includes(it.id) && open;
                return (
                  <button
                    key={it.id}
                    type="button"
                    disabled={!open}
                    onClick={() => toggle(it.id)}
                    title={it.desc}
                    className={`flex cursor-pointer flex-col items-center gap-1 rounded-2xl border-2 px-2 py-3 transition disabled:cursor-not-allowed ${on ? "border-nut bg-cream-3" : "border-line bg-white hover:-translate-y-0.5"} ${open ? "" : "opacity-55"}`}
                  >
                    <ItemIcon id={it.id} locked={!open} />
                    <span className="text-[13px] font-bold">{it.name}</span>
                    <span className="text-[11px] text-muted">{open ? (on ? "입는 중" : "입히기") : `Lv.${it.level}에 열려요`}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className={`${card} flex flex-col gap-3 p-5`}>
            <h2 className="m-0 font-display text-[22px] font-normal">배지</h2>
            <div className="flex flex-wrap gap-2">
              {g.badges.map((b) => (
                <span
                  key={b.id}
                  title={b.hint}
                  className={`rounded-full px-3.5 py-1.5 text-[13px] font-bold ${b.got ? "bg-gold/30 text-brown-dark" : "border border-dashed border-line-2 text-faint"}`}
                >
                  {b.got ? "🏅 " : "🔒 "}
                  {b.name}
                </span>
              ))}
            </div>
            <p className="m-0 text-[12px] leading-relaxed text-muted">
              성장 도토리는 AI에게 질문하기, 끝까지 제출하기, 대신 써 달라고 하지 않고 내 글로 끝내기로 모여요. 질문 수가 많거나 적다고 깎이지 않아요.
            </p>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="m-0 font-display text-[26px] font-normal">내 수행평가</h2>
        {data.attempts.length === 0 && <p className="m-0 text-sub">아직 시작한 수행평가가 없어요.</p>}
        {data.attempts.map((a) => (
          <AttemptCard key={a.attemptId} a={a} me={data.student} />
        ))}
      </section>
    </>
  );
}

function AttemptCard({ a, me }: { a: MyAttempt; me: { id: string; name: string } }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const tone = SUBJECT_TONE[a.subject] ?? "#8A4B12";
  const pts = pointsOf(a);
  const max = Math.max(1, ...a.used, ...(a.plan ?? [0]));

  async function resume() {
    setBusy(true);
    try {
      const res = await api.start({ studentId: me.id, name: me.name, verified: true, examId: a.examId, classId: a.classId });
      rememberSession(res.attemptId, { name: me.name, exam: res.exam });
      router.push(`/exam/${encodeURIComponent(res.attemptId)}`);
    } catch {
      setBusy(false);
    }
  }

  return (
    <article className={`${card} flex flex-col gap-4 p-6 max-sm:p-4`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <span className="flex flex-wrap items-center gap-2 text-[13px]">
            <span className="rounded-full px-2.5 py-0.5 font-bold text-white" style={{ background: tone }}>
              {a.subject}
            </span>
            <span className="text-muted">
              {classLabel(a.classId)} · {a.startedAt.slice(5, 10).replace("-", "/")} {hhmm(a.startedAt)}
            </span>
          </span>
          <h3 className="m-0 font-display text-[24px] leading-snug font-normal">{a.title}</h3>
        </div>
        {a.submittedAt ? (
          <span className="rounded-full bg-leaf-bg px-3 py-1 text-[13px] font-bold text-leaf">제출 완료</span>
        ) : (
          <button type="button" onClick={resume} disabled={busy} className={`${btn.secondary} min-h-10 border-leaf text-leaf`}>
            {busy ? "여는 중…" : "이어 쓰기 →"}
          </button>
        )}
      </div>

      <div className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] gap-5 max-md:grid-cols-1">
        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-bold text-sub">항목별 도토리 · 계획 vs 실제</span>
          {a.labels.map((label, i) => {
            const plan = a.plan?.[i] ?? 0;
            const used = a.used[i];
            return (
              <div key={label} className="flex items-center gap-3 text-[13px]">
                <span className="w-24 shrink-0 truncate text-sub">{label}</span>
                <div className="relative h-5 flex-1 rounded-full bg-cream-2">
                  <div className="absolute inset-y-0 left-0 rounded-full border-2 border-dashed border-line-2" style={{ width: `${(plan / max) * 100}%` }} />
                  <div className="absolute inset-y-1 left-1 rounded-full" style={{ width: `calc(${(used / max) * 100}% - 8px)`, background: tone, opacity: used ? 0.85 : 0 }} />
                </div>
                <span className="w-14 shrink-0 text-right text-muted">
                  {used} / {plan}
                </span>
              </div>
            );
          })}
          <span className="text-[11px] text-faint">점선 = 계획, 색 막대 = 실제 질문</span>
        </div>
        <div className="flex flex-col gap-2 rounded-2xl bg-cream-3 px-4 py-3">
          <span className="flex items-center gap-1.5 text-[13px] font-bold text-brown-dark">
            <Acorn size={14} /> 이번에 모은 성장 도토리 {pts.total}개
          </span>
          <ul className="m-0 flex list-none flex-col gap-1 p-0 text-[13px] text-sub">
            {pts.parts.map((p) => (
              <li key={p.label} className="flex justify-between gap-2">
                <span>{p.label}</span>
                <span className="font-bold text-leaf">+{p.pts}</span>
              </li>
            ))}
            {pts.parts.length === 0 && <li>질문하거나 제출하면 도토리가 모이기 시작해요.</li>}
          </ul>
        </div>
      </div>

      {a.questions.length > 0 && (
        <div className="flex flex-col gap-2 border-t border-dashed border-line pt-3">
          <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="cursor-pointer self-start border-0 bg-transparent p-0 text-[14px] font-bold text-leaf">
            {open ? "내 질문 접기 ▲" : `내 질문 ${a.questions.length}개 다시 보기 ▼`}
          </button>
          {open && (
            <ol className="m-0 flex list-none flex-col gap-2.5 p-0">
              {a.questions.map((q, i) => (
                <li key={i} className="flex flex-col gap-1.5 rounded-2xl bg-paper px-4 py-3 text-[14px] leading-relaxed">
                  <span className="text-[12px] text-muted">
                    {hhmm(q.time)} · {a.labels[q.outlineItem - 1]}
                    {q.blocked && <b className="ml-1.5 text-alert">차단 · 도토리 그대로</b>}
                  </span>
                  <span className="font-bold">Q. {q.question}</span>
                  <span className={q.blocked ? "text-alert" : "text-leaf"}>A. {q.answer}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </article>
  );
}

/** 꾸미기 아이템 아이콘 (다람쥐에 씌우는 그림과 같은 모양) */
function ItemIcon({ id, locked }: { id: ItemId; locked: boolean }) {
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" aria-hidden="true" style={{ filter: locked ? "grayscale(1)" : undefined }}>
      {id === "ribbon" && (
        <g transform="translate(22 22)">
          <path d="M0 0 L-14 -10 Q-17 0 -14 10 Z" fill="#FF8FA3" stroke="#D9607A" strokeWidth="1.5" />
          <path d="M0 0 L14 -10 Q17 0 14 10 Z" fill="#FF8FA3" stroke="#D9607A" strokeWidth="1.5" />
          <circle r="4" fill="#E86A86" />
        </g>
      )}
      {id === "cap" && (
        <g>
          <path d="M22 10 v-5" stroke="#5A3418" strokeWidth="3" strokeLinecap="round" />
          <path d="M5 28 Q5 10 22 10 Q39 10 39 28 Q39 32 22 32 Q5 32 5 28 Z" fill="#7A4A26" />
        </g>
      )}
      {id === "glasses" && (
        <g fill="#FFFFFF" fillOpacity=".3" stroke="#3A2A1C" strokeWidth="2.4">
          <circle cx="13" cy="23" r="8" />
          <circle cx="31" cy="23" r="8" />
          <path d="M21 22 Q22 20 23 22" fill="none" />
        </g>
      )}
      {id === "crown" && (
        <g>
          <path d="M6 34 L8 12 L17 22 L22 6 L27 22 L36 12 L38 34 Z" fill="#FFD36B" stroke="#C9962E" strokeWidth="1.8" strokeLinejoin="round" />
          <circle cx="22" cy="26" r="3" fill="#FF8F8F" />
        </g>
      )}
    </svg>
  );
}
