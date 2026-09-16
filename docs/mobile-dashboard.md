# Mobile household dashboard

Open `/mobile` on the deployment running this branch. The Pi dashboard remains at `/`.

- Home: school rotation, compact Windsor weather, dinner, today's calendar, tasks and Important Events.
- Calendar: current day, date navigation, next seven dates with cached events, calendar selection and manual Google refresh.
- Dinner (`/mobile/meals`): date selection, editing/moving, recipe URL, saving and confirmed deletion.
- To-Do (`/mobile/todos`): Lilly/Sawyer tasks, add/edit, complete/uncomplete, reorder and confirmed deletion.
- Events (`/mobile/events`): edit dates/ranges, description and importance; confirmed deletion.

Use the same Google account on the phone and Pi. Both interfaces call the existing `/api/family` API and use the same email-scoped Redis records. No migration, new database or new environment variable is required. Redis credentials remain server-only. Revision checks protect against simultaneous edits.

On this branch, visible pages recheck household data every 30 seconds using conditional requests. Hidden/offline pages stop, failed requests back off, and successful saves update the phone immediately. Weather keeps its 15-minute refresh and Calendar keeps its existing cache/manual-refresh behavior. No full-page reload or service worker was added. The unchanged `main` deployment retains its own previous refresh interval until these changes are separately approved for production.

## iPhone installation

Visit the branch's stable preview URL with `/mobile`, sign in, then use Safari → Share → Add to Home Screen. The manifest opens `/mobile` in standalone mode. Bottom navigation accommodates the safe-area inset. Opening links to the Pi dashboard may leave standalone mode because the manifest scope is `/mobile`.

## Preview authentication

Keep Vercel Production on `main`. This feature is deployed only by pushing `v2-pi5`.

The existing Preview environment must include `CLIENT_ID`, `SECRET`, `AUTH_SECRET`, `KV_REST_API_URL`, and `KV_REST_API_TOKEN`. Use the same existing Redis configuration to share records with the Pi. The current authentication code uses `VERCEL_BRANCH_URL` for the stable preview callback unless an explicit `AUTH_URL`/`NEXTAUTH_URL` overrides it. Do not set a production origin for this branch.

If Google reports `redirect_uri_mismatch`, add the branch's exact `https://<stable-preview-domain>/api/auth/callback/google` URI to the existing Web OAuth client's authorized redirect URIs in Google Cloud Console. Do not replace the production redirect URI or create another client. Vercel preview protection may require signing into Vercel before using the preview on a phone.

## Validation

`npm run lint`, `npm run typecheck`, `npm test`, and `npm run build`.

`tests/mobile.browser.mjs` uses a shared API fixture for mobile CRUD, Pi updates, 375/390/430px layouts, navigation, calendar/weather isolation, visibility cleanup, and mocked Google sign-in. `tests/family-api.integration.mjs` exercises the real API/auth/storage implementation with an isolated Redis transport and signed test sessions. These do not replace a real Google consent check or an on-device iPhone test.
