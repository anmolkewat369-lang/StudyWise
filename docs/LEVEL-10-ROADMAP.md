# StudyWise Level 10 Product Roadmap

## Product vision
StudyWise is a personal academic operating system: it turns a student's verified syllabus, exam dates, available time, and demonstrated learning evidence into a feasible plan that adapts as real life changes.

## Product principles
1. Learning evidence matters more than time logged.
2. Never silently delete a student's tasks or notes.
3. A plan must respect explicit time limits and show trade-offs when the goal is infeasible.
4. AI outputs are suggestions; verified source material and deterministic rules remain authoritative.
5. Demo data is clearly labeled and isolated from authenticated users.
6. No readiness percentage should imply certainty the underlying evidence cannot support.
7. Privacy, accessibility, and export/deletion are core requirements.

## Cross-product experience contract: personal academic command center
Every signed-in screen must serve a student decision, not merely display information. Use the following hierarchy everywhere—in the overview, courses, syllabus, planner, readiness, resources, recovery, quiz results, and settings:

1. **Action first:** make the next useful action or the main question of the screen obvious near the top.
2. **Context, not clutter:** show only the few counts, dates, or signals needed to make that decision. Prefer plain-language workload summaries to decorative charts and repeated KPI cards.
3. **Evidence over decoration:** every number, date, trend, status, and visualization must come from real saved data or be unmistakably labelled as illustrative. Never fabricate a trend, streak, deadline, or forecast to fill space.
4. **Progressive disclosure:** expose detail when the student asks for it; keep the default view calm, scannable, and task-oriented.
5. **One clear primary action:** every workspace screen should have a sensible primary action and a useful empty state. Avoid competing calls to action.
6. **Respect the student's capacity:** plans must communicate remaining time and trade-offs without guilt language or false certainty.
7. **Accessible by default:** color is never the only status signal; the main task must work by keyboard, touch, and assistive technology.

A screen passes design review only when a student can answer, quickly: **What matters now? Why? What can I do next?** A chart is allowed only when it answers a real question better than a number, short list, or sentence.

## Milestones

### Level 1–2: Reliable foundation
- [x] Add pure domain helpers for dates, topic metrics, priorities, exam selection, and safe recovery merge.
- [x] Add automated tests for those helpers.
- [x] Replace fixed dashboard date and fixed progress/count values with values derived from current data.
- [x] Add real exam dates to sample courses and allow an exam date when creating a course.
- [x] Add scheduled dates to tasks and make daily planner selection date-aware.
- [x] Navigate the planner across previous/next weeks and jump back to today.
- [x] Scope browser storage by demo workspace or authenticated user to prevent cross-account local-data mixing; seed sample records only in demo mode and start new authenticated workspaces empty.
- [ ] Verify the full application in a browser and complete a clean production build (package installation currently times out in this environment).
- [x] Establish a cross-product command-center design contract: action first, factual signals only, progressive detail.
- [x] Apply the supplied visual direction to the signed-in workspace: purple navigation rail, color-coded course cards, rounded white panels, and responsive time-aligned weekly timetable with real saved sessions.
- [x] Make course cards open the matching course syllabus and keep flexible/out-of-hours work visible without cramming it into the timetable.
- [x] Replace illustrative exam-readiness history and decorative weekly bars with task-grounded summaries.
- [x] Separate self-reported syllabus status from practice-based confidence; status changes do not fabricate confidence evidence.
- [x] Pin direct dependency versions and configure the React Vite plugin.
- [ ] Generate a verified lockfile and complete a clean install/build when package registry access is available.
- [x] Add editing/deletion flows for courses, topics, tasks, and resources; confirm before destructive changes and cascade course cleanup explicitly.
- [x] Make Recovery Mode respect today’s committed workload, use the configured study target, prioritize against the next saved exam (or label its default planning horizon), and keep tracked prerequisites in order.
- [x] Persist practice-check history, update topic confidence gradually from actual answers, and prevent quiz questions from referencing deleted/nonexistent sample topics.
- [x] Validate imported backups for duplicate IDs, malformed records, broken course/topic references, strict calendar dates, bounded numbers, invalid settings, safe resource URLs, and consistent practice-history shape.
- [x] Schedule spaced revision from real practice evidence; bring errors back sooner and surface due reviews with capacity-aware one-click planning.

