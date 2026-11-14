// 학생 마이페이지: 학습 기록으로 "다람쥐 성장" 점수·레벨·꾸미기 아이템을 계산 (클라이언트에서도 씀)
// 질문을 많이 하거나 적게 하는 것 자체를 상·벌로 삼지 않고, 끝까지 쓰고 돌아보는 과정에 점수를 줍니다.
import type { MyAttempt } from "./types";

export type Wear = { head?: "cap" | "crown"; face?: "glasses"; ear?: "ribbon" };
export type ItemId = "ribbon" | "cap" | "glasses" | "crown";

export const ITEMS: { id: ItemId; name: string; slot: keyof Wear; level: number; desc: string }[] = [
  { id: "ribbon", name: "분홍 리본", slot: "ear", level: 2, desc: "첫 수행평가를 끝까지 해낸 다람쥐에게" },
  { id: "cap", name: "도토리 모자", slot: "head", level: 3, desc: "도토리를 차곡차곡 모은 다람쥐에게" },
  { id: "glasses", name: "동그란 안경", slot: "face", level: 4, desc: "꼼꼼하게 돌아보는 다람쥐에게" },
  { id: "crown", name: "금빛 왕관", slot: "head", level: 5, desc: "도토리 숲을 지키는 다람쥐에게" },
];

export const LEVELS: { level: number; min: number; name: string }[] = [
  { level: 1, min: 0, name: "아기 다람쥐" },
  { level: 2, min: 30, name: "숲 산책 다람쥐" },
  { level: 3, min: 60, name: "도토리 수집가" },
  { level: 4, min: 100, name: "숲의 탐험가" },
  { level: 5, min: 150, name: "도토리 숲 지킴이" },
];

/** 수행평가 하나에서 얻은 점수와 이유 */
export function pointsOf(a: MyAttempt): { total: number; parts: { label: string; pts: number }[] } {
  const parts: { label: string; pts: number }[] = [];
  if (a.questionCount > 0) parts.push({ label: `AI에게 질문하기 (${a.questionCount}번)`, pts: Math.min(10, a.questionCount * 2) });
  if (a.submittedAt) {
    parts.push({ label: "끝까지 써서 제출", pts: 30 });
    if (a.reflectionDone >= 4) parts.push({ label: "성찰지 4문항 모두 쓰기", pts: 10 });
    if (a.recommended.length && a.used.every((u, i) => u <= (a.recommended[i] ?? 0) + 1)) parts.push({ label: "선생님 권장 도토리에 맞춰 질문하기", pts: 10 });
    if (a.blockedCount === 0) parts.push({ label: "대신 써 달라는 요청 없이 끝내기", pts: 10 });
    if (a.questionCount > 0 && a.blockedCount === 0) parts.push({ label: "AI에게 묻고 내 글로 끝내기", pts: 10 });
  }
  return { total: parts.reduce((s, p) => s + p.pts, 0), parts };
}

export function growthOf(attempts: MyAttempt[]) {
  const points = attempts.reduce((s, a) => s + pointsOf(a).total, 0);
  const cur = [...LEVELS].reverse().find((l) => points >= l.min) ?? LEVELS[0];
  const next = LEVELS.find((l) => l.level === cur.level + 1) ?? null;
  const unlocked = ITEMS.filter((i) => i.level <= cur.level).map((i) => i.id);
  const submitted = attempts.filter((a) => a.submittedAt);
  const badges = [
    { id: "first", name: "첫 제출", got: submitted.length >= 1, hint: "수행평가 하나를 제출해요" },
    { id: "curious", name: "질문 탐험가", got: attempts.reduce((s, a) => s + a.questionCount, 0) >= 10, hint: "질문을 모두 10번 해요" },
    { id: "steady", name: "꾸준한 작가", got: submitted.length >= 3, hint: "수행평가 세 개를 제출해요" },
    { id: "own", name: "내 손으로", got: submitted.filter((a) => a.blockedCount === 0).length >= 2, hint: "대신 써 달라는 요청 없이 두 번 제출해요" },
  ];
  return { points, level: cur, next, unlocked, badges };
}

/** 장착 상태에서 아직 못 연 아이템은 빼기 */
export function wearFrom(equipped: ItemId[], unlocked: ItemId[]): Wear {
  const w: Wear = {};
  for (const id of equipped) {
    if (!unlocked.includes(id)) continue;
    const item = ITEMS.find((i) => i.id === id)!;
    (w as Record<string, string>)[item.slot] = id;
  }
  return w;
}
