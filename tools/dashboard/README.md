# DPM operations dashboard

A web page for running DPM's cloud side: the reports about published lists, everything
`npm run data` does (search, show, take down, remove a user, block), erasure requests that come by
email, and a log of what was removed. Usage figures from Firebase and Google Play come in later
phases; their tabs say what is planned. The page has no build step and loads nothing from outside
(its two fonts, Rajdhani and Share Tech Mono, are in `public/fonts/` under the SIL OFL).

**Nothing is sent from here.** Replies go out from your own mail app. Anything that deletes or
blocks happens only after a red alert screen where you type back the share code or user id, as
`npm run data` asks on the command line.

It runs in one of two ways:

- **On your computer**, plain HTTP on 127.0.0.1, opened with the link it prints.
- **On a home server** (any small always-on Linux machine), HTTPS for the home network, open only
  to your own devices with a certificate from the dashboard's own CA, and a passkey before
  anything that deletes or blocks, opens the erasure requests or changes the settings. See
  [Running it on a home server](#running-it-on-a-home-server).

## Setup

Everything `tools/data-removal/README.md` → _Setup_ says (its `firebase-admin`, the Admin
credentials in `.env`), plus [Claude Code](https://claude.com/claude-code) signed in for the agent
reviews (`claude` on the PATH, or `DPM_CLAUDE_BIN=/path/to/claude`; on Windows it finds the `claude.exe` behind npm's `claude.cmd` itself).

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
marked sent, open erasure requests. Each card opens its tab. A sound plays when a new report
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

### 1. The server

- A 64-bit Linux, Node 22 or newer, `openssl`, and git.
- A user of its own: `sudo adduser --disabled-password dpm-ops`, and clone the repository into its
  home. Run `npm --prefix tools/data-removal install` (the dashboard needs nothing else from npm).
- Put `.env` (with `FIREBASE_PROJECT_ID` and `DPM_ADMIN_CREDENTIALS`) in the checkout, and the
  Admin key **outside** it, for example `/home/dpm-ops/.config/dpm/admin-key.json`; both readable
  only by that user (`chmod 600`). The key can delete everything in the project, so keep the
  server's data on an encrypted disk.
- For agent reviews, install Claude Code and sign in as that user, with _Help improve Claude_ off
  (see _What the agent sees_ above).
- Give the server a fixed address in your router. Its name on the network, for example
  `ops-host.local`, is what the devices open; passkeys need a name, not an IP address.

### 2. Certificates

```bash
npm run ops:pki -- init --name ops-host.local --ip 192.0.2.10
npm run ops:pki -- add-device computer   # prints the .p12 file and its password
npm run ops:pki -- add-device phone
npm run ops:pki -- devices
npm run ops:pki -- revoke-device phone   # a lost phone: refused from its next request
```

`init` makes a small CA of its own (`~/.local/share/dpm/dashboard/tls/`, `DPM_DASHBOARD_DIR`
changes the root) and the server's certificate. On each device:

1. Install `tls/ca.crt` as a trusted CA. Windows: double-click it → _Install certificate_ →
   _Local machine_ → _Trusted Root Certification Authorities_. Linux Chrome/Firefox: settings →
   certificates → _Authorities_ → import. Android: Settings → Security → More security settings →
   Encryption & credentials → _Install a certificate_ → _CA certificate_.
2. Import that device's `tls/devices/<name>.p12` with its password. Windows: double-click it.
   Android: the same menu → _VPN & app user certificate_. Firefox keeps its own store: settings →
   certificates → _Your certificates_ → import.
3. Delete the copies you moved over, and the `.p12` in `tls/devices/` on the server: with the
   printed password it lets any browser in.

A device certificate lasts two years, the server certificate 825 days; make new ones with
`revoke-device` and `add-device`, or delete `tls/` and run `init` again.

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
ReadWritePaths=/home/dpm-ops

[Install]
WantedBy=multi-user.target
```

`sudo systemctl enable --now dpm-ops`, then open `https://ops-host.local:4777/` on a device.
The browser asks which certificate to show; pick the DPM Operations one. `journalctl -u dpm-ops`
shows its output. To update: `git pull` as `dpm-ops`, then `sudo systemctl restart dpm-ops`.

### 4. Passkeys

On each device, open the _Access_ tab. Run `npm run ops:pki -- enroll-code` on the server, type the
code (valid 15 minutes, once) and press _Register passkey_; the device asks for your fingerprint
or screen lock. From then on, the red alert screen asks for it before a removal or block, and the
erasure requests and the Reports tab's settings open only with it. A
passkey belongs to the device certificate it was registered with; `revoke-device` removes both.

### How it keeps others out

- The TLS handshake refuses any browser without a certificate from the dashboard's CA; the server
  then checks the certificate is on the device list (`access/devices.json`) and not revoked.
- The page carries a token that every API call must send back in a header. Another website can't
  read the page or send that header (the server allows no cross-site requests), so it can't drive
  the dashboard through a browser that holds a device certificate.
- The server answers only to its own name (no DNS rebinding) and sends a strict CSP.
- Passkeys are checked on the server with Node's crypto (`lib/access.js`), bound to its name.

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
- `tls/`, `access/`: on a home server, the CA, certificates, device list and passkeys.

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
- `lib/access.js`: device list, passkeys and the ten-minute arming.
- `lib/agent.js`: the `claude -p` command line and the one-at-a-time queue.
- `pki.js`: the CA, certificates and passkey codes (`npm run ops:pki`).

Unit-tested in `__tests__/unit/dashboardReports.test.js` and `dashboardData.test.js`, against
`demoStore`; the second also issues certificates with `pki.js` and connects with them.
