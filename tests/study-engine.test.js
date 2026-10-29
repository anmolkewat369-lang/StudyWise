import test from 'node:test';
import assert from 'node:assert/strict';
import { addDaysToDateKey, applyPracticeResults, createRecoveryPlan, extractSyllabusCandidates, daysUntil, findNextAvailableStudyDate, findNextAvailableTimeSlot, findOpenReviewTask, getMistakeNotebook, getNextExam, getExamEventsForDate, getUpcomingExams, getReviewQueue, getStudyCapacityForDate, getWhatIfPlan, getTasksForDate, getTaskMetricsForDate, getTopicMetrics, getWeekDateKeys, getMonthCalendarDates, getScheduledTimeConflicts, getPrerequisiteBlocker, markMistakeReviewed, mergeRecoveryTasks, normalizeTopicPrerequisites, priorityScore, saveMistakeNote, toLocalDateKey, wouldCreatePrerequisiteCycle } from '../src/lib/study-engine.js';

test('local date key uses local calendar parts', () => {
  assert.equal(toLocalDateKey(new Date(2026, 9, 28, 12)), '2026-10-28');
});

test('daysUntil handles past, today and future dates', () => {
  const today = new Date(2026, 9, 28, 15);
  assert.equal(daysUntil('2026-10-28', today), 0);
  assert.equal(daysUntil('2026-10-30', today), 2);
  assert.equal(daysUntil('2026-10-27', today), -1);
  assert.equal(daysUntil('not-a-date', today), null);
});

test('topic metrics are derived from actual topic records', () => {
  assert.deepEqual(getTopicMetrics([
    { status: 'mastered', mastery: 90 },
    { status: 'learning', mastery: 50 },
    { status: 'not-started', mastery: 0 },
  ]), { total: 3, mastered: 1, learning: 1, notStarted: 1, coveragePercent: 33, averageMastery: 47 });
  assert.equal(getTopicMetrics([]).coveragePercent, 0);
});

test('recovery merge preserves all old tasks and skips exact duplicates', () => {
  const done = { id: '1', title: 'Revise arrays', courseId: 'c1', status: 'done' };
  const pending = { id: '2', title: 'Practice SQL', courseId: 'c2', status: 'todo' };
  const duplicate = { id: '3', title: 'Practice SQL', courseId: 'c2', status: 'todo' };
  const fresh = { id: '4', title: 'Study trees', courseId: 'c1', status: 'todo' };
  const result = mergeRecoveryTasks([done, pending], [duplicate, fresh]);
  assert.deepEqual(result.tasks, [done, pending, fresh]);
  assert.deepEqual(result.additions, [fresh]);
  assert.deepEqual(result.skipped, [duplicate]);
});

test('next exam returns earliest non-past exam', () => {
  const today = new Date(2026, 9, 28);
  const courses = [
    { id: 'past', examDate: '2026-10-20' },
    { id: 'later', examDate: '2026-11-12' },
    { id: 'soon', examDate: '2026-11-09' },
  ];
  assert.equal(getNextExam(courses, today).id, 'soon');
  assert.equal(getNextExam([], today), null);
});

test('priority score prefers important, weaker topics', () => {
  assert.ok(priorityScore({ importance: 'High', mastery: 10, minutes: 30, status: 'not-started' }) > priorityScore({ importance: 'Low', mastery: 90, minutes: 60, status: 'learning' }));
});

test('workspace backup exports supported data and validates a round trip', async () => {
  const { createWorkspaceBackup, validateWorkspaceBackup } = await import('../src/lib/study-engine.js');
  const data = { courses: [{ id: 'c1', name: 'Course' }], topics: [{ id: 't1', courseId: 'c1', name: 'Topic', status: 'not-started', importance: 'High', minutes: 30, mastery: 0 }], tasks: [{ id: 's1', courseId: 'c1', title: 'Task', status: 'done', minutes: 25, reflection: 'Went well', actualMinutes: 22 }], resources: [{ id: 'r1', courseId: 'c1', title: 'Resource', kind: 'Notes' }], settings: { dailyMinutes: 120 }, attempts: [{ id: 'a1', attemptedAt: '2026-10-28T10:00:00.000Z', total: 1, correct: 1, results: [{ topicId: 't1', correct: true }] }] };
  const backup = createWorkspaceBackup(data, '2026-10-28T00:00:00.000Z');
  assert.equal(backup.app, 'StudyWise');
  assert.equal(backup.schemaVersion, 1);
  assert.deepEqual(validateWorkspaceBackup(backup), { ok: true, data });
});

test('workspace backup rejects unsupported or malformed input', async () => {
  const { validateWorkspaceBackup } = await import('../src/lib/study-engine.js');
  assert.equal(validateWorkspaceBackup({}).ok, false);
  assert.equal(validateWorkspaceBackup({ app: 'StudyWise', schemaVersion: 1, data: { courses: [], topics: [], tasks: [], resources: [], settings: {} } }).ok, true);
  assert.equal(validateWorkspaceBackup({ app: 'StudyWise', schemaVersion: 1, data: { courses: [{ name: 'missing id' }], topics: [], tasks: [], resources: [], settings: {} } }).ok, false);
});


test('tasks without dates are shown today only, not on every planner day', () => {
  const tasks = [
    { id: 'today', scheduledDate: '2026-10-28', status: 'todo', minutes: 25 },
    { id: 'future', scheduledDate: '2026-10-29', status: 'todo', minutes: 40 },
    { id: 'legacy', status: 'todo', minutes: 10 },
  ];
  assert.deepEqual(getTasksForDate(tasks, '2026-10-28', '2026-10-28').map(task => task.id), ['today', 'legacy']);
  assert.deepEqual(getTasksForDate(tasks, '2026-10-29', '2026-10-28').map(task => task.id), ['future']);
});

