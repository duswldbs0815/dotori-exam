# 도토리 시험지 API

프론트(학생 시험지, 교사 리포트)와 백엔드가 맞추는 약속입니다. 타입은 `src/lib/types.ts`에 같은 이름으로 있습니다.

- 주소는 모두 `/api/...` (Next.js API Route)
- 요청·응답은 JSON
- 실패하면 HTTP 4xx/5xx와 `{ "error": "사람이 읽을 메시지" }`
- 🔄 수행평가가 여러 개입니다. 기본은 「진달래꽃」 감상문(`kor2`)이고, 가상 학교 시나리오(`src/data/school.json`)와 교사가 만든 수행평가가 더해집니다. `exam/start`에 `examId`, `classId`를 주면 그 시험으로 시작합니다 (없으면 kor2, 2-3반).
- **도토리 개수는 시험이 정하지 않습니다.** 학생이 ① 개요 단계에서 항목마다 "이 활동에 몇 개 쓸지" **목표치**를 스스로 정하고, ③ 성찰지에서 목표와 실제 사용을 비교합니다.
- 목표치는 한도가 아닙니다. **넘겨도 그대로 계속 질문할 수 있고**, 추가 경고 창도 띄우지 않습니다. 화면에는 `사용 3 / 목표 2`처럼 숫자만 보여 주고, 넘긴 사실은 기록(`overPlan`)만 해서 성찰과 리포트에 씁니다.
- AI 답변 길이는 제한하지 않습니다. 대신 써 달라는 요청만 차단합니다.
- 🔄 도토리는 **상한·잔액이 없습니다** (교사팀 자료, 11/13). `acornPlanMaxPerItem`(99, 입력 오류 방지)과 `acornSafetyCap`(100, 장난 방지)은 화면에 보여 주지 않는 안전장치이고 `src/lib/exam-config.ts`에서 바꿉니다. 프론트는 숫자를 직접 쓰지 말고 `exam/start` 응답의 `exam` 값을 씁니다.
- **학생 화면 응답에는 분류(stage, type), 작성 경로, 전후 비교를 넣지 않습니다.** 교사 리포트 API에서만 내려갑니다.

## 전체 흐름

| 단계 | 학생 화면 | 호출 |
|---|---|---|
| 시작 | 본인 확인(페이스페이 모의) + 기록 안내 | `POST /api/exam/start` |
| ① 개요 | 4항목 입력 + 항목별 도토리 계획 | `POST /api/outline` |
| ② 글쓰기 | 10초마다 자동 저장 | `POST /api/draft` |
| ② 글쓰기 | 드래그 → 항목 선택 → 도토리 확인 → 질문 | `POST /api/ask` |
| ③ 성찰지 | 항목별 계획 vs 실제 도토리 그래프 + 성찰 4문항 | `GET /api/attempt/:attemptId`, `POST /api/submit` |
| 새로고침 | 상태 복원 | `GET /api/attempt/:attemptId` |
| 교사 | 학생 리포트 | `GET /api/report/:studentId` |
| 교사 | 반 전체 (P2) | `GET /api/report/class` |

---

## POST /api/exam/start
응시를 시작합니다. 학생은 **학번 + 이름**을 입력합니다 (별도 비밀번호 없음).
- 같은 학번 + 같은 이름으로 다시 부르면 기존 응시를 이어서 씁니다 (새로고침, 기기 바꿈).
- 같은 학번인데 이름이 다르면 HTTP 409 `{ "error": "학번과 이름이 맞지 않아요. 다시 확인해 주세요." }`

