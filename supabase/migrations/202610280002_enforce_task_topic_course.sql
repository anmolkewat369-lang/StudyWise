-- Enforce that a task's linked topic belongs to the same course.
-- Upgrade path for databases that already applied the original schema migration.
-- The task itself is preserved; only invalid legacy topic links are cleared.

update public.studywise_tasks as task
set topic_id = null
where task.topic_id is not null
  and not exists (
    select 1
    from public.studywise_topics as topic
    where topic.user_id = task.user_id
      and topic.course_id = task.course_id
      and topic.id = task.topic_id
  );

alter table public.studywise_tasks
  drop constraint if exists studywise_tasks_user_id_topic_id_fkey;

alter table public.studywise_tasks
  drop constraint if exists studywise_tasks_topic_course_fk;

alter table public.studywise_tasks
  drop constraint if exists studywise_tasks_topic_requires_course;

alter table public.studywise_tasks
  add constraint studywise_tasks_topic_requires_course
  check (topic_id is null or course_id is not null);

alter table public.studywise_tasks
  add constraint studywise_tasks_topic_course_fk
  foreign key (user_id, course_id, topic_id)
  references public.studywise_topics(user_id, course_id, id)
  on delete set null (topic_id);