test('daily workload summaries are derived from open task records', () => {
  const tasks = [
    { id: 'done-learn', scheduledDate: '2026-10-28', status: 'done', type: 'Learn', minutes: 30 },
    { id: 'open-learn', scheduledDate: '2026-10-28', status: 'todo', type: 'Learn', minutes: 40 },
    { id: 'open-practice', scheduledDate: '2026-10-28', status: 'todo', type: 'Practice', minutes: 25 },
    { id: 'tomorrow', scheduledDate: '2026-10-29', status: 'todo', type: 'Learn', minutes: 60 },
  ];
  assert.deepEqual(getTaskMetricsForDate(tasks, '2026-10-28', '2026-10-28'), {
    total: 3, done: 1, open: 2, remainingMinutes: 65, learningMinutes: 40, practiceMinutes: 25,
  });
});

test('missed tasks stay visible without inflating remaining study time', () => {
  const tasks = [
    { id: 'todo', scheduledDate: '2026-10-28', status: 'todo', minutes: 45 },
    { id: 'missed', scheduledDate: '2026-10-28', status: 'missed', minutes: 30 },
  ];
  assert.deepEqual(getTaskMetricsForDate(tasks, '2026-10-28', '2026-10-28'), {
    total: 2, done: 0, open: 1, remainingMinutes: 45, learningMinutes: 0, practiceMinutes: 45,
  });
  assert.equal(getStudyCapacityForDate(tasks, '2026-10-28', 120, '2026-10-28').capacityMinutes, 75);
});


test('recovery proposal fits only the time remaining after existing open tasks', () => {
  const dateKey = '2026-10-28';
  const result = createRecoveryPlan({
    dateKey,
    totalMinutes: 100,
    urgencyDays: 3,
    focus: 'balanced',
    courses: [{ id: 'c1', short: 'DSA' }],
    topics: [
      { id: 't1', courseId: 'c1', name: 'Trees', status: 'not-started', importance: 'High', mastery: 20, minutes: 45 },
      { id: 't2', courseId: 'c1', name: 'Graphs', status: 'learning', importance: 'Medium', mastery: 50, minutes: 30 },
    ],
    tasks: [{ id: 's1', courseId: 'c1', title: 'Existing work', status: 'todo', minutes: 60, scheduledDate: dateKey }],
  });
  assert.equal(result.committedMinutes, 60);
  assert.equal(result.availableMinutes, 40);
  assert.equal(result.plannedMinutes, 40);
  assert.equal(result.plan.length, 1);
  assert.equal(result.plan[0].scheduledDate, dateKey);
  assert.equal(result.remainingMinutes, 0);
  assert.equal(result.remainingTopics, 1);
});

test('recovery proposal leaves duplicate tasks out and does not count completed work against capacity', () => {
  const dateKey = '2026-10-28';
  const result = createRecoveryPlan({
    dateKey,
    totalMinutes: 60,
    urgencyDays: 7,
    courses: [{ id: 'c1', short: 'DSA' }],
    topics: [
      { id: 't1', courseId: 'c1', name: 'Trees', status: 'not-started', importance: 'High', mastery: 20, minutes: 30 },
      { id: 't2', courseId: 'c1', name: 'Graphs', status: 'not-started', importance: 'Medium', mastery: 30, minutes: 30 },
    ],
    tasks: [
      { id: 's1', courseId: 'c1', title: 'Study Trees', status: 'todo', minutes: 25, scheduledDate: dateKey },
      { id: 's2', courseId: 'c1', title: 'Past session', status: 'done', minutes: 90, scheduledDate: dateKey },
    ],
  });
  assert.equal(result.committedMinutes, 25);
  assert.equal(result.availableMinutes, 35);
  assert.equal(result.duplicateTopics, 1);
  assert.deepEqual(result.plan.map(task => task.title), ['Study Graphs']);
  assert.equal(result.plannedMinutes, 30);
});


test('backup validation rejects duplicate IDs and broken course references', async () => {
  const { validateWorkspaceBackup } = await import('../src/lib/study-engine.js');
  const duplicateIds = { app: 'StudyWise', schemaVersion: 1, data: { courses: [{ id: 'c1', name: 'One' }, { id: 'c1', name: 'Two' }], topics: [], tasks: [], resources: [], settings: {} } };
  const brokenReference = { app: 'StudyWise', schemaVersion: 1, data: { courses: [{ id: 'c1', name: 'One' }], topics: [{ id: 't1', courseId: 'missing', name: 'Topic' }], tasks: [], resources: [], settings: {} } };
  assert.match(validateWorkspaceBackup(duplicateIds).error, /duplicate record IDs/i);
  assert.match(validateWorkspaceBackup(brokenReference).error, /invalid topic|missing course/i);
});

test('backup validation rejects invalid preference values', async () => {
  const { validateWorkspaceBackup } = await import('../src/lib/study-engine.js');
  const invalid = { app: 'StudyWise', schemaVersion: 1, data: { courses: [], topics: [], tasks: [], resources: [], settings: { dailyMinutes: 999 } } };
  assert.match(validateWorkspaceBackup(invalid).error, /daily study target/i);
});


test('practice results move confidence gradually and retain a bounded evidence trail', () => {
  const topic = { id: 't1', name: 'Trees', status: 'not-started', mastery: 40, practiceAttempts: 0, practiceCorrect: 0 };
  const first = applyPracticeResults([topic], [{ topicId: 't1', correct: true }], '2026-10-28T10:00:00.000Z')[0];
  assert.equal(first.mastery, 50);
  assert.equal(first.status, 'learning');
  assert.equal(first.practiceAttempts, 1);
  assert.equal(first.practiceCorrect, 1);
  const second = applyPracticeResults([first], [{ topicId: 't1', correct: false }], '2026-10-29T10:00:00.000Z')[0];
  assert.equal(second.mastery, 42);
  assert.equal(second.status, 'learning');
  assert.equal(second.practiceHistory.length, 2);
  const old = { ...topic, practiceHistory: Array.from({ length: 20 }, (_, i) => ({ correct: i % 2 === 0, attemptedAt: `2026-10-${String((i % 28) + 1).padStart(2, '0')}T10:00:00.000Z` })) };
  assert.equal(applyPracticeResults([old], [{ topicId: 't1', correct: true }])[0].practiceHistory.length, 20);
});


