# Home Dashboard

A calm personal start page built with Next.js, TypeScript, and Tailwind CSS. It includes:

- A live local clock and date
- Today’s events from a private Google Calendar using read-only OAuth access
- Quick links for Gmail, Google Calendar, Spotify, and GitHub
- A task list stored privately in the browser
- A 25-minute focus timer
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
https://home-dashboard-umber.vercel.app/api/auth/callback/google
```

For local sign-in, also add:

```text
http://localhost:3000/api/auth/callback/google
```

Copy `.env.example` to `.env.local` and provide `AUTH_SECRET`, `AUTH_GOOGLE_ID`, and `AUTH_GOOGLE_SECRET`. The optional `GOOGLE_CALENDAR_TIME_ZONE` controls which day is considered today. Keep `.env.local` untracked.

## Deployment

The application uses the Next.js App Router and can be deployed directly to Vercel. Every push to the connected `main` branch can trigger a production deployment through the existing Vercel integration.
