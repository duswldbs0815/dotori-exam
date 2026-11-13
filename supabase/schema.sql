-- 도토리 시험지 저장소 (Supabase / Postgres)
-- Supabase 대시보드 > SQL Editor에 붙여 넣고 한 번 실행하면 됩니다.
-- 서버(service_role 키)만 읽고 쓰도록 RLS를 켜고 정책은 만들지 않습니다. (브라우저 anon 키로는 접근 불가)
-- 예전 설계 초안은 schema-draft-v0.sql

create table if not exists dotori_attempts (
  id text primary key,                 -- 응시 기록 ID (학번 또는 학번_시험ID)
  class_id text not null,              -- "2-3"
  exam_id text not null,               -- "kor2"
  data jsonb not null,                 -- AttemptRecord 전체 (src/lib/store.ts)
  updated_at timestamptz not null default now()
);
create index if not exists dotori_attempts_class_exam on dotori_attempts (class_id, exam_id);

create table if not exists dotori_exams (
  id text primary key,                 -- 교사가 만든 수행평가 ID (t + 6자리)
  data jsonb not null,                 -- ExamDef 전체 (src/lib/types.ts)
  updated_at timestamptz not null default now()
);

alter table dotori_attempts enable row level security;
alter table dotori_exams enable row level security;

-- "새 표 자동 공개"를 끈 프로젝트에서도 서버 키(service_role)로는 읽고 쓸 수 있게
grant select, insert, update, delete on dotori_attempts, dotori_exams to service_role;