test('completed recovery tasks do not block future revision of the same topic', () => {
  const dateKey = '2026-10-28';
  const result = createRecoveryPlan({
    dateKey,
    totalMinutes: 45,
    courses: [{ id: 'c1', short: 'DSA' }],
    topics: [{ id: 't1', courseId: 'c1', name: 'Trees', status: 'learning', importance: 'High', mastery: 60, minutes: 30 }],
    tasks: [{ id: 'old', courseId: 'c1', title: 'Practice Trees', status: 'done', minutes: 30, scheduledDate: '2026-10-20' }],
  });
  assert.equal(result.plan.length, 1);
  assert.equal(result.plan[0].title, 'Practice Trees');
});

test('recovery merge can repeat completed work but skips open duplicates', async () => {
  const { mergeRecoveryTasks } = await import('../src/lib/study-engine.js');
  const proposed = [{ id: 'new', courseId: 'c1', title: 'Practice Trees', status: 'todo' }];
  const completed = mergeRecoveryTasks([{ id: 'old', courseId: 'c1', title: 'Practice Trees', status: 'done' }], proposed);
  assert.equal(completed.additions.length, 1);
  const open = mergeRecoveryTasks([{ id: 'old', courseId: 'c1', title: 'Practice Trees', status: 'todo' }], proposed);
  assert.equal(open.additions.length, 0);
  assert.equal(open.skipped.length, 1);
});


test('strict local date validation rejects normalized invalid calendar dates', async () => {
  const { isValidDateKey, daysUntil } = await import('../src/lib/study-engine.js');
  assert.equal(isValidDateKey('2026-10-28'), true);
  assert.equal(isValidDateKey('2026-02-31'), false);
  assert.equal(isValidDateKey('2026-2-03'), false);
  assert.equal(daysUntil('2026-02-31', new Date('2026-02-01T12:00:00')), null);
});

test('recovery plan holds dependent topics until a tracked prerequisite is mastered', () => {
  const result = createRecoveryPlan({
    dateKey: '2026-10-28',
    totalMinutes: 90,
    courses: [{ id: 'c1', short: 'DSA' }],
    topics: [
      { id: 't1', courseId: 'c1', name: 'Arrays', status: 'learning', importance: 'High', mastery: 55, minutes: 30 },
      { id: 't2', courseId: 'c1', name: 'Linked Lists', prerequisite: 'Arrays', status: 'not-started', importance: 'High', mastery: 10, minutes: 45 },
    ],
    tasks: [],
  });
  assert.deepEqual(result.plan.map(task => task.title), ['Practice Arrays']);
  assert.equal(result.blockedTopics, 1);
  assert.equal(result.remainingTopics, 1);
});

test('backup validator rejects invalid ISO calendar dates', async () => {
  const { validateWorkspaceBackup } = await import('../src/lib/study-engine.js');
  const invalid = { app: 'StudyWise', schemaVersion: 1, data: { courses: [{ id: 'c1', name: 'DSA', examDate: '2026-02-31' }], topics: [], tasks: [], resources: [], settings: {} } };
  assert.match(validateWorkspaceBackup(invalid).error, /invalid course/i);
});

test('backup validator rejects unsafe or malformed resource URLs', async () => {
  const { validateWorkspaceBackup } = await import('../src/lib/study-engine.js');
  const base = { app: 'StudyWise', schemaVersion: 1, data: { courses: [], topics: [], tasks: [], resources: [{ id: 'r1', title: 'Resource', url: 'javascript:alert(1)' }], settings: {} } };
  assert.match(validateWorkspaceBackup(base).error, /web link/i);
  const malformed = structuredClone(base);
  malformed.data.resources[0].url = 'not a url';
  assert.match(validateWorkspaceBackup(malformed).error, /web link/i);
  const secure = structuredClone(base);
  secure.data.resources[0].url = 'https://example.edu/resource';
  assert.equal(validateWorkspaceBackup(secure).ok, true);
});

test('backup validator rejects inconsistent practice attempt totals', async () => {
  const { validateWorkspaceBackup } = await import('../src/lib/study-engine.js');
  const backup = { app: 'StudyWise', schemaVersion: 1, data: { courses: [], topics: [], tasks: [], resources: [], settings: {}, attempts: [{ id: 'a1', attemptedAt: '2026-10-28T10:00:00.000Z', total: 2, correct: 1, results: [{ correct: true }] }] } };
  assert.match(validateWorkspaceBackup(backup).error, /practice-history/i);
  backup.data.attempts[0].results = [{ correct: true }, { correct: true }];
  assert.match(validateWorkspaceBackup(backup).error, /practice-history/i);
  backup.data.attempts[0].results = [{ correct: true }, { correct: false }];
  assert.equal(validateWorkspaceBackup(backup).ok, true);
});

test('backup validator rejects excessive unbounded practice history', async () => {
  const { validateWorkspaceBackup } = await import('../src/lib/study-engine.js');
  const history = Array.from({ length: 21 }, (_, index) => ({ correct: index % 2 === 0, attemptedAt: `2026-10-${String((index % 28) + 1).padStart(2, '0')}T10:00:00.000Z` }));
  const backup = { app: 'StudyWise', schemaVersion: 1, data: { courses: [{ id: 'c1', name: 'Course' }], topics: [{ id: 't1', courseId: 'c1', name: 'Topic', practiceHistory: history }], tasks: [], resources: [], settings: {} } };
  assert.match(validateWorkspaceBackup(backup).error, /invalid topic/i);
});