**학생 열쇠 쿠키** 🔄
- 시작에 성공하면 서버가 그 브라우저에 **학생 열쇠 쿠키**(`dotori_student`, 6시간)를 줍니다. 자바스크립트로 읽을 수 없는 쿠키라 프론트는 신경 쓸 필요 없습니다.
- 이후 `outline`, `draft`, `ask`, `attempt/:attemptId`, `submit`은 **이 쿠키가 있어야** 됩니다. 없거나 남의 것이면 HTTP 403 `{ "error": "이 시험지를 열 권한이 없어요. 처음 화면에서 시험을 다시 시작해 주세요." }` → 프론트는 403을 받으면 시작 화면으로 보내 주세요.
- 학번만 알아서는 남의 시험지를 열거나 고칠 수 없게 하려는 것입니다.
- 다시 시작하면 새 열쇠가 나오고, 이전 브라우저의 열쇠는 더 이상 통하지 않습니다 (기기를 바꾸면 이어서 쓰기 가능, 동시에 두 곳은 불가).
- 프론트는 같은 사이트에서 `fetch("/api/…")`로 부르면 쿠키가 자동으로 붙습니다.

요청
```json
{ "studentId": "30907", "name": "박서윤", "verified": true }
```
- `studentId`: 학번 (영문·숫자·`-`·`_` 1~32자). 이 값이 `attemptId`가 됩니다.
- `verified`: 페이스페이(모의) 본인 확인을 거쳤는지

응답
```json
{
  "attemptId": "S07",
  "exam": {
    "title": "김소월 「진달래꽃」 감상문 쓰기",
    "outlineItems": ["주제·배경지식", "문법·어휘", "해석과 근거", "비평과 고쳐쓰기"],
    "reflectionQuestions": ["계획한 도토리 사용과 실제 사용은 어떻게 달랐나요? …", "가장 도움이 되었던 AI 질문은 …", "AI의 답변을 받은 뒤 내 글은 …", "다음 수행평가에서는 …"],
    "acornPlanMaxPerItem": 99,
    "acornSafetyCap": 100
  }
}
```

## POST /api/outline
개요 4항목과 **항목별 도토리 계획**을 저장합니다 (AI 없이 작성). 글쓰기 시작 전까지는 다시 불러서 고칠 수 있고, 첫 질문 이후에는 계획이 잠깁니다.

요청
```json
{
  "attemptId": "S07",
  "outline": ["이별을 대하는 화자의 태도", "'즈려밟고'의 뜻", "반어로 읽는 근거", "내 평가와 결론"],
  "acornPlan": [1, 1, 2, 2]
}
```
- `acornPlan[i]`: 개요 i+1번 항목에 쓰겠다고 계획한 도토리 수 (예상 질문 횟수. 0 이상, `acornPlanMaxPerItem` 이하. 상한이 아니라 화면에 "최대 N개"로 보여 주지 않음)

응답
```json
{ "ok": true }
```

## POST /api/draft
글쓰기 창의 현재 글을 저장합니다. 글쓰기 단계에서 **10초마다**, 그리고 제출 직전에 부릅니다. 바뀐 게 없으면 서버가 저장을 건너뜁니다.

요청
```json
{ "attemptId": "S07", "text": "글쓰기 창의 글 전체" }
```

응답
```json
{ "ok": true, "savedAt": "2026-11-14T10:12:30+09:00" }
```

## POST /api/ask
질문 하나를 처리합니다. 프론트는 "도토리 1개를 사용할까요?" 확인을 받은 뒤 부릅니다. 목표를 넘겼는지와 상관없이 같은 확인 하나만 씁니다.

서버 처리 순서: 대신 작성 요청인지 판별 → 차단이면 되묻기 답(도토리 사용 안 함) → 아니면 답변 생성 (글을 대신 써 주지 않도록 지시) → 질문 분류 → 질문 직전 글 저장 → 그 항목의 사용 수 +1 (목표를 넘겼으면 `overPlan: true`로 기록만 함)

