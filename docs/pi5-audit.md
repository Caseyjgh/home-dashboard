> Historical baseline audit before the household redesign. Browser-local task/meal descriptions and old bundle figures below describe that baseline. Current storage, routes and validation are documented in [household-data.md](household-data.md).

# Pi 5 branch audit

Audited 2026-09-13 for Raspberry Pi 5, 1 GB RAM, Chromium kiosk at 1920×1080.
Repository: `Caseyjgh/home-dashboard`.

## Original Git and deployment state

- Original local branch: `main`, clean working tree.
- Default remote branch: `main`.
- `pi5` existed on origin at `10e682fcca35320ca8dd3ae5b68c730e07e8dda5`, the same
  commit as `main`. It was fetched, checked out as a tracking branch, and pulled
  with `--ff-only` before creating `pi5-vercel`.
- `pi5-vercel` did not previously exist locally or remotely.
- Vercel's existing `home-dashboard` project is linked to the GitHub repo, uses
  Next.js and Node 24, and has `main` as Production Branch. Git deployments are
  enabled; no ignored-build command was configured. No repository `vercel.json`
  overrides the project's defaults.
- No branch-specific variables existed. `CLIENT_ID` and `SECRET` were
  Production-only; all other required variables were already available to Preview.
- Generated deployment URLs are protected by Vercel Authentication. No production
  deployment, domain, environment value, or OAuth credential was changed.

## Findings and changes

| Area audited | Finding and decision |
| --- | --- |
| Framework/build/router | Next.js 16.3.4 App Router, React 19.2.8, TypeScript, webpack production build. `/` is already statically prerendered; retain that fast shell. APIs execute on Vercel. |
| Client JavaScript | One interactive dashboard page. The clock previously rerendered it every second despite displaying only minutes. Tick at minute boundaries and pause when hidden; memoize calendar filtering/sorting. |
| Dependencies | Next/React, next-auth, Upstash Redis, and build tooling are all used. No chart, animation, date-formatting, or large UI library to remove. Load next-auth/react only for explicit auth actions. No production dependencies added or replaced. |
| Memory/lifecycle | Existing clock and initial fetch had cleanup. Manual JSON requests lacked deadlines; reconnect fetch outlived its effect. Add request cancellation/deadlines, reconnect cleanup, and a single cache-read/retry lifecycle with listener/timer cleanup. No client intervals, observers, RAF loops, or realtime subscriptions are added. |
| Calendar cache/fetching | Existing Redis cache holds a rolling range retrieved by explicit refresh; date navigation filters locally. Preserve endpoints, Google read-only scopes, server retries, and five-minute cooldown. Recovery uses only `/api/calendar`, never automatic Google refresh. |
| Scheduled refresh | No cron definition or scheduled refresh job exists in this source. None added. Daily rollover reads existing Redis data only; new Google changes still require the existing explicit refresh workflow. |
| Offline behavior | Initial request failure previously became an empty/unconfigured state with no recovery. Retain successful data, show connection status, and retry cache reads at 15s/60s/300s. Pause offline/hidden; no full-page reloads. |
| Storage | Tasks and exactly three meal fields use localStorage. Malformed JSON/shape, blocked storage, or quota exhaustion could break initialization/writes. Validate input, keep invalid saved originals untouched, catch failures, and notify the user. No automatic task accumulation or historical snapshots added. |
| Large state | Calendar state is replaced, not appended; retry state is a counter/controller/timer, not an error history. Keep the existing finite calendar range and all user tasks rather than silently trimming data. Exceptionally large calendars/task lists still warrant hardware testing. |
| Images/fonts | No content-image downloads on the dashboard; unused public SVGs are not loaded. Only system font families are used. No external font weights/families or high-resolution photo assets to optimize. |
| Effects/styling | No infinite animation, blur, backdrop-filter, parallax, or animated gradient. Simplify the static background/shadow, remove decorative hover transforms, preserve reduced-motion support, and keep task deletion visible on touch. |
| Kiosk/layout | Landscape viewport grid fits calendar/tasks/meals at 1080p; long panels scroll internally. At least 44px buttons, larger readable text, no horizontal document scroll in tested desktop/mobile layouts, same-window links/authentication. Small screens remain stacked. |
| Service workers/charts | None present. No offline-sync framework, new cache layer, chart library, or service worker introduced. |
| Authentication/secrets | Server auth, Google APIs, and Redis implementation remain unchanged. Client imports only types from calendar modules. Secrets stay in server environment variables; none added to source or tests. Auth interaction flows are browser-tested with mocked endpoints. |
| Feature scope | Home, calendar, tasks, meals and calendar settings exist here. Groceries, generic lists, separate settings routes, Expo and Supabase belong to the other repository and are not present in this app. No such features were removed or invented. |

