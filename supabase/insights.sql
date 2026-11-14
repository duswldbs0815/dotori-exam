-- 도토리 시험지: 반 "다음 수업 단서" 저장 표 (Supabase SQL Editor에서 한 번 실행)
-- 없어도 앱은 동작하지만(서버 메모리에만 저장), 있으면 배포 환경에서 서버가 바뀌어도 다시 기다리지 않습니다.
create table if not exists dotori_insights (
  id text primary key,                 -- "2-1__kor2" (반__수행평가)
  data jsonb not null,                 -- { sig, res: ClassInsightsResponse }
  updated_at timestamptz not null default now()
);
alter table dotori_insights enable row level security;
grant select, insert, update, delete on dotori_insights to service_role;