요청
```json
{
  "attemptId": "S07",
  "question": "제 둘째 문단에서 근거가 약한 부분을 하나만 짚어 주세요.",
  "outlineItem": 3,
  "selectedText": "물론 꽃을 뿌려 주며 …",
  "selection": { "start": 120, "end": 168 },
  "draft": "질문하는 순간의 글쓰기 창 글 전체"
}
```
- `outlineItem`: 1~4 (어느 개요 항목에 대한 질문인지)
- `selectedText`, `selection`: 드래그한 부분. 드래그 없이 질문하면 빈 문자열과 `null`

응답 (정상)
```json
{
  "blocked": false, "charged": true, "acornNo": 2, "answer": "AI 답",
  "item": { "outlineItem": 3, "planned": 2, "used": 1 },
  "overPlan": false
}
```

응답 (목표보다 많이 씀: 질문은 평소처럼 처리됨)
```json
{
  "blocked": false, "charged": true, "acornNo": 5, "answer": "…",
  "item": { "outlineItem": 3, "planned": 2, "used": 3 },
  "overPlan": true
}
```

응답 (차단: 대신 써 달라는 요청, 도토리 사용 안 함)
```json
{
  "blocked": true, "charged": false, "acornNo": null,
  "answer": "이 시험에서는 글을 대신 써 줄 수 없어요. 어느 부분에서 막혔는지 알려 주세요.",
  "item": { "outlineItem": 3, "planned": 2, "used": 1 },
  "overPlan": false
}
```

응답 (개요·계획을 아직 안 냄) → HTTP 409
```json
{ "error": "개요와 도토리 계획을 먼저 작성해 주세요." }
```

응답 (안전 상한 도달) → HTTP 429
```json
{ "error": "이번 시험에서 질문할 수 있는 횟수를 모두 썼어요." }
```

## GET /api/attempt/:attemptId
학생 화면 상태 (새로고침 복원, ①개요 표의 계획·사용 수, ②도토리 창고, ③성찰지 계획 vs 실제 그래프).

응답
```json
{
  "attemptId": "S07",
  "outline": ["…", "…", "…", "…"],
  "acornPlan": [1, 1, 2, 2],
  "acornsUsed": [0, 1, 1, 0],
  "draft": "마지막으로 저장된 글",
  "questions": [
    { "acornNo": 1, "time": "22:05", "outlineItem": 2, "question": "…", "answer": "…", "blocked": false }
  ],
  "submitted": false
}
```

## POST /api/submit
최종 글과 성찰지를 제출합니다. 제출 후에는 질문과 글 저장이 막힙니다.

요청
```json
{ "attemptId": "S07", "final": "제출한 글", "reflection": ["① …", "② …", "③ …", "④ …"] }
```

응답
```json
{ "ok": true, "submittedAt": "2026-11-14T10:40:00+09:00" }
```

---

## 교사 로그인 (해커톤용 간이 인증)
리포트 API 2개(`/api/report/...`)는 **교사 로그인 쿠키가 있어야** 응답합니다. 없으면 HTTP 401 `{ "error": "교사 코드로 로그인해 주세요." }`. 학생은 학번·이름으로만 시작하고 로그인이 없습니다. 실제 도입 시에는 슈퍼스쿨 계정 로그인으로 바꿉니다.

| API | 용도 |
|---|---|
| `POST /api/teacher/login` `{ "code": "교사 코드" }` | 맞으면 `{ "ok": true }` + 로그인 쿠키(12시간). 틀리면 401 |
| `GET /api/teacher/me` | `{ "teacher": true/false }`. 교사 화면 첫 진입 때 로그인 창을 띄울지 판단 |
| `POST /api/teacher/logout` | 로그아웃 |
| `GET /api/teacher/enter?code=…&next=/teacher` | 슈퍼스쿨 "바로가기" 링크용. 코드가 맞으면 로그인 후 `next` 주소로 이동, 틀리면 `next?login=failed`로 이동 |

- 교사 코드는 `.env.local`의 `TEACHER_CODE`에 있습니다.
- 쿠키는 브라우저가 알아서 보내므로, 프론트는 같은 사이트에서 `fetch("/api/report/…")`만 하면 됩니다.

