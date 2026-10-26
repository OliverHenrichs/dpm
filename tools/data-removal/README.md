# Data removal

Finds and deletes what people published through DPM's cloud sharing: for an erasure request
(PRIVACY_POLICY.md §7), and for anything that must not be there, such as a child's personal data
(§8). It runs on the operator's laptop with the Firebase Admin SDK, which is not bound by
`firestore.rules`.

## Setup (once)

1. `npm --prefix tools/data-removal install` (its own `package.json`, so `firebase-admin` stays
   out of the app's dependencies).
2. Credentials, either of:
   - **A service account key.** Firebase console → Project settings → Service accounts →
     _Generate new private key_. Keep the file **outside the repository** (for example
     `~/.config/dpm/admin-key.json`, `chmod 600`) and add
     `DPM_ADMIN_CREDENTIALS=/home/you/.config/dpm/admin-key.json` to `.env`. The key can read and
     delete everything in the project; delete it in the console when it is no longer needed.
   - **Your Google account**, with no key file: `gcloud auth application-default login`, and leave
     `DPM_ADMIN_CREDENTIALS` unset.
3. `FIREBASE_PROJECT_ID` comes from `.env` like everything else. Every command prints the project
   it is talking to first.

## Commands

Run from the repository root.

```bash
npm run data -- find "Emma"                    # any text: a name, a word, part of a video link
npm run data -- find AB12CD34                  # a share code: everything under that list
npm run data -- find <user id>                 # where an anonymous user id appears, and its account
npm run data -- show AB12CD34                  # every pattern, video link, suggestion (or suggested change) and subscriber
npm run data -- remove-list AB12CD34           # delete the list and everything under it
npm run data -- remove-user <user id>          # delete one person's suggestions, records and account
npm run data -- remove-suggestion AB12CD34 <suggestion id>
npm run data -- reports                        # every report about a list, newest first
npm run data -- remove-report AB12CD34_<user id>   # delete a report once dealt with
npm run data -- release AB12CD34               # undo a takedown
npm run data -- block-user <user id>           # stop that installation publishing again
npm run data -- unblock-user <user id>
```

Every removal shows what it will delete and asks you to type the share code or user id back.
`--dry-run` stops after showing it; `--yes` skips the question.

`find` reads every shared document in the project (a few reads per list, fine at DPM's size) and
matches any text in it, ignoring case: list and pattern names, descriptions, tags, video links,
modifier names, suggestions and the names subscribers gave. Share keys and the app token are
never searched or printed.

## What a removal does

- **`remove-list`** deletes the list, its suggestions, daily counters and subscriber records, and
  replaces its owner record with a **takedown record**: an owner no device can be, with a key
  nobody holds. Every edit on the publisher's phone re-publishes the whole list, so without the
  takedown the list would come back with the next edit; with it, the rules refuse that push (and
  the phone's _Stop Sharing_ fails too). `--allow-republish` deletes the owner record instead,
  for when the publisher should be able to share again. `release` lifts a takedown later.
- **`remove-user`** deletes one anonymous user's suggestions, subscriber records (join requests,
  mutes, the name they gave), their own daily counters, the reports they sent, then their Firebase Authentication
  account. If they publish lists, the owner records hold their id, so it refuses unless you add
  `--with-lists`, which removes and takes down those lists too.
- **`block-user`** stops one installation: the rules refuse every publish, sync, suggestion
  and request to join from that anonymous id (`blockedUsers/{uid}`), while it can still stop
  sharing its own lists. Use it with `remove-list` when a publisher should not just publish the
  same content under a new code. It keeps the account on purpose: **`remove-user` does not
  stop anyone**, because the app signs in again with a fresh id, so `remove-user` also lifts any
  block. Nothing stops a reinstall (or cleared app data), which gets a new id; with anonymous
  sign-in there is no identity to ban.
- **`remove-suggestion`** deletes one suggestion, for when the rest of that person's records
  should stay.

## Reports

People who follow a list can report it from the app (Lists → the list's "more" button → _Report
list_, `src/legal/`). A report is `reports/{shareCode}_{reporter uid}`: the reason, optional
details and an optional email for a reply. Nobody but this tool can read it. Nothing notifies
you, so run `reports` regularly; the terms of use promise to look at every report promptly
(children's safety first), which the Digital Services Act requires of a host.

The report review dashboard (`npm run reports:review`, `tools/report-review/README.md`) does all
of this on one page, fetching every few minutes, with an agent that checks each report and drafts
the reply. On the command line:

For each report: `show` the list, decide, and if it breaks the law or the terms, `remove-list`
it (and `block-user` its publisher when needed). If the reporter left an email, tell them what you
did. Then `remove-report`. `remove-list` keeps reports about the list; `remove-user` deletes the
reports that user sent.

There is no command to edit one pattern of a list: the publisher's phone would put it back with
its next edit. Remove the whole list, or ask the publisher to change it.

## What it cannot reach

- **Subscribers' phones.** A subscriber keeps a local copy of a list after it is removed from
  Firestore (`useSharedList`); only they can delete it.
- **The publisher's phone**, which keeps its own list until they delete it.
- **Videos** on YouTube, Vimeo or Dropbox: the list holds only links. Report the video to the host.
- **Firebase's own logs** (IP addresses, timestamps), kept by Google under its retention policy.

## Trying it without touching production

```bash
npx -y firebase-tools@15.32.1 emulators:start --only firestore,auth --project demo-dpm
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
  FIREBASE_PROJECT_ID=demo-dpm node tools/data-removal/dpm-data.js find Emma
```

`lib/model.js` (searching and planning, no Firebase) is unit-tested in
`__tests__/unit/dataRemoval.test.js`; that the rules refuse a taken-down list is tested in
`__tests__/rules/`. `lib/firestore.js` and `dpm-data.js` were tried against the emulators.
