import test from 'node:test';
import assert from 'node:assert/strict';
import { fromDatabaseWorkspace, toDatabaseWorkspace } from '../src/lib/workspace-repository.js';

test('workspace mappings keep browser field names separate from database columns', () => {
  const workspace = { courses: [{ id: 'c1', name: 'Maths', examDate: '2026-11-14' }], topics: [], tasks: [{ id: 't1', title: 'Revise', courseId: 'c1', type: 'Revision', time: '9:00 AM' }], resources: [], attempts: [], settings: { degree: 'BSc' } };
  const database = toDatabaseWorkspace(workspace, 'user-1');
  assert.equal(database.courses[0].user_id, 'user-1');
  assert.equal(database.courses[0].exam_date, '2026-11-14');
  assert.equal(database.tasks[0].task_type, 'Revision');
  assert.equal(database.tasks[0].time_label, '9:00 AM');
  const restored = fromDatabaseWorkspace({ courses: database.courses, tasks: database.tasks, settings: workspace.settings });
  assert.equal(restored.courses[0].examDate, '2026-11-14');
  assert.equal(restored.tasks[0].courseId, 'c1');
  assert.equal(restored.tasks[0].type, 'Revision');
});
