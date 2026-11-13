"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { api, ApiError } from "@/lib/api-client";
import { Brand, btn, card, ErrorBox, Pill } from "../ui";

export function TeacherShell({ children, loggedIn = true }: { children: React.ReactNode; loggedIn?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  return (
    <div className="min-h-screen w-full bg-teacher-bg px-8 pt-6 pb-12 max-sm:px-4">
      <div className="mx-auto flex max-w-[1280px] flex-col gap-[22px]">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <Brand badge="교사용" />
          {loggedIn && (
            <div className="flex items-center gap-2">
              <Pill>국어 · 교사</Pill>
              <button
                type="button"
                onClick={async () => {
                  await api.teacherLogout().catch(() => null);
                  // 목록 화면이면 다시 그려서 로그인 창으로, 상세 화면이면 목록으로
                  if (pathname === "/teacher") window.location.reload();
                  else router.push("/teacher");
                }}
                className="min-h-9 cursor-pointer rounded-full border border-line bg-white px-3.5 text-[13px] text-sub"
              >
                로그아웃
              </button>
            </div>
          )}
        </header>
        {children}
      </div>
    </div>
  );
}

/** 교사 코드 로그인 (해커톤용 간이 인증, 실제 도입 시 슈퍼스쿨 로그인) */
export function TeacherLogin({ failed, onDone }: { failed?: boolean; onDone: () => void }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(failed ? "바로가기 링크의 교사 코드가 맞지 않아요. 직접 입력해 주세요." : null);
  return (
    <TeacherShell loggedIn={false}>
      <form
        className={`${card} mx-auto mt-10 flex w-full max-w-[480px] flex-col gap-4 p-9 max-sm:p-6`}
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          try {
            await api.teacherLogin(code);
            onDone();
          } catch (err) {
            setError(err instanceof ApiError ? err.message : "로그인하지 못했어요.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <h1 className="m-0 font-display text-3xl font-normal">교사 리포트</h1>
        <p className="m-0 text-sm leading-relaxed text-sub">학생의 질문 기록과 글쓰기 과정은 선생님만 볼 수 있어요. 교사 코드를 입력해 주세요.</p>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-bold text-sub">교사 코드</span>
          <input
            type="password"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoComplete="current-password"
            className="min-h-12 rounded-2xl border border-line bg-paper px-4 text-[15px]"
          />
        </label>
        {error && <ErrorBox>{error}</ErrorBox>}
        <button type="submit" disabled={!code || busy} className={btn.primary}>
          {busy ? "확인 중…" : "들어가기"}
        </button>
      </form>
    </TeacherShell>
  );
}
