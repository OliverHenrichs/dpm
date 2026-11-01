# 0011: Navigation is expo-router only

- **Status:** accepted
- **Date:** recorded 2026-11-01
- **Decided by:** Oliver merged the PRs that built it
- **Recorded from:** Root `AGENTS.md` (Architecture)

## Context

Expo SDK 56 and later forbid importing `@react-navigation/*` from app code; Metro fails the bundle.

## Decision

Navigation is file-based expo-router: `Drawer` from `expo-router/drawer`, hooks and `router` from
`expo-router`. Route files in `app/` are one-line re-exports; `DrawerRoutes.ts` is the one list of
places and tabs.

## Alternatives considered

- **React Navigation directly**: not allowed by the SDK.

## Consequences

- A new view of a list is a tab, a new place a drawer entry, both added in `DrawerRoutes.ts` and `app/`.
