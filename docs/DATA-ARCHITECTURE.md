# StudyWise data architecture

## Current runtime state

Supabase Auth manages account sessions. For authenticated users, the app loads courses, topics, tasks, resources, settings, and practice attempts from Supabase and saves changes there. Authenticated study records are not persisted to `localStorage`; only the development-only demo profile and its sample workspace are stored locally. A failed cloud load does not mark the workspace as hydrated or trigger a save, preventing stale browser data from replacing remote records. Offline edits are not queued for later synchronization.

## Local domain records

- Courses: subject identity, code, visual tag, unit count, and optional exam date.
- Topics: course relationship, priority, status, time estimate, confidence, stable prerequisite topic ID, explicit learning outcome, personal notes, practice counts, bounded per-topic practice history, last-practiced timestamp, and next spaced-review date.
- Tasks: course/topic relationship when applicable, type, minutes, scheduled date, status, and rationale.
- Resources: course relationship, optional same-course topic relationship, resource kind, optional metadata and HTTP(S) URL.
- Practice attempts: timestamp, total/correct counts, and a per-question snapshot with the original answer choices, selected/correct answer, explanation, and optional reviewed state so past checks remain interpretable.
- User settings: daily target, focus-session length, reminders, and weekly recap preference.

## Supabase schema

Migrations (apply in order):

- `supabase/migrations/202610280001_studywise_schema.sql`
- `supabase/migrations/202610280002_enforce_task_topic_course.sql`
- `supabase/migrations/202610280003_add_focus_session_reflections.sql`

All user-owned tables use a composite `(user_id, id)` key except per-user settings, whose key is `user_id`. Course-linked rows use composite foreign keys that include `user_id`; a client cannot create a row owned by one user that references another user's course. Deleting a course cascades to its topics, tasks, and linked resources. Practice history is retained as a snapshot for interpreting past checks.

RLS is enabled on every table. Each authenticated role policy requires `auth.uid() = user_id` for reads and writes. Anonymous access is explicitly revoked. Do not use a service-role key in browser code.

## Deployment and verification

1. Apply both migrations in filename order to a non-production Supabase project first.
2. Verify every table has RLS enabled and the expected owner policy exists.
3. Test with two separate authenticated users: each can read/write their own rows, cannot read another user's rows, cannot insert with another user's `user_id`, and cannot link a record to another user's course.
4. Verify account registration, email confirmation, sign in/out, and password recovery against the configured project.
5. Test workspace loading and saving with two separate authenticated users; verify RLS prevents cross-account reads, writes, and relationship references.
6. Confirm the production Vercel environment contains only the Supabase project URL and public anon/publishable key; never add a service-role key to this frontend.
7. Remember that offline edits are not queued. A failed load is surfaced and does not fall back to local authenticated records.

A SQL file's presence is not proof that it has been applied or tested against a real Supabase project. Cloud behavior and RLS still require verification against the actual deployment project.

### Prerequisite relationship

Study tasks and resources may link to a topic by stable ID; their topic must belong to the same course. This rule is enforced in both the local validator and the database with composite foreign keys, not just by the UI. Migration 002 clears only invalid legacy task-topic links (preserving the tasks) before enforcing the database constraint. Removing a topic leaves the task/resource and clears the link. New topic records use `prerequisiteTopicId` as a stable record reference. UI selection is limited to other topics in the same course, with cycle prevention. Legacy name-based links are migrated only when a single matching topic exists; missing or ambiguous links remain blocked and require user repair instead of being silently unlocked. The prepared Supabase schema uses a self-reference scoped to the same user and course.
