import { connection } from "next/server";
import { handle } from "@/lib/http";
import { buildClassReport } from "@/lib/report";
import { listAttempts } from "@/lib/store";

// 교사용 반 전체 집계 (요청할 때마다 새로 계산)
export const GET = handle(async () => {
  await connection();
  return Response.json(buildClassReport(await listAttempts()));
});
