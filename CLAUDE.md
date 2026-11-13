@AGENTS.md

# 도토리 시험지 — 작업 규칙

## 기준 문서

- `docs/`가 이 프로젝트의 **기준 문서**다. 원본은 `docs/source/도토리시험지_구현계획.pdf`.
- 기능을 만들기 전에 **해당 문서를 먼저 읽는다.** 목차와 읽는 순서는 `docs/README.md`.
  - 학생 화면 → `docs/02-student-screens.md`
  - 교사 리포트 → `docs/03-teacher-report.md`
  - 서버 API → `docs/05-api.md`, `docs/06-data-model.md`, `docs/07-llm-prompts.md`
- 문서에 `TBD(확인 필요)`로 표시된 부분은 임의로 정하지 말고 사용자에게 확인한다. 목록은 `docs/11-decisions-schedule.md`의 "확인 필요 목록".
- 루트 `README.md`와 `supabase/schema.sql`은 이전 초안이라 `docs/`와 다르다 (확인 필요 목록 C3·C4).

## 구현 우선순위

- **P0 기능부터** 구현한다. 그다음 P1. (`docs/04-features.md`)
- **P2는 발표 설명용이므로 구현하지 않는다.** (반 전체 집계, 슈퍼스쿨 연동, 페이스페이 실연동)

## 반드시 지킬 것

- **학생 화면에는 메모·분류·작성 경로를 절대 노출하지 않는다.** 학생용 API 응답에도 이 값들을 넣지 않는다.
- **가상 학생 데이터만 사용한다.** (예: `S07` / `가상학생07`) 실제 학생 정보를 넣지 않는다.
- `docs/07-llm-prompts.md`의 LLM 지시문은 원문 그대로 쓴다.
