# 08. 기술 제안

> 한 줄 요약: 화면은 웹, 서버는 Node 또는 FastAPI, AI는 대회 제공 LLM API, 전후 비교는 diff 라이브러리, 저장은 JSON 파일을 제안하며 모두 개발자 판단으로 변경 가능합니다. (PDF 8장)
>
> 관련 문서: [01-architecture](./01-architecture.md) · [06-data-model](./06-data-model.md) · [11-decisions-schedule](./11-decisions-schedule.md)

> **개발자 판단으로 변경 가능** — PDF 8장 제목 그대로. 아래는 제안이며 확정이 아닙니다.

## 제안 표

| 영역 | 제안 (PDF 원문) | 비고 |
|---|---|---|
| 화면 | 웹 (React 또는 HTML+JS) | 글 선택 위치는 **텍스트의 시작·끝 위치로 저장** |
| 서버 | Node 또는 Python (FastAPI) | |
| AI | 대회 제공 LLM API | 모델/키 발급 방법 TBD(확인 필요) |
| 전후 비교 | diff 라이브러리 (예: diff-match-patch) | 추가 초록 / 삭제 빨강 (3장) |
| 저장 | JSON 파일 (시연용) | 구조는 [06-data-model](./06-data-model.md) |
| 디자인 시안 | 캔버스 「도토리 시험지 · 학생 화면」, 「전체 틀」 참고 | 시안 위치/링크 TBD(확인 필요) |

## 현재 저장소 상태 (참고, PDF 외 정보)

PDF와 비교하기 위해 저장소 현황만 적습니다. 결정은 [확인 필요 목록](./11-decisions-schedule.md#확인-필요-목록)에서 합니다.

| 항목 | 저장소 현재 | PDF 제안 |
|---|---|---|
| 화면 | Next.js 16 + React 19 (`package.json`) | React 또는 HTML+JS → 범위 안 |
| 서버 | Next.js (Node) | Node 또는 FastAPI → 범위 안 |
| 저장 | `supabase/schema.sql` (Supabase/Postgres 초안), `.env.example`에 Supabase 키 | JSON 파일 (시연용) → **다름** |
| LLM | `.env.example`: `LLM_API_KEY`, `LLM_MODEL` (안농GPT API 가능 여부 확인 후 결정) | 대회 제공 LLM API |

- Next.js는 이 저장소에서 학습 데이터와 다른 버전일 수 있음 — 코드 작성 전 `AGENTS.md` 안내대로 `node_modules/next/dist/docs/`를 확인.
