import { requireOwner } from "@/lib/auth";
import { examOf } from "@/lib/exams";
import { fail, handle, nowIso, readJson } from "@/lib/http";
import { isValidId, loadAttempt, totalUsed, type QuestionRecord, updateAttempt, usedPerItem, withDraft } from "@/lib/store";
import { MAX, checkLength, oneAtATime } from "@/lib/limits";
import { tutor } from "@/lib/tutor";
import type { AskRequest, AskResponse, OutlineItemNo } from "@/lib/types";

export const POST = handle(async (req: Request) => {
  const body = await readJson<AskRequest>(req);
  if (!isValidId(body.attemptId)) fail(400, "attemptId가 올바르지 않아요.");
  if (typeof body.question !== "string" || !body.question.trim()) fail(400, "질문을 입력해 주세요.");
  if (![1, 2, 3, 4].includes(body.outlineItem)) fail(400, "outlineItem은 1~4예요.");
  const item = body.outlineItem as OutlineItemNo;
  const selectedText = typeof body.selectedText === "string" ? body.selectedText : "";
  const selection =
    body.selection && Number.isInteger(body.selection.start) && Number.isInteger(body.selection.end) ? body.selection : null;
  const draft = typeof body.draft === "string" ? body.draft : "";
  checkLength(body.question, MAX.question, "질문");
  checkLength(selectedText, MAX.selectedText, "선택한 부분");
  checkLength(draft, MAX.draft, "글");

  // AI 호출 전에 먼저 상태 확인 (헛된 호출 방지)
  const pre = await loadAttempt(body.attemptId);
  if (!pre) fail(404, "응시 기록이 없어요.");
  await requireOwner(pre);
  if (pre.submittedAt) fail(409, "이미 제출한 시험이에요.");
  if (!pre.outline || !pre.acornPlan) fail(409, "개요와 도토리 계획을 먼저 작성해 주세요.");
  const exam = await examOf(pre);
  if (totalUsed(pre) >= exam.acornSafetyCap) fail(429, "이번 시험에서 질문할 수 있는 횟수를 모두 썼어요.");

  const result = await oneAtATime(body.attemptId, () =>
    tutor({ exam, question: body.question.trim(), outlineItem: item, selectedText, draft }),
  );

  const res = await updateAttempt<AskResponse>(body.attemptId, (rec) => {
    if (!rec || !rec.acornPlan) fail(409, "응시 기록이 바뀌었어요. 다시 시도해 주세요.");
    if (rec.submittedAt) fail(409, "이미 제출한 시험이에요.");

    const charged = !result.blocked;
    const used = usedPerItem(rec);
    if (charged) used[item - 1]++;
    const planned = rec.acornPlan[item - 1];
    const acornNo = charged ? totalUsed(rec) + 1 : null;
    const overPlan = charged && used[item - 1] > planned;

    const q: QuestionRecord = {
      acornNo,
      time: nowIso(),
      outlineItem: item,
      selectedText,
      selection,
      question: body.question.trim(),
      answer: result.answer,
      blocked: result.blocked,
      charged,
      overPlan,
      stage: result.stage,
      type: result.type,
      before: draft,
    };

    return {
      rec: { ...withDraft(rec, draft, q.time), questions: [...rec.questions, q] },
      result: {
        blocked: result.blocked,
        charged,
        acornNo,
        answer: result.answer,
        item: { outlineItem: item, planned, used: used[item - 1] },
        overPlan,
      },
    };
  });

  return Response.json(res);
});