test('spaced revision returns due and upcoming topics in date order', () => {
  const topics = [
    { id: 'future', name: 'Future', nextReviewDate: '2026-10-30', mastery: 70 },
    { id: 'late', name: 'Overdue', nextReviewDate: '2026-10-20', mastery: 30 },
    { id: 'today', name: 'Today', nextReviewDate: '2026-10-28', mastery: 50 },
    { id: 'none', name: 'No evidence' },
  ];
  const queue = getReviewQueue(topics, new Date(2026, 9, 28, 12));
  assert.deepEqual(queue.due.map(topic => topic.id), ['late', 'today']);
  assert.deepEqual(queue.upcoming.map(topic => topic.id), ['future']);
  assert.equal(addDaysToDateKey('2026-10-31', 1), '2026-11-01');
  assert.equal(addDaysToDateKey('2026-02-31', 1), null);
});

test('incorrect answers return sooner than strong correct recall', () => {
  const topic = { id: 't1', name: 'Topic', status: 'learning', mastery: 40, practiceAttempts: 0, practiceCorrect: 0 };
  const wrong = applyPracticeResults([topic], [{ topicId: 't1', correct: false }], '2026-10-28T12:00:00');
  const right = applyPracticeResults([{ ...topic, mastery: 85 }], [{ topicId: 't1', correct: true }], '2026-10-28T12:00:00');
  assert.equal(wrong[0].nextReviewDate, '2026-10-29');
  assert.equal(right[0].nextReviewDate, '2026-11-04');
});

test('review scheduling finds the next day with enough capacity', () => {
  const tasks = [
    { id: 't1', scheduledDate: '2026-10-28', status: 'todo', minutes: 30 },
    { id: 't2', scheduledDate: '2026-10-29', status: 'todo', minutes: 25 },
    { id: 't3', scheduledDate: '2026-10-29', status: 'done', minutes: 60 },
  ];
  assert.equal(findNextAvailableStudyDate(tasks, '2026-10-28', 40, 15, 7), '2026-10-29');
  assert.equal(findNextAvailableStudyDate(tasks, '2026-10-28', 30, 15, 0), null);
  assert.equal(findNextAvailableStudyDate(tasks, 'not-a-date', 30, 15, 2), null);
});

test('backup validator rejects malformed next-review dates', async () => {
  const { validateWorkspaceBackup } = await import('../src/lib/study-engine.js');
  const backup = { app: 'StudyWise', schemaVersion: 1, data: { courses: [{ id: 'c1', name: 'Course' }], topics: [{ id: 't1', courseId: 'c1', name: 'Topic', nextReviewDate: '2026-02-31' }], tasks: [], resources: [], settings: {} } };
  assert.match(validateWorkspaceBackup(backup).error, /invalid topic/i);
});


test('topic recommendations account for a closer course exam date', () => {
  const from = new Date(2026, 9, 28, 12);
  const sameTopic = { id: 't1', status: 'learning', importance: 'Medium', mastery: 60, minutes: 30 };
  const near = priorityScore(sameTopic, { courseExamDate: '2026-10-30', from });
  const distant = priorityScore(sameTopic, { courseExamDate: '2026-11-30', from });
  const past = priorityScore(sameTopic, { courseExamDate: '2026-10-20', from });
  assert.ok(near > distant);
  assert.equal(past, distant);
});


test('error notebook returns recent unreviewed incorrect answers and retains snapshots', () => {
  const attempts = [
    { id: 'older', attemptedAt: '2026-10-20T10:00:00Z', total: 1, correct: 0, results: [{ topicId: 't1', prompt: 'Older Q', correct: false, choices: ['A','B'], selectedChoice: 0, correctChoice: 1, explanation: 'Older explanation.' }] },
    { id: 'newer', attemptedAt: '2026-10-28T10:00:00Z', total: 2, correct: 1, results: [{ topicId: 't1', prompt: 'Missed Q', correct: false, choices: ['Wrong','Right'], selectedChoice: 0, correctChoice: 1, explanation: 'Review the definition.' }, { topicId: 't2', prompt: 'Correct Q', correct: true, choices: ['A','B'], selectedChoice: 1, correctChoice: 1 }] },
  ];
  const notebook = getMistakeNotebook(attempts, [{ id: 't1', name: 'Linked lists', courseId: 'c1' }], 5);
  assert.deepEqual(notebook.map(note => note.prompt), ['Missed Q', 'Older Q']);
  assert.equal(notebook[0].topicName, 'Linked lists');
  assert.equal(notebook[0].choices[notebook[0].correctChoice], 'Right');
});

test('marking a mistake reviewed preserves attempt and answer history', () => {
  const attempts = [{ id: 'a1', attemptedAt: '2026-10-28T10:00:00Z', total: 2, correct: 1, results: [{ prompt: 'Q1', correct: false }, { prompt: 'Q2', correct: true }] }];
  const updated = markMistakeReviewed(attempts, 'a1', 0);
  assert.equal(updated[0].results[0].reviewed, true);
  assert.equal(updated[0].results[0].prompt, 'Q1');
  assert.equal(updated[0].results[1].reviewed, undefined);
  assert.equal(attempts[0].results[0].reviewed, undefined);
  assert.deepEqual(getMistakeNotebook(updated, [], 5), []);
});

test('backup validation rejects inconsistent answer choice snapshots', async () => {
  const { validateWorkspaceBackup } = await import('../src/lib/study-engine.js');
  const backup = { app: 'StudyWise', schemaVersion: 1, data: { courses: [], topics: [], tasks: [], resources: [], settings: {}, attempts: [{ id: 'a1', attemptedAt: '2026-10-28T10:00:00Z', total: 1, correct: 0, results: [{ prompt: 'Question', correct: false, choices: ['A','B'], selectedChoice: 0, correctChoice: 1 }] }] } };
  assert.equal(validateWorkspaceBackup(backup).ok, true);
  backup.data.attempts[0].results[0].correct = true;
  assert.match(validateWorkspaceBackup(backup).error, /practice-history/i);
});


