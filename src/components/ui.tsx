import Link from "next/link";
import { Acorn } from "./Acorn";

/** 버튼 모양 (와이어프레임 공통) */
export const btn = {
  primary:
    "inline-flex min-h-[52px] items-center justify-center gap-2 rounded-[18px] border-0 bg-brown px-[26px] font-display text-xl text-white no-underline cursor-pointer disabled:cursor-not-allowed disabled:bg-disabled disabled:text-faint",
  secondary:
    "inline-flex min-h-[52px] items-center justify-center rounded-[18px] border border-line-2 bg-white px-[22px] text-[15px] font-bold text-sub no-underline cursor-pointer disabled:cursor-not-allowed disabled:opacity-60",
  disabledBox:
    "inline-flex min-h-[60px] items-center justify-center rounded-[18px] bg-disabled px-[26px] font-display text-xl text-faint",
};

export const card = "rounded-[28px] border border-line bg-white";

export function Brand({ subtitle, badge }: { subtitle?: string; badge?: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <Acorn size={30} />
      <span className="font-display text-[26px] text-brown-dark">도토리 시험지</span>
      {badge && <span className="rounded-lg bg-ink px-2.5 py-1 text-xs font-bold text-white">{badge}</span>}
      {subtitle && <span className="ml-2 text-[15px] text-sub">{subtitle}</span>}
    </div>
  );
}

export function Pill({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full border border-line bg-white px-3.5 py-[7px] text-[13px] text-sub">{children}</span>;
}

export type StepKey = "outline" | "write" | "reflect";
const STEPS: { key: StepKey; label: string }[] = [
  { key: "outline", label: "1 개요" },
  { key: "write", label: "2 글쓰기" },
  { key: "reflect", label: "3 성찰지" },
];

/** 진행 단계 표시 + 이동 */
export function StepNav({
  current,
  done,
  onGo,
  disabled,
}: {
  current: StepKey;
  done: Partial<Record<StepKey, boolean>>;
  onGo: (s: StepKey) => void;
  disabled?: Partial<Record<StepKey, boolean>>;
}) {
  return (
    <ol aria-label="진행 단계" className="m-0 flex list-none flex-wrap items-center gap-2 p-0">
      {STEPS.map((s, i) => {
        const on = s.key === current;
        const cls = on
          ? "bg-brown font-bold text-white border-brown"
          : done[s.key]
            ? "bg-[#F3E6D3] text-sub border-[#F3E6D3]"
            : "bg-white text-sub border-line";
        return (
          <li key={s.key} className="flex items-center gap-2">
            {i > 0 && <span aria-hidden="true" className="h-0.5 w-5 bg-line-2" />}
            <button
              type="button"
              aria-current={on ? "step" : undefined}
              disabled={disabled?.[s.key]}
              onClick={() => onGo(s.key)}
              className={`min-h-9 cursor-pointer rounded-full border px-4 text-sm disabled:cursor-not-allowed disabled:opacity-50 ${cls}`}
            >
              {s.label}
              {done[s.key] && !on ? " ✓" : ""}
            </button>
          </li>
        );
      })}
    </ol>
  );
}

export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="text-sm text-brown hover:text-[#5C300A]">
      {children}
    </Link>
  );
}

export function Loading({ label = "불러오는 중" }: { label?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-3 py-24 text-sub">
      <Acorn size={22} style={{ animation: "dotori-wobble 1.2s ease-in-out infinite" }} />
      {label}
    </div>
  );
}

export function ErrorBox({ children }: { children: React.ReactNode }) {
  return (
    <div role="alert" className="rounded-2xl bg-alert-bg px-4 py-3 text-sm leading-relaxed text-alert">
      {children}
    </div>
  );
}
