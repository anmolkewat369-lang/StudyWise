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

### Development-only demo

When running Vite locally with `npm run dev`, the Log in / Get started buttons offer a clearly labeled local demo if Supabase is not configured. This is sample data, does not verify identity, and is stored only in that browser. It is not available in a production build. If production Supabase configuration is missing, StudyWise displays an account-configuration error instead of opening a demo profile.

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
6. Use **Create an account** to register. Confirm your email from the message Supabase sends before logging in. From the login dialog, use **Forgot password?** to request a reset link; password recovery returns to the configured site URL.
7. In Supabase Authentication URL settings, add your local URL (for example `http://localhost:5173`) to the allowed redirect URLs. Add your production domain there before deployment.

Real authentication is handled by Supabase Auth. The client uses the project URL and public browser key; never use a service-role key in Vercel or in this browser application.

### Enable private cloud workspaces

Before deploying, apply every SQL file in `supabase/migrations/` to the same Supabase project, in filename order. The migrations create the per-user workspace tables, enforce task/topic relationships, and add focus-session reflection fields. Row Level Security policies restrict each student's workspace rows to their authenticated account.

Authenticated workspace data is loaded from and saved to Supabase; it is not treated as a browser-local source of truth. If cloud loading fails, the app does not upload stale browser data over the remote workspace. The local demo remains isolated and is never written to Supabase. A migration file being present in this repository does not mean it has been applied to your Supabase project.

For Vercel, configure these production environment variables (not the service-role key), then redeploy:

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY
```

In Supabase Authentication URL settings, add the final Vercel domain (`https://studywise-vzau.vercel.app`) and any custom domain to the redirect allow-list. Configure the confirmation and password-recovery email templates with that same production redirect URL before inviting real users.

New authenticated workspaces with no saved courses are guided through semester setup, then shown a checklist for their profile, subjects, syllabus, study availability, and first session. The dashboard starts the next open task in a pausable focus timer and records a brief reflection on completion. Missed tasks remain visible but are excluded from remaining-time and open-task totals. PDF/image syllabus extraction and device notifications are not enabled; syllabus import currently prepares candidates from pasted text for review.

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
- Real login and cross-device cloud workspaces require a configured Supabase project with the supplied migrations applied.
- AI syllabus extraction and live university question-paper analysis are not implemented.

## Visual refresh: reference-led course cards and weekly planner

The signed-in workspace now follows the supplied visual reference more closely: a purple gradient navigation rail with a clear active state, a quieter lilac workspace background, rounded white content panels, colorful course art cards, and a true time-aligned weekly planner. Course cards use the student's saved course/topic records and open the matching course in the syllabus map. The weekly grid positions sessions using their saved date and time; flexible or out-of-hours sessions stay visible in a separate list below the grid. The design remains responsive, with scrollable week columns on small screens rather than compressing the schedule into unreadable cells.

The redesign keeps the product-wide command-center rule: action and real scheduled work first, facts from saved data second, details on demand. Decorative analytics are not added just to imitate a screenshot. See `docs/visual-reference.png` for the supplied composite reference and `tests/visual-design.test.js` for source-level regression checks. These checks validate markup/style contracts, not a rendered browser screenshot.

## Product-wide UX rule: command center, not chart wall
StudyWise is designed around the student's next decision. The overview foregrounds one next action, then gives concise academic context. Every other workspace screen follows the same rule: action first, factual evidence second, details on demand. Avoid decorative charts and fake trends; metrics and workload summaries must be grounded in saved records. See `docs/LEVEL-10-ROADMAP.md` and `docs/QA-CHECKLIST.md` for the review contract.

## Current foundation work

The current working source includes edit/delete flows for core records and a text-only syllabus import: paste syllabus text, inspect and edit candidates, then add topics after review. PDF parsing and AI-generated topics are not implemented. The domain helpers in `src/lib/study-engine.js` cover local-date calculations, task metrics, priority, review scheduling, time conflicts, prerequisite validation, recovery planning, and text candidates. Knowledge checks save real answer snapshots and update topic evidence gradually; an authenticated workspace stores that evidence through Supabase, while the development demo remains local. Workspace backups are validated before import. The planner supports daily, weekly, and monthly views, exam events, fixed-time conflict detection, and a what-if capacity preview. Tasks, courses, topics, and resources support CRUD; records retain stable topic links and resource URLs are limited to HTTP/HTTPS. Authenticated workspaces start empty and load their records from Supabase after successful authentication.

**Important:** Supabase cloud workspaces depend on the supplied migrations being applied and RLS being independently verified in the target project. A production Vite build passes locally. AI document extraction and AI tutoring are not implemented.

## Premium visual direction (October 2026)

The signed-in workspace now follows the approved StudyWise visual direction: midnight indigo navigation, electric-violet actions, soft periwinkle/lilac surfaces, rounded glass-like panels, a prominent “Next Up” action, colorful course cards, a compact weekly strip, a study timeline, and an on-demand right rail for Today's Focus, calendar events, exams, and quick access. The dashboard uses the student's saved course/topic/task data; decorative academic artwork is CSS-rendered rather than a static screenshot, so the actions and content remain functional.

The approved visual reference is available at `docs/visual-reference.png`. The dashboard is responsive and collapses its right rail beneath the main content on smaller screens. This is a source implementation, not a screenshot pasted into the application. A local production build and authentication-configuration browser smoke check passed; full responsive visual and production-service verification remain open.
