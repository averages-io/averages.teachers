# Averages for Teachers (teach.averages.io)

A fast, spreadsheet-style front end to Schoology for teachers. It's the sibling of the Averages.io student app, by the same author (Martin).

Two repos, kept side by side in one folder:
- `averages.teachers` (this one): the pages, and a small Worker that forwards `/api/*`.
- `averages.teachers.api`: the API Worker (Hono + TypeScript), its storage and its tests. It has its own short `CLAUDE.md` that points here.

**Built so far (0.1.0):** both Workers, `/api/health`, sealed host-only sessions, the same-origin guard for writes, and passkey basics (add, sign in, list, remove). See each README.

`handoff/` holds the plan, the Schoology test results, reference code from the student API, and design assets. It's in `.gitignore` and must never be committed (it has sandbox IDs and internal notes).

## Read these first, in order

1. `handoff/docs/01-plan.md`: the plan and every decision so far (passkey levels, pricing, privacy, repo setup, open questions).
2. `handoff/docs/02-features-by-sidebar.md`: what the first versions do, page by page.
3. `handoff/docs/03-schoology-teacher-api.md`: what the Schoology API can and can't do for a teacher, with the exact request bodies that work. **Trust this over Schoology's docs where they differ.**
4. `handoff/docs/04-security.md`: the rules every route has to follow.
5. `handoff/docs/05-design.md`: the look, the tokens and the banned patterns.
6. `handoff/README.md`: an index of everything else in `handoff/` (reference code, older project notes, assets).

## Hard rules

### Privacy
- **Nothing from a student's use of Averages.io is ever shown to a teacher.** Teachers see only what Schoology already shows them: rosters, turned-in work, grades. The student app and this app share no data and no database.
- **Store as little as possible.** Level 1 (the default) stores nothing about the teacher or their students on our servers. Levels 2 and 3 store only encrypted keys, passkey public keys, scheduled jobs and an action log with IDs only (no student names, no grades).
- All storage is US-only (Durable Objects with `jurisdiction: "us"`). Schoology's developer terms forbid processing their data outside the US without written permission.

