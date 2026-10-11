# Changelog and the what's-new hint — `src/changelog/`

`changelog.ts` holds `CHANGELOG`, every released version's notes, newest first, bundled with the
app (no network). Settings → *What's new* lists all of it (`components/ChangelogSheet.tsx`) and
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
