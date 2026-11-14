"use client";

// 반 화면 맨 아래 "기록 지우기": 학기 말에 한 반·한 수행평가의 학생 기록을 영구히 지움.
// 실수 방지: 채점표를 먼저 내려받을 수 있게 하고, 반 이름을 직접 입력해야 지워짐.
// 빼고 싶으면 ClassView.tsx 에서 <DeleteRecords … /> 한 줄만 지우면 됨.
import { useState } from "react";
import { api } from "@/lib/api-client";
import { classLabel } from "@/lib/school";
import { card } from "../ui";

export function DeleteRecords({
  classId,
  examId,
  examTitle,
  count,
  onDone,
}: {
  classId: string;
  examId: string;
  examTitle: string;
  count: number;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<number | null>(null);

  const close = () => {
    if (busy) return;
    setOpen(false);
    setTyped("");
    setError(null);
    if (done !== null) {
      setDone(null);
      onDone();
    }
  };

  const remove = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/report/class/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classId, examId, confirm: typed.trim() }),
      });
      const body = await r.json().catch(() => null);
      if (!r.ok) throw new Error(body?.error ?? "지우지 못했어요.");
      setDone(body.deleted ?? 0);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (count === 0) return null;

  return (
    <section aria-label="기록 지우기" className={`${card} flex flex-wrap items-center justify-between gap-3 px-6 py-4 max-sm:px-4`}>
      <div className="flex flex-col gap-0.5">
        <b className="text-[14px] text-sub">기록 정리</b>
        <span className="text-[12px] text-muted">학기가 끝나면 이 반 학생들의 글·질문·AI 답·채점 기록을 지울 수 있어요. 수행평가 자체는 남아요.</span>
      </div>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="min-h-[38px] cursor-pointer rounded-full border border-line-3 bg-white px-3.5 text-[13px] text-alert"
      >
        이 반 기록 지우기
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(58,42,28,.35)] p-6" onClick={close}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="del-title"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.key === "Escape" && close()}
            className="flex w-[480px] max-w-full flex-col gap-4 rounded-[28px] bg-white p-7 shadow-[0_24px_60px_rgba(58,42,28,.25)]"
          >
            {done !== null ? (
              <>
                <h2 id="del-title" className="m-0 font-display text-[26px] font-normal">
                  기록을 지웠어요
                </h2>
                <p className="m-0 text-sm leading-relaxed text-sub">
                  {classLabel(classId)} 「{examTitle}」 학생 {done}명의 기록을 지웠어요.
                </p>
                <button
                  type="button"
                  autoFocus
                  onClick={close}
                  className="inline-flex min-h-12 cursor-pointer items-center justify-center rounded-[18px] border-0 bg-leaf px-6 font-display text-xl text-white"
                >
                  확인
                </button>
              </>
            ) : (
              <>
                <h2 id="del-title" className="m-0 font-display text-[26px] font-normal">
                  이 반 기록 지우기
                </h2>
                <p className="m-0 text-sm leading-relaxed text-sub">
                  {classLabel(classId)} 「{examTitle}」 학생 <b className="text-alert">{count}명</b>의 글, 질문, AI 답, 성찰지, 글쓰기 과정, 채점이{" "}
                  <b className="text-alert">영구히 지워져요.</b> 되돌릴 수 없어요.
                </p>
                <a
                  href={api.classCsvUrl(classId, examId)}
                  download
                  className="inline-flex min-h-[40px] items-center justify-center rounded-full border border-line-3 bg-white px-4 text-[13px] font-bold text-ink no-underline"
                >
                  지우기 전에 채점표 내려받기 (CSV)
                </a>
                <label className="flex flex-col gap-1.5 text-[13px] text-sub">
                  확인을 위해 반 이름 <b className="text-ink">{classId}</b> 를 그대로 입력해 주세요.
                  <input
                    value={typed}
                    onChange={(e) => setTyped(e.target.value)}
                    autoFocus
                    placeholder={classId}
                    className="min-h-11 rounded-xl border border-line-2 px-3 text-[15px] outline-none focus:border-leaf"
                  />
                </label>
                {error && <p className="m-0 text-[13px] text-alert">{error}</p>}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={close}
                    disabled={busy}
                    className="inline-flex min-h-12 flex-1 cursor-pointer items-center justify-center rounded-[18px] border border-line-2 bg-white text-[15px] font-bold text-sub"
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    onClick={() => void remove()}
                    disabled={busy || typed.trim() !== classId}
                    className="inline-flex min-h-12 flex-1 cursor-pointer items-center justify-center rounded-[18px] border-0 bg-alert text-[15px] font-bold text-white disabled:cursor-not-allowed disabled:bg-disabled disabled:text-faint"
                  >
                    {busy ? "지우는 중…" : "영구히 지우기"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
