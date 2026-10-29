/** Pure StudyWise domain helpers. Keep scheduling rules independent from the UI. */
export function toLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function isValidDateKey(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

export function daysUntil(dateValue, from = new Date()) {
  if (!isValidDateKey(dateValue)) return null;
  const [year, month, day] = dateValue.split('-').map(Number);
  const target = new Date(year, month - 1, day);
  const today = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  return Math.ceil((target.getTime() - today.getTime()) / 86400000);
}

export function formatDate(dateValue, options = { month: 'short', day: 'numeric' }) {
  if (!isValidDateKey(dateValue)) return 'Not set';
  const [year, month, day] = dateValue.split('-').map(Number);
  const date = new Date(year, month - 1, day, 12, 0, 0, 0);
  return new Intl.DateTimeFormat(undefined, options).format(date);
}

export function addDaysToDateKey(dateKey, offset) {
  if (!isValidDateKey(dateKey) || !Number.isInteger(offset)) return null;
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(year, month - 1, day + offset, 12, 0, 0, 0);
  return toLocalDateKey(date);
}

/** Return Monday–Sunday local date keys for a relative week in the planner. */
export function getWeekDateKeys(from = new Date(), weekOffset = 0) {
  if (!(from instanceof Date) || !Number.isFinite(from.getTime()) || !Number.isInteger(weekOffset)) return [];
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate(), 12, 0, 0, 0);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7) + weekOffset * 7);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return toLocalDateKey(date);
  });
}

/** Return a Monday-aligned six-week calendar grid for a month offset from `from`. */
export function getMonthCalendarDates(from = new Date(), monthOffset = 0) {
  if (!(from instanceof Date) || !Number.isFinite(from.getTime()) || !Number.isInteger(monthOffset) || Math.abs(monthOffset) > 240) return [];
  const anchor = new Date(from.getFullYear(), from.getMonth() + monthOffset, 1, 12, 0, 0, 0);
  const leadingDays = (anchor.getDay() + 6) % 7;
  const firstCell = new Date(anchor.getFullYear(), anchor.getMonth(), 1 - leadingDays, 12, 0, 0, 0);
  const todayKey = toLocalDateKey(from);
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(firstCell);
    date.setDate(firstCell.getDate() + index);
    return {
      dateKey: toLocalDateKey(date),
      day: date.getDate(),
      isCurrentMonth: date.getMonth() === anchor.getMonth(),
      isToday: toLocalDateKey(date) === todayKey,
    };
  });
}

/** Extract only user-supplied text lines as editable syllabus candidates; never invent topics. */
export function extractSyllabusCandidates(text, limit = 200) {
  if (typeof text !== 'string' || !Number.isInteger(limit) || limit < 1) return [];
  const candidates = [];
  const seen = new Set();
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  for (const rawLine of lines) {
    let line = rawLine.replace(/[\t\u00a0]+/g, ' ').trim();
    if (!line || /^\d{1,4}$/.test(line) || /^(?:page\s+\d+(?:\s+of\s+\d+)?|©\s*\d{4})$/i.test(line)) continue;
    line = line.replace(/^(?:[-*•▪◦]|\d+(?:\.\d+)*[.)])\s+/, '');
    line = line.replace(/^(?:unit|chapter|module|topic)\s+\d+\s*[:.\-–—]+\s*/i, '');
    if (/^(?:unit|chapter|module|topic)\s+\d+$/i.test(line)) continue;
    line = line.trim().replace(/^[\s:;,.–—-]+|[\s:;,.–—-]+$/g, '').trim();
    if (line.length < 3 || /^(?:contents?|syllabus|course outcomes?|learning outcomes?|references|bibliography|index|end of document)$/i.test(line)) continue;
    if (/^(?:page|semester|course code|credits|department|university)\b/i.test(line)) continue;
    if (/^\d+(?:\.\d+)*\s+[A-Za-z]/.test(line)) line = line.replace(/^\d+(?:\.\d+)*\s+/, '');
    const key = line.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    candidates.push(line);
    if (candidates.length >= limit) break;
  }
  return candidates;
}

/** Find a date for a review without exceeding the student's daily open-task budget. */
export function findNextAvailableStudyDate(tasks = [], startDateKey = toLocalDateKey(), dailyMinutes = 120, requiredMinutes = 25, maxDays = 30, todayKey = toLocalDateKey()) {
  if (!isValidDateKey(startDateKey) || !Number.isFinite(dailyMinutes) || dailyMinutes < 1
    || !Number.isFinite(requiredMinutes) || requiredMinutes < 1 || !Number.isInteger(maxDays) || maxDays < 0) return null;
  const target = Math.min(requiredMinutes, dailyMinutes);
  for (let offset = 0; offset <= maxDays; offset += 1) {
    const dateKey = addDaysToDateKey(startDateKey, offset);
    const committed = getTasksForDate(tasks, dateKey, todayKey)
      .filter(task => task.status !== 'done')
      .reduce((sum, task) => sum + Math.max(0, Number(task.minutes) || 0), 0);
    if (committed + target <= dailyMinutes) return dateKey;
  }
  return null;
}

