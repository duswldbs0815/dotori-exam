import Link from "next/link";
import { hhmm } from "@/lib/api-client";
import type { PerItem } from "@/lib/types";
import { Squirrel } from "../Squirrel";
import { btn, card } from "../ui";
import type { DoneInfo } from "./ExamApp";

/** ⑤ 제출 완료 */
export function DoneStep({ name, used, info }: { name: string; used: PerItem; info: DoneInfo | null }) {
  const stats: [string, string][] = [];
  if (info?.submittedAt) stats.push([hhmm(info.submittedAt), "제출 시각"]);
  if (info) stats.push([`${info.chars}자`, "글자 수"]);
  stats.push([`${used.reduce((a, b) => a + b, 0)}개`, "쓴 도토리"]);
  if (info?.reflectionCount != null) stats.push([`${info.reflectionCount}/4`, "성찰 문항"]);

  return (
    <main className={`${card} mx-auto mt-10 box-border flex w-full max-w-[760px] flex-col items-center gap-[22px] px-12 py-14 text-center max-sm:px-5`}>
      <Squirrel size={96} />
      <h1 className="m-0 font-display text-[40px] font-normal">제출 완료!</h1>
      <p className="m-0 text-base leading-relaxed text-sub">수고했어요, {name} 님. 선생님이 확인한 뒤 결과를 알려 주실 거예요.</p>
      <div className="grid w-full gap-2.5" style={{ gridTemplateColumns: `repeat(${stats.length}, minmax(0, 1fr))` }}>
        {stats.map(([v, l]) => (
          <div key={l} className="rounded-2xl bg-cream-3 px-1.5 py-3.5">
            <div className="font-display text-[26px] text-brown">{v}</div>
            <div className="text-xs text-sub">{l}</div>
          </div>
        ))}
      </div>
      <Link href="/" className={btn.primary}>
        처음으로
      </Link>
    </main>
  );
}
