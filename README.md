# 도토리 시험지

AI 사용의 흔적이 남는 수행평가 프로그램. 2026 INHA AX-EDU 해커톤 팀 도토리.

학생은 「진달래꽃」 감상문을 쓰다가 시험지 안의 AI에게 도토리 1개씩 내고 질문합니다. AI는 질문에 답하되, 글을 대신 써 달라는 요청은 차단합니다(도토리 차감 없음). 질문한 위치·시간·질문·답과 질문 전후의 글이 기록되어, 교사에게만 리포트로 보입니다.

## 흐름

0. 소개(랜딩) `/`: 현장 문제 통계 → 작동 방식 미니 시연 → 학생 `/start` · 교사 `/teacher` 입장
1. 시험 시작: 본인 확인(페이스페이 모의) + 기록 안내
2. ① 개요: 4항목 작성 (AI 없이)
3. ② 글쓰기: 문장을 드래그해 질문 → 도토리 1개 사용 → AI 답
4. ③ 성찰지: 항목별 도토리 그래프 + 성찰 4문항 → 제출
5. 제출 완료: `홈으로` · `내 학습 기록 보기` 버튼
6. 🔄 내 학습 기록 `/me`: 학번·이름으로 로그인 → 내가 한 수행평가, 계획 vs 실제 도토리, 질문 기록. 학습할수록 성장 도토리가 쌓여 다람쥐 꾸미기 아이템(리본·모자·안경·왕관)이 열림
7. 교사 리포트: 글 + 여백 메모 → 메모를 누르면 질문 전후 비교

시험지 옆에는 지문(예: 「진달래꽃」 전문)이 함께 보입니다. 교사가 수행평가를 만들 때 지문 제목·본문을 넣을 수 있습니다.

가상 학교 「도토리중학교」(1~3학년 각 4반)에서 과목마다 다른 수행평가를 돌립니다. 교사는 과제와 수업 자료·채점기준표를 올리면 AI가 개요 항목별 AI 활용 범위와 권장 도토리 수를 제안하고, 고쳐서 반에 배포합니다. 리포트는 PDF로 저장하거나 슈퍼스쿨로 보내기(시연용 모의 전송)를 할 수 있습니다.

## 개발 시작

```bash
npm install
cp .env.example .env.local   # 키 채우기 (커밋 금지)
npm run dev
```

- AI 호출: `src/lib/llm.ts` (BAZE API Gateway, OpenAI 호환 `/chat/completions`). `.env.local`에 `LLM_API_URL=https://api.baze.co/v1/gateway`, `LLM_API_KEY`(BAZE 대시보드 > API Gateway), `LLM_MODEL`(예: `claude-sonnet-5-5`), `LLM_MODEL_FAST`(예: `claude-haiku-5-5`). 연결 확인은 `GET /api/health/llm`. 키가 없으면 수행평가 제안은 과목별 예시로 대신함
- 공용 타입: `src/lib/types.ts`
- 시험 설정 (도토리 안전 상한 등): `src/lib/exam-config.ts`
- 저장: `SUPABASE_URL`과 `SUPABASE_SERVICE_ROLE_KEY`가 있으면 Supabase(`dotori_attempts`, `dotori_exams` 표, `src/lib/db.ts`), 없으면 로컬 JSON 파일(`data/attempts/`, `data/exams/`, git 제외). 표 만들기는 `supabase/schema.sql`. 어디에 저장 중인지 확인: `GET /api/health/storage` → `"storage":"supabase"`
- 가상 학교 데이터: `npm run seed:school` → 12개 반 가상 학생 응시 기록 (`src/data/school.json`, `scripts/demo-data/school-content.json`). Supabase로 올리기: `npm run push:supabase`
- 타임랩스용 글 변화 기록: `node scripts/add-draft-logs.mjs` → 시드 기록(학생 열쇠가 없는 것)에 10초 저장 기록을 만들어 넣음. 일부(약 8%)는 붙여 넣은 구간 포함. LLM 호출 없음. 시드를 새로 만든 뒤 다시 실행
- 가상 학생 글 변형: `npm run gen:variants -- <examId> <개수>` → 교사팀 S01~S03 장문 데이터를 본보기로 AI가 새 학생 글·질문을 만들어 `scripts/demo-data/generated-variants.json`에 저장. `seed:school`이 이 변형을 섞어 씀 (손으로 쓴 고정 문장 대신). ⚠️ LLM 크레딧을 많이 씀
- 시연용 가상 학생 만들기: `npm run seed:demo` → `S01`~`S03` (교사팀이 만든 가상 데이터 `scripts/demo-data/teacher-demo-students.json`). A: 계획 3·허용 2 / B: 계획 4·허용 11 / C: 계획 5·허용 6·대신 써 달라는 요청 차단 2
- AI 답변·차단·분류: `src/lib/tutor.ts` / 교사 리포트(전후 비교, 작성 경로, 반 집계): `src/lib/report.ts`