/** A factual spaced-revision queue derived from actual practice timestamps. */
export function getReviewQueue(topics = [], from = new Date()) {
  const todayKey = toLocalDateKey(from);
  const scheduled = topics
    .filter(topic => isValidDateKey(topic.nextReviewDate))
    .slice()
    .sort((a, b) => a.nextReviewDate.localeCompare(b.nextReviewDate) || priorityScore(b) - priorityScore(a));
  return {
    todayKey,
    due: scheduled.filter(topic => topic.nextReviewDate <= todayKey),
    upcoming: scheduled.filter(topic => topic.nextReviewDate > todayKey),
  };
}

/** Return recent unanswered learning gaps from saved, incorrect practice results. */
export function getMistakeNotebook(attempts = [], topics = [], limit = 5) {
  const topicById = new Map(topics.map(topic => [topic.id, topic]));
  const mistakes = attempts
    .filter(attempt => typeof attempt.attemptedAt === 'string' && Number.isFinite(Date.parse(attempt.attemptedAt)))
    .slice()
    .sort((a, b) => Date.parse(b.attemptedAt) - Date.parse(a.attemptedAt))
    .flatMap(attempt => (Array.isArray(attempt.results) ? attempt.results : [])
      .map((result, resultIndex) => ({ ...result, attemptId: attempt.id, resultIndex, attemptedAt: attempt.attemptedAt }))
      .filter(result => result.correct === false && result.reviewed !== true && typeof result.prompt === 'string' && result.prompt.trim())
      .map(result => ({
        ...result,
        topicName: topicById.get(result.topicId)?.name || 'Topic removed from syllabus',
        courseId: topicById.get(result.topicId)?.courseId || '',
      })));
  return mistakes.slice(0, Math.max(0, Number.isInteger(limit) ? limit : 5));
}

/** Preserve the attempt snapshot while marking one known mistake as reviewed. */
export function markMistakeReviewed(attempts = [], attemptId, resultIndex) {
  return attempts.map(attempt => attempt.id !== attemptId || !Array.isArray(attempt.results)
    ? attempt
    : { ...attempt, results: attempt.results.map((result, index) => index === resultIndex ? { ...result, reviewed: true } : result) });
}

/** Save a student's own remediation note without deleting or rewriting answer evidence. */
export function saveMistakeNote(attempts = [], attemptId, resultIndex, note) {
  if (typeof note !== 'string' || typeof attemptId !== 'string' || !Number.isInteger(resultIndex) || resultIndex < 0
    || !attempts.some(attempt => attempt.id === attemptId && Array.isArray(attempt.results) && resultIndex < attempt.results.length)) return attempts;
  const reviewNote = note.slice(0, 2000);
  return attempts.map(attempt => attempt.id !== attemptId || !Array.isArray(attempt.results)
    ? attempt
    : { ...attempt, results: attempt.results.map((result, index) => index === resultIndex ? { ...result, reviewNote } : result) });
}

/** Return tasks assigned to a date. Undated legacy tasks belong to today only. */
export function getTasksForDate(tasks = [], dateKey, todayKey = toLocalDateKey()) {
  if (!dateKey) return [];
  return tasks.filter(task => task.scheduledDate
    ? task.scheduledDate === dateKey
    : dateKey === todayKey);
}

function clockTimeMinutes(value) {
  if (typeof value !== 'string') return null;
  const match = value.trim().match(/^(1[0-2]|[1-9]):([0-5]\d)\s*(AM|PM)$/i);
  if (!match) return null;
  const hour = Number(match[1]) % 12;
  return hour * 60 + Number(match[2]) + (match[3].toUpperCase() === 'PM' ? 720 : 0);
}

/** Find overlaps between fixed-time open tasks; flexible tasks intentionally do not conflict. */
export function getScheduledTimeConflicts(tasks = [], dateKey, todayKey = toLocalDateKey()) {
  const scheduled = getTasksForDate(tasks, dateKey, todayKey)
    .filter(task => task.status !== 'done' && task.status !== 'missed')
    .map(task => {
      const start = clockTimeMinutes(task.time);
      const duration = Math.max(0, Number(task.minutes) || 0);
      return { task, start, end: start === null ? null : start + duration };
    })
    .filter(item => item.start !== null && item.end > item.start)
    .sort((a, b) => a.start - b.start);
  const conflicts = [];
  for (let i = 0; i < scheduled.length; i += 1) {
    for (let j = i + 1; j < scheduled.length && scheduled[j].start < scheduled[i].end; j += 1) {
      if (scheduled[i].start < scheduled[j].end && scheduled[j].start < scheduled[i].end) {
        conflicts.push({ first: scheduled[i].task, second: scheduled[j].task });
      }
    }
  }
  return conflicts;
}

