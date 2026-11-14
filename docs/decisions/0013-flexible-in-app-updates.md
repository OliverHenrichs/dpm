# 0013: Updates are offered through Play's flexible in-app flow

- **Status:** accepted
- **Date:** 2026-11-14
- **Decided by:** Oliver (asked for an in-app update prompt; the flow was proposed in the PR)
- **PR:** see the PR that adds this record

## Context

Google Play updates apps in the background by default, but someone who turned auto-update off
never learned that a new version exists: nothing in DPM told them. Testers on the alpha track and
store users alike could stay on an old version with known bugs.

## Decision

At launch DPM asks Play whether a newer version exists and, if so, shows Play's own update dialog
using the **flexible** flow: the update downloads in the background while the user keeps working,
and DPM offers a restart once it is ready. The dialog shows at most once a week per version. The
wrapper is a small local Expo module (`modules/app-update`) over Google's own library.

## Alternatives considered

- **Immediate flow** (a full-screen Play page that blocks the app until updated): too intrusive
  for routine releases, and it would interrupt video work. Kept in reserve for a release that must
  reach everyone, which would be a new record.
- **OTA JavaScript updates (`expo-updates`)**: ships JS without Play, but not native changes, and
  adds an update server and a second release path. Not needed for the problem at hand.
- **A third-party React Native in-app-updates package**: the same Google library underneath, plus
  a dependency to keep compatible with every SDK bump; the wrapper is about a hundred lines.
- **Our own "new version available" check against a server**: duplicates what Play already knows.

## Consequences

- The prompt only works for installs from Google Play; dev clients and sideloaded builds never
  see it, so testing needs Play's internal app sharing or a track build one version behind.
- A restart must never cut off a video job (`src/changelog/AGENTS.md`).
- iOS has no counterpart yet; an App Store version check would be its own piece of work.
