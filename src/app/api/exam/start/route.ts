import { EXAM_CONFIG } from "@/lib/exam-config";
import { fail, handle, nowIso, readJson } from "@/lib/http";
import { isValidId, updateAttempt } from "@/lib/store";
import type { StartRequest, StartResponse } from "@/lib/types";

export const POST = handle(async (req: Request) => {
  const body = await readJson<StartRequest>(req);
  if (!isValidId(body.studentId)) fail(400, "학번은 영문·숫자·-·_ 1~32자여야 해요.");
  if (typeof body.name !== "string" || !body.name.trim()) fail(400, "이름이 필요해요.");

  await updateAttempt(body.studentId, (rec) => {
    if (rec) {
      // 같은 학번 + 같은 이름이면 이어서, 이름이 다르면 다른 사람이 들어온 것으로 보고 막음
      if (rec.student.name !== body.name.trim()) fail(409, "학번과 이름이 맞지 않아요. 다시 확인해 주세요.");
      return { rec: null, result: null };
    }
    return {
      rec: {
        attemptId: body.studentId,
        student: { id: body.studentId, name: body.name.trim() },
        verified: Boolean(body.verified),
        startedAt: nowIso(),
        outline: null,
        acornPlan: null,
        draft: "",
        draftSavedAt: null,
        questions: [],
        final: null,
        reflection: null,
        submittedAt: null,
      },
      result: null,
    };
  });

  const res: StartResponse = { attemptId: body.studentId, exam: EXAM_CONFIG };
  return Response.json(res);
});
