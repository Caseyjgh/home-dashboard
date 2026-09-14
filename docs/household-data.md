# Household dashboard

Home uses a 73% calendar / 27% Dinner and To-Do grid on landscape screens. Below 1050px, sections stack calendar → dinner → to-dos. Panels scroll internally when content exceeds a single screen. Controls use at least 44px button/label targets. System fonts, static CSS and existing dependencies keep the interface light.

## Shared storage

The existing Upstash/Vercel Redis credentials are reused, server-side only. No SQL migration, new service, package or environment variable is needed. The first successful save creates `home-dashboard:family:v1:<SHA-256 of normalized Google email>` with no expiry:

- Dinner: `id`, `date` (YYYY-MM-DD), `title`, `description`, `link`. One entry per date; moving preserves its ID. Recipe URLs must use HTTP(S), without embedded credentials.
- To-do: `id`, `text`, `person` (Lilly/Sawyer), `completed`, `sortOrder`, `createdAt` (server UTC timestamp).
- Envelope: `version`, `revision`, `dinners`, `todos`, `legacyImports` (deduplication markers).

Sign into **the same Google account on every device** to share this household. Different Google accounts remain isolated; multi-account household membership is not implemented. Calendar reset/sign-out does not delete family entries. Back up the Redis database through your existing provider. Records are limited to 1,000 dinners and 1,000 tasks; older entries can be explicitly deleted in the editors. No automatic deletion occurs.

Writes require authentication and same-origin JSON. Redis compare-and-set prevents lost updates from concurrent devices; a conflict loads the latest data and asks the user to review and save again. Failed writes are never automatically replayed. Dinner/task reads occur once at load, every two minutes while visible, and on reconnect/focus. Errors retain loaded content and retry after 15, 60, then 300 seconds. Hidden/offline tabs stop polling. This is **not Google Calendar polling**: the existing cache-only calendar flow, manual refresh/cooldown, OAuth credentials and scopes are unchanged.

Settings offers an explicit import of the original browser-local tasks and dinner title. Pick Lilly/Sawyer and the dinner date, then import. Original storage is untouched; repeat imports deduplicate. Breakfast/lunch values remain visible in the legacy preview for reference. Run import on the browser/origin containing those entries. Unsaved form drafts are not persistent; a cold offline page load is not supported.

## Deployment

Continue using the `pi5-vercel` Preview branch and keep `main` as production. Existing variables remain `AUTH_SECRET`, `CLIENT_ID`, `SECRET`, `KV_REST_API_URL`, `KV_REST_API_TOKEN`; `GOOGLE_CALENDAR_TIME_ZONE` is optional. No public environment variables are added. See [Pi setup](pi5-kiosk.md) for the existing Preview credential scope, callback URL and deployment protection actions. No additional Vercel configuration is required by this redesign.

## Validation

Run `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build`.

Optional checks, with Playwright installed outside the app dependencies and the production app running on port 3105:

```sh
PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node tests/household.browser.mjs
PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node tests/kiosk.browser.mjs
node tests/family-api.integration.mjs
```

The browser household suite uses a shared API fixture to exercise editing, date moves, ordering, completion, recipe popups, device/reload behavior and responsive layout. The API suite launches an isolated production server on port 3106 with a Redis REST fixture and signed test session; it tests actual route authentication, origin rejection, storage-client round trips, isolation and concurrency. Fixtures do not verify live Google OAuth or the deployed Upstash service. Confirm sign-in and saved data across two real devices after deployment, and perform an actual all-day Pi test; accelerated desktop tests cannot prove 1 GB hardware stability.