## 배포 (Vercel + Supabase)

Vercel 같은 서버리스에서는 파일 저장이 유지되지 않으므로 **Supabase가 꼭 필요합니다.**

1. Supabase 프로젝트를 만들고 SQL Editor에서 `supabase/schema.sql` 실행 → `dotori_attempts`, `dotori_exams` 표
2. Project Settings > API Keys에서 Project URL과 secret 키(`sb_secret_…`) 복사
3. Vercel 환경 변수: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `LLM_API_URL`, `LLM_API_KEY`, `LLM_MODEL`, `LLM_MODEL_FAST`, `TEACHER_CODE`
4. 가상 데이터 넣기: 로컬 `.env.local`에도 Supabase 두 값을 넣고 `npm run seed:demo` (S01~S03), `npm run seed:school && npm run push:supabase` (학교 전체)
5. 배포: `npm run deploy` (git 정보 없이 올림. git 연결 배포는 Hobby 요금제에서 커밋 작성자가 팀원이 아니면 BLOCKED로 멈춤)
6. 확인: `https://<주소>/api/health/storage` → `{"ok":true,"storage":"supabase"}`
7. 교사 자료 업로드는 Vercel 요청 크기 제한 때문에 모두 합쳐 4MB까지
8. 현재 배포: https://dotori-exam.vercel.app (Vercel `cjwksis-projects/dotori-exam`, Supabase `dotori-exam` 프로젝트)

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
| `GET /api/report/class?classId=&examId=` | 교사용 반 전체 집계 (+ 먼저 확인할 점) | P1 |
| `POST /api/report/:studentId/grade` | 교사 채점 저장 (단계 선택, 자동 저장) | P1 |
| `GET /api/report/class/csv?classId=&examId=` | 반 채점표 CSV | P1 |
| `GET /api/me` · `POST /api/me/login` · `POST /api/me/logout` | 학생 내 학습 기록 (학생용 값만) | P1 |
| `GET /api/exams?classId=` | 반에 열린 수행평가 목록 (학생 시작 화면) | P1 |
| `GET /api/teacher/school` | 학교 전체 반·수행평가 진행 현황 | P1 |
| `POST /api/teacher/exams/suggest` | 과제·자료(PDF/TXT/MD)를 읽고 AI 활용 기준 초안 제안 | P1 |
| `POST /api/teacher/exams` | 수행평가 확정·배포 | P1 |

## 주의

- API 키, `.env.local`, `.claude/settings.local.json`은 절대 커밋하지 않습니다.
- 학생 화면 응답에는 분류·작성 경로·전후 비교를 넣지 않습니다.

- 🔄 반 "다음 수업 단서" 저장 표: Supabase SQL Editor에서 `supabase/insights.sql` 한 번 실행 (`dotori_insights`). 없어도 동작하지만 서버가 바뀌면 다시 만들어요.
