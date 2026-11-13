# 도토리 시험지

AI 사용의 흔적이 남는 수행평가 프로그램. 2026 INHA AX-EDU 해커톤 팀 도토리.

학생은 「진달래꽃」 감상문을 쓰다가 시험지 안의 AI에게 도토리 1개씩 내고 질문합니다. AI는 질문에 답하되, 글을 대신 써 달라는 요청은 차단합니다(도토리 차감 없음). 질문한 위치·시간·질문·답과 질문 전후의 글이 기록되어, 교사에게만 리포트로 보입니다.

## 흐름

1. 시험 시작: 본인 확인(페이스페이 모의) + 기록 안내
2. ① 개요: 4항목 작성 (AI 없이)
3. ② 글쓰기: 문장을 드래그해 질문 → 도토리 1개 사용 → AI 답
4. ③ 성찰지: 항목별 도토리 그래프 + 성찰 4문항 → 제출
5. 교사 리포트: 글 + 여백 메모 → 메모를 누르면 질문 전후 비교

## 개발 시작

```bash
npm install
cp .env.example .env.local   # 키 채우기 (커밋 금지)
npm run dev
```

- AI 호출: `src/lib/llm.ts` (BAZE API Gateway). 연결 확인은 `GET /api/health/llm`
- 공용 타입: `src/lib/types.ts`
- 시험 설정 (도토리 안전 상한 등): `src/lib/exam-config.ts`
- 저장: `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`가 있으면 **Supabase**, 없으면 **JSON 파일**(`data/attempts/<학생ID>.json`, git 제외). 코드는 `src/lib/store.ts`, 확인은 `GET /api/health/storage`
- 시연용 가상 학생 만들기: `npm run seed:demo` → `S01`~`S03` (교사팀이 만든 가상 데이터 `scripts/demo-data/teacher-demo-students.json`). A: 계획 3·허용 2 / B: 계획 4·허용 11 / C: 계획 5·허용 6·대신 써 달라는 요청 차단 2
- AI 답변·차단·분류: `src/lib/tutor.ts` / 교사 리포트(전후 비교, 작성 경로, 반 집계): `src/lib/report.ts`

## 배포 (Vercel + Supabase)

Vercel 같은 서버리스에서는 파일 저장이 유지되지 않으므로 **Supabase가 꼭 필요합니다.**

1. supabase.com에서 프로젝트 만들기 (무료)
2. SQL Editor에 `supabase/attempts.sql` 내용을 붙여 넣고 Run → `attempts` 표 생성
3. Project Settings > API에서 Project URL과 `service_role` 키 복사
4. Vercel 프로젝트 > Settings > Environment Variables에 아래 값 넣기
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
   - `LLM_PROVIDER`, `LLM_API_URL`, `LLM_API_KEY`, `LLM_MODEL`, `LLM_MODEL_FAST`, `TEACHER_CODE`
5. 배포 후 `https://<주소>/api/health/storage` → `{"ok":true,"storage":"supabase"}` 확인
6. 시연 학생 넣기: 내 컴퓨터 `.env.local`에도 Supabase 두 값을 넣고 `npm run seed:demo` (Supabase에 S01~S03이 들어감)

주의: 교사 코드 잠금(5번 틀리면 5분)과 "질문 한 번에 하나"는 서버 메모리에 두므로, 서버가 여러 대로 나뉘는 배포 환경에서는 서버마다 따로 셉니다. 시연 규모에서는 문제없습니다.

## API

**[docs/API.md](docs/API.md)** 에 요청·응답 형식이 있습니다. 프론트와 백엔드는 이 문서와 `src/lib/types.ts`를 기준으로 맞춥니다.

| API | 기능 | 우선 |
|---|---|---|
| `POST /api/exam/start` | 응시 시작, 본인 확인 기록 | P0 |
| `POST /api/outline` | 개요 4항목 + 항목별 도토리 계획 저장 | P0 |
| `POST /api/draft` | 글 저장 (10초마다) | P0 |
| `POST /api/ask` | 질문 → 차단 판별 → 답변 → 분류 → 직전 글 저장 → 도토리 차감 | P0 |
| `GET /api/attempt/:attemptId` | 학생 화면 상태 복원, 항목별 도토리 수 | P0 |
| `POST /api/submit` | 최종 글과 성찰지 제출 | P0 |
| `GET /api/report/:studentId` | 교사용 학생 리포트 (메모, 전후 비교, 작성 경로) | P0 |
| `GET /api/report/class` | 교사용 반 전체 집계 | P2 |

## 주의

- API 키, `.env.local`, `.claude/settings.local.json`은 절대 커밋하지 않습니다.
- 학생 화면 응답에는 분류·작성 경로·전후 비교를 넣지 않습니다.
