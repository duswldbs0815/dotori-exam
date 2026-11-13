// 시험 설정. 아직 확정 안 된 값은 여기만 바꾸면 화면·서버·리포트에 모두 반영됩니다.
import { OUTLINE_ITEMS, type ExamInfo } from "./types";

export const EXAM_CONFIG: ExamInfo = {
  title: "「진달래꽃」 비평문 쓰기",
  outlineItems: OUTLINE_ITEMS,
  // 도토리는 시험이 정하지 않습니다. 학생이 개요 단계에서 항목별로 스스로 계획합니다.
  // 아래는 비용·장난 방지용 안전 상한일 뿐이고, 학생에게는 보이지 않습니다.
  acornPlanMaxPerItem: 10, // 개요 항목 하나에 계획할 수 있는 최대 개수
  acornSafetyCap: 30, // 한 학생이 시험 전체에서 쓸 수 있는 최대 질문 수
};
