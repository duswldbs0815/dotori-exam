"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";
import { SCHOOL_NAME } from "@/lib/school";
import { api, ApiError } from "@/lib/api-client";
import type { TeacherAccount } from "@/lib/types";
import { Acorn } from "../Acorn";
import { Squirrel } from "../Squirrel";
import { btn, card, ErrorBox, Loading } from "../ui";

/** 로그인한 교사 (TeacherGate 안에서만 값이 있음) */
const TeacherCtx = createContext<TeacherAccount | null>(null);
export const useTeacher = () => useContext(TeacherCtx);

const NAV: { href: string; label: string; icon: React.ReactNode; match: (p: string) => boolean }[] = [
  { href: "/teacher", label: "홈", icon: <HomeIcon />, match: (p) => p === "/teacher" },
  {
    href: "/teacher/exams",
    label: "수행평가",
    icon: <ClipIcon />,
    match: (p) => p.startsWith("/teacher/exams") || p.startsWith("/teacher/class") || p.startsWith("/teacher/new") || /^\/teacher\/\d/.test(p),
  },
  { href: "/teacher/cases", label: "설계 사례", icon: <BookIcon />, match: (p) => p.startsWith("/teacher/cases") },
];

function Logo() {
  return (
    <Link href="/teacher" className="flex flex-col items-center gap-1 text-ink no-underline max-lg:flex-row max-lg:gap-2">
      <span className="relative inline-flex items-end">
        <Squirrel size={46} />
        <Acorn size={18} />
      </span>
      <span className="font-display text-[22px] leading-none text-leaf">도토리 시험지</span>
    </Link>
  );
}

export function TeacherShell({ children, loggedIn = true }: { children: React.ReactNode; loggedIn?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const me = useTeacher();
  const logout = async () => {
    await api.teacherLogout().catch(() => null);
    if (pathname === "/teacher") window.location.reload();
    else router.push("/teacher");
  };
  return (
    <div className="flex min-h-screen w-full bg-teacher-bg max-lg:flex-col print:block print:bg-white">
      <aside className="sticky top-0 flex h-screen w-[210px] shrink-0 flex-col gap-8 border-r border-line bg-cream px-4 pt-7 pb-5 max-lg:static max-lg:h-auto max-lg:w-full max-lg:flex-row max-lg:flex-wrap max-lg:items-center max-lg:gap-3 max-lg:border-r-0 max-lg:border-b max-lg:px-4 max-lg:py-3 print:hidden">
        <Logo />
        {loggedIn && (
          <nav aria-label="교사 메뉴" className="flex flex-col gap-1.5 max-lg:flex-row max-lg:gap-1">
            {NAV.map((n) => {
              const on = n.match(pathname);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  aria-current={on ? "page" : undefined}
                  className={`flex min-h-11 items-center gap-3 rounded-xl px-3.5 text-[16px] font-bold no-underline transition-colors max-lg:min-h-9 max-lg:px-3 max-lg:text-[14px] ${
                    on ? "bg-leaf text-white" : "text-ink hover:bg-leaf-bg"
                  }`}
                >
                  {n.icon}
                  {n.label}
                </Link>
              );
            })}
          </nav>
        )}
        <div className="mt-auto flex flex-col gap-3 max-lg:mt-0 max-lg:ml-auto max-lg:flex-row max-lg:items-center">
          {loggedIn && me && (
            <div className="flex flex-col gap-1 rounded-xl bg-cream-2 px-3 py-2.5 max-lg:flex-row max-lg:items-center max-lg:gap-2 max-lg:py-1.5">
              <span className="text-[13px] font-bold text-ink">
                {me.name} 선생님 <span className="font-normal text-muted">· {me.subject}</span>
              </span>
              <button type="button" onClick={logout} className="w-fit cursor-pointer border-0 bg-transparent p-0 text-xs text-sub underline">
                로그아웃
              </button>
            </div>
          )}
          <span className="flex items-center gap-1.5 text-[11px] text-muted max-lg:hidden">
            <Acorn size={14} /> 기록은 자세하게, 확인은 간단하게
          </span>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-9 pt-8 pb-14 max-sm:px-4 max-sm:pt-5 print:p-0">
        <div className="mx-auto flex max-w-[1120px] flex-col gap-[22px]">{children}</div>
      </main>
    </div>
  );
}

/** 교사 계정 로그인 (과목 담당 교사, 해커톤용 가상 계정. 실제 도입 시 슈퍼스쿨 로그인) */
export function TeacherLogin({ onDone }: { onDone: (t: TeacherAccount) => void }) {
  const [id, setId] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = "min-h-12 rounded-2xl border border-line bg-paper px-4 text-[15px]";
  return (
    <TeacherShell loggedIn={false}>
      <form
        className={`${card} mx-auto mt-10 flex w-full max-w-[480px] flex-col gap-4 p-9 max-sm:p-6`}
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          try {
            const r = await api.teacherLogin(id, password);
            if (r.account) onDone(r.account);
          } catch (err) {
            setError(err instanceof ApiError ? err.message : "로그인하지 못했어요.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <h1 className="m-0 font-display text-3xl font-normal">선생님 로그인</h1>
        <p className="m-0 text-sm leading-relaxed text-sub">
          담당 과목의 수행평가와 학생 기록만 보여요. 학생의 질문 기록과 글쓰기 과정은 선생님만 볼 수 있어요.
        </p>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-bold text-sub">아이디</span>
          <input value={id} onChange={(e) => setId(e.target.value)} autoComplete="username" placeholder="kor@dotori.school" className={input} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-bold text-sub">비밀번호</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" className={input} />
        </label>
        {error && <ErrorBox>{error}</ErrorBox>}
        <button type="submit" disabled={!id || !password || busy} className={btn.primary}>
          {busy ? "확인 중…" : "들어가기"}
        </button>
        <span className="text-xs text-muted">{SCHOOL_NAME}는 가상 학교예요. 시연용 교사 계정으로 들어가요.</span>
      </form>
    </TeacherShell>
  );
}

/** 교사 로그인 확인 후 children을 그림 (로그인 전이면 로그인 창) */
export function TeacherGate({ children }: { children: React.ReactNode }) {
  const [auth, setAuth] = useState<"checking" | "out" | TeacherAccount>("checking");
  useEffect(() => {
    api.teacherMe().then(
      (m) => setAuth(m.teacher && m.account ? m.account : "out"),
      () => setAuth("out"),
    );
  }, []);
  if (auth === "checking") return <TeacherShell loggedIn={false}><Loading /></TeacherShell>;
  if (auth === "out") return <TeacherLogin onDone={setAuth} />;
  return <TeacherCtx.Provider value={auth}>{children}</TeacherCtx.Provider>;
}

function HomeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M12 3.2 2.8 11a1 1 0 0 0 1.3 1.5l.9-.8V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-8.3l.9.8a1 1 0 0 0 1.3-1.5Z" />
    </svg>
  );
}
function ClipIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <rect x="5" y="4.5" width="14" height="16.5" rx="2" />
      <path d="M9 3h6v3H9zM8.5 11h7M8.5 15h5" />
    </svg>
  );
}
function BookIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
      <path d="M12 6.5C10 5 6.5 4.5 3 5v13.5c3.5-.5 7 0 9 1.5 2-1.5 5.5-2 9-1.5V5c-3.5-.5-7 0-9 1.5ZM12 6.5V20" />
    </svg>
  );
}
