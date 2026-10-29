import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const schema = readFileSync(new URL('../supabase/migrations/202610280001_studywise_schema.sql', import.meta.url), 'utf8');
const taskIntegrityMigration = readFileSync(new URL('../supabase/migrations/202610280002_enforce_task_topic_course.sql', import.meta.url), 'utf8');
const focusSessionMigration = readFileSync(new URL('../supabase/migrations/202610280003_add_focus_session_reflections.sql', import.meta.url), 'utf8');

test('fresh schema enforces task topic links within the same course', () => {
  const taskTable = schema.match(/create table if not exists public\.studywise_tasks \(([\s\S]*?)\n\);/i)?.[1] || '';
  assert.match(taskTable, /check\s*\(\s*topic_id\s+is\s+null\s+or\s+course_id\s+is\s+not\s+null\s*\)/i);
  assert.match(taskTable, /foreign key\s*\(\s*user_id\s*,\s*course_id\s*,\s*topic_id\s*\)\s+references\s+public\.studywise_topics\s*\(\s*user_id\s*,\s*course_id\s*,\s*id\s*\)\s+on delete set null\s*\(\s*topic_id\s*\)/i);
  assert.doesNotMatch(taskTable, /foreign key\s*\(\s*user_id\s*,\s*topic_id\s*\)/i);
});

test('upgrade migration preserves tasks while clearing only invalid legacy topic links', () => {
  assert.match(taskIntegrityMigration, /update public\.studywise_tasks as task[\s\S]*?set topic_id = null[\s\S]*?not exists/i);
  assert.match(taskIntegrityMigration, /drop constraint if exists studywise_tasks_user_id_topic_id_fkey/i);
  assert.match(taskIntegrityMigration, /add constraint studywise_tasks_topic_course_fk[\s\S]*?foreign key\s*\(user_id, course_id, topic_id\)[\s\S]*?references public\.studywise_topics\(user_id, course_id, id\)/i);
  assert.doesNotMatch(taskIntegrityMigration, /delete\s+from\s+public\.studywise_tasks/i);
});

test('focus-session reflection fields are available on fresh and upgraded workspaces', () => {
  const taskTable = schema.match(/create table if not exists public\.studywise_tasks \(([\s\S]*?)\n\);/i)?.[1] || '';
  assert.match(taskTable, /session_reflection text not null default '' check \(length\(session_reflection\) <= 80\)/i);
  assert.match(taskTable, /actual_minutes integer not null default 0 check \(actual_minutes between 0 and 360\)/i);
  assert.match(focusSessionMigration, /add column if not exists session_reflection/i);
  assert.match(focusSessionMigration, /add column if not exists actual_minutes/i);
});

test('all user-owned data tables enable RLS and use auth.uid ownership policies', () => {
  const tables = ['courses', 'topics', 'tasks', 'resources', 'practice_attempts', 'user_settings'];
  for (const name of tables) {
    assert.match(schema, new RegExp(`alter table public\\.studywise_${name} enable row level security`, 'i'));
    assert.match(schema, new RegExp(`create policy studywise_${name}_own_rows on public\\.studywise_${name}[\\s\\S]*?auth\\.uid\\(\\) = user_id`, 'i'));
  }
  assert.match(schema, /revoke all on[\s\S]*?from anon/i);
});
