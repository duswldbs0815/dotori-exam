import { connection } from "next/server";
import { listAttempts, storageKind } from "@/lib/store";

// 배포 확인용: GET /api/health/storage → 어디에 저장하는지, 연결되는지
export async function GET() {
  await connection(); // 요청할 때마다 새로 확인
  try {
    const count = (await listAttempts()).length;
    return Response.json({ ok: true, storage: storageKind(), count });
  } catch (e) {
    return Response.json({ ok: false, storage: storageKind(), error: (e as Error).message }, { status: 500 });
  }
}
