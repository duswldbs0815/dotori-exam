import { EXAM_CONFIG } from "@/lib/exam-config";
import { fail, handle, nowIso, readJson } from "@/lib/http";
import { isValidId, updateAttempt } from "@/lib/store";
import type { StartRequest, StartResponse } from "@/lib/types";

export const POST = handle(async (req: Request) => {
  const body = await readJson<StartRequest>(req);
  if (!isValidId(body.studentId)) fail(400, "studentId는 영문·숫자·-·_ 1~32자여야 해요.");
  if (typeof body.name !== "string" || !body.name.trim()) fail(400, "이름이 필요해요.");

  await updateAttempt(body.studentId, (rec) => {
    if (rec) return { rec: null, result: null }; // 이미 시작했으면 그대로 이어서
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