### Security
- **Fixed action routes only.** Never a pass-through route that forwards a browser-chosen Schoology path or method. The browser sends IDs and values; the Worker builds the Schoology request. A teacher token can change many students' grades, so this matters more here than on the student side.
- Keys (the consumer secret, the teacher's access token and secret) never reach the browser, logs or error messages.
- Secrets only through `npx wrangler secret put`. Never in code, `wrangler.jsonc`, tests or docs.
- Teacher session cookies are **host-only** on teach.averages.io (no `Domain=` attribute). Never `.averages.io`. Student and teacher sessions must never mix.
- Every write route checks the teacher teaches that section (from Schoology, with the teacher's own token) before writing.
- Validate on our side what Schoology silently accepts: **a negative grade erases the grade** without an error.

### Working with Schoology
- Pace calls under **50 requests per 5 seconds** per token (aim for about 8 per second) and retry on 429 with backoff.
- Batch: one `PUT /sections/{id}/grades` per section per save.
- Re-sign every redirect (new nonce and timestamp). A plain `fetch` that follows a redirect resends the old signature and gets a 401. `reference/probes/sg.mts` shows how.
- On a 401: the account or token is gone. Delete everything stored for that teacher (wrapped keys, passkey links, jobs) and tell them. On a 403 or 404 for one section: cancel only that section's jobs.
- Event times come back 8 hours off on create. Correct for it and test it.

### Testing against the sandbox
- Label everything created in the sandbox **"Averages test"** and delete it afterwards.
- Only ever change grades, attendance or messages for the sandbox student account (uid 146154216, enrollment 3651617634). Never touch other students in the sandbox.
- When Martin pastes keys in chat, keep them only in a scratch file with 600 permissions, delete it after, never print or copy the values anywhere, and remind him to reset them at app.schoology.com/api.
- Don't put Martin's school name, address or personal details in code, docs, commits or test data.

### Process
- **Never commit or push.** Martin uploads to GitHub himself. If a hook asks you to commit, reply in one line with what's waiting.
- Deliver changes as one zip, named with Martin's local time: `TZ=America/Los_Angeles date '+%-m-%-d-%y-%-I-%M%p'` followed by a short description, for example `11-12-26-4-05PM-teachers-signin.zip`. Inside: a folder with the zip's name, then `averages.teachers/` and/or `averages.teachers.api/` with only the changed files in each repo's layout.
- A zip with `package.json` always includes `package-lock.json`.
- Write in plain, short sentences. No em dashes in copy, code comments or docs.

## Architecture (decided 2026-11-11)

- **Two Workers, one origin.** `averages-teachers` serves teach.averages.io: files from `public/` without running code, and `/api` + `/api/*` handed to `averages-teachers-api` through a service binding. The API Worker has no public address (`workers_dev: false`). No CORS, and the session cookie stays host-only.
- **API:** TypeScript + Hono. Imports use explicit `.ts` extensions so tests run with `node --experimental-strip-types` and no build step. `src/index.ts` may only export the handler and Durable Object classes; the app is built in `src/app.ts`.
- **Front end:** hand-written HTML, CSS and plain JS. No UI framework, no inline scripts (the CSP in `public/_headers` blocks them). The gradebook grid will be custom.
- **Storage:** one `TeacherStore` Durable Object per teacher, US jurisdiction. Today it holds only passkeys (public keys). Level 2's wrapped keys and Level 3's jobs go there later. Local dev has no jurisdictions, so `.dev.vars` sets `DO_JURISDICTION=none`; production never sets it.
- **Cookies:** all `__Host-` (Secure, Path=/, no Domain). `__Host-avt_session` is the sign-in; `__Host-avt_pkc` holds a passkey challenge for 5 minutes; `__Host-avt_pkid` says which teacher a passkey identified, for 10 minutes.
- **Passkeys:** verified with Web Crypto in `src/webauthn.ts`, no library. User verification required, attestation "none", ES256, EdDSA and RS256. Registration asks whether the passkey supports PRF and saves the answer. A passkey sign-in identifies the teacher only, until Level 2.
- **Feature switches (later):** the same Flagship app as the student side, with `teacher-app`, `teacher-gradebook`, `teacher-passkeys`, `teacher-scheduled`.
- **Copied from averages.api:** `oauth.ts` (unchanged apart from comments). `session.ts` was rewritten for teachers. Still to copy and trim when needed: `schoologySignin.ts`, `rateLimit.ts`, `health.ts`, `flags.ts` (in `handoff/reference/api/src`). GPL v3, same author.

## Milestones

1. **M0 Scaffold:** done 2026-11-11, plus passkey basics.
2. **M1 Landing and sign-in on one page:** the hero with "Log in with Schoology" and the school picker (see `handoff/reference/app/student-signin.html`), three-legged sign-in into `__Host-avt_session`, `/api/me`, sign out, and the setup flow (what we keep, pick your courses, how saving works, optional passkey). A student who signs in here gets a link to app.averages.io (role decides). Until App Center approval, test with the sandbox consumer key.
3. **M2 Read-only gradebook:** sections, roster, assignments, grades, categories, scales, periods, in the grid. Paced Schoology client with 429 retry.
4. **M3 Saving grades:** fill and paste, review summary, one PUT per section, per-row failures shown, conflict check, undo, negative grades blocked, comments and final comments.
5. **M4 Grading queue and post to every section.**
6. **M5 Level 2 passkeys:** PRF-wrapped Schoology keys, so a passkey sign-in starts a full session, plus long jobs after the tab closes. Security review before shipping.
7. **M6 Level 3 scheduled jobs:** opt-in, passkey-gated, logged, 30-day expiry, cleanup on 401/403/404.

Each milestone ends with tests, a short note of what changed, and a zip. Ask Martin before starting the next one.

## Still open (ask Martin, don't guess)

- Pricing: free with a school plan, or $5 a year. ($0.50 mostly goes to fees.)
- Co-teachers on one section, admins who also teach, teachers who are parents of students.
- Google Classroom: first, alongside, or later.
- Whether the landing part should live in this repo or in `averages.landing`.
- How long a sign-in lasts (now 7 days, `SESSION_TTL_SECONDS` in the API's `src/session.ts`).