/** Suggest a conflict-free fixed time after the current choice, without modifying existing tasks. */
export function findNextAvailableTimeSlot(tasks = [], dateKey, durationMinutes = 30, todayKey = toLocalDateKey(), afterTime = '') {
  if (!isValidDateKey(dateKey) || !Number.isFinite(durationMinutes) || durationMinutes <= 0) return null;
  const slots = ['8:00 AM','9:00 AM','10:00 AM','11:00 AM','12:00 PM','2:00 PM','3:00 PM','4:00 PM','5:00 PM'];
  const startIndex = Math.max(0, slots.indexOf(afterTime));
  const orderedSlots = [...slots.slice(startIndex + (slots.includes(afterTime) ? 1 : 0)), ...slots.slice(0, startIndex + (slots.includes(afterTime) ? 1 : 0))];
  for (const time of orderedSlots) {
    const draft = { id: '__studywise-time-candidate__', title: 'Proposed task', scheduledDate: dateKey, time, minutes: durationMinutes, status: 'todo' };
    const conflicts = getScheduledTimeConflicts([...tasks, draft], dateKey, todayKey);
    if (!conflicts.some(conflict => conflict.first.id === draft.id || conflict.second.id === draft.id)) return time;
  }
  return null;
}

/** A factual, task-based summary for one day; unfinished work is the remaining workload. */
export function getTaskMetricsForDate(tasks = [], dateKey, todayKey = toLocalDateKey()) {
  const dayTasks = getTasksForDate(tasks, dateKey, todayKey);
  const openTasks = dayTasks.filter(task => task.status !== 'done' && task.status !== 'missed');
  const sumMinutes = list => list.reduce((sum, task) => sum + Math.max(0, Number(task.minutes) || 0), 0);
  return {
    total: dayTasks.length,
    done: dayTasks.filter(task => task.status === 'done').length,
    open: openTasks.length,
    remainingMinutes: sumMinutes(openTasks),
    learningMinutes: sumMinutes(openTasks.filter(task => task.type === 'Learn')),
    practiceMinutes: sumMinutes(openTasks.filter(task => task.type !== 'Learn')),
  };
}

/** Compare unfinished work on a date with the student's chosen daily target. */
export function getStudyCapacityForDate(tasks = [], dateKey, dailyMinutes = 120, todayKey = toLocalDateKey()) {
  const targetMinutes = Number.isFinite(Number(dailyMinutes)) ? Math.max(0, Number(dailyMinutes)) : 0;
  const day = getTaskMetricsForDate(tasks, dateKey, todayKey);
  const scheduledMinutes = day.remainingMinutes;
  const capacityMinutes = Math.max(0, targetMinutes - scheduledMinutes);
  const overByMinutes = Math.max(0, scheduledMinutes - targetMinutes);
  return { targetMinutes, scheduledMinutes, capacityMinutes, overByMinutes, isOverCapacity: overByMinutes > 0, taskCount: day.open };
}

/** Preview which open sessions fit in a time budget without mutating the actual plan. */
export function getWhatIfPlan(tasks = [], availableMinutes = 120, topics = []) {
  const budgetValue = Number(availableMinutes);
  const budget = Number.isFinite(budgetValue) ? Math.max(0, Math.min(720, Math.floor(budgetValue))) : 0;
  const topicById = new Map(topics.map(topic => [topic.id, topic]));
  const openTasks = tasks.map((task, index) => ({ task, index }))
    .filter(({ task }) => task.status !== 'done' && task.status !== 'missed')
    .sort((a, b) => {
      const aTime = clockTimeMinutes(a.task.time);
      const bTime = clockTimeMinutes(b.task.time);
      if (aTime !== null && bTime !== null) return aTime - bTime || a.index - b.index;
      if (aTime !== null) return -1;
      if (bTime !== null) return 1;
      return a.index - b.index;
    });
  const fitTasks = [];
  const deferredTasks = [];
  const blockedTasks = [];
  let remainingMinutes = budget;
  for (const { task } of openTasks) {
    const topic = task.topicId ? topicById.get(task.topicId) : null;
    const blocker = topic ? getPrerequisiteBlocker(topic, topics) : null;
    if (blocker) {
      blockedTasks.push({ task, blocker });
      continue;
    }
    const duration = Number(task.minutes);
    if (Number.isFinite(duration) && duration > 0 && duration <= remainingMinutes) {
      fitTasks.push(task);
      remainingMinutes -= duration;
    } else {
      deferredTasks.push(task);
    }
  }
  return {
    availableMinutes: budget,
    fitTasks,
    deferredTasks,
    blockedTasks,
    usedMinutes: budget - remainingMinutes,
    remainingMinutes,
    openTaskCount: openTasks.length,
  };
}

