# 도토리 시험지

AI 사용의 흔적이 남는 수행평가 플랫폼. 2026 INHA AX-EDU 해커톤 팀 도토리.

학생은 시험지 안의 AI에게 정해진 질문 한도 안에서 질문할 수 있고, AI는 정답 대신 개념·방향·검토만 답합니다. 모든 질문, 답변, 질문 전후의 글, 최종 답안이 기록되고, 교사는 결과물과 과정을 함께 보고 평가합니다. 결과 보고서는 슈퍼스쿨로 옮깁니다.

## 흐름

1. 교사: 시험 만들기 (문항, 정답, 채점 기준, 질문 한도, AI 규칙)
2. 학생: 응시 (본인 인증 → 잠금 모드) → AI에게 질문 → 최종 답안 제출
3. 평가: AI 가채점 (답안 + 과정) → 교사 확정
4. 보고서: 학생별 결과 보고서 → 슈퍼스쿨

## 개발 시작

```bash
npm install
cp .env.example .env.local   # 키 채우기 (커밋 금지)
npm run dev
```

DB 초안은 `supabase/schema.sql`에 있습니다. Supabase SQL Editor에서 실행하세요.

## API (프론트·백엔드 합의용)

| 우선 | API | 기능 |
|---|---|---|
| 1 | `POST /api/exams`, `GET /api/exams/:id` | 시험 만들기, 조회 |
| 1 | `POST /api/attempts/start` | 응시 시작 (질문 한도 세팅) |
| 1 | `POST /api/chat` | 질문 처리: 분류 → 정답 요구면 코칭(차감 없음) → 답변 생성 → 서버 검사 → 저장·차감 |
| 1 | `POST /api/snapshots` | 10초 자동 저장, 질문 시점 저장 |
| 1 | `POST /api/attempts/:id/submit` | 최종 답안 제출 |
| 2 | `POST /api/attempts/:id/grade` | AI 가채점 |
| 2 | `PATCH /api/grades/:id` | 교사 점수 확정, 코멘트 |
| 2 | `GET /api/exams/:id/dashboard` | 학생 상태, 단계 × 방식 질문 지도, 문제별 질문 배분 |
| 2 | `GET /api/attempts/:id/report` | 학생 리포트 데이터 |
| 3 | `POST /api/events` | 붙여넣기, 창 이탈 기록 |
| 3 | `GET /api/attempts/:id/report.pdf` | 보고서 PDF |

## 주의

- API 키와 `.env.local`은 절대 커밋하지 않습니다.
- `exam_items.answer_key`는 서버에서만 쓰고 학생 화면으로 보내지 않습니다.
