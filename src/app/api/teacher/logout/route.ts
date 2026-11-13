import { clearTeacherCookie } from "@/lib/auth";
import { handle } from "@/lib/http";
import type { OkResponse } from "@/lib/types";

export const POST = handle(async () => {
  await clearTeacherCookie();
  const res: OkResponse = { ok: true };
  return Response.json(res);
});