export function getTopicMetrics(topics = []) {
  const total = topics.length;
  const mastered = topics.filter(topic => topic.status === 'mastered').length;
  const learning = topics.filter(topic => topic.status === 'learning').length;
  const averageMastery = total
    ? Math.round(topics.reduce((sum, topic) => sum + Math.max(0, Math.min(100, Number(topic.mastery) || 0)), 0) / total)
    : 0;
  return {
    total,
    mastered,
    learning,
    notStarted: total - mastered - learning,
    coveragePercent: total ? Math.round((mastered / total) * 100) : 0,
    averageMastery,
  };
}

export function priorityScore(topic, { courseExamDate, from = new Date() } = {}) {
  const importance = topic.importance === 'High' ? 1.5 : topic.importance === 'Medium' ? 1 : 0.7;
  const gap = 100 - Math.max(0, Math.min(100, Number(topic.mastery) || 0));
  const notStarted = topic.status === 'not-started' ? 1.2 : 1;
  const daysToExam = courseExamDate ? daysUntil(courseExamDate, from) : null;
  const deadlineWeight = daysToExam === null || daysToExam < 0 ? 1
    : daysToExam <= 3 ? 1.8
      : daysToExam <= 7 ? 1.5
        : daysToExam <= 14 ? 1.25 : 1;
  return (importance * gap * notStarted * deadlineWeight) / Math.max(Number(topic.minutes) || 30, 20);
}

/**
 * Merge a proposed recovery plan without deleting existing work.
 * Exact duplicates are skipped; existing tasks are never replaced or removed.
 */
export function findOpenReviewTask(tasks = [], topicId) {
  if (typeof topicId !== 'string' || !topicId) return null;
  return tasks
    .filter(task => task.topicId === topicId && task.type === 'Revision' && task.status !== 'done')
    .slice()
    .sort((a, b) => String(a.scheduledDate || '9999-12-31').localeCompare(String(b.scheduledDate || '9999-12-31')))[0] || null;
}

export function mergeRecoveryTasks(existingTasks = [], proposedTasks = []) {
  // Completed work is history, not a reason to block future revision. Only active
  // tasks reserve a title; a repeated topic can be scheduled again after completion.
  const keys = new Set(existingTasks
    .filter(task => task.status !== 'done')
    .map(task => `${task.courseId || ''}::${String(task.title || '').trim().toLowerCase()}`));
  const additions = [];
  const skipped = [];
  for (const task of proposedTasks) {
    const key = `${task.courseId || ''}::${String(task.title || '').trim().toLowerCase()}`;
    if (keys.has(key)) {
      skipped.push(task);
      continue;
    }
    keys.add(key);
    additions.push(task);
  }
  return { tasks: [...existingTasks, ...additions], additions, skipped };
}

export function getNextExam(courses = [], from = new Date()) {
  return courses
    .filter(course => course.examDate && daysUntil(course.examDate, from) !== null && daysUntil(course.examDate, from) >= 0)
    .sort((a, b) => a.examDate.localeCompare(b.examDate))[0] || null;
}

/** Return the exam events on one valid local calendar date. */
export function getExamEventsForDate(courses = [], dateKey) {
  if (!isValidDateKey(dateKey)) return [];
  return courses.filter(course => isValidDateKey(course.examDate) && course.examDate === dateKey)
    .slice().sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
}

/** Return upcoming exams in date order, excluding past and malformed dates. */
export function getUpcomingExams(courses = [], from = new Date(), limit = 3) {
  const todayKey = toLocalDateKey(from);
  if (!Number.isInteger(limit) || limit < 1) return [];
  return courses.filter(course => isValidDateKey(course.examDate) && course.examDate >= todayKey)
    .slice().sort((a, b) => a.examDate.localeCompare(b.examDate) || String(a.name || '').localeCompare(String(b.name || '')))
    .slice(0, limit);
}

export function createWorkspaceBackup({ courses, topics, tasks, resources, settings, attempts = [] }, exportedAt = new Date().toISOString()) {
  return {
    app: 'StudyWise',
    schemaVersion: 1,
    exportedAt,
    data: { courses, topics, tasks, resources, settings, attempts },
  };
}

