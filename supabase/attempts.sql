-- 도토리 시험지: 배포용 저장소 (Supabase)
-- Supabase 대시보드 > SQL Editor 에 붙여 넣고 Run 한 번이면 됩니다.
-- 학생 1명 = 한 줄. 응시 기록 전체(AttemptRecord)를 data 칸에 JSON 그대로 저장합니다.

create table if not exists public.attempts (
  id         text primary key,              -- 학번 (= attemptId)
  data       jsonb not null,                -- 응시 기록 전체
  version    integer not null default 0,    -- 동시에 고칠 때 덮어쓰기 방지용 번호
  updated_at timestamptz not null default now()
);

-- 서버(service_role 키)만 읽고 쓰게 막아 둡니다.
-- 정책(policy)을 하나도 만들지 않으면 브라우저용 anon 키로는 아무것도 못 읽습니다.
alter table public.attempts enable row level security;
