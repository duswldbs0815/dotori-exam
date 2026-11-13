import { clearMeCookie } from "@/lib/auth";
import { handle } from "@/lib/http";

export const POST = handle(async () => {
  await clearMeCookie();
  return Response.json({ ok: true });
});