export function validateWorkspaceBackup(value) {
  const invalid = error => ({ ok: false, error });
  if (!value || value.app !== 'StudyWise' || value.schemaVersion !== 1 || !value.data || typeof value.data !== 'object' || Array.isArray(value.data)) {
    return invalid('This file is not a supported StudyWise backup.');
  }
  const { courses, topics, tasks, resources, settings } = value.data;
  const attempts = value.data.attempts === undefined ? [] : value.data.attempts;
  if (![courses, topics, tasks, resources, attempts].every(Array.isArray) || !settings || typeof settings !== 'object' || Array.isArray(settings)) {
    return invalid('The backup is missing required data collections or settings.');
  }
  const records = [courses, topics, tasks, resources, attempts];
  const hasId = list => list.every(item => item && typeof item === 'object' && !Array.isArray(item) && typeof item.id === 'string' && item.id.trim().length > 0);
  if (!records.every(hasId)) return invalid('One or more backup records have a missing or invalid ID.');
  const allUnique = list => new Set(list.map(item => item.id)).size === list.length;
  if (!records.every(allUnique)) return invalid('The backup contains duplicate record IDs.');
  const isOptionalString = (record, key) => record[key] === undefined || typeof record[key] === 'string';
  const isOptionalFiniteNumber = (record, key, min = 0, max = Infinity, integer = false) => {
    if (record[key] === undefined) return true;
    const number = record[key];
    return typeof number === 'number' && Number.isFinite(number) && number >= min && number <= max && (!integer || Number.isInteger(number));
  };
  const optionalDate = (record, key) => record[key] === undefined || record[key] === '' || isValidDateKey(record[key]);
  if (!courses.every(c => typeof c.name === 'string' && c.name.trim()
    && ['code','short','examDate','exam','color','icon'].every(key => isOptionalString(c, key))
    && optionalDate(c, 'examDate')
    && isOptionalFiniteNumber(c, 'units', 1, 100, true)
    && isOptionalFiniteNumber(c, 'topics', 0, 10000, true)
    && isOptionalFiniteNumber(c, 'progress', 0, 100)
    && isOptionalFiniteNumber(c, 'mastery', 0, 100))) {
    return invalid('The backup contains an invalid course record.');
  }
  const courseIds = new Set(courses.map(c => c.id));
  const topicIds = new Set(topics.map(t => t.id));
  const practiceHistoryValid = topic => topic.practiceHistory === undefined || (Array.isArray(topic.practiceHistory)
    && topic.practiceHistory.length <= 20
    && topic.practiceHistory.every(item => item && typeof item === 'object' && !Array.isArray(item)
      && typeof item.correct === 'boolean' && typeof item.attemptedAt === 'string' && Number.isFinite(Date.parse(item.attemptedAt))));
  if (!topics.every(t => typeof t.name === 'string' && t.name.trim() && typeof t.courseId === 'string' && courseIds.has(t.courseId)
    && ['unit','importance','prerequisite','prerequisiteTopicId','learningOutcome','notes','lastPracticedAt','nextReviewDate'].every(key => isOptionalString(t, key))
    && (t.learningOutcome === undefined || t.learningOutcome.length <= 2000)
    && (t.notes === undefined || t.notes.length <= 10000)
    && ['High','Medium','Low',undefined].includes(t.importance)
    && ['mastered','learning','not-started',undefined].includes(t.status)
    && isOptionalFiniteNumber(t, 'minutes', 5, 360, true)
    && isOptionalFiniteNumber(t, 'mastery', 0, 100, true)
    && isOptionalFiniteNumber(t, 'practiceAttempts', 0, 1000000, true)
    && isOptionalFiniteNumber(t, 'practiceCorrect', 0, t.practiceAttempts ?? 1000000, true)
    && (t.lastPracticedAt === undefined || Number.isFinite(Date.parse(t.lastPracticedAt)))
    && optionalDate(t, 'nextReviewDate')
    && practiceHistoryValid(t))) {
    return invalid('The backup contains an invalid topic or a topic linked to a missing course.');
  }
  const topicById = new Map(topics.map(topic => [topic.id, topic]));
  if (!topics.every(topic => {
    const prerequisiteId = String(topic.prerequisiteTopicId || '').trim();
    const legacyName = String(topic.prerequisite || '').trim().toLocaleLowerCase();
    if (prerequisiteId) return topics.some(candidate => candidate.id === prerequisiteId && candidate.id !== topic.id && candidate.courseId === topic.courseId);
    if (!legacyName) return true;
    return topics.filter(candidate => candidate.id !== topic.id && candidate.courseId === topic.courseId
      && String(candidate.name || '').trim().toLocaleLowerCase() === legacyName).length === 1;
  })) return invalid('The backup contains a prerequisite that does not match another topic in the same course.');
  if (topics.some(topic => wouldCreatePrerequisiteCycle(topic.id, topic.prerequisiteTopicId || (topic.prerequisite ? (() => { const matches = topics.filter(candidate => candidate.courseId === topic.courseId && candidate.id !== topic.id && candidate.name.trim().toLocaleLowerCase() === topic.prerequisite.trim().toLocaleLowerCase()); return matches.length === 1 ? matches[0].id : ''; })() : ''), topics))) {
    return invalid('The backup contains a circular prerequisite dependency.');
  }
  if (!tasks.every(t => typeof t.title === 'string' && t.title.trim()
    && ['courseId','type','scheduledDate','time','reason','topicId','reflection'].every(key => isOptionalString(t, key))
    && optionalDate(t, 'scheduledDate')
    && (t.courseId === undefined || t.courseId === '' || courseIds.has(t.courseId))
    && (t.topicId === undefined || t.topicId === '' || (topicIds.has(t.topicId) && (t.courseId === undefined || t.courseId === '' || topicById.get(t.topicId)?.courseId === t.courseId)))
    && ['Learn','Practice','Revision','Quick review',undefined].includes(t.type)
    && ['done','todo','missed',undefined].includes(t.status)
    && isOptionalFiniteNumber(t, 'minutes', 0, 360, true)
    && isOptionalFiniteNumber(t, 'actualMinutes', 0, 360, true))) {
    return invalid('The backup contains an invalid task or a task linked to a missing course or topic.');
  }
  const optionalWebUrl = (record, key) => {
    if (record[key] === undefined || record[key] === '') return true;
    if (typeof record[key] !== 'string') return false;
    try {
      const parsed = new URL(record[key]);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  };
  if (!resources.every(r => typeof r.title === 'string' && r.title.trim()
    && ['courseId','topicId','kind','meta','tone','url'].every(key => isOptionalString(r, key))
    && optionalWebUrl(r, 'url')
    && (r.courseId === undefined || r.courseId === '' || courseIds.has(r.courseId))
    && (r.topicId === undefined || r.topicId === '' || (topicIds.has(r.topicId) && r.courseId === topicById.get(r.topicId)?.courseId))
    && ['Notes','Past paper','Video','Cheat sheet',undefined].includes(r.kind))) {
    return invalid('The backup contains an invalid resource, web link, or resource linked to a missing course.');
  }
  const attemptValid = attempt => {
    if (typeof attempt.attemptedAt !== 'string' || !Number.isFinite(Date.parse(attempt.attemptedAt))) return false;
    if (typeof attempt.total !== 'number' || !Number.isInteger(attempt.total) || attempt.total < 0 || attempt.total > 10000) return false;
    if (typeof attempt.correct !== 'number' || !Number.isInteger(attempt.correct) || attempt.correct < 0 || attempt.correct > attempt.total) return false;
    if (attempt.results === undefined) return true;
    if (!Array.isArray(attempt.results) || attempt.results.length !== attempt.total) return false;
    if (attempt.results.filter(result => result && result.correct === true).length !== attempt.correct) return false;
    return attempt.results.every(result => result && typeof result === 'object' && !Array.isArray(result)
      && typeof result.correct === 'boolean'
      && (result.topicId === undefined || typeof result.topicId === 'string')
      && ['prompt','explanation','reviewNote'].every(key => result[key] === undefined || (typeof result[key] === 'string' && (key !== 'reviewNote' || result[key].length <= 2000)))
      && (result.reviewed === undefined || typeof result.reviewed === 'boolean')
      && (result.choices === undefined || (Array.isArray(result.choices) && result.choices.length >= 2 && result.choices.length <= 10 && result.choices.every(choice => typeof choice === 'string')))
      && ['selectedChoice','correctChoice'].every(key => result[key] === undefined || (typeof result[key] === 'number' && Number.isInteger(result[key]) && result[key] >= 0))
      && (!Array.isArray(result.choices) || (Number.isInteger(result.selectedChoice) && result.selectedChoice < result.choices.length && Number.isInteger(result.correctChoice) && result.correctChoice < result.choices.length))
      && (!(Number.isInteger(result.selectedChoice) && Number.isInteger(result.correctChoice)) || result.correct === (result.selectedChoice === result.correctChoice)));
  };
  if (!attempts.every(attemptValid)) return invalid('The backup contains an invalid practice-history record.');
  if (settings.dailyMinutes !== undefined && (typeof settings.dailyMinutes !== 'number' || !Number.isInteger(settings.dailyMinutes) || settings.dailyMinutes < 30 || settings.dailyMinutes > 360 || settings.dailyMinutes % 30 !== 0)) {
    return invalid('The backup has an invalid daily study target.');
  }
  if (settings.sessionMinutes !== undefined && (typeof settings.sessionMinutes !== 'number' || ![15,25,40,50].includes(settings.sessionMinutes))) {
    return invalid('The backup has an invalid preferred session length.');
  }
  if (settings.reminders !== undefined && typeof settings.reminders !== 'boolean') return invalid('The backup has an invalid reminders setting.');
  if (settings.weeklyRecap !== undefined && typeof settings.weeklyRecap !== 'boolean') return invalid('The backup has an invalid weekly recap setting.');
  return { ok: true, data: { courses, topics, tasks, resources, settings, attempts } };
}

/** Migrate legacy name-based links to stable topic IDs when the target is unambiguous. */
export function normalizeTopicPrerequisites(topics = []) {
  return topics.map(topic => {
    const explicitId = String(topic.prerequisiteTopicId || '').trim();
    const legacyName = String(topic.prerequisite || '').trim();
    const legacyMatches = legacyName ? topics.filter(candidate => candidate.id !== topic.id && candidate.courseId === topic.courseId
      && String(candidate.name || '').trim().toLocaleLowerCase() === legacyName.toLocaleLowerCase()) : [];
    const target = explicitId
      ? topics.find(candidate => candidate.id === explicitId && candidate.id !== topic.id && candidate.courseId === topic.courseId)
      : legacyMatches.length === 1 ? legacyMatches[0] : null;
    const { prerequisite, ...rest } = topic;
    if (target) return { ...rest, prerequisiteTopicId: target.id };
    // Preserve unresolved links instead of silently removing a dependency.
    if (explicitId) return { ...rest, prerequisiteTopicId: explicitId };
    if (legacyName) return { ...rest, prerequisiteTopicId: '', prerequisite: legacyName };
    return { ...rest, prerequisiteTopicId: '' };
  });
}

/** Prevent circular learning dependencies when a prerequisite is selected. */
export function wouldCreatePrerequisiteCycle(topicId, prerequisiteTopicId, topics = []) {
  if (!topicId || !prerequisiteTopicId) return false;
  const byId = new Map(topics.map(topic => [topic.id, topic]));
  const visited = new Set();
  let cursorId = prerequisiteTopicId;
  while (cursorId) {
    if (cursorId === topicId) return true;
    if (visited.has(cursorId)) return true;
    visited.add(cursorId);
    const current = byId.get(cursorId);
    if (!current) return false;
    const linkedId = String(current.prerequisiteTopicId || '').trim();
    if (linkedId) {
      cursorId = linkedId;
      continue;
    }
    const legacyName = String(current.prerequisite || '').trim().toLocaleLowerCase();
    const legacyMatches = legacyName ? topics.filter(topic => topic.courseId === current.courseId && topic.id !== current.id
      && String(topic.name || '').trim().toLocaleLowerCase() === legacyName) : [];
    cursorId = legacyMatches.length === 1 ? legacyMatches[0].id : '';
  }
  return false;
}

/** Resolve prerequisite links by ID. Legacy names are supported only for migration. */
export function getPrerequisiteBlocker(topic, topics = []) {
  const prerequisiteId = String(topic?.prerequisiteTopicId || '').trim();
  const legacyName = String(topic?.prerequisite || '').trim();
  if (!prerequisiteId && !legacyName) return null;
  const prerequisite = prerequisiteId
    ? topics.find(candidate => candidate.id === prerequisiteId && candidate.id !== topic.id && candidate.courseId === topic.courseId)
    : (() => {
      const matches = topics.filter(candidate => candidate.id !== topic.id && candidate.courseId === topic.courseId
        && String(candidate.name || '').trim().toLocaleLowerCase() === legacyName.toLocaleLowerCase());
      return matches.length === 1 ? matches[0] : null;
    })();
  if (!prerequisite) return { id: null, courseId: topic.courseId, name: legacyName || 'Unresolved prerequisite', status: 'not-started', unresolved: true };
  return prerequisite.status === 'mastered' ? null : prerequisite;
}

/** Build a recovery proposal that fits the time left after today's existing tasks. */
export function createRecoveryPlan({
  courses = [],
  topics = [],
  tasks = [],
  dateKey,
  totalMinutes = 120,
  urgencyDays = 7,
  focus = 'balanced',
}) {
  const existingToday = getTasksForDate(tasks, dateKey, dateKey).filter(task => task.status !== 'done');
  const committedMinutes = existingToday.reduce((sum, task) => sum + Math.max(0, Number(task.minutes) || 0), 0);
  const availableMinutes = Math.max(0, Math.max(0, Number(totalMinutes) || 0) - committedMinutes);
  const existingKeys = new Set(tasks
    .filter(task => task.status !== 'done')
    .map(task => `${task.courseId || ''}::${String(task.title || '').trim().toLowerCase()}`));
  const importanceWeight = topic => topic.importance === 'High' ? 1.5 : topic.importance === 'Medium' ? 1 : 0.7;
  const score = topic => {
    const importance = importanceWeight(topic);
    const mastery = Math.max(0, Math.min(100, Number(topic.mastery) || 0));
    const gap = 100 - mastery;
    if (focus === 'weak') return gap * importance;
    const timeFit = focus === 'rescue' ? 1 / Math.sqrt(Math.max(15, Number(topic.minutes) || 30)) : 1;
    const urgency = urgencyDays <= 3 ? (topic.importance === 'High' ? 1.8 : 0.9) : urgencyDays <= 7 ? (topic.importance === 'High' ? 1.35 : 1) : 1;
    const notStarted = topic.status === 'not-started' ? 1.2 : 1;
    return importance * gap * timeFit * urgency * notStarted / Math.sqrt(Math.max(15, Number(topic.minutes) || 30));
  };
  const unfinishedTopics = topics.filter(topic => topic.status !== 'mastered');
  const blockedTopics = unfinishedTopics.filter(topic => getPrerequisiteBlocker(topic, topics));
  const ranked = unfinishedTopics.filter(topic => !getPrerequisiteBlocker(topic, topics)).slice().sort((a, b) => score(b) - score(a));
  const plan = [];
  const includedIds = new Set();
  let remainingMinutes = availableMinutes;
  for (const topic of ranked) {
    if (remainingMinutes < 15) break;
    const title = `${topic.status === 'learning' ? 'Practice' : 'Study'} ${topic.name}`;
    const key = `${topic.courseId || ''}::${title.trim().toLowerCase()}`;
    if (existingKeys.has(key)) continue;
    const requested = Math.max(15, Number(topic.minutes) || 30);
    const duration = Math.min(requested, remainingMinutes, focus === 'rescue' ? 45 : requested);
    const course = courses.find(item => item.id === topic.courseId);
    plan.push({
      id: `recovery-${topic.id}-${dateKey}`,
      title,
      courseId: topic.courseId,
      type: topic.status === 'learning' ? 'Practice' : 'Learn',
      minutes: duration,
      time: plan.length === 0 ? 'Next up' : `${plan.length + 1} task`,
      scheduledDate: dateKey,
      status: 'todo',
      reason: `${course?.short || 'Course'} · ${String(topic.importance || 'medium').toLowerCase()} importance · ${Math.max(0, Math.min(100, Number(topic.mastery) || 0))}% current mastery`,
      topicId: topic.id,
    });
    includedIds.add(topic.id);
    remainingMinutes -= duration;
  }
  const duplicateTopics = ranked.filter(topic => {
    const title = `${topic.status === 'learning' ? 'Practice' : 'Study'} ${topic.name}`;
    return existingKeys.has(`${topic.courseId || ''}::${title.trim().toLowerCase()}`);
  }).length;
  return {
    plan,
    committedMinutes,
    availableMinutes,
    plannedMinutes: plan.reduce((sum, task) => sum + task.minutes, 0),
    remainingMinutes: Math.max(0, availableMinutes - plan.reduce((sum, task) => sum + task.minutes, 0)),
    remainingTopics: Math.max(0, ranked.length - includedIds.size - duplicateTopics) + blockedTopics.length,
    blockedTopics: blockedTopics.length,
    duplicateTopics,
  };
}

/** Update topic evidence from actual answer outcomes, retaining a bounded history. */
export function applyPracticeResults(topics = [], results = [], attemptedAt = new Date().toISOString()) {
  const resultsByTopic = new Map();
  for (const result of results) {
    if (!result || typeof result.topicId !== 'string' || typeof result.correct !== 'boolean') continue;
    const list = resultsByTopic.get(result.topicId) || [];
    list.push(result);
    resultsByTopic.set(result.topicId, list);
  }
  return topics.map(topic => {
    const outcomes = resultsByTopic.get(topic.id);
    if (!outcomes?.length) return topic;
    const priorAttempts = Math.max(0, Number(topic.practiceAttempts) || 0);
    const priorCorrect = Math.max(0, Number(topic.practiceCorrect) || 0);
    let mastery = Math.max(0, Math.min(100, Number(topic.mastery) || 0));
    let history = Array.isArray(topic.practiceHistory) ? topic.practiceHistory.slice() : [];
    let attempts = priorAttempts;
    let correctCount = priorCorrect;
    let wasIncorrect = false;
    for (const outcome of outcomes) {
      // Current confidence acts as five prior observations; a real answer then shifts it.
      mastery = Math.round((mastery * 5 + (outcome.correct ? 100 : 0)) / 6);
      attempts += 1;
      if (outcome.correct) correctCount += 1;
      else wasIncorrect = true;
      history.push({ correct: outcome.correct, attemptedAt });
    }
    const status = wasIncorrect
      ? 'learning'
      : (topic.status === 'mastered' || (mastery >= 85 && attempts >= 3) ? 'mastered' : 'learning');
    const attemptTimestamp = new Date(attemptedAt);
    const attemptDate = Number.isFinite(attemptTimestamp.getTime()) ? toLocalDateKey(attemptTimestamp) : toLocalDateKey();
    const reviewInterval = wasIncorrect ? 1 : mastery >= 80 ? 7 : mastery >= 60 ? 3 : 1;
    return {
      ...topic,
      mastery,
      status,
      practiceAttempts: attempts,
      practiceCorrect: correctCount,
      lastPracticedAt: attemptedAt,
      nextReviewDate: addDaysToDateKey(attemptDate, reviewInterval),
      practiceHistory: history.slice(-20),
    };
  });
}
