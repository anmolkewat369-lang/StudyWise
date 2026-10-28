# StudyWise — Semester Rescue MVP

A bright, responsive React + Vite student academic workspace for course and syllabus mapping, date-aware study planning, recovery planning, practice checks, spaced revision, mistake review, resources, and validated data backups. The experience is designed as an action-led academic command center rather than a dashboard wall of charts.

New workspaces can start with a semester setup flow: add several courses, optionally record exam dates, choose a realistic daily study target, then continue directly to the syllabus map. Topic records support explicit learning outcomes, stable ID-linked prerequisites, personal study notes and estimated effort so “I studied it” can become a more observable learning goal. Course and topic records use the same data model throughout the app.

## Run locally

1. Install Node.js 22.12 or later (Node.js 26 is suitable).
2. Extract the ZIP and open the folder containing `package.json` in VS Code.
3. In the VS Code terminal, run:

   ```powershell
   npm install
   npm run dev
   ```

4. Open the local URL printed by Vite (usually `http://localhost:5173`).

## Login behavior

### Preview mode (works without an account backend)

When Supabase keys are not configured, the Log in / Get started buttons open a preview access dialog. Choose a display name and optionally enter an email, then select **Continue to demo**. This is only a local preview profile; it does not verify identity, store a password, or create a real account. Demo study data and the preview profile are saved in that browser's local storage. Use **Settings → Sign out** to exit the preview session.

### Enable real email/password authentication