test('review scheduler can find an existing open revision to prevent duplicates', () => {
  const tasks = [
    { id: 'done', topicId: 't1', type: 'Revision', status: 'done', scheduledDate: '2026-10-27' },
    { id: 'later', topicId: 't1', type: 'Revision', status: 'todo', scheduledDate: '2026-11-01' },
    { id: 'earlier', topicId: 't1', type: 'Revision', status: 'missed', scheduledDate: '2026-10-30' },
    { id: 'other', topicId: 't2', type: 'Revision', status: 'todo', scheduledDate: '2026-10-28' },
  ];
  assert.equal(findOpenReviewTask(tasks, 't1').id, 'earlier');
  assert.equal(findOpenReviewTask(tasks, 't2').id, 'other');
  assert.equal(findOpenReviewTask(tasks, 'missing'), null);
});


test('backup validator rejects tasks whose course disagrees with their topic', async () => {
  const { validateWorkspaceBackup } = await import('../src/lib/study-engine.js');
  const backup = { app: 'StudyWise', schemaVersion: 1, data: { courses: [{ id: 'c1', name: 'Course A' }, { id: 'c2', name: 'Course B' }], topics: [{ id: 't1', courseId: 'c1', name: 'Topic A' }], tasks: [{ id: 's1', courseId: 'c2', topicId: 't1', title: 'Review Topic A', type: 'Revision', minutes: 25 }], resources: [], settings: {} } };
  assert.match(validateWorkspaceBackup(backup).error, /invalid task/i);
});


test('syllabus text import strips list markers and unit headings without inventing content', () => {
  const source = `SYLLABUS
Unit 1: Data Structures
1. Arrays and Strings
2. Linked Lists
• Stacks and Queues

Page 1 of 12
2
Unit 2: Algorithms
- Sorting Algorithms
Arrays and Strings`;
  assert.deepEqual(extractSyllabusCandidates(source), [
    'Data Structures', 'Arrays and Strings', 'Linked Lists', 'Stacks and Queues', 'Algorithms', 'Sorting Algorithms',
  ]);
});

test('syllabus text import handles empty input, invalid limits, duplicates and a candidate cap', () => {
  assert.deepEqual(extractSyllabusCandidates('\n  \n'), []);
  assert.deepEqual(extractSyllabusCandidates('Arrays\nLinked Lists', 0), []);
  assert.deepEqual(extractSyllabusCandidates('Arrays\narrays\nTrees\nGraphs', 2), ['Arrays', 'Trees']);
  assert.deepEqual(extractSyllabusCandidates('Unit 1\nChapter 2\nPage 3\n© 2025'), []);
});


test('saving an error-notebook note preserves the original answers and reviewed state', () => {
  const attempts = [{ id: 'attempt-1', attemptedAt: '2026-10-28T10:00:00Z', total: 1, correct: 0, results: [{ topicId: 'topic-1', prompt: 'What is a stack?', correct: false, choices: ['FIFO', 'LIFO'], selectedChoice: 0, correctChoice: 1, explanation: 'A stack is last-in, first-out.', reviewed: false }] }];
  const updated = saveMistakeNote(attempts, 'attempt-1', 0, 'Remember: Last In, First Out.');
  assert.equal(updated[0].results[0].reviewNote, 'Remember: Last In, First Out.');
  assert.equal(updated[0].results[0].prompt, 'What is a stack?');
  assert.deepEqual(updated[0].results[0].choices, ['FIFO', 'LIFO']);
  assert.equal(updated[0].results[0].correct, false);
  assert.equal(updated[0].results[0].reviewed, false);
  assert.equal(attempts[0].results[0].reviewNote, undefined);
  assert.equal(saveMistakeNote(attempts, 'missing', 0, 'note'), attempts);
  assert.equal(saveMistakeNote(attempts, 'attempt-1', 0, { unsafe: true }), attempts);
});

test('backup rejects malformed or oversized personal review notes', async () => {
  const { validateWorkspaceBackup } = await import('../src/lib/study-engine.js');
  const backup = { app: 'StudyWise', schemaVersion: 1, data: { courses: [], topics: [], tasks: [], resources: [], settings: {}, attempts: [{ id: 'attempt-1', attemptedAt: '2026-10-28T10:00:00Z', total: 1, correct: 0, results: [{ correct: false, prompt: 'Question?', reviewNote: 'my note' }] }] } };
  assert.equal(validateWorkspaceBackup(backup).ok, true);
  backup.data.attempts[0].results[0].reviewNote = { text: 'not a string' };
  assert.match(validateWorkspaceBackup(backup).error, /practice-history/i);
  backup.data.attempts[0].results[0].reviewNote = 'x'.repeat(2001);
  assert.match(validateWorkspaceBackup(backup).error, /practice-history/i);
});


test('workspace backup accepts bounded topic notes and rejects oversized notes', async () => {
  const { validateWorkspaceBackup } = await import('../src/lib/study-engine.js');
  const backup = { app: 'StudyWise', schemaVersion: 1, data: { courses: [{ id: 'c1', name: 'Data Structures' }], topics: [{ id: 't1', courseId: 'c1', name: 'Arrays', notes: 'Remember the index bounds.' }], tasks: [], resources: [], settings: {} } };
  assert.equal(validateWorkspaceBackup(backup).ok, true);
  backup.data.topics[0].notes = 7;
  assert.match(validateWorkspaceBackup(backup).error, /invalid topic/i);
  backup.data.topics[0].notes = 'x'.repeat(10001);
  assert.match(validateWorkspaceBackup(backup).error, /invalid topic/i);
});


test('planner week navigation returns local Monday-through-Sunday dates', () => {
  const from = new Date(2026, 9, 28, 18); // Wednesday, October 28, 2026
  assert.deepEqual(getWeekDateKeys(from, 0), ['2026-10-26','2026-10-27','2026-10-28','2026-10-29','2026-10-30','2026-10-31','2026-11-01']);
  assert.deepEqual(getWeekDateKeys(from, -1), ['2026-10-19','2026-10-20','2026-10-21','2026-10-22','2026-10-23','2026-10-24','2026-10-25']);
  assert.deepEqual(getWeekDateKeys(from, 1), ['2026-11-02','2026-11-03','2026-11-04','2026-11-05','2026-11-06','2026-11-07','2026-11-08']);
  assert.deepEqual(getWeekDateKeys(from, 1.5), []);
});