## GET /api/report/:studentId (교사)
학생 한 명의 리포트입니다. 교사 로그인 필요.

응답
```json
{
  "student": { "id": "S07", "name": "가상학생07" },
  "exam": { "title": "김소월 「진달래꽃」 감상문 쓰기", "outlineItems": ["…", "…", "…", "…"], "reflectionQuestions": ["…"], "acornPlanMaxPerItem": 99, "acornSafetyCap": 100 },
  "outline": ["…", "…", "…", "…"],
  "final": "제출한 글",
  "reflection": ["…", "…", "…", "…"],
  "submittedAt": "2026-11-14T10:40:00+09:00",
  "acorns": { "planned": [1, 1, 2, 2], "used": [0, 1, 3, 0], "totalPlanned": 6, "totalUsed": 4 },
  "blockedCount": 1,
  "questions": [
    {
      "acornNo": 2,
      "time": "22:10",
      "outlineItem": 3,
      "selectedText": "물론 꽃을 뿌려 주며 …",
      "question": "제 둘째 문단에서 근거가 약한 부분을 하나만 짚어 주세요.",
      "answer": "…",
      "blocked": false,
      "stage": "고쳐쓰기",
      "type": "글 점검 요청",
      "before": "질문 직전 글 전체",
      "after": "질문 직후 글 전체",
      "diff": [
        { "op": "same", "text": "…" },
        { "op": "del", "text": "삭제된 부분 (빨강)" },
        { "op": "add", "text": "추가된 부분 (초록)" }
      ]
    }
  ],
  "sentences": [
    { "text": "제출한 글의 한 문장", "path": "self" },
    { "text": "…", "path": "revised", "acornNo": 2 },
    { "text": "…", "path": "ai", "acornNo": 2 }
  ]
}
```
- 메모 붙이기: 각 질문의 `selectedText`를 `final`에서 찾아 그 위치 옆에 메모를 붙입니다. 못 찾으면 글 맨 끝 여백에 붙입니다. (글이 바뀌면 숫자 위치는 어긋나므로 문장으로 찾습니다.)
- `after`: 다음 질문 직전 글, 마지막 질문이면 제출한 글
- `stage`: 계획하기 / 내용 생성 / 내용 조직 / 표현하기 / 고쳐쓰기
- `type`: 사실 확인 요청 / 생각 확장 요청 / 글 점검 요청 / 대신 작성 요청
- `sentences[].path`: 문장별 작성 경로 (교사가 참고할 단서이며 판정이 아님. 화면에 "참고용" 안내를 붙여 주세요)
  - `self`: 스스로 작성 (첫 질문 전부터 있던 문장, 또는 질문 뒤에 썼지만 AI 답과 관계없는 문장)
  - `revised`: 질문 후 AI 답의 내용을 자기 말로 반영
  - `ai`: AI 답과 70% 이상 같음 (AI 답변 활용)
  - 판정 방식: ① 1차(즉시): AI 답에서 처음 나온 내용과 겹치는지 글자 비교 ② 2차(제출 직후 뒤에서): AI가 문장마다 판정해 저장. 2차 결과가 저장되기 전(제출 직후 몇 초)에는 1차 결과가 내려갑니다.

## GET /api/report/class (교사, 🔄 P1)
반 전체 집계입니다. 교사 로그인 필요. 🔄 `?classId=2-3&examId=kor2`로 한 반·한 수행평가만 볼 수 있고, 그때 응답에 `exam`(항목 이름·권장 도토리)이 들어가며 `students[].attemptId`로 학생 리포트를 엽니다.

