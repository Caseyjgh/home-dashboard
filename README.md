# Home Dashboard

A calm personal start page built with Next.js, TypeScript, and Tailwind CSS. It includes:

- A live local clock and date
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

## Environment variables

No environment variables are currently required. If integrations are added later, document their variable names in `.env.example` and keep local `.env` files untracked.

## Deployment

The application uses the Next.js App Router and can be deployed directly to Vercel. Every push to the connected `main` branch can trigger a production deployment through the existing Vercel integration.