test('workspace backup accepts bounded learning outcomes and rejects oversized ones', async () => {
  const { validateWorkspaceBackup } = await import('../src/lib/study-engine.js');
  const backup = { app: 'StudyWise', schemaVersion: 1, data: { courses: [{ id: 'c1', name: 'Data Structures' }], topics: [{ id: 't1', courseId: 'c1', name: 'Arrays', learningOutcome: 'Trace array access and implement traversal.' }], tasks: [], resources: [], settings: {} } };
  assert.equal(validateWorkspaceBackup(backup).ok, true);
  backup.data.topics[0].learningOutcome = 12;
  assert.match(validateWorkspaceBackup(backup).error, /invalid topic/i);
  backup.data.topics[0].learningOutcome = 'x'.repeat(2001);
  assert.match(validateWorkspaceBackup(backup).error, /invalid topic/i);
});

test('sample legacy topic prerequisite names resolve within the same course', async () => {
  const fs = await import('node:fs');
  const source = fs.readFileSync(new URL('../src/main.jsx', import.meta.url), 'utf8');
  const match = source.match(/const initialTopicsRaw = \[([\s\S]*?)\n\];/);
  assert.ok(match, 'initial topic seed should be present');
  const namesByCourse = new Map();
  for (const row of match[1].split('\n')) {
    const id = row.match(/id: '([^']+)'/); const course = row.match(/courseId: '([^']+)'/); const name = row.match(/name: '([^']+)'/); const prerequisite = row.match(/prerequisite: '([^']*)'/);
    if (!id || !course || !name) continue;
    if (!namesByCourse.has(course[1])) namesByCourse.set(course[1], new Set());
    namesByCourse.get(course[1]).add(name[1].toLocaleLowerCase());
    if (prerequisite?.[1]) assert.ok(prerequisite[1].toLocaleLowerCase(), 'prerequisite should be a non-empty topic name');
  }
  for (const row of match[1].split('\n')) {
    const course = row.match(/courseId: '([^']+)'/); const prerequisite = row.match(/prerequisite: '([^']*)'/);
    if (course && prerequisite?.[1]) assert.ok(namesByCourse.get(course[1])?.has(prerequisite[1].toLocaleLowerCase()), `missing demo prerequisite: ${prerequisite[1]}`);
  }
});


test('planner capacity compares open workload to the saved daily target', async () => {
  const tasks = [
    { id: 'done', scheduledDate: '2026-10-28', status: 'done', minutes: 60 },
    { id: 'a', scheduledDate: '2026-10-28', status: 'todo', minutes: 75 },
    { id: 'b', scheduledDate: '2026-10-28', status: 'todo', minutes: 60 },
    { id: 'other', scheduledDate: '2026-10-29', status: 'todo', minutes: 90 },
  ];
  assert.deepEqual(getStudyCapacityForDate(tasks, '2026-10-28', 120, '2026-10-28'), {
    targetMinutes: 120, scheduledMinutes: 135, capacityMinutes: 0, overByMinutes: 15, isOverCapacity: true, taskCount: 2,
  });
  assert.deepEqual(getStudyCapacityForDate(tasks, '2026-10-29', 120, '2026-10-28'), {
    targetMinutes: 120, scheduledMinutes: 90, capacityMinutes: 30, overByMinutes: 0, isOverCapacity: false, taskCount: 1,
  });
});


test('backup validation rejects unresolved prerequisites and accepts valid same-course links', async () => {
  const { validateWorkspaceBackup } = await import('../src/lib/study-engine.js');
  const backup = { app: 'StudyWise', schemaVersion: 1, data: { courses: [{ id: 'c1', name: 'Data Structures' }, { id: 'c2', name: 'Databases' }], topics: [
    { id: 't1', courseId: 'c1', name: 'Arrays', prerequisite: '' },
    { id: 't2', courseId: 'c1', name: 'Linked Lists', prerequisite: 'Arrays' },
  ], tasks: [], resources: [], settings: {} } };
  assert.equal(validateWorkspaceBackup(backup).ok, true);
  backup.data.topics[1].prerequisite = 'Missing topic';
  assert.match(validateWorkspaceBackup(backup).error, /prerequisite/i);
  backup.data.topics[1].prerequisite = 'DBMS topic';
  backup.data.topics.push({ id: 't3', courseId: 'c2', name: 'DBMS topic', prerequisite: '' });
  assert.match(validateWorkspaceBackup(backup).error, /prerequisite/i);
  backup.data.topics.splice(1, 1);
  backup.data.topics[0].prerequisite = 'Arrays';
  assert.match(validateWorkspaceBackup(backup).error, /prerequisite/i);
});


test('finding a future task date keeps undated legacy work on the real current day', () => {
  const legacyToday = [{ id: 'legacy', title: 'Old task', minutes: 100, status: 'todo' }];
  assert.equal(findNextAvailableStudyDate(legacyToday, '2026-10-30', 120, 25, 2, '2026-10-28'), '2026-10-30');
  assert.equal(findNextAvailableStudyDate(legacyToday, '2026-10-28', 120, 25, 2, '2026-10-28'), '2026-10-29');
});


