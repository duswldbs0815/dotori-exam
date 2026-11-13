-- 도토리 시험지 DB 초안 (Supabase / Postgres)

create table users (
  id uuid primary key default gen_random_uuid(),
  role text not null check (role in ('teacher', 'student')),
  name text not null,
  class_name text,
  created_at timestamptz default now()
);

create table exams (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid references users(id),
  title text not null,
  subject text not null,
  question_budget int not null default 8,   -- 시험 전체 질문 한도
  rules jsonb default '{}'::jsonb,          -- AI 규칙 (정답 금지, 답변 길이 등)
  status text not null default 'draft',     -- draft / open / closed
  created_at timestamptz default now()
);

create table exam_items (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid references exams(id) on delete cascade,
  item_order int not null,
  prompt text not null,
  answer_key text,                          -- AI에게만 전달, 학생에게 노출 금지
  rubric jsonb default '{}'::jsonb
);

create table attempts (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid references exams(id) on delete cascade,
  student_id uuid references users(id),
  started_at timestamptz default now(),
  submitted_at timestamptz,
  verified boolean default false,           -- 본인 인증 (시연은 모의)
  budget_left int not null
);

create table messages (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid references attempts(id) on delete cascade,
  item_id uuid references exam_items(id),
  role text not null check (role in ('student', 'ai')),
  content text not null,
  stage text,                               -- 질문 단계 (예: 내용 생성)
  style text,                               -- 질문 방식 (대신 해 줘 / 확인해 줘 / 넓혀 줘 / 점검해 줘)
  charged boolean default false,            -- 질문권 차감 여부
  created_at timestamptz default now()
);

create table snapshots (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid references attempts(id) on delete cascade,
  item_id uuid references exam_items(id),
  text text not null,
  reason text not null check (reason in ('autosave', 'question', 'submit')),
  created_at timestamptz default now()
);

create table events (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid references attempts(id) on delete cascade,
  type text not null check (type in ('paste', 'blur')),
  detail jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create table answers (
  attempt_id uuid references attempts(id) on delete cascade,
  item_id uuid references exam_items(id),
  final_text text,
  primary key (attempt_id, item_id)
);

create table grades (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid references attempts(id) on delete cascade,
  item_id uuid references exam_items(id),
  ai_result jsonb,                          -- AI 가채점 결과와 근거
  teacher_score numeric,
  comment text,
  confirmed boolean default false
);
