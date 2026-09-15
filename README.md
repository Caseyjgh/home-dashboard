# Home Dashboard

A lightweight household display for Raspberry Pi 5, desktop, and mobile. Home uses a large daily calendar beside Dinner and Lilly/Sawyer to-dos. Meals and tasks are stored in the existing Redis database, shared by devices signed into the same Google account.

- `/`: cached calendar, today's dinner, incomplete tasks
- `/dinner`: dinner editing, date changes and deletion
- `/todos`: task editing, completion, reassignment and ordering
- `/calendar-settings`: existing Google calendar selection
- `/settings`: account controls and explicit import of older browser-local entries

See [household storage and operation](docs/household-data.md).

## Local development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Quality checks

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Google Calendar setup

See [OAuth configuration and safe diagnostics](docs/oauth-configuration.md) for the Pi branch callback and shared credentials.

Create a Google Cloud OAuth 2.0 client with the **Web application** type, enable the Google Calendar API, and add this production redirect URI:

```text
https://home-dashboard-umber.vercel.app/api/auth/callback/google
```

For local sign-in, also add:

```text
http://localhost:3000/api/auth/callback/google
```

Copy `.env.example` to `.env.local` and provide `AUTH_SECRET`, `CLIENT_ID`, `SECRET`, `KV_REST_API_URL`, and `KV_REST_API_TOKEN`. `CLIENT_ID` and `SECRET` are the Google OAuth web-application credentials. `KV_REST_API_URL` and `KV_REST_API_TOKEN` come from the Vercel-provisioned KV store and are used only by server-side code. The optional `GOOGLE_CALENDAR_TIME_ZONE` defaults to America/Denver until the signed-in browser stores its explicit IANA timezone.

Calendar events, selected-calendar preferences, user timezone, last successful refresh time, and cooldown timestamps are stored in Vercel KV. Normal page loads and date navigation read only this cache. Google Calendar is contacted only when the user explicitly refreshes, or when the user opens calendar selection and no cached calendar list exists.

## Deployment

The application uses the Next.js App Router and can be deployed directly to Vercel. Every push to the connected `main` branch can trigger a production deployment through the existing Vercel integration.

## Raspberry Pi branch

`pi5-vercel` is the dedicated Pi 5 / 1 GB Chromium kiosk target, based on `pi5`.
It uses Vercel Preview deployments; `main` remains production. See
[Pi kiosk and Vercel setup](docs/pi5-kiosk.md) and the
[performance audit](docs/pi5-audit.md) before deploying a device.
