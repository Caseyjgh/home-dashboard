# Automatic Denver day/night theme

All routes, including the Pi dashboard and `/mobile`, use light mode from 5 AM until 9 PM and dark mode from 9 PM until 5 AM in `America/Denver`. The browser's timezone does not change this schedule; daylight saving time is handled by `Intl.DateTimeFormat`.

The small inline scheduler in `src/lib/scheduled-theme.ts` applies the palette before hydration and checks at minute boundaries. It updates only the root theme attribute when the mode changes. It does not reload the page, reset forms, or make API requests. Existing household, calendar, and weather refresh behavior continues independently.

Hidden pages stop the theme timer and immediately catch up when visible or focused again. Page-cache restoration also reapplies the current mode. The scheduler lives once per document, across route navigation.

Reload an already-open app once after deploying this feature. Subsequent 9 PM and 5 AM switches are automatic while the app is running, or immediately on resume after sleep.

Validation: `tests/scheduled-theme.test.mjs` checks summer/winter boundaries, DST transition dates, timer cleanup, and resume behavior. `tests/scheduled-theme.browser.mjs` checks real browser transitions, night colors, hydration, navigation, and preservation of unsaved dinner edits.

## Two-hour home refresh and event expiration

A separate scheduler reloads `/` and `/mobile` every two hours of document lifetime. It waits while hidden, offline, saving household data, or choosing calendars. Editing routes never reload automatically; returning home after the deadline triggers the pending reload. Timers and listeners are cleaned up on route changes/unmount. This full reload is separate from the automatic 9 PM/5 AM palette update, which preserves unsaved forms.

Important Events are filtered using the shared America/Denver date helper. A single-date event remains visible through that date; a range remains through its end date. The existing minute clock updates the filter after midnight or on resume. Records are retained in Redis and the editor, with no deletion or schema changes.

`tests/dashboard-refresh.test.mjs` and `tests/dashboard-refresh.browser.mjs` cover expiration, midnight rollover, reload timing, deferred reloads, history retention, and draft protection.
