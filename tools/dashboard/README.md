# DPM operations dashboard

A web page for running DPM's cloud side: the reports about published lists, everything
`npm run data` does (search, show, take down, remove a user, block), erasure requests that come by
email, a log of what was removed, and how busy Firestore is against Spark's free quota. Figures
from Google Play come in a later phase; its tab says what is planned. The page has no build step and loads nothing from outside
(its two fonts, Rajdhani and Share Tech Mono, are in `public/fonts/` under the SIL OFL).

**Nothing is sent from here.** Replies go out from your own mail app. Anything that deletes or
blocks happens only after a red alert screen where you type back the share code or user id, as
`npm run data` asks on the command line.

It runs in one of two ways:

- **On your computer**, plain HTTP on 127.0.0.1, opened with the link it prints.
- **On a home server** (any small always-on Linux machine), HTTPS for the home network, open only
  to someone who signs in with one of your devices' passkeys, and that passkey again before
  anything that deletes or blocks, opens the erasure requests or changes the settings. See
  [Running it on a home server](#running-it-on-a-home-server).

## Setup

Everything `tools/data-removal/README.md` → _Setup_ says (its `firebase-admin`, the Admin
credentials in `.env`), plus [Claude Code](https://claude.com/claude-code) signed in for the agent
reviews (`claude` on the PATH, or `DPM_CLAUDE_BIN=/path/to/claude`; on Windows it finds the `claude.exe` behind npm's `claude.cmd` itself).

For the Usage tab's quota and rules check, the read-only `dpm-ops` key (see
[The dpm-ops key](#the-dpm-ops-key)). Without it, everything else works and the tab shows the
setup steps.

## Running it on your computer

```bash
npm run ops                      # production, from .env (npm run reports:review still works)
npm run ops -- --every 10        # fetch reports every 10 minutes (default 5)
npm run ops -- --agent           # start with agent reviews on
npm run ops -- --auto-review     # and auto review too
npm run ops:demo                 # made-up lists and reports in memory, no Firestore
```

It prints a link with a one-time token (`http://127.0.0.1:4777/#…`); open that. The page listens on
127.0.0.1 only and refuses API calls without the token, so another website in the same browser
cannot drive it. The page takes the token out of the address bar once it has read it. It refuses
`--listen` beyond this machine unless `--lan` is given.

## Overview tab

What is waiting on you: reports about a child's safety, reports waiting for a verdict, replies not
marked sent, open erasure requests, master's Firestore rules not deployed, and today's Firestore
quota once it passes 80%. Below them, today's reads, writes and deletes. Each card opens its tab. A sound plays when a new report
arrives; the _Sound on_ button in the header mutes every sound (remembered per browser).

## Reports tab

Reports are grouped as _Waiting for your verdict_, _Not reviewed yet_, _Agent reviewing_ and
_Decided, to finish_; children's safety comes first, then the oldest.

**Agent reviews are off by default** (_Agent reviews_, at the top of the tab), because a review sends the
report's text and the list to Anthropic. With them off, you decide from the report and the list
and write the reply yourself in the empty draft. Turn them on for a report without personal
details, and off again; the setting is remembered.

1. **Review with agent** (asks before it sends anything) runs the `review-report` skill (`.claude/skills/review-report/`). It splits
   the report into claims, finds each in the list, checks video links on YouTube, Vimeo and Dropbox,
   and recommends _uphold_, _reject_ or _unclear_ with the terms sections, what to check by hand,
   and actions in proportion (§5). It drafts the reply in the reporter's language. A review takes
   a minute or two. The dollar figure on a review is what Claude Code reports at API prices: real
   money with an API key, while a Claude subscription counts it against the plan's usage instead.
2. **Your verdict**: _Uphold_ or _Reject_, with an optional note. If you decide differently from
   the agent, or want your reasoning in the email, **Redraft email for my verdict** runs the skill
   again with both; the new draft replaces the old one, edits included.
3. **Actions**: _Take list down_ (`remove-list`, with the takedown record), _Block list owner_
   (`block-user`). Both change Firestore at once, after the red alert screen (below).
4. **Reply**: edit the draft, then _Open in mail app_ (a `mailto:` link to the reporter's address)
   or _Copy_; send it from dance-pattern-mapper@pm.me; _Mark as sent_.
5. **Delete report (done)** deletes the report in Firestore (`remove-report`) and the dashboard's
   notes on it.

**Auto review** (top of the tab, only with agent reviews on) gives every new report on a live list an agent review as soon as it is
fetched, one at a time, so they wait for your verdict already reviewed. A review that fails is not
retried automatically; _Review again_ retries it. It stays on across restarts.

The page fetches reports every few minutes (_Fetch every_, _Fetch now_). Each fetch reads
the reports and, for each reported list, the list, its owner record and the publisher's block:
a few reads per report. Taking a list down reads the whole snapshot, as `remove-list` does.

## What the agent sees and may do

The agent session reads text strangers wrote, so it gets little:

- **Input**: the report's reason, details and date, whether the reporter wants a reply, the list
  as subscribers see it (no share key, no app token), and other reports about the same list.
  **Never** the reporter's email address or any user id.
- **Folder**: an empty temporary one holding only the input file, the skill and a copy of
  `TERMS_OF_USE.md`, never the checkout, so nothing a report talks it into reading is there
  (`.env`, the Admin key, a keystore).
- **Tools**: `Read` (its input file, `TERMS_OF_USE.md`, the skill) and
  `WebFetch` for youtube.com, youtu.be, vimeo.com and dropbox.com only. No shell, no edits, no
  other sites; anything else is refused without asking (`--permission-mode dontAsk`). Spending is
  capped per review (`DPM_REVIEW_BUDGET_USD`, default 2).
- **Model**: the tab's _Model_ picker (remembered) chooses fable, opus, sonnet or haiku, Claude Code's aliases for the latest of each; it starts on haiku; _Claude Code default_ leaves it to Claude Code, or to `DPM_REVIEW_MODEL` when set. Each review shows the model that wrote it. `DPM_REVIEW_TIMEOUT_MS` (default 10
  minutes) stops a stuck run.

The report and list text go to Anthropic for the review. The privacy policy (§3.3, §5) says so,
and says how: Claude used under Anthropic's own terms with training on our conversations off, and
no data processing agreement. That matches a Claude subscription with _Help improve Claude_
switched off in its privacy settings; keep it off. Moving to an API key or a Team plan (which come
with Anthropic's data processing addendum) would let the policy name Anthropic as a processor
instead; update §5 then.

## Data tab

The data removal tool on a page, with the same plans (`tools/data-removal/lib/model.js`), so the
page and the command line always find and remove the same things.

- **Search**: any text, a share code or a user id, across every shared list, figure, video link,
  modifier, suggestion and subscriber name (`find`). Share keys and app tokens are never searched
  or shown. A share code opens the list; a user id offers its user view.
- **List view** (`show`): every figure, video link, suggestion and subscriber record, the reports
  about it, and its owner. _Take list down_ (`remove-list`), _Delete, allow republish_
  (`remove-list --allow-republish`), _Release takedown_ (`release`), and _Delete_ on a single
  suggestion (`remove-suggestion`).
- **User view**: the sign-in account, the lists it owns, its suggestions and memberships, and
  whether it is blocked. _Block_ / _Unblock_, and _Remove everything of this user_ (`remove-user`;
  tick _with their lists_ when they own lists).
- **Erasure requests**: paste a deletion request that came by email, add the lists and user ids you
  find for it (_Add to request_ in a list or user view), remove them with the request picked in the
  red alert screen, write the reply, _Mark as sent_, then _Close request_. A closed request is
  deleted with your notes; the action log keeps what was removed.
- **Blocks and takedowns**: every blocked id and every taken-down share code, with _Unblock_ and
  _Release_, so neither is forgotten.
- **Action log**: what was removed or blocked, when, from which device and why. Each action
  writes a line when it starts and another when it is done or failed, so a removal that fails
  halfway still shows; the page shows a _started_ line only when nothing followed it. Lines in
  `actions.jsonl` hold share codes, user ids (for a takedown, the owner it had), report and case
  ids and your reason (200 characters at most), never list content, an email address or a
  report's words. Lines older than two years are dropped when the
  dashboard starts (PRIVACY_POLICY.md §6).

Search and the list and user views read the whole snapshot (a few reads per list, as `find`
does), kept in memory for a minute so a search, a look and a removal read it once. Every removal
reads it fresh first.

## Usage tab

How busy Firestore is, and whether the deployed rules are master's.

- **Firestore quota today**: reads, writes and deletes since midnight Pacific (when Spark's free
  quota resets; the page shows that time in yours) against the free limits of 50,000 reads,
  20,000 writes and 20,000 deletes, with yesterday's totals and reads per hour. Over the quota,
  Firestore refuses everyone (sharing stops) until the reset, so it warns from 80%. The
  dashboard's own reads count too: _Count now_ and the Data tab's search read every shared
  document once.
- **Live and refused**: snapshot listeners and connections now and at today's peak (subscribers'
  phones syncing), and today's requests by answer, with the ones the rules refused
  (`PERMISSION_DENIED`) by method.
- **Firestore rules**: the ruleset Firestore runs now against `firestore.rules` on master, as this
  checkout last fetched it (`origin/master`, no `git fetch` here; without that ref, the file in
  the checkout and its branch). If they differ, the difference, and a card on Overview: run
  `npm run rules:deploy`.
- **Our own counts** (only on _Count now_, since it reads the whole snapshot): shared lists and
  how many are members-only, subscriber records, join requests, suggestions, reports, takedowns,
  blocked ids, sign-in accounts (new this week, idle for a year: no sign-in or token refresh),
  and lists published and suggestions sent per day over two weeks. Only the numbers are kept, in
  memory.

The quota, listeners, requests and rules come from Cloud Monitoring and the Firebase Rules API,
fetched when the dashboard starts and then hourly (_Fetch now_ for sooner). They cost no
Firestore reads. Monitoring's figures lag a few minutes.

**On Spark, Cloud Monitoring refuses** to give out time series ("This API method requires billing
to be enabled"), whatever the key's roles: reading Firestore's figures needs a billing account on
the project (Blaze). The quota and _Live and refused_ panels then say so and point to the Firebase
console (_Firestore → Usage_); the rules check and our own counts work as they are. If the project
ever moves to Blaze, the panels fill in by themselves at the next hourly fetch.

### The dpm-ops key

A service account that can only look: it reads Monitoring's figures and the deployed rules, and
can change nothing. It is separate from the Admin key, so a bug in these calls can't delete
anything. Once, in the Firebase project:

```bash
PROJECT=<your Firebase project id>
gcloud iam service-accounts create dpm-ops --project $PROJECT \
  --display-name "DPM ops dashboard (read-only)"
for role in roles/monitoring.viewer roles/firebaserules.viewer; do
  gcloud projects add-iam-policy-binding $PROJECT \
    --member "serviceAccount:dpm-ops@$PROJECT.iam.gserviceaccount.com" --role $role
done
gcloud services enable monitoring.googleapis.com --project $PROJECT
gcloud iam service-accounts keys create ~/keys/dpm-ops.json \
  --iam-account dpm-ops@$PROJECT.iam.gserviceaccount.com
chmod 600 ~/keys/dpm-ops.json
```

Or in the Google Cloud console: _IAM & Admin → Service accounts → Create service account_
(`dpm-ops`), roles _Monitoring Viewer_ and _Firebase Rules Viewer_, then _Keys → Add key →
JSON_. Keep the file outside the repository and put its path in `.env`:

```bash
DPM_OPS_CREDENTIALS=/home/<you>/keys/dpm-ops.json
```

The dashboard signs its own token with the key (scopes `monitoring.read` and
`firebase.readonly`), so it needs no Google library. If a panel says an API "has not been used in
project", enable it with the link in the message (Cloud Monitoring API, Firebase Rules API).
On Spark there is no bill, so there is no billing role; after a move to Blaze, a cost panel
would need `roles/billing.viewer`.

## The red alert screen

Every action that deletes or blocks (on the Reports tab and the Data tab, and closing a request)
shows what it will do in words, then asks you to type back the share code, user id or request id
(for deleting a report, the reporter's id, since every report on a list shares its code). On a
home server it then asks for this device's passkey, unless you used it in the last ten minutes.
Only the passkey arms a device, so it is asked for again ten minutes after its last use. The
Reports tab reads the list's owner record again before a takedown or block, so a list handed over
or taken down since the last fetch is caught.

## Running it on a home server

The dashboard can run on a small always-on machine in your home network so you can use it from
your computers and your phone. It is never meant to face the internet: don't forward a port to it.

Nothing is installed on the devices. Each one is **enrolled** once: a one-time code from the
server, typed on the dashboard's sign-in page, registers a passkey on that device (fingerprint or
screen lock). From then on the device signs in with that passkey.

### 1. The server

- Linux with Node 24 (LTS until April 2028) or newer, and git. On a 32-bit Raspberry Pi OS, which
  Node 24 doesn't support, Node 22 runs it too (LTS until April 2027).
- A user of its own: `sudo adduser --disabled-password dpm-ops`, and clone the repository into its
  home. Run `npm --prefix tools/data-removal install` (the dashboard needs nothing else from npm).
- Put `.env` (with `FIREBASE_PROJECT_ID` and `DPM_ADMIN_CREDENTIALS`) in the checkout, and the
  Admin key **outside** it, for example `/home/dpm-ops/.config/dpm/admin-key.json`; both readable
  only by that user (`chmod 600`). The key can delete everything in the project, so keep the
  server's data on an encrypted disk.
- For agent reviews, install Claude Code and sign in as that user, with _Help improve Claude_ off
  (see _What the agent sees_ above).
- Give the server a fixed address in your router and a name on the network, for example
  `ops-host.local`: that is what the devices open, and passkeys need a name, not an IP address.

### 2. HTTPS: its own, or a proxy's

Passkeys need HTTPS. Either:

- **The dashboard serves HTTPS itself** (`--lan`). `npm run ops:pki -- init --name ops-host.local`
  makes a small CA (`~/.local/share/dpm/dashboard/tls/`, `DPM_DASHBOARD_DIR` changes the root)
  and a server certificate for that name, valid 825 days. Install `tls/ca.crt` as a trusted CA on
  each device once (Windows: double-click → _Install certificate_ → _Local machine_ → _Trusted Root
  Certification Authorities_; Android: Settings → Security → More security settings → Encryption &
  credentials → _Install a certificate_ → _CA certificate_). Or put a certificate for the name
  from a CA the devices already trust into `tls/server.crt` and `tls/server.key`, and skip that.
- **A proxy in front does HTTPS** (`--proxy --origin https://ops.home.lan`): Traefik, nginx or
  Caddy, with a certificate the devices trust, forwarding to the dashboard's plain HTTP port.
  The proxy is trusted with nothing but TLS: the dashboard reads no `X-Forwarded-*` header, so a
  request that reaches its port some other way still has to sign in. It answers only to the
  origin's host name, as the browser sends it.

### 3. Run it as a service

```ini
# /etc/systemd/system/dpm-ops.service
[Unit]
Description=DPM operations dashboard
After=network-online.target
Wants=network-online.target

[Service]
User=dpm-ops
WorkingDirectory=/home/dpm-ops/dpm
ExecStart=/usr/bin/node --env-file=.env tools/dashboard/server.js --lan --port 4777
Restart=on-failure
NoNewPrivileges=true
ProtectSystem=strict
PrivateTmp=true
UMask=0077
ReadWritePaths=/home/dpm-ops

[Install]
WantedBy=multi-user.target
```

(Behind a proxy: `--proxy --origin https://ops.home.lan --listen 127.0.0.1` instead of `--lan`,
if the proxy runs on the same machine.) `sudo systemctl enable --now dpm-ops`, and
`journalctl -u dpm-ops` shows its output. To update: `git pull` as `dpm-ops`, then
`sudo systemctl restart dpm-ops`.

### 4. Devices

```bash
npm run ops:pki -- enroll-code laptop   # a one-time code for the device called laptop
npm run ops:pki -- devices              # devices, their passkeys, last use
npm run ops:pki -- revoke-device phone  # a lost phone: passkeys gone, signed out at its next request
```

Open the dashboard on that device, type the code under _New device_ (valid 15 minutes, once; five
wrong tries void it) and confirm with the fingerprint or screen lock. The device is then signed
in. Device names are lowercase letters, digits and `-`, up to 32 characters. To add a passkey to a
device again (a new phone with the same name), make it another code.

A session lasts until 12 hours without use or 7 days in all, whichever comes first, or until a
restart; then the device signs in again with its passkey. The red alert screen asks for the
passkey again before a removal or block, and the erasure requests and the Reports tab's settings
open only with it, once ten minutes have passed since it was last used.

A passkey synced by the phone's password manager (Google Password Manager, iCloud Keychain) also
works on that account's other devices: the account and each device's screen lock are then what
lets one in.

### How it keeps others out

- Without a session, the server answers only the sign-in page, its fonts, and the four sign-in
  and enrolment calls; everything else is refused. After ten failed sign-ins or enrolments in ten
  minutes (from anywhere: behind a proxy there is no client address to go by), those calls pause
  for ten minutes.
- A session is a random cookie (`__Host-dpm-session`: `Secure`, `HttpOnly`, `SameSite=Strict`)
  the page's scripts can't read. The server keeps only its hash, in memory.
- The page carries that session's own token, which every API call must send back in a header,
  and every POST must come with the dashboard's own `Origin`. Another website can't read the page
  or send that header (the server allows no cross-site requests), so it can't drive the dashboard
  through a signed-in browser.
- The server answers only to its own name (no DNS rebinding) and sends a strict CSP.
- Passkeys are checked on the server with Node's crypto (`lib/access.js`), bound to its name and
  origin, with user verification required.

## Where its notes live

One JSON file per report in `~/.local/share/dpm/report-reviews/<project>/` (`DPM_REVIEWS_DIR`
changes the root), readable only by you: the agent's review, your verdict and note, the edited
email, and what was done. They hold the reporter's words, so they go when the report goes: _Delete
report_ removes them, and a fetch deletes the notes of any report deleted elsewhere (`npm run
data -- remove-report` or `remove-user`). `settings.json` there keeps the fetch interval and auto
review.

## Where its other files live

In `~/.local/share/dpm/dashboard/` (`DPM_DASHBOARD_DIR` changes it), readable only by you:

- `<project>/cases/`: one JSON file per open erasure request, deleted when it is closed.
- `<project>/actions.jsonl`: the action log, two years.
- `tls/`, `access/`: on a home server, the CA and server certificate (`--lan`), the device list and passkeys.

## Code

- `server.js`: the HTTP(S) server, its token, host and device checks, and the table of every
  tab's API.
- `public/index.html`: the page, no build step, no external scripts or fonts.
- `lib/reports.js`: the Reports tab's API and refresh timer.
- `lib/review.js`: pure: report views, the agent's input and answer schema, stages, priority.
- `lib/data.js`: the Data tab's API (search, views, removals, erasure requests, log).
- `lib/dataView.js`: pure: search results, list and user views, and each removal in words.
- `lib/store.js`: Firestore through `tools/data-removal` (same plans as `npm run data`), or the
  demo data.
- `lib/cases.js`, `lib/actionLog.js`, `lib/reviews.js`: the files above.
- `lib/access.js`: devices, passkeys, sign-in, sessions and the ten-minute arming.
- `public/login.html`: the sign-in and enrolment page on a home server.
- `lib/usage.js`: the Usage tab's API and hourly fetch; `lib/usageView.js`: pure: the quota day,
  Monitoring series into figures, the rules diff, our own counts; `lib/usageSources.js`: Cloud
  Monitoring and the Rules API, or made-up demo figures; `lib/google.js`: the `dpm-ops` key's
  token and read-only GETs.
- `lib/agent.js`: the `claude -p` command line and the one-at-a-time queue.
- `pki.js`: enrolment codes, the device list and revocation, and for `--lan` the CA and server certificate (`npm run ops:pki`).

Unit-tested in `__tests__/unit/dashboardReports.test.js`, `dashboardData.test.js` and
`dashboardUsage.test.js`, against
`demoStore`; the second also enrols a device and signs in over HTTP, and serves HTTPS with a `pki.js` certificate.
