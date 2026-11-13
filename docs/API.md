# 도토리 시험지 API

프론트(학생 시험지, 교사 리포트)와 백엔드가 맞추는 약속입니다. 타입은 `src/lib/types.ts`에 같은 이름으로 있습니다.

- 주소는 모두 `/api/...` (Next.js API Route)
- 요청·응답은 JSON
- 실패하면 HTTP 4xx/5xx와 `{ "error": "사람이 읽을 메시지" }`
- 시험은 하나로 고정: 「진달래꽃」 비평문 쓰기
- **도토리 개수는 시험이 정하지 않습니다.** 학생이 ① 개요 단계에서 항목마다 "이 활동에 몇 개 쓸지" **목표치**를 스스로 정하고, ③ 성찰지에서 목표와 실제 사용을 비교합니다.
- 목표치는 한도가 아닙니다. **넘겨도 그대로 계속 질문할 수 있고**, 추가 경고 창도 띄우지 않습니다. 화면에는 `사용 3 / 목표 2`처럼 숫자만 보여 주고, 넘긴 사실은 기록(`overPlan`)만 해서 성찰과 리포트에 씁니다.
- AI 답변 길이는 제한하지 않습니다. 대신 써 달라는 요청만 차단합니다.
- 안전 상한(`acornPlanMaxPerItem`, `acornSafetyCap`)은 `src/lib/exam-config.ts`에서 바꿉니다. 프론트는 숫자를 직접 쓰지 말고 `exam/start` 응답의 `exam` 값을 씁니다.
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
응시를 시작합니다. 같은 학생이 다시 부르면 기존 응시를 돌려줍니다.

요청
```json
{ "studentId": "S07", "name": "가상학생07", "verified": true }
```

응답
```json
{
  "attemptId": "S07",
  "exam": {
    "title": "「진달래꽃」 비평문 쓰기",
    "outlineItems": ["주제·배경지식", "문법·어휘", "해석과 근거", "비평과 고쳐쓰기"],
    "acornPlanMaxPerItem": 10,
    "acornSafetyCap": 30
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
- `acornPlan[i]`: 개요 i+1번 항목에 쓰겠다고 계획한 도토리 수 (0 이상, `acornPlanMaxPerItem` 이하)

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

## GET /api/report/:studentId (교사)
학생 한 명의 리포트입니다.

응답
```json
{
  "student": { "id": "S07", "name": "가상학생07" },
  "exam": { "title": "「진달래꽃」 비평문 쓰기", "outlineItems": ["…", "…", "…", "…"], "acornPlanMaxPerItem": 10, "acornSafetyCap": 30 },
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
- `sentences[].path` (P1, 문장 유사도로 판정)
  - `self`: 스스로 작성
  - `revised`: 질문 후 학생이 자기 말로 수정
  - `ai`: AI 답과 70% 이상 같음 (AI 답변 활용)

## GET /api/report/class (교사, P2)
반 전체 집계입니다.

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
