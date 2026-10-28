import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync(new URL('../src/main.jsx', import.meta.url), 'utf8');
const styles = fs.readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');

test('signed-in workspace uses the purple reference-led navigation system', () => {
  assert.match(styles, /\.sidebar\{width:218px;padding:25px 13px 18px;background:radial-gradient/);
  assert.match(styles, /\.side-link\.active\{color:#fff;background:linear-gradient\(100deg,#8155ff,#5830dc\)/);
  assert.match(styles, /\.premium-dashboard-grid\{display:grid;grid-template-columns:minmax\(0,1fr\) minmax\(310px,370px\)/);
});

test('overview course cards use saved course data and display up to three real courses', () => {
  assert.match(app, /className="premium-course-grid"/);
  assert.match(app, /courses\.slice\(0,4\)\.map\(\(course,index\)/);
  assert.match(app, /className=\{`premium-course-card premium-course-\$\{index%4\}`\}/);
  assert.match(app, /courseTopics\.filter\(topic => topic\.status !== 'mastered'/);
});

test('opening a course card selects that course in the syllabus map', () => {
  assert.match(app, /onOpenCourse=\{courseId=>\{setSelectedSyllabusCourseId\(courseId\);setPage\('syllabus'\)\}\}/);
  assert.match(app, /useState\(initialCourseId&&courses\.some\(course=>course\.id===initialCourseId\)/);
});

test('weekly planner renders a time-aligned grid from dated, timed tasks', () => {
  assert.match(app, /function clockMinutes\(value\)/);
  assert.match(app, /className="week-timetable-head"/);
  assert.match(app, /className="week-timetable-day"/);
  assert.match(app, /getTasksForDate\(tasks,dateKey,todayKey\)/);
  assert.match(app, /className=\{`week-timetable-task tint-\$\{course\?\.color\|\|'violet'\}/);
});

test('visual refresh keeps responsive course cards and a scrollable timetable on narrow screens', () => {
  assert.match(styles, /@media\(max-width:760px\)[\s\S]*?\.active-course-grid\{grid-template-columns:repeat\(2/);
  assert.match(styles, /\.week-timetable-scroll\{overflow-x:auto/);
  assert.match(styles, /@media\(max-width:480px\)[\s\S]*?\.active-course-grid\{grid-template-columns:1fr/);
});

test('course library uses matching art panels and shares the purple workspace card styling', () => {
  assert.match(app, /course-card-banner course-card-banner-\$\{c\.color\|\|'violet'\}/);
  assert.match(styles, /\.course-card-banner-violet\{background:linear-gradient/);
  assert.match(styles, /\.course-card-banner-mint\{background:linear-gradient/);
});
