// 시험 설정. 아직 확정 안 된 값은 여기만 바꾸면 화면·서버·리포트에 모두 반영됩니다.
import { OUTLINE_ITEMS, type ExamInfo } from "./types";

export const EXAM_CONFIG: ExamInfo = {
  title: "「진달래꽃」 비평문 쓰기",
  outlineItems: OUTLINE_ITEMS,
  acornTotal: 5, // 도토리 총개수 (미정, 임시값)
  maxAnswerSentences: 3, // AI 답변 최대 문장 수 (미정, 임시값)
};
