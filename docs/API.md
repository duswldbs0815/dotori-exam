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

## 입력 길이 제한 🔄
너무 긴 입력은 HTTP 413 `{ "error": "글은 5,000자까지 쓸 수 있어요." }`처럼 막습니다. (`src/lib/limits.ts`)

| 항목 | 최대 |
|---|---|
| 이름 | 20자 |
| 글 (`draft.text`, `ask.draft`, `submit.final`) | 5,000자 |
| 질문 | 500자 |
| 선택한 부분 (`selectedText`) | 2,000자 |
| 개요 항목 하나 | 500자 |
| 성찰지 답 하나 | 2,000자 |
| 요청 하나 전체 | 100,000자 (넘으면 "보낸 내용이 너무 커요.") |

→ 프론트는 입력칸에 `maxLength`를 같은 값으로 걸어 두면 됩니다.

## 전체 흐름

| 단계 | 학생 화면 | 호출 |
|---|---|---|
| 시작 | 본인 확인(페이스페이 모의) + 기록 안내 | `POST /api/exam/start` |
| 🔄 수행평가 탭 | 과제·지문 + 내 글, 10초마다 자동 저장 → 제출 | `POST /api/draft`, `POST /api/submit` (`reflection: ["","","",""]`) |
| 🔄 AI 질문 탭 | 드래그(선택) → 항목 고르기 → 질문 (확인 창 없음) | `POST /api/ask` |
| (예전) ① 개요 | 🔄 11/14 학생 화면에서 없앰. API는 예전 기록 호환용으로 남음 | `POST /api/outline` |
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
질문 하나를 처리합니다. 🔄 11/14: 확인 창 없이 바로 부르고, 개요·도토리 계획이 없어도 됩니다 (예전엔 409). `overPlan`은 예전처럼 계획이 있는 기록에서만 true가 될 수 있습니다.

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

응답 (앞 질문의 답을 기다리는 중에 또 질문함) → HTTP 429 🔄
```json
{ "error": "앞 질문의 답을 기다리는 중이에요. 답이 나온 뒤에 다시 질문해 주세요." }
```
→ 프론트는 답을 기다리는 동안 질문 버튼을 잠가 두면 이 오류를 볼 일이 없습니다.

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

## 교사 로그인 (🔄 11/14: 과목 담당 교사 계정)
교사 API(`/api/teacher/...`, `/api/report/...`)는 **교사 로그인 쿠키가 있어야** 응답합니다. 없으면 HTTP 401 `{ "error": "교사 계정으로 로그인해 주세요." }`. 학생은 학번·이름으로만 시작하고 로그인이 없습니다. 실제 도입 시에는 슈퍼스쿨 계정 로그인으로 바꿉니다.

- 교사 한 명 = 과목 하나. 계정은 가상 교사 4명(국어·과학·사회·영어)으로 `src/lib/teachers.ts`에 있고, 비밀번호는 scrypt 해시만 둡니다. 시연 비밀번호는 팀 안에서만 공유합니다.
- 🔄 **담당 과목만 보기**: 교사 홈·반 리포트·학생 리포트·채점·CSV·수업 단서는 로그인한 교사 과목의 수행평가만 돌려줍니다. 다른 과목 기록은 HTTP 404 (있는지 없는지도 숨김). 수행평가 만들기·AI 기준 제안도 담당 과목만 (다른 과목이면 403).
- `GET /api/teacher/school`은 담당 과목 수행평가와 그 반들만, 그리고 `teacher` `{ id, name, subject }`를 함께 돌려줍니다.

| API | 용도 |
|---|---|
| `POST /api/teacher/login` `{ "id": "kor@dotori.school", "password": "…" }` | 맞으면 `{ "teacher": true, "account": { id, name, subject } }` + 로그인 쿠키(12시간). 틀리면 401 `{ "error": "아이디나 비밀번호가 맞지 않아요." }`. 🔄 **5번 틀리면 5분 잠금** → HTTP 429 |
| `GET /api/teacher/me` | `{ "teacher": true, "account": {…} }` 또는 `{ "teacher": false }` |
| `POST /api/teacher/logout` | 로그아웃 |

