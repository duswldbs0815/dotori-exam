import { newStudentKey, setStudentCookie } from "@/lib/auth";
import { MAX, checkLength } from "@/lib/limits";
import { EXAM_CONFIG } from "@/lib/exam-config";
import { fail, handle, nowIso, readJson } from "@/lib/http";
import { isValidId, updateAttempt } from "@/lib/store";
import type { StartRequest, StartResponse } from "@/lib/types";

// 본인 확인(학번 + 이름, 페이스페이) 후 이 브라우저에 학생 열쇠 쿠키를 발급
export const POST = handle(async (req: Request) => {
  const body = await readJson<StartRequest>(req);
  if (!isValidId(body.studentId)) fail(400, "학번은 영문·숫자·-·_ 1~32자여야 해요.");
  if (typeof body.name !== "string" || !body.name.trim()) fail(400, "이름이 필요해요.");
  const name = body.name.trim();
  checkLength(name, MAX.name, "이름");

  // 들어올 때마다 새 열쇠 발급 (다시 들어오면 이전 브라우저의 열쇠는 더 이상 안 통함)
  const { key, keyHash } = newStudentKey();

  await updateAttempt(body.studentId, (rec) => {
    if (rec) {
      // 같은 학번 + 같은 이름이면 이어서, 이름이 다르면 다른 사람이 들어온 것으로 보고 막음
      if (rec.student.name !== name) fail(409, "학번과 이름이 맞지 않아요. 다시 확인해 주세요.");
      return { rec: { ...rec, keyHash, verified: rec.verified || Boolean(body.verified) }, result: null };
    }
    return {
      rec: {
        attemptId: body.studentId,
        student: { id: body.studentId, name },
        verified: Boolean(body.verified),
        keyHash,
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

  await setStudentCookie(body.studentId, key);
  const res: StartResponse = { attemptId: body.studentId, exam: EXAM_CONFIG };
  return Response.json(res);
});
