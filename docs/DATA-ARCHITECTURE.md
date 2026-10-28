# StudyWise data architecture

## Current runtime state

The app currently persists courses, topics, tasks, resources, settings, and practice attempts in browser `localStorage`, with separate keys for the demo workspace and each authenticated Supabase user ID. Supabase is used for authentication only. **The schema below is prepared for cloud sync; cloud reads/writes are not connected yet.** Do not tell users that an authenticated account has cloud backup until the sync adapter and cross-user tests are implemented.

## Local domain records

- Courses: subject identity, code, visual tag, unit count, and optional exam date.
- Topics: course relationship, priority, status, time estimate, confidence, stable prerequisite topic ID, explicit learning outcome, personal notes, practice counts, bounded per-topic practice history, last-practiced timestamp, and next spaced-review date.
- Tasks: course/topic relationship when applicable, type, minutes, scheduled date, status, and rationale.
- Resources: course relationship, optional same-course topic relationship, resource kind, optional metadata and HTTP(S) URL.
- Practice attempts: timestamp, total/correct counts, and a per-question snapshot with the original answer choices, selected/correct answer, explanation, and optional reviewed state so past checks remain interpretable.
- User settings: daily target, focus-session length, reminders, and weekly recap preference.

## Prepared Supabase schema

Migrations (apply in order):

- `supabase/migrations/202610280001_studywise_schema.sql`
- `supabase/migrations/202610280002_enforce_task_topic_course.sql`

All user-owned tables use a composite `(user_id, id)` key except per-user settings, whose key is `user_id`. Course-linked rows use composite foreign keys that include `user_id`; a client cannot create a row owned by one user that references another user's course. Deleting a course cascades to its topics, tasks, and linked resources. Practice history is retained as a snapshot for interpreting past checks.

RLS is enabled on every table. Each authenticated role policy requires `auth.uid() = user_id` for reads and writes. Anonymous access is explicitly revoked. Do not use a service-role key in browser code.

## Before enabling cloud sync

1. Apply both migrations in filename order to a non-production Supabase project first.
2. Verify every table has RLS enabled and the expected owner policy exists.
3. Test with two separate authenticated users: each can read/write their own rows, cannot read another user's rows, cannot insert with another user's `user_id`, and cannot link a record to another user's course.
4. Implement and test a repository adapter that converts camelCase local records to the SQL column names and back.
5. Decide first-login behavior explicitly. Do not silently overwrite cloud data with demo data or local data; offer a previewed import/merge if needed.
6. Add offline/error/unsynced states and conflict handling before advertising multi-device sync.
7. Only then update Settings to say cloud sync is active.

A SQL file's presence is not proof that it has been applied or tested against a real Supabase project.

### Prerequisite relationship

Study tasks and resources may link to a topic by stable ID; their topic must belong to the same course. This rule is enforced in both the local validator and the database with composite foreign keys, not just by the UI. Migration 002 clears only invalid legacy task-topic links (preserving the tasks) before enforcing the database constraint. Removing a topic leaves the task/resource and clears the link. New topic records use `prerequisiteTopicId` as a stable record reference. UI selection is limited to other topics in the same course, with cycle prevention. Legacy name-based links are migrated only when a single matching topic exists; missing or ambiguous links remain blocked and require user repair instead of being silently unlocked. The prepared Supabase schema uses a self-reference scoped to the same user and course.