- 🔄 11/14: 교사 코드 하나로 들어가던 방식과 `GET /api/teacher/enter`(코드 바로가기 링크)는 없앴습니다. `.env.local`의 `TEACHER_CODE`는 이제 로그인 쿠키 서명용 서버 비밀값으로만 씁니다.
- 🔄 로그인 쿠키 안에 만료 시각이 들어 있어서 12시간이 지나면 서버가 받아 주지 않습니다 (쿠키가 새어 나가도 계속 쓸 수 없음).
- 🔄 마이페이지 로그인(`POST /api/me/login`)도 같은 곳에서 **같은 학번으로** 5번 틀리면 5분 잠금 → HTTP 429. 학교처럼 IP를 같이 써도 그 학번만 잠깁니다.
- 🔄 `GET /api/health/llm`(AI 연결 확인)은 교사 로그인 후에만 열립니다. `GET /api/health/storage`는 누구나.
- 🔄 모든 화면·API에 기본 보안 헤더(다른 사이트에 끼워 넣기 금지, 파일 형식 위장 금지, 주소 넘김 최소화, 카메라·마이크·위치 사용 안 함)가 붙습니다 (`next.config.ts`).
- 🔄 잠금은 같은 곳(IP)에서 틀린 횟수로 셉니다. 학교처럼 모두 같은 IP를 쓰면 학생이 일부러 틀려서 잠글 수 있으므로, 실제 도입 시에는 슈퍼스쿨 계정 로그인으로 바꿉니다.
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
  ],
  "timelapse": {
    "start": "2026-11-14T09:00:00+09:00",
    "source": "log",
    "edits": [
      { "t": "2026-11-14T09:04:10+09:00", "at": 0, "del": 0, "ins": "김소월의 「진달래꽃」은" },
      { "t": "2026-11-14T09:12:30+09:00", "at": 120, "del": 0, "ins": "한 번에 들어온 긴 글…", "paste": true }
    ]
  }
}
```
- 메모 붙이기: 각 질문의 `selectedText`를 `final`에서 찾아 그 위치 옆에 메모를 붙입니다. 못 찾으면 글 맨 끝 여백에 붙입니다. (글이 바뀌면 숫자 위치는 어긋나므로 문장으로 찾습니다.)
- `after`: 다음 질문 직전 글, 마지막 질문이면 제출한 글
- `stage`: 계획하기 / 내용 생성 / 내용 조직 / 표현하기 / 고쳐쓰기
- `type`: 사실 확인 요청 / 생각 확장 요청 / 글 점검 요청 / 대신 작성 요청
- 🔄 `timelapse` (글쓰기 과정 다시 보기, 교사 전용): 빈 글에 `edits`를 차례로 적용하면 최종 글이 됩니다. 각 수정은 "`at` 위치에서 `del`글자를 지우고 `ins`를 넣음". `paste: true`는 20초 안에 80자 이상이 한 번에 생긴 구간 (판정이 아니라 확인할 구간 표시). `source: "snapshots"`는 저장 기록이 없는 예전 응시라 질문 직전 글과 최종 글로 만든 것
- `sentences[].path`: 문장별 작성 경로 (교사가 참고할 단서이며 판정이 아님. 화면에 "참고용" 안내를 붙여 주세요)
  - `self`: 스스로 작성 (첫 질문 전부터 있던 문장, 또는 질문 뒤에 썼지만 AI 답과 관계없는 문장)
  - `revised`: 질문 후 AI 답의 내용을 자기 말로 반영
  - `ai`: AI 답과 70% 이상 같음 (AI 답변 활용)
  - 판정 방식: ① 1차(즉시): AI 답에서 처음 나온 내용과 겹치는지 글자 비교 ② 2차(제출 직후 뒤에서): AI가 문장마다 판정해 저장. 2차 결과가 저장되기 전(제출 직후 몇 초)에는 1차 결과가 내려갑니다.

## 기록 지우기 (교사, 🆕 11/14)
학기 말 정리용. **영구 삭제라 되돌릴 수 없어요.** 실수 방지로 확인 값을 한 번 더 받습니다.

| API | 용도 |
|---|---|
| `POST /api/report/class/delete` `{ "classId": "2-1", "examId": "kor2", "confirm": "2-1" }` | 한 반·한 수행평가의 학생 기록 전부 지움. `confirm`은 반 이름과 같아야 함. 응답 `{ "ok": true, "deleted": 25 }` |
| `DELETE /api/report/:attemptId` `{ "confirm": "20105" }` | 학생 한 명의 기록 지움 (전학, 응시 취소, 테스트 기록). `confirm`은 학번(또는 응시 ID) |

- 교사 로그인 필요 (없으면 401). 확인 값이 다르면 400.
- 수행평가 자체(과제·기준)는 남습니다. 그 반의 "다음 수업 단서" 저장본도 같이 지웁니다.
- 화면: 반 화면 맨 아래 "기록 정리" (`src/components/teacher/DeleteRecords.tsx`). 지우기 전에 채점표 CSV를 내려받을 수 있고, 반 이름을 입력해야 버튼이 켜짐.

## GET /api/report/class/insights (교사, 🆕 수업 단서)
`?classId=2-1&examId=kor2` — 한 반·한 수행평가의 학생 질문을 AI가 3~5개 묶음으로 정리하고, 다음 수업 제안을 붙입니다.
- 학생 이름·학번은 AI에 보내지 않습니다 (질문 글, 개요 항목, 분류만).
- `students`·`questions`(몇 명·몇 개)는 AI가 아니라 서버가 직접 셉니다.
- 처음 한 번만 15~20초 걸리고, 결과는 저장해 둡니다 (Supabase `dotori_insights` 표 / 로컬은 `data/insights/`). 서버가 바뀌어도 바로 뜹니다.
- 🔄 그사이 새 질문이 생기면 **저장된 결과를 바로 돌려주고**(`stale: true`) 새 결과는 뒤에서 만들어 저장합니다. 다음에 열면 바뀐 결과가 나옵니다.
- 표 만들기: `supabase/insights.sql`을 SQL Editor에서 한 번 실행. 표가 없어도 동작은 하지만 서버 메모리에만 저장됩니다.
- 질문이 3개 미만이면 `source: "none"`, AI 연결 실패면 `source: "error"` (화면은 카드를 숨기거나 안내 문구).

응답
```json
{
  "cards": [
    {
      "title": "옛말 어휘 뜻을 확인하는 질문",
      "detail": "'역겨워', '즈려밟고'처럼 지금과 쓰임이 다른 말의 뜻을 몰라 시의 분위기를 잡기 어려워해요.",
      "suggestion": "시의 옛말 표현을 칠판에 적고 짝과 '지금 말로 바꾸면?'을 한 줄씩 적어 보게 해요.",
      "students": 20, "questions": 25, "item": "문법·어휘",
      "examples": ["여기서 '고이'는 무슨 뜻이에요?"],
      "blocked": false
    }
  ],
  "basedOn": { "students": 25, "questions": 146, "blocked": 10 },
  "generatedAt": "2026-11-14T00:00:00.000Z",
  "source": "ai",
  "stale": false
}
```
화면: `src/components/teacher/ClassInsights.tsx` (반 화면 `ClassView.tsx`에 한 줄로 들어감. 빼려면 그 한 줄만 지우면 됨)

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

### 🔄 POST /api/teacher/exams/classes (교사)

`{ "examId": "kor2", "classIds": ["2-1","2-2"], "closedClassIds": ["2-2"] }` → `{ classIds, closedClassIds }`. 담당 과목 수행평가만 (아니면 404). `classIds`는 배포한 반(하나 이상), `closedClassIds`는 그중 마감한 반. 마감한 반은 `GET /api/exams` 목록에서 빠지고 `exam/start`로 **새로** 시작할 수 없음 (HTTP 403 "선생님이 이 반 수행평가를 마감했어요."). 기록·채점은 그대로. 설정은 `dotori_exams` 표에 `cls__시험ID` 줄로 저장 (기본 제공 수행평가도 바꿀 수 있게).

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

## 🔄 채점 (11/14 추가, 교사)

타입은 `src/lib/types.ts`의 `Grade`, `GradeRequest`, `CheckFlag`, 단계 목록은 `src/lib/grading.ts`의 `GRADE_SCALES`.

### POST /api/report/:studentId/grade
`{ scale: "3" | "5" | "pf" | "points", max?, itemMax?, items: (string|number|null)[], ai?, comment }`
- `scale`: `3` 상·중·하 / `5` A~E / `pf` 통과·미통과 / `points` 점수 (`max` = 항목당 만점, 기본 25)
- 🔄 `itemMax`: 항목별 배점 (점수일 때, `items`와 같은 길이). 있으면 항목 i의 만점은 `itemMax[i]`
- `items`: 개요 항목 수만큼. 단계 이름 또는 점수, 아직 안 매겼으면 `null`
- `ai`: 교사가 "AI 활용" 항목을 켰을 때만
- `comment`: 나이스·세특에 옮길 평가 근거 한 줄 (500자)
- 화면에서 누를 때마다 자동 저장. 응답 `{ grade }`
- 학생 리포트 응답에 `grade`, `grading`(수행평가 기본 단계, `itemMax?`), 🔄 `criteria?`(항목별 채점 기준), 🔄 `aiGrade`(AI 1차 채점 제안, 없으면 `null`), `flags`(먼저 확인할 점)가 함께 옵니다.

### 🔄 POST /api/report/:studentId/ai-grade (11/14)
AI 1차 채점. 본문 없음. 응답 `{ aiGrade: { scale, max?, itemMax?, items, reasons, at } }`
- 교사가 정한 **채점 기준(`criteria`)만** 보고 제출한 글을 항목마다 채점한 **제안**. 항목마다 학생 글을 인용한 이유 한 문장(`reasons`)
- AI 사용량·붙여넣기·차단 같은 과정 정보와 학생 이름·학번은 AI에 보내지 않음. 과정은 `flags`(숫자·사실)로만 보여 주고 판단은 교사가 함
- 제출한 글이 있어야 함 (없으면 400). 같은 글·같은 채점 방식이면 저장해 둔 제안을 그대로 돌려줌 (AI 다시 안 부름). 글이 바뀌면 리포트의 `aiGrade`는 `null`
- 교사 채점(`grade`)과 따로 저장. 화면에서 "적용"을 눌러야 교사 채점에 들어감

### 🔄 POST /api/report/class/accept-ai (11/14)
`{ classId, examId }` → `{ accepted: string[], skipped: { flagged, graded, noAi } }`
- 확인할 점(`flags`)이 **없는** 학생 중 AI 제안이 있고 아직 교사 채점이 없는 학생만, AI 제안을 교사 채점으로 확정
- 확인할 점이 있는 학생·이미 채점한 학생·제안이 없는 학생은 건너뜀 → 교사가 학생 리포트에서 직접 확인
- 화면에서 "확정한 점수의 책임은 선생님께 있어요" 확인 창을 거침. 확정 후에도 학생 리포트에서 고칠 수 있음

### GET /api/report/class/csv?classId=&examId=
반 채점표 CSV (엑셀에서 바로 열리게 UTF-8 BOM). 학번, 이름, 제출, 채점 단계, 항목별 값, (AI 활용), (합계), 평가 근거, 질문 수, 차단 수, 확인할 점.

### 먼저 확인할 점 (`flags`, 판정 아님)
| code | 조건 |
|---|---|
| `paste` | 타임랩스에서 20초 안에 80자 이상 한꺼번에 들어온 구간 |
| `blocked` | 대신 써 달라는 요청 2번 이상 |
| `over` | 🔄 선생님 권장 질문 수(항목별 권장 도토리 합)보다 질문 4개 이상 많음. 학생은 계획을 세우지 않으므로 계획 대신 권장 수와 비교 (예전 기록도 같은 기준). 수행평가를 정해 부를 때만 계산 |
| `ai` | AI 답과 70% 이상 비슷한 문장 2개 이상 |

수행평가를 만들 때 `POST /api/teacher/exams`에 `grading: { scale, max?, itemMax? }`를 넣으면 그 수행평가의 기본 채점 단계가 됩니다. 🔄 `criteria`(항목마다 채점 기준 한 줄, 400자, 4개)도 함께 넣으면 학생 리포트 채점 칸과 AI 1차 채점에 쓰입니다. AI 기준 제안(`suggest`)도 `criteria`를 채워 줍니다.
