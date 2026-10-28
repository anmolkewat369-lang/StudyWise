# StudyWise release QA checklist

## Install and package
- [ ] Extract the ZIP into a clean folder.
- [ ] Confirm `package.json` is inside the extracted `StudyWise/` project folder.
- [ ] Run `npm install` in an internet-connected environment (this source archive intentionally contains no fabricated lockfile).
- [ ] After a lockfile is generated, commit it and verify `npm ci` from a clean checkout.
- [x] Add `npm run check:source` and `npm run verify` scripts for repeatable local checks.
- [ ] Configure and run a real project typecheck/linter (scripts and configs are not present yet).
- [ ] `npm test` succeeds.
- [ ] `npm run build` succeeds.
- [ ] Verify ZIP integrity and launch the production preview.

## Command-center UX (all workspace screens)
- [ ] Overview makes one recommended next action clear before secondary metrics.
- [ ] Every count, progress indicator, date, and trend is derived from stored data or visibly labelled as illustrative.
- [ ] No decorative charts, fake history, arbitrary streaks, or repeated KPI-card walls.
- [ ] Courses, syllabus, plan, readiness, resources, recovery, quiz results, and settings each have a clear purpose and primary action.
- [ ] Detail is revealed on demand; empty states explain a useful next step.
- [ ] A student can answer “What matters now, why, and what next?” without scanning multiple charts.

## Core data behavior
- [x] Wire add, edit, and delete flows for a course, topic, task, and resource in the UI (manual browser verification remains pending).
- [ ] Verify each CRUD flow in a browser, including confirmation cancellation and linked-data cleanup.
- [ ] Refresh and confirm data persists in the correct workspace.
- [ ] Switch demo/authenticated identities and confirm browser data is isolated.
- [ ] A new authenticated workspace starts empty; the illustrative sample records appear only in demo mode.
- [ ] Reset clears an authenticated workspace but restores sample records only for the demo workspace.
- [ ] Export and import data without silent overwrites.
- [ ] Dashboard/course metrics match topic records.
- [ ] Semester setup accepts one or many named courses, optional course codes/exam dates, and a 30–360 minute daily target.
- [ ] Semester setup rejects duplicate names and unfinished rows, supports adding/removing rows, and opens the syllabus map after saving.
- [ ] Semester setup is keyboard operable and usable on narrow mobile screens.
- [x] Text syllabus import proposes only lines from user-pasted text, exposes an editable preview, and skips duplicate topic names.
- [x] Topic study notes support add/edit, are bounded to 10,000 characters, and are validated in backup import.
- [x] Topic learning outcomes support add/edit, are bounded to 2,000 characters, appear in topic details, and are validated in backup import.
- [x] Prerequisites use valid same-course topic options rather than free-text entry and are stored as stable topic IDs.
- [x] Renaming preserves prerequisite links by ID; moving or deleting a prerequisite topic clears its dependents safely.
- [x] Legacy prerequisite names migrate only when one same-course target exists; unresolved/ambiguous links remain blocked and backup import rejects them.
- [ ] Exam countdown uses the next valid exam date.
- [x] Saved exam dates appear as selectable events in the planner daily view and as named events in the weekly overview.
- [x] Month grid aligns Monday–Sunday, includes 42 date cells and handles leap months/year boundaries in domain tests.
- [ ] Verify multiple exams on the same date, event date edits, and month/week boundary rendering in the browser.
- [ ] Planner date selection shows the correct scheduled tasks.
- [x] Planner capacity shows open workload, remaining capacity, and the exact over-target amount without counting completed tasks.
- [x] Week navigation calculates Monday–Sunday ranges across month boundaries.
- [ ] Verify the selected calendar date pre-fills the add-task form and that the saved task appears on that date.
- [x] Add/edit task forms show current scheduled load against the daily target and offer a nearest feasible date when one is found.
- [x] Fixed-time overlaps are detected for open tasks and the editor can suggest a non-overlapping next slot.
- [x] The on-demand what-if preview compares open session durations with a selectable budget, excludes completed work and separately flags prerequisite-blocked sessions without mutating the plan.
- [ ] Verify the what-if control and Recovery Mode handoff in a real browser.
- [x] Manual tasks can link to a same-course syllabus topic; switching course clears incompatible links.
- [x] Resources can link to a same-course topic, show the link in the library, and keep their record if the topic is deleted.
- [x] Readiness, revision queue, mistake notebook actions, and quiz selection respect prerequisite locks.
- [ ] Verify topic-linked tasks/resources and prerequisite locks in a real browser.
- [ ] Attempt a task/topic link mismatch directly against a test Supabase database and confirm the database rejects it.
- [x] Existing recovery-task durations remain selectable when editing, even if they are not one of the common quick durations.
- [ ] Recovery Mode never deletes old tasks and reports duplicates skipped.
- [x] Quiz attempts update topic evidence gradually, store answer snapshots locally, and schedule conservative next-review dates.
- [x] Revision queue distinguishes due/upcoming reviews; scheduled reviews fit the next available daily time budget.
- [x] Saved incorrect answers retain answer choices and explanations; marking reviewed preserves attempt history.
- [x] Students can attach an editable, bounded personal review note to a mistake without altering the recorded answer.
- [x] Recovery Mode deducts today’s open task minutes before proposing new work, respects known prerequisites, allows later revision after a task is completed, and avoids duplicate open tasks.
- [x] Backup validation checks IDs, course/topic references, strict calendar dates, numeric bounds, settings, and practice-history structure.
- [x] Click-through domain coverage for targeted topic checks, prerequisite-aware recovery, repeated revision, and strict backup dates (browser verification remains pending).
- [ ] Verify quiz history, backup import/export, recovery capacity, spaced-revision queue, and error-notebook state changes in a browser.