응답
```json
{
  "students": [
    { "studentId": "S07", "name": "가상학생07", "totalPlanned": 6, "totalUsed": 4, "blockedCount": 1, "submitted": true }
  ],
  "matrix": {
    "stages": ["계획하기", "내용 생성", "내용 조직", "표현하기", "고쳐쓰기"],
    "types": ["사실 확인 요청", "생각 확장 요청", "글 점검 요청", "대신 작성 요청"],
    "counts": [[0, 1, 0, 0], [0, 2, 0, 0], [0, 0, 0, 0], [1, 0, 0, 0], [0, 0, 3, 0]]
  },
  "acornsByOutlineItem": { "planned": [4, 6, 9, 7], "used": [3, 5, 12, 6] },
  "blockedTotal": 4
}
```
- `counts[i][j]` = `stages[i]` 단계에서 `types[j]` 방식으로 한 질문 수

---

## 🔄 가상 학교·수행평가 만들기 (11/14 추가)

타입은 `src/lib/types.ts`의 `ExamDef`, `ExamSuggestion`, `SaveExamRequest`, `ClassExamsResponse`, `SchoolOverviewResponse`.

### GET /api/exams?classId=2-3
학생 시작 화면용. 그 반에 열린 수행평가 목록 (`ClassExamsResponse`). 학생용이라 교사 전용 값(`avoid`, 올린 자료)은 빼고 내려갑니다.

### GET /api/teacher/school (교사)
학교 전체 현황 (`SchoolOverviewResponse`): 반마다 수행평가별 응시 수, 제출 수, 차단 요청 수, 평균 도토리.

### POST /api/teacher/exams/suggest (교사)
`multipart/form-data`: `subject`, `grade`, `task`(필수), `unit`, `notes`, `pasted`(붙여 넣은 자료), `files`(PDF·TXT·MD, 5개, 모두 합쳐 4MB까지).
AI가 자료와 채점기준표를 읽고 개요 4항목, 항목별 `itemGuides`(`help` AI가 도와도 되는 일 / `avoid` 하지 않을 일 / `acorns` 권장 도토리), 성찰 질문, 제안 이유를 돌려줍니다 (`ExamSuggestion`). AI 연결이 없거나 실패하면 같은 과목 예시로 대신하고 `source: "preset"`.

### POST /api/teacher/exams (교사)
`SaveExamRequest`(제안을 교사가 고친 값 + `classIds`)를 저장하고 바로 배포. 응답 `{ exam: ExamDef }`, 새 ID는 `t` + 6자리.

## 🔄 내 학습 기록 (학생 마이페이지, 11/14 추가)

타입은 `src/lib/types.ts`의 `MyPageResponse`, `MyAttempt`, `MeLoginRequest`. 학생 로그인은 서명한 쿠키 `dotori_me`(학번·이름)로 기억합니다. `POST /api/exam/start`도 이 쿠키를 함께 심습니다.

### POST /api/me/login
`{ studentId, name }`. 그 학번·이름으로 된 응시 기록이 있어야 로그인됩니다 (없으면 404). 페이스페이는 화면만 있는 모의 확인.

### GET /api/me
로그인한 학생의 응시 목록 (`MyPageResponse`). **학생용 값만** 내려갑니다: 개요, 도토리 계획·사용, 질문·답, 차단 여부, 글자 수, 제출 여부. 교사용 메모·분류·작성 경로는 넣지 않습니다. 로그인 전이면 401.

### POST /api/me/logout
`dotori_me` 쿠키 삭제.

성장 도토리와 다람쥐 꾸미기 아이템 계산은 화면 쪽 `src/lib/growth.ts` (계획 5, 질문 1개당 2(최대 10), 제출 30, 성찰 10, 계획에 가깝게 10, 차단 없음 5 → 레벨 0/30/60/100/150).

## 🔄 지문 (passage)

`ExamInfo.passage = { title, author?, body, source? }`. `exam/start` 응답의 `exam`에 들어가고 (`GET /api/exams` 목록에는 제목만), 학생 화면 개요·글쓰기 옆에 보입니다. AI 튜터 지시문에도 지문(최대 3000자)이 들어갑니다. `POST /api/teacher/exams`에 `passage`를 넣으면 저장됩니다.
