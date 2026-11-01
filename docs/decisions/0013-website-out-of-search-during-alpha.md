# 0013: The website stays out of search engines during the alpha

- **Status:** accepted
- **Date:** 2026-10-19
- **Decided by:** Oliver
- **PR:** #107
- **Recorded from:** Project memory, `website/README.md`

## Context

The app is not public yet. A site found through search would promise an app people can't install.

## Decision

Every page carries `noindex`. `robots.txt` still allows crawling, so the tag is seen. The launch
checklist in `website/README.md` removes the tags at public launch.

## Alternatives considered

- **Block crawling in `robots.txt`**: crawlers then never see `noindex`, and a linked page can
  still be listed.

## Consequences

- Remove the tags as part of the public launch.
