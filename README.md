# Home Dashboard

A calm personal start page built with Next.js, TypeScript, and Tailwind CSS. It includes:

- A live local clock and date
- Cached events from selected private Google calendars using read-only OAuth access
- Date navigation, manual refresh, and a server-enforced five-minute refresh cooldown
- Quick links for Gmail, Google Calendar, Spotify, and GitHub
- A task list stored privately in the browser
- An editable daily recipe plan for breakfast, lunch, and dinner
- Responsive styling for desktop and mobile

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
npm run build
```

## Google Calendar setup

Create a Google Cloud OAuth 2.0 client with the **Web application** type, enable the Google Calendar API, and add this production redirect URI:

```text
https://home-dashboard-lumber.vercel.app/api/auth/callback/google
```

For local sign-in, also add:

```text
http://localhost:3000/api/auth/callback/google
```

Copy `.env.example` to `.env.local` and provide `AUTH_SECRET`, `CLIENT_ID`, `SECRET`, `KV_REST_API_URL`, and `KV_REST_API_TOKEN`. `CLIENT_ID` and `SECRET` are the Google OAuth web-application credentials. `KV_REST_API_URL` and `KV_REST_API_TOKEN` come from the Vercel-provisioned KV store and are used only by server-side code. The optional `GOOGLE_CALENDAR_TIME_ZONE` defaults to America/Denver until the signed-in browser stores its explicit IANA timezone.

Calendar events, selected-calendar preferences, user timezone, last successful refresh time, and cooldown timestamps are stored in Vercel KV. Normal page loads and date navigation read only this cache. Google Calendar is contacted only when the user explicitly refreshes, or when the user opens calendar selection and no cached calendar list exists.

## Deployment

The application uses the Next.js App Router and can be deployed directly to Vercel. Every push to the connected `main` branch can trigger a production deployment through the existing Vercel integration.