### Level 3–4: Academic intelligence
- [x] Paste syllabus text and extract editable candidate lines, with duplicate filtering before import (manual review required; no PDF parsing or AI claims).
- [x] Save bounded personal study notes on each topic and include them in validated workspace backups.
- [x] Add explicit, observable learning outcomes to syllabus topics, with bounded backup validation and a matching prepared database column.
- [x] Prerequisites are stable topic-ID links selected from existing topics in the same course; renames preserve links, delete/move clears them, cycle creation is blocked, and ambiguous legacy links stay blocked for repair.
- [x] Add a first-run semester setup wizard to register multiple courses, optional exam dates, and a realistic daily target; take the student directly to the syllabus map.
- [x] Daily, weekly and monthly planner views with date selection, actual task summaries and saved exam events; month-grid domain tests cover leap February, week alignment and year boundaries.
- [x] Fixed-time task overlap detection with a next-available-slot suggestion in the add/edit flow.
- [x] Preview which scheduled sessions fit different time budgets without changing tasks; prerequisite-blocked sessions are separated from work that exceeds the budget.
- [x] Show saved exam dates as events in daily/weekly/monthly planner views and keep upcoming exam lists date-valid.
- [x] Link manual study sessions and resources to same-course syllabus topic records, with safe cleanup and backup reference validation.
- [x] Keep prerequisite gating consistent across readiness suggestions, the revision queue, the error notebook, and practice-question selection.
- Syllabus PDF extraction with source-page references and user confirmation.
- Course topics with prerequisites and explicit learning outcomes.
- Constraint-aware deterministic scheduling with clear conflict explanations.

### Level 5–6: Learning engine
- [x] Topic-aware sample practice questions and saved attempts (small demo bank; not yet a user-editable verified question bank).
- [x] Spaced-revision queue with error-first intervals and capacity-aware scheduling.
- [x] Saved missed-question notebook with original choices, selected/correct answer, explanation, and a non-destructive reviewed state.
- [x] Student-written remediation notes on saved mistakes, preserved with the original attempt snapshot.
- [ ] Source links and broader verified question banks for the error notebook.
- Recovery preview with safe merge/replace choices.
- Readiness estimates based on evidence and uncertainty.
- [x] Initial what-if preview for different available-time scenarios (duration-fit only; external calendar availability and automatic rescheduling remain future work).

### Level 7–8: Grounded AI and exam insights
- Secure server-side AI integration.
- Answers grounded in selected course materials with source references.
- Validated question generation and worked-example support.
- Previous-paper mapping only where source material and rights permit.

### Level 9: Connected ecosystem
- Cloud sync with Supabase Auth, Postgres, tested Row Level Security and migrations.
- Offline-friendly PWA and conflict-aware synchronization.
- Calendar integrations, localization and optional study groups.
- Verified, rights-respecting course packs.

### Level 10: Proven platform
- Accessibility target WCAG 2.2 AA with manual and automated checks.
- Security, privacy, backup, deletion, and operational monitoring.
- Learning-outcome pilot evaluation and calibrated analytics.
- Sustainable pricing validated with students and institutions.

## Current limitations
- Study data is browser-local, even when Supabase Auth is configured; cloud synchronization is not implemented yet.
- AI syllabus extraction and live AI tutoring are not implemented.
- Sample syllabus and quiz material is illustrative, not official academic content. The question bank is intentionally small; a topic without a verified sample question cannot yet run a topic-specific multiple-choice check.
- Full app build/browser verification is blocked until package installation can complete successfully.
