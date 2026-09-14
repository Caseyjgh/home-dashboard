# Raspberry Pi 5 kiosk deployment

This is the `home-dashboard` repository's dedicated `pi5-vercel` branch, based on
`pi5` at `10e682fcca35320ca8dd3ae5b68c730e07e8dda5`. The Vercel project remains
`home-dashboard` in team `kc-e777`; `main` remains production. No Pi OS settings
are changed by this repository.

## Vercel branch deployment

Pushes to `pi5-vercel` use the existing GitHub integration's Preview environment.
Use the **branch alias** from Vercel, which follows subsequent deployments, rather
than an individual commit's immutable deployment URL. Vercel documents these
[branch URLs](https://vercel.com/docs/deployments/generated-urls) and
[Preview environments](https://vercel.com/docs/deployments/environments).

Expected alias (verify under the deployment's Domains before setup):

```text
https://home-dashboard-git-pi5-vercel-kc-e777.vercel.app
```

### Required dashboard setup

The read-only audit on 2026-09-13 found a connected GitHub repository,
`main` as production, Git deployments enabled, no ignored-build command, and no
branch-specific environment overrides. It also found Google credentials scoped
only to Production and Vercel Authentication enabled for generated URLs.

1. Open Vercel → team **KC / kc-e777** → **home-dashboard** → **Settings** → **Git**.
   Confirm the connected repo is `Caseyjgh/home-dashboard`. Leave Production
   Branch as `main` (the branch control may appear under **Environments → Production**).
2. Open **Settings → Environment Variables**. The OAuth repair on 2026-09-14
   enabled the existing `CLIENT_ID` and `SECRET` for both Production and Preview,
   retaining the stored values. `AUTH_URL` is scoped only to Preview / `pi5-vercel`
   and points to the stable branch alias below. No duplicate Google credentials
   or new Google client are needed.
3. Confirm the variables in the table below apply to the Preview deployment.
   Shared Preview variables apply automatically; overrides take precedence.
   See [Vercel's environment variable rules](https://vercel.com/docs/environment-variables).
4. Open **Deployments**, filter Branch to **pi5-vercel**, and open its deployment.
   After changing variables, choose **… → Redeploy**, keeping the **Preview**
   environment. Do not promote it to Production.
5. Open the deployment's **Domains** and copy its `git-pi5-vercel` branch alias.
   Use this exact origin for the kiosk and Google callback below.
6. Under **Settings → Deployment Protection**, review **Vercel Authentication**.
   The current setting protects generated Preview URLs. You can authenticate to
   Vercel once in the Pi's persistent Chromium profile; that session may expire
   and require maintenance. For unattended access, use a dedicated custom domain
   assigned to this branch if your plan permits it and the existing protection
   policy excludes that domain. Under **Settings → Domains → Add**, add only a
   new Pi subdomain; **Edit → Connect to an environment → Preview → Git Branch → pi5-vercel**, save, and configure the
   displayed DNS record. See [branch-domain setup](https://vercel.com/docs/domains/working-with-domains/assign-domain-to-a-git-branch). Do not repoint a production domain or weaken protection
   for every Preview branch. Confirm effective protection on the new domain.

If a push has no deployment, first inspect GitHub's commit checks and the Vercel
Deployments filter. In **Settings → Git**, reconnect the existing repository only
if disconnected; check deployment permissions for the commit author and any
ignored-build rules. No additional Vercel project is required.

### Environment variables (names only)

| Variable | Needed | Audit result / action |
| --- | --- | --- |
| `AUTH_SECRET` | Yes, server only | Already shared with Preview |
| `CLIENT_ID` | Yes, server only | Shared with Preview after OAuth repair |
| `SECRET` | Yes, server only | Shared with Preview after OAuth repair |
| `KV_REST_API_URL` | Yes, server only | Already shared with Preview |
| `KV_REST_API_TOKEN` | Yes, server only | Already shared with Preview |
| `AUTH_URL` | Pi Preview | Stable branch origin; set only for pi5-vercel |
| `GOOGLE_CALENDAR_TIME_ZONE` | Optional, server only | Already shared; fallback is America/Denver |

`REDIS_URL`, `KV_URL`, and `KV_REST_API_READ_ONLY_TOKEN` are provisioned by the
integration but are not read by this app. No `NEXT_PUBLIC_*` variable or Pi-mode
flag is needed: this is intentionally a separate branch. `.env.example` has
empty assignments only. No secret belongs in a Git commit or kiosk command.

The existing shared Redis credentials also mean **shared calendar data**, keyed
by Google account. Manual refresh, calendar selection, and the existing
"Sign out & reset Calendar" action affect that account's cache across both
versions. Dinners and to-dos now use separate persistent Redis keys for the same Google account; see [household storage](household-data.md). Older browser-local entries can be imported explicitly in Settings.
An isolated database can be configured with branch-specific KV variables if
independent data is needed; this change does not migrate or alter the database.

### Google sign-in on the branch

Auth.js v5 now uses the explicit branch-scoped `AUTH_URL` for Pi callbacks; the original production environment is unchanged.
Google must allow the actual kiosk origin's callback. In Google Cloud Console →
**Google Auth Platform → Clients** (or **APIs & Services → Credentials**) → your
existing Web application client → **Authorized redirect URIs**, add:

```text
https://THE-PI5-VERCEL-URL/api/auth/callback/google
```

Use the actual branch alias or dedicated Pi domain, not the placeholder. Retain
all existing production/local callback URIs. This is an additional allowed URL;
client ID, client secret, and read-only Calendar scopes stay unchanged. If the
callback is not already allowed, Google sign-in will fail until the owner adds
it. See [Auth.js deployment guidance](https://authjs.dev/getting-started/deployment).
No OAuth dashboard changes are performed automatically.

## Raspberry Pi setup

Use **Raspberry Pi OS 64-bit with desktop**, current Trixie release, rather than
the larger Full image. Chromium runs on the Pi; the Next.js server and builds run
on Vercel. Set Wi-Fi, the correct timezone, and a maintenance login in Imager.
Prefer Ethernet where practical. Keep the OS/browser updated, use a suitable Pi 5
power supply and cooling, and run only this one browser tab without extensions.
Do not run development servers or builds on the 1 GB device.

The current official [Raspberry Pi kiosk tutorial](https://www.raspberrypi.com/tutorials/how-to-use-a-raspberry-pi-in-kiosk-mode/)
uses **`chromium`**, not `chromium-browser`, and the labwc desktop's autostart file.
Check with `command -v chromium` on the installed image.

First, open a normal Chromium window using the same persistent profile and sign
in to Vercel (if required) and Google. Select calendars and perform one manual
refresh. Close that browser before starting kiosk mode:

```bash
chromium --user-data-dir="$HOME/.config/chromium-pi5" https://THE-PI5-VERCEL-URL
```

Then launch one tab:

```bash
chromium \
  --user-data-dir="$HOME/.config/chromium-pi5" \
  --kiosk \
  --no-first-run \
  --noerrdialogs \
  --disable-infobars \
  https://THE-PI5-VERCEL-URL
```

Kiosk mode removes browser chrome; the remaining flags suppress initial setup and
browser interruption UI. No speculative memory flags are required. Keep GPU
acceleration, process isolation, sandboxing, and browser memory-pressure handling
at their defaults. Do not use `--no-sandbox`, `--single-process`,
`--ignore-certificate-errors`, or disable the GPU. Do not use incognito: cookies
and sign-in must survive a browser restart; dinners and to-dos are stored on the server. Do not routinely clear the
profile. Additional crash-bubble suppression flags are omitted because support
varies by Chromium release; fix repeated crashes rather than masking them.

### Autostart, display, and maintenance

Enable **desktop autologin** for the kiosk user through `sudo raspi-config` →
**System Options → Boot / Auto Login**. Append the single launch command below to
`~/.config/labwc/autostart`, preserving existing lines (create the directory/file
if absent):

```bash
chromium --user-data-dir="$HOME/.config/chromium-pi5" --kiosk --no-first-run --noerrdialogs --disable-infobars https://THE-PI5-VERCEL-URL &
```

Do not add it twice. Reboot once during setup and verify it opens the branch URL.
This simple autostart launches at login; it is not a crash watchdog. If the network
is unavailable before the HTML first loads, Chromium may show its own network
error page; app recovery cannot run yet. Restore the connection and reload or
relaunch during maintenance. Once the app has loaded, it handles interruptions.

Set **1920×1080, landscape, 1× display scale, 100% browser zoom**. In current Pi OS,
use **Preferences → Control Centre → Screens**. To keep the screen on, use
**Control Centre → Display → Screen Blanking → Off**, or `sudo raspi-config` →
**Display Options → Screen Blanking → No**. Configure the onscreen keyboard if
there is no physical keyboard. See the official
[display configuration instructions](https://www.raspberrypi.com/documentation/computers/configuration.html).
The app uses internally scrolling panels for busy days, and a stacked layout on
small displays; no controls depend on hovering or right-clicking.

For maintenance, attach a keyboard and press **Alt+F4** to close the kiosk window.
The simple autostart will not reopen it until the next login. Open the same profile
normally to reauthenticate; relaunch the kiosk command afterwards. Keep SSH access
available for recovery. Do not force-kill Chromium or cut power during normal
shutdowns, because local browser data can be damaged.

### Swap on 1 GB

**Keep swap enabled.** It provides headroom for temporary browser/OS memory spikes
and can prevent an out-of-memory kill. It is slower than RAM and cannot fix a
leak or excessive workload. Check `free -h`, `swapon --show`, and `zramctl` before
changing anything. Current Trixie provides zram plus file-backed swap through
`rpi-swap`; retain those defaults initially. The Raspberry Pi team's
[Trixie release discussion](https://www.raspberrypi.com/news/trixie-the-new-version-of-raspberry-pi-os/)
describes that configuration. Do not apply old `dphys-swapfile` instructions to
Trixie blindly.

Compressed zram uses CPU and RAM but reduces disk traffic; disk-backed swap adds
writes to the boot medium. Heavy sustained swapping wears an SD card and makes the
UI lag. Prefer an SSD if the device will write heavily; otherwise use a suitable
high-endurance card and monitor swap activity. If an older image has negligible
swap, 512 MB–1 GB of disk-backed fallback is a starting point to assess with its
OS-supported tools, not an automatic requirement. No swap changes are performed
by this branch.

## Recovery and data behavior

- Visible clock ticks at minute boundaries and pauses when hidden. Today advances
  at midnight unless you deliberately browsed to another date.
- Calendar reads use the existing server Redis cache. There is no healthy polling
  loop. Cache reads happen at startup, reconnect, midnight, an explicit retry, or
  when returning to a page whose last successful read was at least five minutes ago.
- Failed cache reads retry after 15 seconds, 60 seconds, then at most once per five
  minutes. Only one read/retry is active. Hidden/offline pages pause attempts.
- Calendar JSON requests have a 30-second deadline including body reading. A
  failed refresh keeps displayed events. Mutations and Google refreshes are not
  automatically replayed. The server's five-minute manual refresh cooldown stays.
- No scheduled Google sync exists in this source branch. No client Google polling
  or new cron has been added. Google access remains limited to manual refresh,
  explicit reconnect, and opening calendar selection when its server cache is empty.
  The operator still needs to refresh periodically as the existing calendar cache
  is not automatically updated with new/changed Google events.
- No full offline app shell or service worker is added. Previously displayed
  calendar data survives a transient failure in memory; a cold start needs network.
  Previously loaded dinner/to-do data stays visible during a connection failure. A cold offline page load is not supported.
- No forced periodic reload. If real-device measurements eventually show Chromium
  growth, an optional off-hours browser restart can be an operational fallback.
  First measure the cause and close Chromium cleanly; never use frequent reloads
  or restarts to conceal application errors.

## Verification and ongoing checks

Run on a development machine with Node 24 and installed dependencies:

```bash
npm ci
npm run typecheck
npm run lint
npm test
npm run build
npm run start -- --hostname 127.0.0.1 --port 3105
```

Optional browser regression test in another terminal (no added project dependency):

```bash
npm install --prefix /tmp/home-dashboard-browser-test --no-audit --no-fund --package-lock=false playwright
PLAYWRIGHT_MODULE=/tmp/home-dashboard-browser-test/node_modules/playwright/index.mjs \
CHROMIUM_PATH=/usr/bin/chromium node tests/kiosk.browser.mjs
```

The browser test uses mocked API/OAuth responses and an isolated Chromium profile.
It checks layout, calendar controls, backoff,
and accelerated idle behavior. It does not prove live Google OAuth, Redis access,
or real 1 GB ARM device stability. See `docs/pi5-audit.md` for measured results.

Before leaving the Pi unattended, verify real Google sign-in, calendar selection,
manual refresh, shared dinner/to-do persistence after a clean reboot, Wi-Fi interruption and
recovery, and midnight behavior. Leave it running 24–72 hours and compare Chromium
memory using its task manager or OS process metrics at consistent idle points.
Investigate a sustained upward trend, OOM events, excessive swapping, or heat.
