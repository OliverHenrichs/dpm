# Report review dashboard

A web page on the operator's laptop for working through reports about published lists (Lists →
the list's "more" button → _Report list_, `src/legal/`). It shows every report next to the list it
is about, lets an agent check the claims and draft the reply email, and keeps the operator's
verdict, the edited email and what was done until the report is closed.

**Nothing is sent from here.** The agent decides nothing; the reply goes out from your own mail
app; takedowns and blocks happen only when you click them and type the share code or user id
back, as `npm run data` asks on the command line.

## Setup

Everything `tools/data-removal/README.md` → _Setup_ says (its `firebase-admin`, the Admin
credentials in `.env`), plus [Claude Code](https://claude.com/claude-code) signed in on the
laptop for the agent reviews (`claude` on the PATH, or `DPM_CLAUDE_BIN=/path/to/claude`).

## Running it

```bash
npm run reports:review                      # production, from .env
npm run reports:review -- --every 10        # fetch every 10 minutes (default 5)
npm run reports:review -- --agent           # start with agent reviews on
npm run reports:review -- --auto-review     # and auto review too
npm run reports:demo                        # made-up reports in memory, no Firestore
```

It prints a link with a one-time token (`http://127.0.0.1:4777/#…`); open that. The page listens on
127.0.0.1 only and refuses API calls without the token, so another website in the same browser
cannot drive it.

## Working through a report

Reports are grouped as _Waiting for your verdict_, _Not reviewed yet_, _Agent reviewing_ and
_Decided, to finish_; children's safety comes first, then the oldest.

**Agent reviews are off by default** (header: _Agent reviews_), because a review sends the
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
3. **Actions**: _Take list down_ (`remove-list`, with the takedown record), _Block publisher_
   (`block-user`). Both change Firestore at once.
4. **Reply**: edit the draft, then _Open in mail app_ (a `mailto:` link to the reporter's address)
   or _Copy_; send it from dance-pattern-mapper@pm.me; _Mark as sent_.
5. **Delete report (done)** deletes the report in Firestore (`remove-report`) and the dashboard's
   notes on it.

**Auto review** (header, only with agent reviews on) gives every new report on a live list an agent review as soon as it is
fetched, one at a time, so they wait for your verdict already reviewed. A review that fails is not
retried automatically; _Review again_ retries it. It stays on across restarts.

The page fetches reports every few minutes (header: _Fetch every_, _Fetch now_). Each fetch reads
the reports and, for each reported list, the list, its owner record and the publisher's block:
a few reads per report. Taking a list down reads the whole snapshot, as `remove-list` does.

## What the agent sees and may do

The agent session reads text strangers wrote, so it gets little:

- **Input**: the report's reason, details and date, whether the reporter wants a reply, the list
  as subscribers see it (no share key, no app token), and other reports about the same list.
  **Never** the reporter's email address or any user id.
- **Tools**: `Read` (its input file, `TERMS_OF_USE.md`, the skill; `.env` is denied) and
  `WebFetch` for youtube.com, youtu.be, vimeo.com and dropbox.com only. No shell, no edits, no
  other sites; anything else is refused without asking (`--permission-mode dontAsk`). Spending is
  capped per review (`DPM_REVIEW_BUDGET_USD`, default 2).
- **Model**: the header's _Model_ picker (remembered) chooses fable, opus, sonnet or haiku, Claude Code's aliases for the latest of each; _default_ leaves it to Claude Code, or to `DPM_REVIEW_MODEL` when set. Each review shows the model that wrote it. `DPM_REVIEW_TIMEOUT_MS` (default 10
  minutes) stops a stuck run.

The report and list text go to Anthropic for the review. The privacy policy (§3.3, §5) says so,
and says how: Claude used under Anthropic's own terms with training on our conversations off, and
no data processing agreement. That matches a Claude subscription with _Help improve Claude_
switched off in its privacy settings; keep it off. Moving to an API key or a Team plan (which come
with Anthropic's data processing addendum) would let the policy name Anthropic as a processor
instead; update §5 then.

## Where its notes live

One JSON file per report in `~/.local/share/dpm/report-reviews/<project>/` (`DPM_REVIEWS_DIR`
changes the root), readable only by you: the agent's review, your verdict and note, the edited
email, and what was done. They hold the reporter's words, so they go when the report goes: _Delete
report_ removes them, and a fetch deletes the notes of any report deleted elsewhere (`npm run
data -- remove-report` or `remove-user`). `settings.json` there keeps the fetch interval and auto
review.

## Code

- `server.js`: the HTTP server, the refresh timer and the API the page calls.
- `public/index.html`: the page, no build step, no external scripts.
- `lib/review.js`: pure: report views, the agent's input and answer schema, stages, priority.
  Unit-tested in `__tests__/unit/reportReview.test.js` with the dashboard against `demoStore`.
- `lib/store.js`: Firestore through `tools/data-removal` (same plans as `npm run data`), or the
  demo data.
- `lib/agent.js`: the `claude -p` command line and the one-at-a-time queue.
- `lib/reviews.js`: the notes files.
