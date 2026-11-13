# 06. 데이터 구조

> 한 줄 요약: 학생 1명의 응시 기록을 JSON 파일 하나(`data/attempts/<학생ID>.json`)로 저장하며, 실제 구조의 기준은 `src/lib/store.ts`의 `AttemptRecord`입니다. PDF 6장 JSON은 변경 전 기록으로 남깁니다. (PDF 6장 + 팀 결정 반영)
>
> 관련 문서: [05-api](./05-api.md) · [API.md](./API.md) · [03-teacher-report](./03-teacher-report.md) · [07-llm-prompts](./07-llm-prompts.md)

> **기준은 코드입니다.** 저장 구조는 `src/lib/store.ts`, API 타입은 `src/lib/types.ts`.

## 저장 방식

| 항목 | 내용 |
|---|---|
| 위치 | `data/attempts/<학생ID>.json` (git에서 제외: `.gitignore`의 `/data/`) |
| 단위 | 학생(응시) 1명당 파일 1개. `attemptId` = 학생 ID |
| 동시 저장 | 학생마다 쓰기 대기열로 순서대로 저장 |
| 교체 | 웹 배포 시 `store.ts`의 load/save/list만 바꾸면 Supabase로 교체 가능 (`supabase/schema.sql`은 확장용 초안) |

## AttemptRecord (응시 기록 전체)

| 필드 | 타입 | 의미 | 언제 채워지는지 |
|---|---|---|---|
| `attemptId` | string | 응시 ID (= 학생 ID) | `POST /api/exam/start` |
| `student` | `{ id, name }` | 가상 학생 | `POST /api/exam/start` |
| `verified` | boolean | 본인 확인(모의) 여부 | `POST /api/exam/start` |
| `startedAt` | string (ISO) | 시작 시각 | `POST /api/exam/start` |
| `outline` | string[4] \| null | 개요 4항목에 학생이 쓴 내용 | `POST /api/outline` |
| `acornPlan` | number[4] \| null | 🔄 개요 항목별 도토리 **목표** (0~10) | `POST /api/outline` (첫 질문 이후 잠김) |
| `draft` | string | 마지막으로 저장된 글 | `POST /api/draft` (10초마다), `POST /api/ask` |
| `draftSavedAt` | string (ISO) \| null | 글 저장 시각 | 위와 같음 |
| `questions` | QuestionRecord[] | 질문 기록 | `POST /api/ask`마다 1건 추가 |
| `final` | string \| null | 제출한 글 | `POST /api/submit` |
| `reflection` | string[4] \| null | 성찰 질문 ①~④ 답 | `POST /api/submit` |
| `submittedAt` | string (ISO) \| null | 제출 시각 | `POST /api/submit` |

개요 항목 이름(주제·배경지식 / 문법·어휘 / 해석과 근거 / 비평과 고쳐쓰기)은 기록에 넣지 않고 `exam-config.ts`의 `outlineItems`에 고정되어 있다.

## QuestionRecord (질문 1건)

| 필드 | 타입 | 의미 | 비고 |
|---|---|---|---|
| `acornNo` | number \| null | 몇 번째 도토리인지 | 차단이면 `null` |
| `time` | string (ISO) | 질문 시각 | 🔄 PDF는 `"22:10"` 형식 |
| `outlineItem` | 1~4 | 어느 개요 항목에 대한 질문인지 | 학생이 선택 |
| `selectedText` | string | 드래그한 글 | 드래그 없이 질문하면 `""` |
| `selection` | `{ start, end }` \| null | 🆕 선택 위치 (텍스트 시작·끝) | PDF 8장 반영 |
| `question` | string | 학생 질문 | |
| `answer` | string | AI 답, 차단이면 되묻기 문구 | `[BLOCKED]` 표식은 저장하지 않음 |
| `blocked` | boolean | 대신 작성 요청으로 차단되었는지 | |
| `charged` | boolean | 🆕 도토리를 썼는지 | `!blocked` |
| `overPlan` | boolean | 🆕 이 질문으로 그 항목이 목표를 넘겼는지 | 기록만, 질문은 막지 않음 |
| `stage` | string \| null | 쓰기 단계 | 분류 실패 시 `null` |
| `type` | string \| null | 질문 방식 | 분류 실패 시 `null` |
| `before` | string | 질문 직전 글 전체 | |

`after`(질문 직후 글)는 **저장하지 않는다.** 리포트를 만들 때 "다음 질문의 `before`, 마지막 질문이면 제출한 글"로 계산한다. 분류의 `reason`도 저장하지 않는다.

## 계산해서 만드는 값 (저장하지 않음)

| 값 | 계산 방법 | 쓰는 곳 |
|---|---|---|
| 항목별 사용 수 `acornsUsed` | `charged`인 질문을 `outlineItem`별로 셈 | 학생 화면, 성찰지 그래프, 리포트 |
| `after` | 다음 질문 `before` 또는 `final` | 교사 리포트 전후 비교 |
| `diff` | `before` ↔ `after`를 diff-match-patch로 비교 (`same`/`add`/`del`) | 교사 리포트 |
| `sentences[].path` | 문장 유사도 판정 (`self`/`revised`/`ai`) | 교사 리포트 |
| `blockedCount` | `blocked`인 질문 수 | 교사 리포트, 반 전체 |

## PDF 6장 JSON (변경 전 기록)

PDF 원문입니다. **지금 구조와 다릅니다** (`exam.maxAnswerSentences` 삭제, `after` 미저장, `acornPlan`·`selection`·`charged`·`overPlan` 추가 등). 기록용으로만 남깁니다.

```json
{
  "exam": { "title": "「진달래꽃」 비평문 쓰기", "maxAnswerSentences": 3 },
  "student": { "id": "S07", "name": "가상학생07" },
  "outline": ["이별을 대하는 화자의 태도", "'즈려밟고'의 뜻", "반어로 읽는 근거", "내 평가와 결론"],
  "questions": [
    {
      "acornNo": 2, "time": "22:10", "outlineItem": 3,
      "selectedText": "물론 꽃을 뿌려 주며 …",
      "question": "제 둘째 문단에서 근거가 약한 부분을 하나만 짚어 주세요.",
      "answer": "…", "blocked": false,
      "stage": "고쳐쓰기", "type": "글 점검 요청",
      "before": "질문 직전 글 전체", "after": "질문 직후 글 전체"
    }
  ],
  "final": "제출한 글", "reflection": ["…", "…", "…", "…"]
}
```
