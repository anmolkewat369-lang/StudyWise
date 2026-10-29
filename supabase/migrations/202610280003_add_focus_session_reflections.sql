alter table public.studywise_tasks
  add column if not exists session_reflection text not null default '' check (length(session_reflection) <= 80),
  add column if not exists actual_minutes integer not null default 0 check (actual_minutes between 0 and 360);
