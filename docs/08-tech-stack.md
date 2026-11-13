# 08. 기술 스택

> 한 줄 요약: PDF 기술 제안(개발자 판단으로 변경 가능)과, 그 범위 안에서 실제로 정한 스택(Next.js 16 + React 19, BAZE LLM, diff-match-patch, JSON 파일 저장)을 정리했습니다. (PDF 8장 + 팀 결정 반영)
>
> 관련 문서: [01-architecture](./01-architecture.md) · [06-data-model](./06-data-model.md) · [11-decisions-schedule](./11-decisions-schedule.md)

> **개발자 판단으로 변경 가능** — PDF 8장 제목 그대로.

## PDF 제안과 지금 결정

| 영역 | PDF 제안 | 지금 (저장소 기준) |
|---|---|---|
| 화면 | 웹 (React 또는 HTML+JS). 글 선택 위치는 텍스트의 시작·끝 위치로 저장 | Next.js 16 + React 19 + Tailwind 4. 선택 위치는 `selection: { start, end }` |
| 서버 | Node 또는 Python (FastAPI) | Next.js API Route (Node) `src/app/api/**` |
| AI | 대회 제공 LLM API | BAZE API Gateway, OpenAI 호환 `/chat/completions` (`src/lib/llm.ts`). 환경 변수 `LLM_API_URL`, `LLM_API_KEY`, `LLM_MODEL`, `LLM_MODEL_FAST` |
| 전후 비교 | diff 라이브러리 (예: diff-match-patch) | diff-match-patch (`src/lib/report.ts`) |
| 작성 경로 | AI 답과 유사도 | 글자 2개 단위 유사도, 70% 이상이면 "AI 답변 활용" |
| 저장 | JSON 파일 (시연용) | 🔄 배포: Supabase `attempts` 표 (`supabase/attempts.sql`) / 로컬: `data/attempts/<학생ID>.json`. 환경 변수로 자동 선택 |
| 디자인 시안 | 캔버스 「도토리 시험지 · 학생 화면」, 「전체 틀」 참고 | 시안 위치/링크 TBD(확인 필요) |

## 개발 메모

- 시연은 **로컬 실행 + JSON 파일**. 웹 배포 시에는 `src/lib/store.ts`의 load/save/list만 Supabase로 바꾼다.
- `src/lib/llm.ts`, `tutor.ts`, `store.ts`, `report.ts`는 **서버 전용**이다. 클라이언트 컴포넌트에서 import하지 않는다.
- Next.js는 이 저장소에서 학습 데이터와 다른 버전일 수 있다. 코드 작성 전 `AGENTS.md` 안내대로 `node_modules/next/dist/docs/`를 확인한다.
- API 키, `.env.local`, `.claude/settings.local.json`은 커밋하지 않는다.
