@AGENTS.md

# 도토리 시험지 — 작업 규칙

## 기준 문서

- `docs/`가 이 프로젝트의 **기준 문서**다. 원본 계획서는 `docs/source/도토리시험지_구현계획.pdf`, 그 이후 팀 결정은 docs에 🔄로 표시되어 있다.
- 기능을 만들기 전에 **해당 문서를 먼저 읽는다.** 목차와 읽는 순서는 `docs/README.md`.
  - 학생 화면 → `docs/02-student-screens.md`
  - 교사 리포트 → `docs/03-teacher-report.md`
  - 서버 API → `docs/API.md` (요청·응답 기준), `docs/05-api.md`, `docs/06-data-model.md`, `docs/07-llm-prompts.md`
- 코드와 문서가 다르면 코드가 기준이다: `src/lib/types.ts`(API 타입), `src/lib/tutor.ts`(LLM 지시문), `src/lib/exam-config.ts`(시험 설정). 코드를 바꾸면 문서도 함께 고친다.
- 문서에 `TBD(확인 필요)`로 표시된 부분은 임의로 정하지 말고 사용자에게 확인한다. 목록은 `docs/11-decisions-schedule.md`의 "확인 필요 목록".

## 구현 우선순위

- **P0 기능부터** 구현한다. 그다음 P1. (`docs/04-features.md`)
- **P2는 발표 설명용이므로 구현하지 않는다.** (슈퍼스쿨 실연동, 페이스페이 실연동). 🔄 반 전체 요약 화면은 11/13 P1로 올려 구현함. 🔄 11/14: 가상 학교·수행평가 만들기(AI 기준 제안)·리포트 PDF·슈퍼스쿨 모의 전송 추가
- 🔄 11/14: 교사 계정 = 과목 하나 담당 (`src/lib/teachers.ts`, 서버 전용). 교사 API는 `requireTeacher()`가 돌려준 교사 과목의 수행평가·기록만 다룬다 (`requireSubject`). 교사 화면: 홈 `/teacher`, 내 수행평가 `/teacher/exams`, 설계 사례 `/teacher/cases`
- 🔄 11/14: 학생 화면은 **[수행평가 | AI 질문] 두 탭**뿐 (`WriteStep.tsx`). 개요·도토리 계획·성찰지 단계는 없앰. 교사 커뮤니티 사례는 `src/data/community.json`·`src/lib/community.ts`(가상 학교·교사). 강조색은 `leaf`(초록), 갈색은 도토리 그림에만
- 🔄 11/14: 학생 마이페이지 `/me`(쿠키 `dotori_me`, 성장·꾸미기 `src/lib/growth.ts`), 지문 패널(`ExamInfo.passage`). `/me` 응답에도 메모·분류·작성 경로를 넣지 않는다.
- 저장은 `src/lib/store.ts`·`exams.ts` → Supabase 환경 변수가 있으면 `src/lib/db.ts`, 없으면 `data/` JSON 파일

## 반드시 지킬 것

- **학생 화면에는 메모·분류·작성 경로를 절대 노출하지 않는다.** 학생용 API 응답에도 이 값들을 넣지 않는다.
- **가상 학생 데이터만 사용한다.** (예: `S07` / `가상학생07`) 실제 학생 정보를 넣지 않는다.
- 도토리 숫자(목표 최대값, 안전 상한)는 화면에 직접 쓰지 않고 `exam/start` 응답의 `exam` 값을 쓴다.
- `src/lib/llm.ts`, `tutor.ts`, `store.ts`, `report.ts`, `exams.ts`, `db.ts`, `teachers.ts`, `auth.ts`는 서버 전용이다. 클라이언트 컴포넌트에서 import하지 않는다.
