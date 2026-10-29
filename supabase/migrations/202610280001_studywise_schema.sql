-- StudyWise cloud data foundation.
-- Apply this migration in the Supabase SQL editor before enabling client sync.
-- All user-owned rows are partitioned by auth.uid() and protected with RLS.

create or replace function public.studywise_set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.studywise_courses (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  name text not null check (length(trim(name)) > 0),
  short text not null default '',
  code text not null default '',
  color text not null default 'violet',
  icon text not null default 'book',
  units integer not null default 1 check (units between 1 and 100),
  exam_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.studywise_topics (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  course_id text not null,
  name text not null check (length(trim(name)) > 0),
  unit text not null default '',
  importance text not null default 'Medium' check (importance in ('High', 'Medium', 'Low')),
  status text not null default 'not-started' check (status in ('not-started', 'learning', 'mastered')),
  mastery integer not null default 0 check (mastery between 0 and 100),
  minutes integer not null default 30 check (minutes between 5 and 360),
  prerequisite_topic_id text,
  learning_outcome text not null default '' check (length(learning_outcome) <= 2000),
  notes text not null default '' check (length(notes) <= 10000),
  practice_attempts integer not null default 0 check (practice_attempts >= 0),
  practice_correct integer not null default 0 check (practice_correct between 0 and practice_attempts),
  last_practiced_at timestamptz,
  next_review_date date,
  practice_history jsonb not null default '[]'::jsonb check (jsonb_typeof(practice_history) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  unique (user_id, course_id, id),
  check (prerequisite_topic_id is null or prerequisite_topic_id <> id),
  foreign key (user_id, course_id)
    references public.studywise_courses(user_id, id) on delete cascade,
  foreign key (user_id, course_id, prerequisite_topic_id)
    references public.studywise_topics(user_id, course_id, id) on delete set null (prerequisite_topic_id)
);

create table if not exists public.studywise_tasks (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  course_id text,
  topic_id text,
  title text not null check (length(trim(title)) > 0),
  task_type text not null default 'Learn' check (task_type in ('Learn', 'Practice', 'Revision', 'Quick review')),
  minutes integer not null default 30 check (minutes between 0 and 360),
  time_label text not null default 'Flexible',
  scheduled_date date,
  status text not null default 'todo' check (status in ('todo', 'done', 'missed')),
  reason text not null default '',
  session_reflection text not null default '' check (length(session_reflection) <= 80),
  actual_minutes integer not null default 0 check (actual_minutes between 0 and 360),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  constraint studywise_tasks_topic_requires_course check (topic_id is null or course_id is not null),
  foreign key (user_id, course_id)
    references public.studywise_courses(user_id, id) on delete cascade,
  constraint studywise_tasks_topic_course_fk foreign key (user_id, course_id, topic_id)
    references public.studywise_topics(user_id, course_id, id) on delete set null (topic_id)
);

create table if not exists public.studywise_resources (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  course_id text,
  topic_id text,
  title text not null check (length(trim(title)) > 0),
  kind text not null default 'Notes' check (kind in ('Notes', 'Past paper', 'Video', 'Cheat sheet')),
  meta text not null default '',
  tone text not null default 'violet',
  url text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  constraint studywise_resources_topic_requires_course check (topic_id is null or course_id is not null),
  foreign key (user_id, course_id)
    references public.studywise_courses(user_id, id) on delete cascade,
  constraint studywise_resources_topic_course_fk foreign key (user_id, course_id, topic_id)
    references public.studywise_topics(user_id, course_id, id) on delete set null (topic_id)
);

-- Safe when this schema file is applied to an installation with an older resources table.
alter table public.studywise_resources add column if not exists topic_id text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'studywise_resources_topic_requires_course' and conrelid = 'public.studywise_resources'::regclass) then
    alter table public.studywise_resources add constraint studywise_resources_topic_requires_course check (topic_id is null or course_id is not null);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'studywise_resources_topic_course_fk' and conrelid = 'public.studywise_resources'::regclass) then
    alter table public.studywise_resources add constraint studywise_resources_topic_course_fk foreign key (user_id, course_id, topic_id)
      references public.studywise_topics(user_id, course_id, id) on delete set null (topic_id);
  end if;