test('prerequisites normalize to stable topic IDs and survive a rename', () => {
  const topics = normalizeTopicPrerequisites([
    { id: 't-arrays', courseId: 'c1', name: 'Arrays', prerequisite: '' },
    { id: 't-lists', courseId: 'c1', name: 'Linked Lists', prerequisite: 'Arrays' },
    { id: 't-arrays-other', courseId: 'c2', name: 'Arrays', prerequisite: '' },
  ]);
  assert.equal(topics[1].prerequisiteTopicId, 't-arrays');
  assert.equal(Object.hasOwn(topics[1], 'prerequisite'), false);
  const renamed = topics.map(topic => topic.id === 't-arrays' ? { ...topic, name: 'Arrays and Strings' } : topic);
  assert.equal(getPrerequisiteBlocker(renamed[1], renamed).name, 'Arrays and Strings');
  const mastered = renamed.map(topic => topic.id === 't-arrays' ? { ...topic, status: 'mastered' } : topic);
  assert.equal(getPrerequisiteBlocker(mastered[1], mastered), null);
});

test('unresolved or deleted prerequisite references never silently unlock a topic', () => {
  const topics = [{ id: 't2', courseId: 'c1', name: 'Trees', prerequisiteTopicId: 'deleted-topic' }];
  assert.equal(getPrerequisiteBlocker(topics[0], topics).unresolved, true);
  const normalized = normalizeTopicPrerequisites(topics);
  assert.equal(normalized[0].prerequisiteTopicId, 'deleted-topic');
});

test('prerequisite cycle detection rejects direct and indirect cycles', () => {
  const topics = [
    { id: 'a', courseId: 'c1', name: 'Arrays', prerequisiteTopicId: '' },
    { id: 'b', courseId: 'c1', name: 'Linked Lists', prerequisiteTopicId: 'a' },
    { id: 'c', courseId: 'c1', name: 'Trees', prerequisiteTopicId: 'b' },
  ];
  assert.equal(wouldCreatePrerequisiteCycle('a', 'b', topics), true);
  assert.equal(wouldCreatePrerequisiteCycle('b', 'c', topics), true);
  assert.equal(wouldCreatePrerequisiteCycle('c', 'a', topics), false);
  assert.equal(wouldCreatePrerequisiteCycle('a', 'a', topics), true);
});

test('backup validator rejects a circular prerequisite graph', async () => {
  const { validateWorkspaceBackup } = await import('../src/lib/study-engine.js');
  const backup = { app: 'StudyWise', schemaVersion: 1, data: {
    courses: [{ id: 'c1', name: 'Data Structures' }],
    topics: [
      { id: 'a', courseId: 'c1', name: 'Arrays', prerequisiteTopicId: 'b' },
      { id: 'b', courseId: 'c1', name: 'Linked Lists', prerequisiteTopicId: 'a' },
    ], tasks: [], resources: [], settings: {},
  } };
  assert.match(validateWorkspaceBackup(backup).error, /circular prerequisite/i);
});


test('ambiguous legacy prerequisite names remain blocked instead of guessing a target', () => {
  const legacy = [
    { id: 'a1', courseId: 'c1', name: 'Overview' },
    { id: 'a2', courseId: 'c1', name: 'Overview' },
    { id: 'b', courseId: 'c1', name: 'Advanced topic', prerequisite: 'Overview' },
  ];
  const normalized = normalizeTopicPrerequisites(legacy);
  assert.equal(normalized[2].prerequisiteTopicId, '');
  assert.equal(normalized[2].prerequisite, 'Overview');
  assert.equal(getPrerequisiteBlocker(normalized[2], normalized).unresolved, true);
});


test('fixed-time overlap detection ignores flexible and completed tasks', () => {
  const tasks = [
    { id: 'a', title: 'Study arrays', scheduledDate: '2026-10-28', time: '9:00 AM', minutes: 60, status: 'todo' },
    { id: 'b', title: 'Practice lists', scheduledDate: '2026-10-28', time: '9:30 AM', minutes: 30, status: 'todo' },
    { id: 'c', title: 'Flexible reading', scheduledDate: '2026-10-28', time: 'Flexible', minutes: 45, status: 'todo' },
    { id: 'd', title: 'Completed session', scheduledDate: '2026-10-28', time: '9:15 AM', minutes: 60, status: 'done' },
    { id: 'e', title: 'Tomorrow', scheduledDate: '2026-10-29', time: '9:15 AM', minutes: 60, status: 'todo' },
  ];
  const conflicts = getScheduledTimeConflicts(tasks, '2026-10-28', '2026-10-28');
  assert.deepEqual(conflicts.map(pair => [pair.first.id, pair.second.id]), [['a', 'b']]);
});

test('time-slot suggestion finds a non-overlapping fixed slot after the selected time', () => {
  const tasks = [
    { id: 'a', title: 'Existing', scheduledDate: '2026-10-28', time: '9:00 AM', minutes: 90, status: 'todo' },
    { id: 'b', title: 'Later', scheduledDate: '2026-10-28', time: '10:00 AM', minutes: 60, status: 'todo' },
  ];
  assert.equal(findNextAvailableTimeSlot(tasks, '2026-10-28', 30, '2026-10-28', '9:00 AM'), '11:00 AM');
  assert.equal(findNextAvailableTimeSlot(tasks, '2026-10-28', 30, '2026-10-28', 'Flexible'), '8:00 AM');
});

test('backup validator accepts resource topic links only when course and topic match', async () => {
  const { validateWorkspaceBackup } = await import('../src/lib/study-engine.js');
  const backup = {
    app: 'StudyWise', schemaVersion: 1,
    data: {
      courses: [{ id: 'c1', name: 'Data Structures' }, { id: 'c2', name: 'Databases' }],
      topics: [{ id: 't1', courseId: 'c1', name: 'Arrays' }],
      tasks: [], resources: [{ id: 'r1', courseId: 'c1', topicId: 't1', title: 'Array notes', kind: 'Notes' }], settings: {},
    },
  };
  assert.equal(validateWorkspaceBackup(backup).ok, true);
  const wrongCourse = structuredClone(backup);
  wrongCourse.data.resources[0].courseId = 'c2';
  assert.equal(validateWorkspaceBackup(wrongCourse).ok, false);
  const missingTopic = structuredClone(backup);
  missingTopic.data.resources[0].topicId = 'missing';
  assert.equal(validateWorkspaceBackup(missingTopic).ok, false);
});

