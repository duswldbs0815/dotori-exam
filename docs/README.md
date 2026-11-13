# 도토리 시험지 — 개발 기준 문서

> 한 줄 요약: 「도토리 시험지」 최종 구현 계획서(PDF)를 개발 기준 문서로 나눠 정리한 목차입니다.
>
> 관련 문서: [원본 PDF](./source/도토리시험지_구현계획.pdf) · [00-overview](./00-overview.md) · [04-features](./04-features.md) · [11-decisions-schedule](./11-decisions-schedule.md)

## 프로젝트 한 줄 소개

**AI 사용의 흔적이 남는 수행평가 프로그램.** AI를 시험지 안에 열어 두고, 학생이 질문할 때마다 도토리 1개를 쓰며, 어디서 무엇을 물었는지와 질문 전후의 글을 기록해 교사에게만 리포트로 보여 준다.

## 문서 목차

| 파일 | PDF 장 | 내용 |
|---|---|---|
| [00-overview.md](./00-overview.md) | 1장 | 한 줄 소개, 문제와 근거 통계, 핵심 아이디어 |
| [01-architecture.md](./01-architecture.md) | 2장 | 구성 요소 7개, 데이터 흐름 다이어그램 |
| [02-student-screens.md](./02-student-screens.md) | 3장 | 학생 시험지: 시험 시작 → ①개요 ②글쓰기 ③성찰지 |
| [03-teacher-report.md](./03-teacher-report.md) | 3장 | 교사 리포트: 여백 메모, 전후 비교, 작성 경로, 반 전체 집계 |
| [04-features.md](./04-features.md) | 4장 | P0/P1/P2 기능과 완료 기준 체크리스트 |
| [05-api.md](./05-api.md) | 5장 | 서버 API 7개, `/ask` 처리 순서 |
| [06-data-model.md](./06-data-model.md) | 6장 | 데이터 구조 JSON 원문과 필드 설명 |
| [07-llm-prompts.md](./07-llm-prompts.md) | 7장 | LLM 지시문 ①②③ 원문, `[BLOCKED]` 처리 |
| [08-tech-stack.md](./08-tech-stack.md) | 8장 | 기술 제안 (개발자 판단으로 변경 가능) |
| [09-demo-scenario.md](./09-demo-scenario.md) | 9장 | 3분 시연 6단계, 가상 학생 A·B·C, 시연 전 체크리스트 |
| [10-assessment-design.md](./10-assessment-design.md) | 10장 | 2차시 운영, 성찰 질문, 원칙 5가지 |
| [11-decisions-schedule.md](./11-decisions-schedule.md) | 11장 | 남은 결정, 일정, **확인 필요 목록** |

자료:

- `source/도토리시험지_구현계획.pdf` — 원본 계획서 (5쪽)
- `assets/sketch-screens.png` — 손그림 화면 틀 (PDF 2쪽에서 추출)

## 문서 읽는 순서

1. **[00-overview](./00-overview.md)** — 왜 만드는지 먼저 이해한다.
2. **[01-architecture](./01-architecture.md)** — 무엇과 무엇이 연결되는지 본다.
3. **[04-features](./04-features.md)** — 무엇부터 만드는지(P0 → P1) 확인한다.
4. 맡은 부분의 상세 문서를 읽는다.
   - 학생 화면 담당: [02-student-screens](./02-student-screens.md)
   - 교사 화면 담당: [03-teacher-report](./03-teacher-report.md)
   - 서버 담당: [05-api](./05-api.md) → [06-data-model](./06-data-model.md) → [07-llm-prompts](./07-llm-prompts.md)
5. **[08-tech-stack](./08-tech-stack.md)** — 기술 선택을 맞춘다.
6. **[09-demo-scenario](./09-demo-scenario.md)** — 시연에서 실제로 보여 줄 흐름을 확인한다.
7. **[10-assessment-design](./10-assessment-design.md)** — 교육 설계 원칙을 확인한다.
8. **[11-decisions-schedule](./11-decisions-schedule.md)** — 마감 일정과 **확인 필요 목록**을 확인한다.

## 표기 규칙

- 모든 내용은 PDF에 근거합니다. PDF에 없는 내용은 **TBD(확인 필요)** 로 표시합니다.
- 7장 LLM 지시문과 6장 JSON은 원문 그대로입니다. 수정하지 마세요.
