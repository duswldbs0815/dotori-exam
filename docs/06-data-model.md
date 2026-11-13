# 06. 데이터 구조

> 한 줄 요약: 학생 1명의 응시 기록(시험·학생·개요·질문 목록·최종 글·성찰지)을 하나의 JSON으로 저장하며, 아래는 PDF 원문과 필드별 설명입니다. (PDF 6장)
>
> 관련 문서: [05-api](./05-api.md) · [03-teacher-report](./03-teacher-report.md) · [07-llm-prompts](./07-llm-prompts.md) · [08-tech-stack](./08-tech-stack.md)

## JSON 원문

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

- 저장: JSON 파일 (시연용, 8장)

## 필드 설명

"언제 채워지는지"는 5장 API 설명에서 도출했습니다. PDF에 명시되지 않은 부분은 TBD입니다.

### 최상위

| 필드 | 타입 | 의미 | 언제 채워지는지 |
|---|---|---|---|
| `exam` | object | 시험 정보 | TBD(확인 필요) — 시험 생성 기능/API는 PDF에 없음 |
| `exam.title` | string | 시험 제목 | 위와 같음 |
| `exam.maxAnswerSentences` | number | AI 답 최대 문장 수 (3) | 위와 같음 |
| `student` | object | 응시 학생 (가상 학생) | `POST /exam/start` (추정, TBD) |
| `student.id` | string | 학생 ID (예: `S07`) | 위와 같음 |
| `student.name` | string | 학생 이름 (예: `가상학생07`) | 위와 같음 |
| `outline` | string[4] | 개요 4항목에 학생이 쓴 내용 (순서대로 ①~④) | `POST /outline` |
| `questions` | object[] | 질문 기록 목록 | `POST /ask` 때마다 1건 추가 |
| `final` | string | 제출한 최종 글 | `POST /submit` |
| `reflection` | string[4] | 성찰 질문 ①~④에 대한 답 | `POST /submit` |

### `questions[]` 항목

| 필드 | 타입 | 의미 | 언제 채워지는지 |
|---|---|---|---|
| `acornNo` | number | 도토리 번호 (몇 번째 도토리인지) | `/ask` 도토리 차감 시. 차단된 질문의 값: TBD |
| `time` | string (`"HH:MM"`) | 질문 시각 | `/ask` (날짜·시간대 포함 여부 TBD) |
| `outlineItem` | number (1~4) | 질문이 어느 개요 항목에 대한 것인지 | `/ask` (학생이 질문 시 선택) |
| `selectedText` | string | 학생이 드래그해 선택한 글 | `/ask` |
| `question` | string | 학생 질문 | `/ask` |
| `answer` | string | AI 답 (차단 시 되묻기 문구) | `/ask` 답변 생성 |
| `blocked` | boolean | 대신 작성 요청으로 차단되었는지 | `/ask` 차단 판별 |
| `stage` | string | 쓰기 단계 (계획하기 / 내용 생성 / 내용 조직 / 표현하기 / 고쳐쓰기) | `/ask` 분류 (P1) |
| `type` | string | 질문 방식 (사실 확인 요청 / 생각 확장 요청 / 글 점검 요청 / 대신 작성 요청) | `/ask` 분류 (P1) |
| `before` | string | 질문 직전 글 전체 | `/ask` 직전 글 저장 |
| `after` | string | 질문 직후 글 전체 | 다음 `/ask` 또는 `/submit` 때, 마지막 `/draft` 글로 채움 |

## PDF 다른 장에는 있지만 JSON에 필드가 없는 값

| 값 | 근거 | 상태 |
|---|---|---|
| 선택 위치 (텍스트 시작·끝 위치) | 8장 | 필드명 TBD(확인 필요) |
| 분류 이유 `reason` | 7장 ② 출력 | 저장 여부·위치 TBD(확인 필요) |
| 본인 확인 기록 | 5장 `/exam/start` | 필드명 TBD(확인 필요) |
| 첫 글 / 글 스냅숏 (`/draft`) | 2장·5장 | 저장 형태 TBD(확인 필요) |
| 남은 도토리 수 / 총개수 | 3·4장, 11장 | 상한 미정, 필드명 TBD(확인 필요) |
| 문장별 작성 경로 | 3장, 7장 ③ | 필드명 TBD(확인 필요) |
| 개요 4항목의 고정 이름 (주제·배경지식 등) | 3장 | JSON에는 학생 작성 내용만 있음 — 항목 이름 저장 여부 TBD |
