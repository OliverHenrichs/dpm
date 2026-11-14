# Changelog, the what's-new hint and the update prompt — `src/changelog/`

`changelog.ts` holds `CHANGELOG`, every released version's notes, newest first, bundled with the
app (no network). Settings → _What's new_ lists all of it (`components/ChangelogSheet.tsx`) and
holds the switch for the hint. `components/WhatsNewHint.tsx`, mounted once in `app/_layout.tsx`,
shows the entries a user has not seen yet the first time they open a new version.

## Releasing a version

Add an entry at the top of `CHANGELOG` whose `version` is the new `version` in `app.config.ts`
(and `package.json`), with the same notes in **all nine** languages. Set `date` on the day it
ships; an entry without one shows no date. `__tests__/unit/changelog.test.ts` fails on a newest
entry that is not the app's version, versions out of order, or a language missing or with a
different number of notes. Notes are the translations themselves, not `t()` keys: they are
written once per release and never reused, so they stay together in one place. Write them for
dancers (what they will notice), not as commit messages, and keep the dance terms as precise as
anywhere else in the app.

Set the app's own names apart (buttons, tabs, sections, settings: _Edit Figure_, _Map_,
_Levels_), using the exact label from `locales/<lang>.json`. In Latin-script languages wrap
them in `*…*`, which `ChangelogEntries` shows in italics (`noteParts` splits them; the test
fails on an unclosed mark). Chinese, Arabic, Hindi and Bengali use the script's quotation
marks instead (“…”, «…»), since italics don't suit those scripts. Play's what's-new text is
plain, so it has neither.

## When the hint shows

`decideWhatsNew` is pure and decides it from the version last seen (`@changelogSeenVersion`), the
setting (`@whatsNewHintEnabled`, on unless turned off) and whether any list exists:

- **First install** (no version recorded, no lists): nothing shows; the newest version is
  recorded. Everything is new, and the app is its own introduction.
- **Update from a build without the hint** (no version recorded, but lists exist): the newest
  entry.
- **Otherwise**: every entry newer than the version last seen, so someone who skipped a release
  sees both.
- **Hint turned off**: nothing shows, but the version is still recorded, so turning it back on
  does not replay every update since.

The version is recorded when the sheet closes, not when it opens. The decision runs once per
launch, after `ActivePatternListProvider` has loaded (it needs `hasLists`).

## The update prompt

`components/UpdatePrompt.tsx`, mounted once in `app/_layout.tsx`, uses Google Play's in-app
updates (flexible flow) through the local `app-update` module (`modules/AGENTS.md`). At launch it
asks Play once; `decideUpdatePrompt` (`appUpdate.ts`, pure) turns the answer and the last time
Play's dialog was shown (`@updatePromptAsked`: version code and time) into `restart`, `ask` or
`none`. The dialog shows at most once every `ASK_AGAIN_DAYS` per version, and never while an
update is already downloading. When the download finishes (an `onInstallStatus` event, or
`downloaded` at a later launch) the sheet offers `completeUpdate`, which restarts the app.

- **Never restart over a video job.** The sheet stays hidden while any job is `queued`,
  `running` or in `review`: `jobStore` lives in memory and the restart would lose it.
- **It only works for a Play install.** In the dev client, a preview APK or anything sideloaded,
  `check` rejects and nothing shows; that is expected, not a bug. Test it with Play's internal
  app sharing or an alpha build that is one version behind the track.
- The what's-new hint then shows after the restart, as after any update.
