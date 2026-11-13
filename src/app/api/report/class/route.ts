import { requireTeacher } from "@/lib/auth";
import { handle } from "@/lib/http";
import { buildClassReport } from "@/lib/report";
import { listAttempts } from "@/lib/store";

// 교사용 반 전체 집계 (요청할 때마다 새로 계산. 쿠키를 읽으므로 미리 만들어 두지 않음)
export const GET = handle(async () => {
  await requireTeacher();
  return Response.json(buildClassReport(await listAttempts()));
});