1. Create a project at [supabase.com](https://supabase.com/).
2. In the Supabase dashboard, make sure Email authentication is enabled.
3. Open the project's Connect/API settings and copy the Project URL and publishable (or anon) key. These client-side values are intended for the browser; **never put a service-role key in this frontend**.
4. Copy `.env.example` to `.env.local` in the project root. Fill these values:

   ```dotenv
   VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
   VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY
   ```

5. Stop the Vite server (`Ctrl+C`) and run `npm run dev` again. Vite reads `.env.local` only when the dev server starts.
6. Use **Create an account** to register. If email confirmation is enabled in Supabase, click the confirmation link before logging in.
7. In Supabase Authentication URL settings, add your local URL (for example `http://localhost:5173`) to the allowed redirect URLs. Add your production domain there before deployment.

Real authentication is handled by Supabase Auth. The client uses the project URL and public browser key; row-level security and authorization must still be configured before storing user data in database tables. In this MVP, course/topic/task data is still local to the browser and is not synced to the user's account.

## Reproducible dependencies

Direct dependency versions are pinned in `package.json`, and `vite.config.js` enables the React plugin for development refresh. A committed `package-lock.json` is still pending because package-registry DNS is unavailable in the current development environment; run `npm install` in an internet-connected environment to create the lockfile before relying on `npm ci`.

## Available scripts

- `npm run dev` — start the development server
- `npm run build` — make a production build in `dist/`
- `npm run preview` — preview the production build locally
- `npm test` — run the dependency-free study-engine test suite
- `npm run check:source` — parse/transpile project JS/JSX and verify relative imports
- `npm run verify` — run tests, source checks, then the production build (requires dependencies installed)

## Project layout

```text
studywise-website/
├── public/                         # Favicon and public assets
├── src/
│   ├── lib/
│   │   └── study-engine.js         # Pure scheduling, recovery, and backup rules
│   ├── main.jsx                    # React application and screen flows
│   ├── styles.css                  # Responsive, accessible visual system
│   └── supabase.js                 # Optional Supabase Auth client
├── docs/
│   ├── visual-reference.png        # Supplied UI inspiration
│   ├── DATA-ARCHITECTURE.md
│   ├── LEVEL-10-ROADMAP.md
│   └── QA-CHECKLIST.md
├── supabase/migrations/            # Prepared per-user schema migrations and RLS policies
├── tests/study-engine.test.js      # Dependency-free domain regression tests
├── tests/visual-design.test.js     # Responsive visual contract regression tests
├── .env.example
├── .gitignore
├── index.html
├── package.json
└── README.md
```

## Important limitations

- Demo data is illustrative, not official university content.
- Real login requires a configured Supabase project.
- Study data remains browser-local in this version; accounts do not yet sync data between devices.
- AI syllabus extraction and live university question-paper analysis are not implemented.

## Visual refresh: reference-led course cards and weekly planner

The signed-in workspace now follows the supplied visual reference more closely: a purple gradient navigation rail with a clear active state, a quieter lilac workspace background, rounded white content panels, colorful course art cards, and a true time-aligned weekly planner. Course cards use the student's saved course/topic records and open the matching course in the syllabus map. The weekly grid positions sessions using their saved date and time; flexible or out-of-hours sessions stay visible in a separate list below the grid. The design remains responsive, with scrollable week columns on small screens rather than compressing the schedule into unreadable cells.

The redesign keeps the product-wide command-center rule: action and real scheduled work first, facts from saved data second, details on demand. Decorative analytics are not added just to imitate a screenshot. See `docs/visual-reference.png` for the supplied composite reference and `tests/visual-design.test.js` for source-level regression checks. These checks validate markup/style contracts, not a rendered browser screenshot.

## Product-wide UX rule: command center, not chart wall
StudyWise is designed around the student's next decision. The overview foregrounds one next action, then gives concise academic context. Every other workspace screen follows the same rule: action first, factual evidence second, details on demand. Avoid decorative charts and fake trends; metrics and workload summaries must be grounded in saved records. See `docs/LEVEL-10-ROADMAP.md` and `docs/QA-CHECKLIST.md` for the review contract.

## Current foundation work

The current working source includes explicit edit/delete flows for the core records, plus a text-only syllabus import: paste syllabus text, inspect and edit the candidate list, then add topics after review. Each topic also supports a personal study note, included in export/restore. It does not parse PDFs or use AI to invent syllabus entries. The small, dependency-free domain module at `src/lib/study-engine.js` handles date calculations, topic-derived metrics, priority scoring, next-exam selection, capacity-aware review scheduling, fixed-time conflict checks, stable prerequisite linking/cycle validation, recovery-plan merging, syllabus text candidates, and mistake-note updates. Its regression tests run with `npm test` and Node's built-in test runner. Recovery Mode now subtracts today's existing open workload from your selected daily capacity, respects exam urgency, avoids duplicate open tasks, and holds a topic back until its stable-ID prerequisite is mastered; renamed topics retain their relationships, circular dependencies are rejected, and ambiguous legacy references stay blocked for repair. Completed sessions do not block a later revision. Knowledge checks are limited to verified question-bank entries matching current topics; clicking Practice from readiness targets that topic when a sample question exists. Completed checks are saved locally and gradually update topic confidence; manually changing a topic status never fabricates a practice-based confidence increase. Errors schedule a closer follow-up while stronger recall gets a longer review interval; the dashboard and Readiness view surface due revisions, and one-click scheduling respects the selected daily time budget. Missed questions keep their answer choices and explanations in a review notebook; students can add a personal remediation note, and marking one reviewed does not remove the original attempt. Workspace backups include practice history and are validated for record IDs, course/topic relationships, dates, numeric ranges, preferences, and nested history before replacing local data.

Study tasks now carry a `scheduledDate`, and the planner navigates previous/next weeks and months, supports daily/weekly/monthly views, marks exam events and actual task workload in a month grid, jumps back to today, and pre-fills new tasks with the selected calendar date. Course exam dates are editable when adding or editing a course. The task editor also detects overlapping fixed-time sessions and can suggest a next available slot, alongside its daily-capacity warning. An on-demand what-if preview compares the selected day with a smaller/larger focus-time budget, flags prerequisite-blocked work separately, and leaves the actual plan untouched until the student chooses Recovery Mode. Courses, topics, tasks, and resources support edit/delete flows; course deletion confirms and removes its linked topics, tasks, and resources. Study tasks and library resources can be linked to a syllabus topic, with backup validation enforcing same-course references and topic deletion clearing those links safely. Resource links open only over HTTP/HTTPS; sample resource cards explicitly show when no link is attached rather than pretending a PDF is present. Browser storage keys are scoped to the demo workspace or the signed-in user's identity to avoid mixing separate local workspaces. Illustrative sample records appear only in demo mode; new authenticated workspaces start empty, and reset behavior preserves that separation.

**Important:** Supabase currently provides authentication only. Study data is still saved in that browser, not synced to a cloud database. Cloud synchronization must not be considered complete until both prepared database migrations are applied, Row Level Security policies are independently verified, and a tested repository/sync adapter is connected. A production Vite build and browser walkthrough are still pending because the package registry could not be reached (`EAI_AGAIN` from `npm ping`); do not treat syntax/transpilation checks as a production build. No lockfile has been fabricated. AI document extraction and AI tutoring are not yet implemented.

## Premium visual direction (October 2026)

The signed-in workspace now follows the approved StudyWise visual direction: midnight indigo navigation, electric-violet actions, soft periwinkle/lilac surfaces, rounded glass-like panels, a prominent “Next Up” action, colorful course cards, a compact weekly strip, a study timeline, and an on-demand right rail for Today's Focus, calendar events, exams, and quick access. The dashboard uses the student's saved course/topic/task data; decorative academic artwork is CSS-rendered rather than a static screenshot, so the actions and content remain functional.

The approved visual reference is available at `docs/visual-reference.png`. The dashboard is responsive and collapses its right rail beneath the main content on smaller screens. This is a source implementation, not a screenshot pasted into the application. Production build and browser screenshot verification still require installing the pinned npm dependencies in an environment with registry access.
