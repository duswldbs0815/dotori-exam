# 05. 서버 API

> 한 줄 요약: 서버 API 7개(시작·개요·질문·글 저장·제출·학생 리포트·반 집계)와 `/ask` 처리 순서(차단 판별 → 답변 → 분류 → 직전 글 저장 → 도토리 차감)를 정리했습니다. (PDF 5장, "예시")
>
> 관련 문서: [01-architecture](./01-architecture.md) · [06-data-model](./06-data-model.md) · [07-llm-prompts](./07-llm-prompts.md) · [04-features](./04-features.md)

> ⚠️ PDF 5장 제목은 **"서버 API (예시)"** 이며, 요청/응답 본문은 PDF에 없습니다.
> 아래 JSON 예시는 **6장 데이터 구조의 필드 이름만으로 구성한 초안**이며, 형태 전체가 **TBD(확인 필요)** 입니다. PDF에 없는 필드는 만들지 않았고, 필요한데 이름이 없는 값은 `TBD`로 표시했습니다.

## 엔드포인트 목록 (PDF 원문)

| 요청 | 하는 일 |
|---|---|
| `POST /exam/start` | 응시 시작, 본인 확인 기록, 첫 글 저장 |
| `POST /outline` | 개요 4항목 저장 |
| `POST /ask` | 질문 받기 → 차단 판별 → 답변 생성 → 분류 → 직전 글 저장 → 도토리 차감 |
| `POST /draft` | 글 저장 (다음 질문 또는 제출 때 직후 글로 사용) |
| `POST /submit` | 최종 글과 성찰지 제출 |
| `GET /report/:studentId` | 교사용 학생 리포트 |
| `GET /report/class` | 교사용 반 전체 집계 |

공통 TBD: 인증 방식, 에러 응답 형식, URL 접두어(`/api` 등), 학생·교사 구분 방법.

---

## POST /exam/start

응시 시작, 본인 확인 기록, 첫 글 저장.

```jsonc
// 요청 (초안, TBD)
{
  "student": { "id": "S07", "name": "가상학생07" },
  "verified": "TBD",   // 본인 확인 기록 — 필드명/형식 PDF에 없음
  "draft": "TBD"       // 첫 글 — 필드명 PDF에 없음
}
// 응답 (초안, TBD)
{
  "exam": { "title": "「진달래꽃」 비평문 쓰기", "maxAnswerSentences": 3 },
  "acornsLeft": "TBD"  // 도토리 총개수 상한 미정 (11장)
}
```

## POST /outline

개요 4항목 저장.

```jsonc
// 요청 (초안, TBD)
{
  "studentId": "S07",
  "outline": ["이별을 대하는 화자의 태도", "'즈려밟고'의 뜻", "반어로 읽는 근거", "내 평가와 결론"]
}
// 응답: TBD(확인 필요)
```

## POST /ask

질문 처리. 학생에게는 **답(또는 되묻기)과 차단 여부만** 돌려준다 (분류는 학생 화면 비노출).

```jsonc
// 요청 (초안, TBD)
{
  "studentId": "S07",
  "outlineItem": 3,
  "selectedText": "물론 꽃을 뿌려 주며 …",
  "selection": "TBD",  // 텍스트 시작·끝 위치 (8장) — 필드명 PDF에 없음
  "question": "제 둘째 문단에서 근거가 약한 부분을 하나만 짚어 주세요.",
  "before": "질문 직전 글 전체"
}
// 응답 — 일반 (초안, TBD)
{ "acornNo": 2, "answer": "…", "blocked": false }
// 응답 — 차단 (초안, TBD)
{ "answer": "이 시험에서는 글을 대신 써 줄 수 없어요. 어느 부분에서 막혔는지 알려 주세요.", "blocked": true }
```

### `/ask` 처리 순서

1. **차단 판별** — 대신 작성 요청인지 판별 (7장 ①의 `[BLOCKED]` 첫 줄로 판별)
2. **답변 생성** — 3문장 이내 답 (7장 ①). 차단이면 되묻기 문구
3. **분류** — stage / type / reason (7장 ②, P1)
4. **직전 글 저장** — `before`에 질문 직전 글 전체 저장
5. **도토리 차감** — 1개 차감. **차단된 경우 차감하지 않음** (4장)

참고:

- 7장 ①은 "답변 + 차단 (하나로 처리)"이므로 1·2단계는 **LLM 호출 1번**으로 처리된다.
- 차단된 질문에도 3·4단계(분류·직전 글 저장)를 하는지: TBD(확인 필요) — 반 전체 "차단된 요청 수" 집계를 위해 기록 자체는 필요.
- `time`(예: `"22:10"`)은 서버에서 기록하는지 클라이언트에서 보내는지: TBD(확인 필요)

## POST /draft

글 저장. 저장된 글은 **다음 질문 또는 제출 때 직후 글(`after`)** 로 사용된다.

```jsonc
// 요청 (초안, TBD)
{ "studentId": "S07", "draft": "현재 글 전체" }
// 응답: TBD(확인 필요)
```

- 호출 시점(자동 저장 주기, 질문 직전 등): TBD(확인 필요)

## POST /submit

최종 글과 성찰지 제출.

```jsonc
// 요청 (초안, TBD)
{
  "studentId": "S07",
  "final": "제출한 글",
  "reflection": ["…", "…", "…", "…"]
}
// 응답: TBD(확인 필요)
```

## GET /report/:studentId

교사용 학생 리포트. 6장 데이터 구조 전체(메모·분류·전후 글 포함)를 돌려준다고 보는 것이 자연스러우나 응답 형식은 TBD.

```jsonc
// 응답 (초안, TBD) — 6장 구조 그대로
{
  "exam": { "title": "「진달래꽃」 비평문 쓰기", "maxAnswerSentences": 3 },
  "student": { "id": "S07", "name": "가상학생07" },
  "outline": ["…", "…", "…", "…"],
  "questions": [ { "acornNo": 2, "time": "22:10", "outlineItem": 3, "selectedText": "…", "question": "…", "answer": "…", "blocked": false, "stage": "고쳐쓰기", "type": "글 점검 요청", "before": "…", "after": "…" } ],
  "final": "제출한 글",
  "reflection": ["…", "…", "…", "…"],
  "paths": "TBD"  // 문장별 작성 경로 (P1) — 필드 PDF에 없음
}
```

## GET /report/class

교사용 반 전체 집계 (P2).

```jsonc
// 응답 (초안, TBD) — 필드명 모두 PDF에 없음
{
  "stageByType": "TBD",       // 쓰기 단계 × 질문 방식 표
  "acornsByOutlineItem": "TBD", // 개요 항목별 도토리 합계
  "blockedCount": "TBD"       // 차단된 요청 수
}
```
