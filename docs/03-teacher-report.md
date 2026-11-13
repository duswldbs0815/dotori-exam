# 03. 교사 리포트 화면

> 한 줄 요약: 교사 리포트는 학생 글에 질문 위치마다 여백 메모를 달고, 메모를 누르면 AI 답과 질문 전후 비교(추가 초록/삭제 빨강)를 펼치며, 문장별 작성 경로 3종과 도토리 목표 vs 실제, 반 전체 집계를 보여 줍니다. (PDF 3장 + 팀 결정 반영)
>
> 관련 문서: [02-student-screens](./02-student-screens.md) · [05-api](./05-api.md) · [API.md](./API.md) · [06-data-model](./06-data-model.md) · [07-llm-prompts](./07-llm-prompts.md)

## 화면 영역

| 영역 | 내용 | 우선순위 | 데이터 (`GET /api/report/:studentId`) |
|---|---|---|---|
| 학생 글 보기 | 제출된 글 + 질문한 위치마다 **여백 메모** (도토리 번호 · 시간 · 질문 · 분류) | P0 (분류 표시는 P1) | `final`, `questions[]` |
| 메모 클릭 | 그 질문의 **AI 답**, **질문 직전 글**, **질문 직후 글** (추가 **초록**, 삭제 **빨강**) | P0 | `answer`, `before`, `after`, `diff` |
| 🆕 도토리 요약 | 항목별 목표 vs 실제 사용, 합계, 차단 수 | P0 | `acorns`, `blockedCount` |
| 작성 경로 | 문장마다 색 표시: **스스로 작성 / 질문 후 수정 / AI 답변 활용** | P1 | `sentences[]` |
| 반 전체 | 🔄 교사 첫 화면 요약: 숫자 카드(제출·평균 도토리·차단·차단 학생), 개요 항목별 도토리 합계(목표·사용), 질문 방식 분포 | P1 (11/13 P2에서 올림) | `GET /api/report/class` |

- 교사 리포트 진입: 슈퍼스쿨 교사 홈 **바로가기 링크** (2장)
- 응답 형식 상세: [API.md](./API.md)

## 1. 학생 글 + 여백 메모

| 메모 항목 | 필드 |
|---|---|
| 도토리 번호 | `questions[].acornNo` (차단이면 `null`) |
| 시간 | `questions[].time` |
| 질문 | `questions[].question` |
| 분류 | `questions[].stage`, `questions[].type` (분류 실패 시 `null`) |

메모 붙이는 방법 (API.md):

- 각 질문의 `selectedText`를 `final`에서 **문장으로 찾아** 그 위치 옆에 붙인다.
- 못 찾으면 글 맨 끝 여백에 붙인다.
- 숫자 위치(`selection`)는 글이 바뀌면 어긋나므로 메모 위치에 쓰지 않는다.
- 차단된 질문도 `questions[]`에 있으므로 메모로 표시된다 (`blocked: true`).

## 2. 메모 클릭 → 전후 비교

```
[메모 클릭]
 ├─ AI 답            ← questions[].answer
 ├─ 질문 직전 글      ← questions[].before
 ├─ 질문 직후 글      ← questions[].after  (다음 질문의 직전 글, 마지막이면 제출한 글)
 └─ 비교             ← questions[].diff
     · op "add": 초록
     · op "del": 빨강
     · op "same": 기본색
```

- diff는 서버에서 diff-match-patch로 계산해 내려준다 (의미 단위로 정리됨).

## 3. 작성 경로 3색

| 작성 경로 | 값 | 판정 (`src/lib/report.ts`) | 색 |
|---|---|---|---|
| 스스로 작성 | `self` | 첫 질문 직전 글에 이미 있던 문장 | TBD(확인 필요) |
| 질문 후 수정 | `revised` | 어떤 질문 뒤에 처음 생긴 문장 중, 그 질문의 AI 답과 유사도 70% 미만 | TBD(확인 필요) |
| AI 답변 활용 | `ai` | 위와 같은 문장 중, AI 답과 유사도 70% 이상 | TBD(확인 필요) |

- `revised`·`ai` 문장에는 관련 도토리 번호(`acornNo`)가 붙는다.
- 판정은 교사가 볼 **단서**일 뿐 표절 판정이 아니다.
- PDF는 "색 표시"만 정함. 전후 비교의 초록/빨강과 겹치지 않는 3가지 색을 정해야 함: TBD(확인 필요)

## 4. 반 전체 집계 (🔄 P1, 교사 첫 화면)

`GET /api/report/class` (서버 코드 있음, 화면은 P2):

| 집계 | 필드 |
|---|---|
| 학생별 요약 (목표 합·사용 합·차단 수·제출 여부) | `students[]` |
| 쓰기 단계 × 질문 방식 | `matrix.counts[i][j]` (행: stage 5종, 열: type 4종) |
| 개요 항목별 도토리 합계 (목표·사용) | `acornsByOutlineItem` |
| 차단된 요청 수 | `blockedTotal` |