## Auth and security
- [ ] Demo access works without credentials and is labeled as demo.
- [ ] Supabase sign-up, confirmation, login, session restore, reset and logout work when configured.
- [x] Prepare schema migrations and per-user RLS policies, including database enforcement of same-course task/topic links (migrations have not yet been executed against a Supabase project).
- [ ] Apply both database migrations in order and independently verify RLS policies and same-course task/topic constraints before cloud data is enabled.
- [ ] User A cannot read or mutate User B's rows.
- [ ] No service-role or private AI key appears in frontend assets.

## Accessibility and responsive UI
- [ ] All primary actions work with keyboard and mouse/touch.
- [ ] Inputs have labels and errors are announced.
- [ ] Focus indicators and contrast are usable.
- [ ] Mobile, tablet and desktop layouts are checked.
- [ ] Empty, loading, success, and error states are understandable.

- [x] Prerequisite references use stable topic IDs; verify rename preserves a link, deleting/moving a source topic clears dependents, cycles are rejected, and ambiguous legacy names do not guess.


## Reference-led UI regression checks

- [ ] Verify the purple navigation rail and active item at desktop and mobile widths.
- [ ] Verify active course cards reflect saved course/topic records and open the selected course in the syllabus map.
- [ ] Verify weekly planner sessions align with saved dates/times, completed sessions remain identifiable, and flexible/out-of-hours work appears below the time grid.
- [ ] Verify the weekly schedule remains horizontally scrollable on small screens and task cards remain clickable by keyboard/touch.
- [ ] Run a production browser walkthrough; source-level visual tests do not replace this step.


## Reference-led visual review

- [ ] Confirm the signed-in shell uses the purple navigation rail and readable active state at desktop widths.
- [ ] Confirm course cards show each saved course's own title, progress, and exam context and open that course in the syllabus map.
- [ ] Confirm weekly schedule blocks align with saved task date, start time, and duration; overlaps remain visible in distinct lanes.
- [ ] Confirm exams are marked on the correct date and flexible/out-of-hours sessions remain accessible below the timetable.
- [ ] Check keyboard focus, text contrast, touch target sizes, and responsive layout at desktop, tablet, and phone widths.
- [ ] Capture a real browser screenshot and complete smoke tests after `npm install` and `npm run build` succeed.