No Pi-mode environment flag was introduced: the dedicated branch is the deployment
boundary, and adding a flag would complicate setup without providing another
required behavior. Production `main` remains independent.

## Build and bundle measurements

Baseline and final builds used `npm run build` (`next build --webpack`) on the
same development machine with the existing installed dependencies. Both pass,
prerender `/`, and expose the same API surface: five calendar routes plus the
auth catch-all.

Initial modern-browser JavaScript was measured from the script/preload assets in
`.next/server/app/index.html`, deduplicated and summed. Gzip sizes were computed
per file; this is a transfer estimate, not Vercel's negotiated Brotli size or
browser memory usage. Legacy `nomodule` polyfills are excluded because current
Chromium does not load them.

| Measurement | Source `pi5` | `pi5-vercel` |
| --- | ---: | ---: |
| Initial JS, uncompressed bytes | 466,640 | 464,930 |
| Initial JS, gzip bytes | 137,267 | 136,196 |
| Dashboard clock updates/hour while visible | 3,600 | 60 |

The ~1 KB gzip reduction is deliberately modest: timeout/recovery logic adds some
code while deferred authentication removes startup work. The biggest remaining
chunks are the existing framework/runtime at ~201 KB and ~241 KB uncompressed.
Replacing Next.js or React for a speculative saving would be a rewrite, so they
remain. No bundle-analyzer package was installed in the project. Local dependency
installation was unnecessary; the existing lockfile remained unchanged.

## Verification

- TypeScript check, ESLint, and optimized production build pass.
- Six unit tests cover HTTP error/cooldown data, request body deadlines, single
  mutation attempt, unmount cancellation, abort-listener removal, and invalid
  stored tasks/meals. `npm test` runs the two test files.
- Chromium 151 desktop regression checks use an isolated profile and mocked APIs;
  see `tests/kiosk.browser.mjs`. Screenshots inspected at 1920×1080 and 390×844.
- Browser checks cover tasks add/complete/remove, recipe persistence across reload,
  calendar date navigation without fetching, selection save, manual refresh and
  cooldown, missing network/server failures, retained events, backoff, storage
  failures, midnight rollover, hidden-tab pause/resume, and authentication
  interactions. All browser checks pass with zero page errors.
- The accelerated eight-hour idle run has no healthy calendar polling. Sample
  post-GC JavaScript heap readings were 4,011,664 / 4,045,964 / 4,073,168 / 4,095,292
  bytes: about 84 KB change. This short simulation neither proves nor rules out a
  long-term leak. It includes test-clock overhead and is not total
  Chromium RSS, a full-day soak, or an ARM/1 GB benchmark.
- Real local unauthenticated calendar mutations return 401. The unconfigured
  calendar endpoint reports missing variables. Live auth on the unconfigured
  local production server is unavailable (missing host trust/credentials).
- Real Google consent/callback and Redis reads/writes remain unverified without
  Preview credentials, an allowed callback URL, and an authenticated account.
  No existing user's calendar was modified during these tests.

The actual Pi still needs a 24–72-hour test with the intended account/data, reboot,
Wi-Fi loss, memory/swap monitoring, onscreen keyboard, and authentication expiry.
Vercel protection and Google consent may require occasional maintenance. A cold
start without network cannot load this app; full offline-first storage was not
added. Follow [pi5-kiosk.md](pi5-kiosk.md) for deployment and device setup.