test('planner calendar exposes exam events on the matching date', () => {
  const courses = [
    { id: 'c2', name: 'Databases', examDate: '2026-11-02' },
    { id: 'c1', name: 'Algorithms', examDate: '2026-11-02' },
    { id: 'c3', name: 'Operating Systems', examDate: '2026-11-05' },
    { id: 'bad', name: 'Invalid date', examDate: '2026-02-31' },
  ];
  assert.deepEqual(getExamEventsForDate(courses, '2026-11-02').map(course => course.id), ['c1', 'c2']);
  assert.deepEqual(getExamEventsForDate(courses, '2026-02-31'), []);
  assert.deepEqual(getExamEventsForDate(courses, 'not-a-date'), []);
});

test('upcoming exam list excludes past/invalid dates and applies a limit', () => {
  const from = new Date(2026, 9, 28, 12);
  const courses = [
    { id: 'past', name: 'Past exam', examDate: '2026-10-27' },
    { id: 'later', name: 'Later exam', examDate: '2026-11-12' },
    { id: 'today', name: 'Today exam', examDate: '2026-10-28' },
    { id: 'soon', name: 'Soon exam', examDate: '2026-11-01' },
    { id: 'invalid', name: 'Invalid', examDate: '2026-11-31' },
  ];
  assert.deepEqual(getUpcomingExams(courses, from, 2).map(course => course.id), ['today', 'soon']);
  assert.deepEqual(getUpcomingExams(courses, from, 0), []);
});


test('month calendar is Monday-aligned, contains 42 dates and marks the target month', () => {
  const dates = getMonthCalendarDates(new Date(2026, 9, 28, 12), 0);
  assert.equal(dates.length, 42);
  assert.equal(dates[0].dateKey, '2026-09-28');
  assert.equal(dates[0].isCurrentMonth, false);
  assert.equal(dates.find(day => day.dateKey === '2026-10-01').isCurrentMonth, true);
  assert.equal(dates.find(day => day.dateKey === '2026-10-28').isToday, true);
  assert.equal(new Date(`${dates[0].dateKey}T12:00:00Z`).getUTCDay(), 1);
  assert.equal(new Date(`${dates[41].dateKey}T12:00:00Z`).getUTCDay(), 0);
});

test('month calendar handles leap February, year boundaries and invalid offsets', () => {
  const leapFebruary = getMonthCalendarDates(new Date(2026, 9, 28, 12), -32);
  assert.equal(leapFebruary.length, 42);
  assert.equal(leapFebruary.find(day => day.dateKey === '2024-02-29').day, 29);
  const nextJanuary = getMonthCalendarDates(new Date(2026, 11, 15, 12), 1);
  assert.equal(nextJanuary.find(day => day.isCurrentMonth).dateKey, '2027-01-01');
  assert.deepEqual(getMonthCalendarDates(new Date('invalid'), 0), []);
  assert.deepEqual(getMonthCalendarDates(new Date(2026, 9, 28), 241), []);
});


test('what-if planner previews only sessions that fit and never mutates the source tasks', () => {
  const tasks = [
    { id: 'late', title: 'Late revision', minutes: 30, time: '11:00 AM', status: 'todo' },
    { id: 'early', title: 'Early reading', minutes: 25, time: '9:00 AM', status: 'todo' },
    { id: 'long', title: 'Long practice', minutes: 60, time: '10:00 AM', status: 'todo' },
    { id: 'done', title: 'Already done', minutes: 20, time: '8:00 AM', status: 'done' },
  ];
  const before = structuredClone(tasks);
  const preview = getWhatIfPlan(tasks, 55);
  assert.deepEqual(preview.fitTasks.map(task => task.id), ['early', 'late']);
  assert.deepEqual(preview.deferredTasks.map(task => task.id), ['long']);
  assert.equal(preview.usedMinutes, 55);
  assert.equal(preview.remainingMinutes, 0);
  assert.equal(preview.openTaskCount, 3);
  assert.deepEqual(tasks, before);
});

test('what-if preview flags prerequisite-blocked sessions separately from time that does not fit', () => {
  const topics = [
    { id: 'base', courseId: 'c1', name: 'Basics', status: 'learning', prerequisiteTopicId: '' },
    { id: 'dependent', courseId: 'c1', name: 'Advanced', status: 'learning', prerequisiteTopicId: 'base' },
  ];
  const tasks = [
    { id: 'blocked', title: 'Advanced practice', topicId: 'dependent', minutes: 20, time: '9:00 AM', status: 'todo' },
    { id: 'ready', title: 'Read basics', topicId: 'base', minutes: 30, time: '10:00 AM', status: 'todo' },
    { id: 'too-long', title: 'Long session', minutes: 90, time: '11:00 AM', status: 'todo' },
  ];
  const preview = getWhatIfPlan(tasks, 45, topics);
  assert.deepEqual(preview.fitTasks.map(task => task.id), ['ready']);
  assert.deepEqual(preview.blockedTasks.map(item => [item.task.id, item.blocker.name]), [['blocked', 'Basics']]);
  assert.deepEqual(preview.deferredTasks.map(task => task.id), ['too-long']);
});

test('what-if preview handles an invalid or empty time budget conservatively', () => {
  const tasks = [
    { id: 'open', title: 'Study', minutes: 20, time: 'Flexible', status: 'todo' },
    { id: 'done', title: 'Finished', minutes: 10, time: '8:00 AM', status: 'done' },
  ];
  const zero = getWhatIfPlan(tasks, 0);
  assert.equal(zero.availableMinutes, 0);
  assert.deepEqual(zero.fitTasks, []);
  assert.deepEqual(zero.deferredTasks.map(task => task.id), ['open']);
  const invalid = getWhatIfPlan(tasks, Number.NaN);
  assert.equal(invalid.availableMinutes, 0);
  assert.equal(invalid.openTaskCount, 1);
});