end;
$$;

create table if not exists public.studywise_practice_attempts (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  attempted_at timestamptz not null default now(),
  total integer not null check (total >= 0),
  correct integer not null check (correct between 0 and total),
  results jsonb not null default '[]'::jsonb check (jsonb_typeof(results) = 'array'),
  primary key (user_id, id)
);

create table if not exists public.studywise_user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  settings jsonb not null default '{}'::jsonb check (jsonb_typeof(settings) = 'object'),
  updated_at timestamptz not null default now()
);

create index if not exists studywise_courses_exam_date_idx
  on public.studywise_courses(user_id, exam_date);
create index if not exists studywise_topics_course_status_idx
  on public.studywise_topics(user_id, course_id, status);
create index if not exists studywise_topics_review_queue_idx
  on public.studywise_topics(user_id, next_review_date) where next_review_date is not null;
create index if not exists studywise_tasks_scheduled_idx
  on public.studywise_tasks(user_id, scheduled_date, status);
create index if not exists studywise_resources_course_idx
  on public.studywise_resources(user_id, course_id);
create index if not exists studywise_resources_topic_idx
  on public.studywise_resources(user_id, topic_id);
create index if not exists studywise_practice_attempts_recent_idx
  on public.studywise_practice_attempts(user_id, attempted_at desc);

-- Maintain timestamps without trusting client-supplied updated_at values.
drop trigger if exists studywise_courses_updated_at on public.studywise_courses;
create trigger studywise_courses_updated_at before update on public.studywise_courses
  for each row execute function public.studywise_set_updated_at();
drop trigger if exists studywise_topics_updated_at on public.studywise_topics;
create trigger studywise_topics_updated_at before update on public.studywise_topics
  for each row execute function public.studywise_set_updated_at();
drop trigger if exists studywise_tasks_updated_at on public.studywise_tasks;
create trigger studywise_tasks_updated_at before update on public.studywise_tasks
  for each row execute function public.studywise_set_updated_at();
drop trigger if exists studywise_resources_updated_at on public.studywise_resources;
create trigger studywise_resources_updated_at before update on public.studywise_resources
  for each row execute function public.studywise_set_updated_at();
drop trigger if exists studywise_user_settings_updated_at on public.studywise_user_settings;
create trigger studywise_user_settings_updated_at before update on public.studywise_user_settings
  for each row execute function public.studywise_set_updated_at();

-- RLS is mandatory before any authenticated client is allowed to use these tables.
alter table public.studywise_courses enable row level security;
alter table public.studywise_topics enable row level security;
alter table public.studywise_tasks enable row level security;
alter table public.studywise_resources enable row level security;
alter table public.studywise_practice_attempts enable row level security;
alter table public.studywise_user_settings enable row level security;

drop policy if exists studywise_courses_own_rows on public.studywise_courses;
create policy studywise_courses_own_rows on public.studywise_courses
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists studywise_topics_own_rows on public.studywise_topics;
create policy studywise_topics_own_rows on public.studywise_topics
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists studywise_tasks_own_rows on public.studywise_tasks;
create policy studywise_tasks_own_rows on public.studywise_tasks
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists studywise_resources_own_rows on public.studywise_resources;
create policy studywise_resources_own_rows on public.studywise_resources
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists studywise_practice_attempts_own_rows on public.studywise_practice_attempts;
create policy studywise_practice_attempts_own_rows on public.studywise_practice_attempts
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists studywise_user_settings_own_rows on public.studywise_user_settings;
create policy studywise_user_settings_own_rows on public.studywise_user_settings
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select, insert, update, delete on
  public.studywise_courses,
  public.studywise_topics,
  public.studywise_tasks,
  public.studywise_resources,
  public.studywise_practice_attempts,
  public.studywise_user_settings
  to authenticated;
revoke all on
  public.studywise_courses,
  public.studywise_topics,
  public.studywise_tasks,
  public.studywise_resources,
  public.studywise_practice_attempts,
  public.studywise_user_settings
  from anon;
