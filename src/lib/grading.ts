// 채점 단계 (클라이언트·서버 공용). 교사가 수행평가마다·학생마다 고를 수 있음
import type { Grade, GradeScale } from "./types";

export const GRADE_SCALES: { id: GradeScale; label: string; levels?: readonly string[] }[] = [
  { id: "3", label: "상·중·하", levels: ["상", "중", "하"] },
  { id: "5", label: "A~E", levels: ["A", "B", "C", "D", "E"] },
  { id: "pf", label: "통과·미통과", levels: ["통과", "미통과"] },
  { id: "points", label: "점수" },
];

export const DEFAULT_SCALE: GradeScale = "3";
export const DEFAULT_MAX = 25;

export const levelsOf = (scale: GradeScale) => GRADE_SCALES.find((s) => s.id === scale)?.levels ?? null;

/** 항목 i의 만점 (점수 채점). 항목별 배점이 있으면 그것 */
export const maxOf = (g: { max?: number; itemMax?: number[] }, i: number) => g.itemMax?.[i] ?? g.max ?? DEFAULT_MAX;

/** 값 하나가 이 단계에 맞는지 (안 매긴 null도 됨) */
export function validValue(scale: GradeScale, max: number, v: unknown): v is string | number | null {
  if (v === null) return true;
  const levels = levelsOf(scale);
  if (levels) return typeof v === "string" && levels.includes(v);
  return typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= max;
}

/** 점수 채점일 때 합계 (안 매긴 칸이 있으면 null) */
export function pointsTotal(g: Grade): number | null {
  if (g.scale !== "points") return null;
  const vals = [...g.items, ...(g.ai !== undefined ? [g.ai] : [])];
  if (vals.some((v) => typeof v !== "number")) return null;
  return (vals as number[]).reduce((a, b) => a + b, 0);
}

export const gradeDone = (g: Grade | null | undefined) =>
  !!g && g.items.every((v) => v !== null) && (g.ai === undefined || g.ai !== null);
