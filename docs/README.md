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
| [05-api.md](./05-api.md) | 5장 | 서버 API 8개 요약, `/api/ask` 처리 순서 |
| [API.md](./API.md) | — | **API 요청·응답 상세 명세 (기준, 지윤 작성)** |
| [06-data-model.md](./06-data-model.md) | 6장 | 실제 저장 구조(`AttemptRecord`), PDF JSON(변경 전 기록) |
| [07-llm-prompts.md](./07-llm-prompts.md) | 7장 | 지금 쓰는 지시문 요약, 차단 처리, PDF 원문(변경 전 기록) |
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

- PDF를 바탕으로 쓰고, PDF 이후 팀이 정한 결정(지윤 커밋 `24a7133`, `6a0fa58`)을 반영했습니다.
  - **🔄 변경**: PDF와 달라진 부분 / **🆕**: PDF에 없던 부분
- PDF에도 팀 결정에도 없는 내용은 **TBD(확인 필요)** 로 표시합니다.
- 코드와 문서가 다르면 **코드가 기준**입니다: API는 [API.md](./API.md)와 `src/lib/types.ts`, 지시문은 `src/lib/tutor.ts`, 시험 설정은 `src/lib/exam-config.ts`.
- PDF 원문 지시문과 JSON은 06·07번 문서 끝에 "변경 전 기록"으로 남겨 두었습니다.

### PDF 이후 바뀐 핵심 결정

| 항목 | PDF | 지금 |
|---|---|---|
| 도토리 개수 | 총개수 상한 미정 | 시험이 정하지 않음. 학생이 개요 단계에서 **항목별 목표**를 정하고, 넘겨도 계속 질문 가능(기록만). 🔄 11/13: 상한·잔액 없음, 장난 방지 안전장치(100번)만 화면에 안 보이게 둠. 안전 상한: 항목 목표 최대 10, 전체 질문 30 (학생에게 안 보임) |
| AI 답변 길이 | 3문장 제한 | **최대 세 문장** (한때 삭제 → 11/13 교사팀 자료 기준으로 다시 적용) |
| 성찰지 그래프 | 항목별 도토리 | 항목별 **목표 vs 실제** |
| 저장 | JSON 파일 | `data/attempts/<학생ID>.json` (Supabase는 확장용) |
