const tables = {
  courses: 'studywise_courses',
  topics: 'studywise_topics',
  tasks: 'studywise_tasks',
  resources: 'studywise_resources',
  attempts: 'studywise_practice_attempts',
};

function nullable(value) {
  return value || null;
}

export function toDatabaseWorkspace(workspace, userId) {
  return {
    courses: workspace.courses.map(course => ({
      user_id: userId, id: course.id, name: course.name, short: course.short || '', code: course.code || '',
      color: course.color || 'violet', icon: course.icon || 'book', units: Number(course.units) || 1,
      exam_date: nullable(course.examDate),
    })),
    topics: workspace.topics.map(topic => ({
      user_id: userId, id: topic.id, course_id: topic.courseId, name: topic.name, unit: topic.unit || '',
      importance: topic.importance || 'Medium', status: topic.status || 'not-started', mastery: Number(topic.mastery) || 0,
      minutes: Number(topic.minutes) || 30, prerequisite_topic_id: nullable(topic.prerequisiteTopicId),
      learning_outcome: topic.learningOutcome || '', notes: topic.notes || '', practice_attempts: Number(topic.practiceAttempts) || 0,
      practice_correct: Number(topic.practiceCorrect) || 0, last_practiced_at: nullable(topic.lastPracticedAt),
      next_review_date: nullable(topic.nextReviewDate), practice_history: topic.practiceHistory || [],
    })),
    tasks: workspace.tasks.map(task => ({
      user_id: userId, id: task.id, course_id: nullable(task.courseId), topic_id: nullable(task.topicId), title: task.title,
      task_type: task.type || 'Learn', minutes: Number(task.minutes) || 0, time_label: task.time || 'Flexible',
      scheduled_date: nullable(task.scheduledDate), status: task.status || 'todo', reason: task.reason || '',
    })),
    resources: workspace.resources.map(resource => ({
      user_id: userId, id: resource.id, course_id: nullable(resource.courseId), topic_id: nullable(resource.topicId),
      title: resource.title, kind: resource.kind || 'Notes', meta: resource.meta || '', tone: resource.tone || 'violet', url: resource.url || '',
    })),
    attempts: workspace.attempts.map(attempt => ({
      user_id: userId, id: attempt.id, attempted_at: attempt.attemptedAt, total: Number(attempt.total) || 0,
      correct: Number(attempt.correct) || 0, results: attempt.results || [],
    })),
  };
}

export function fromDatabaseWorkspace(data) {
  return {
    courses: (data.courses || []).map(row => ({ ...row, examDate: row.exam_date || '', exam: row.exam_date || 'Not set' })),
    topics: (data.topics || []).map(row => ({
      ...row, courseId: row.course_id, prerequisiteTopicId: row.prerequisite_topic_id || '', learningOutcome: row.learning_outcome || '',
      practiceAttempts: row.practice_attempts || 0, practiceCorrect: row.practice_correct || 0, lastPracticedAt: row.last_practiced_at || '',
      nextReviewDate: row.next_review_date || '', practiceHistory: row.practice_history || [],
    })),
    tasks: (data.tasks || []).map(row => ({ ...row, courseId: row.course_id || '', topicId: row.topic_id || '', type: row.task_type, time: row.time_label, scheduledDate: row.scheduled_date || '' })),
    resources: (data.resources || []).map(row => ({ ...row, courseId: row.course_id || '', topicId: row.topic_id || '' })),
    attempts: (data.attempts || []).map(row => ({ ...row, attemptedAt: row.attempted_at })),
    settings: data.settings || {},
  };
}

async function deleteStaleRows(client, table, rows, userId) {
  const { data: existing, error: readError } = await client.from(table).select('id').eq('user_id', userId);
  if (readError) throw readError;
  const ids = new Set(rows.map(row => row.id));
  const staleIds = (existing || []).map(row => row.id).filter(id => !ids.has(id));
  if (staleIds.length) {
    const { error } = await client.from(table).delete().eq('user_id', userId).in('id', staleIds);
    if (error) throw error;
  }
}

async function upsertRows(client, table, rows) {
  if (!rows.length) return;
  const { error } = await client.from(table).upsert(rows, { onConflict: 'user_id,id' });
  if (error) throw error;
}

export async function loadWorkspace(client, userId) {
  const [courses, topics, tasks, resources, attempts, settings] = await Promise.all([
    client.from(tables.courses).select('*').eq('user_id', userId), client.from(tables.topics).select('*').eq('user_id', userId),
    client.from(tables.tasks).select('*').eq('user_id', userId), client.from(tables.resources).select('*').eq('user_id', userId),
    client.from(tables.attempts).select('*').eq('user_id', userId), client.from('studywise_user_settings').select('settings').eq('user_id', userId).maybeSingle(),
  ]);
  for (const result of [courses, topics, tasks, resources, attempts, settings]) if (result.error) throw result.error;
  return fromDatabaseWorkspace({ courses: courses.data, topics: topics.data, tasks: tasks.data, resources: resources.data, attempts: attempts.data, settings: settings.data?.settings || {} });
}

export async function saveWorkspace(client, userId, workspace) {
  const data = toDatabaseWorkspace(workspace, userId);
  await upsertRows(client, tables.courses, data.courses);
  await upsertRows(client, tables.topics, data.topics);
  await upsertRows(client, tables.tasks, data.tasks);
  await upsertRows(client, tables.resources, data.resources);
  await upsertRows(client, tables.attempts, data.attempts);
  await deleteStaleRows(client, tables.resources, data.resources, userId);
  await deleteStaleRows(client, tables.tasks, data.tasks, userId);
  await deleteStaleRows(client, tables.topics, data.topics, userId);
  await deleteStaleRows(client, tables.courses, data.courses, userId);
  await deleteStaleRows(client, tables.attempts, data.attempts, userId);
  const { error } = await client.from('studywise_user_settings').upsert({ user_id: userId, settings: workspace.settings }, { onConflict: 'user_id' });
  if (error) throw error;
}
