// 서버 전용: API Route 공통 도우미

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function fail(status: number, message: string): never {
  throw new HttpError(status, message);
}

export async function readJson<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    fail(400, "요청 본문이 올바른 JSON이 아닙니다.");
  }
}

/** 핸들러를 감싸서 HttpError는 그 상태코드로, 나머지는 500으로 { error } 응답 */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (e) {
      if (e instanceof HttpError) return Response.json({ error: e.message }, { status: e.status });
      console.error(e);
      return Response.json({ error: "서버 오류가 발생했어요. 잠시 후 다시 시도해 주세요." }, { status: 500 });
    }
  };
}

export const nowIso = () => new Date().toISOString();
