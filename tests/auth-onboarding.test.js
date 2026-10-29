import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../src/main.jsx', import.meta.url), 'utf8');
const repository = readFileSync(new URL('../src/lib/workspace-repository.js', import.meta.url), 'utf8');

test('authentication supports confirmation, generic password recovery, and password updates', () => {
  assert.match(app, /Check your email for the confirmation link/);
  assert.match(app, /resetPasswordForEmail\(email\.trim\(\), \{ redirectTo: window\.location\.origin \}\)/);
  assert.match(app, /If an account exists for this email, a password-reset link is on its way\./);
  assert.match(app, /updateUser\(\{ password \}\)/);
  assert.match(app, /PASSWORD_RECOVERY/);
  assert.match(app, /Forgot password\?/);
  assert.match(app, /Your courses, study tasks, and progress are private to your account/);
});

test('demo access is development-only and missing production configuration is explicit', () => {
  assert.match(app, /const canUseLocalDemo = import\.meta\.env\.DEV/);
  assert.match(app, /if \(!canUseLocalDemo\)/);
  assert.match(app, /StudyWise will not create a demo profile in production/);
  assert.match(app, /else if\(import\.meta\.env\.DEV\)/);
});

test('cloud data is not saved until the authenticated workspace has loaded successfully', () => {
  assert.match(app, /cloudReadyUserId!==cloudUserId/);
  assert.match(app, /No local workspace was substituted/);
  assert.match(app, /function useStoredState\(key, initial, legacyKey = null, persistLocally = false\)/);
  assert.match(app, /if\(stored\.key!==key\|\|!persistLocally\) return;/);
});

test('first-time authenticated students see semester setup and a visible checklist', () => {
  assert.match(app, /if\(!workspace\.courses\.length&&!workspace\.settings\.profile\?\.onboardingComplete\)\{setPage\('courses'\);setModal\('semester-setup'\);\}/);
  assert.match(app, /StudyWise setup checklist/);
  assert.match(app, /Subjects & exams/);
  assert.match(app, /First study session/);
});

test('focus actions launch a pausable session and preserve its reflection', () => {
  assert.match(app, /function FocusSessionModal/);
  assert.match(app, /setRunning\(value => !value\)/);
  assert.match(app, /How did it go\?/);
  assert.match(app, /startFocusSession\(nextTask/);
  assert.match(repository, /session_reflection: task\.reflection/);
});

test('dashboard avoids unsupported notifications and unexplained zero confidence', () => {
  assert.doesNotMatch(app, /aria-label="Notifications"/);
  assert.match(app, /Build<\/strong><small>your baseline<\/small>/);
  assert.match(app, /Start diagnostic/);
  assert.match(app, /\['My courses', 'Syllabus map', 'Resources'\]\.includes\(title\)/);
});
