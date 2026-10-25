# Terms of use and reports — `src/legal/`

What the app does about the rules for sharing: agreement to the terms of use before anything is
shared, reporting a list to the operator, and the links to the legal pages. Unqualified paths are
relative to `src/legal/`.

## Why it exists

Published lists and suggestions are content people make available to others, so DPM is a hosting
service under the Digital Services Act, and Google Play's user-generated content policy applies:
terms accepted before anything is shared, and an in-app way to report content. The operator handles
reports with `tools/data-removal` (`reports`, `remove-list`, `block-user`, `remove-report`), or
on the report review dashboard (`tools/report-review`, `npm run reports:review`), where the
`review-report` skill (`.claude/skills/review-report/`) checks each report and drafts the reply.

## The terms of use

- **The text** is `TERMS_OF_USE.md` at the repository root, rendered to `website/terms.html` by
  `website/build-privacy.py` (with the privacy policy). The app opens it in the browser
  (`legalLinks.ts`); it is not bundled.
- **Agreement** is asked by `useTermsConsent()`: `withTerms(action, onDecline?)` runs `action` at
  once when this phone agreed to `TERMS_VERSION` (`TermsStorage.ts`, key `@termsAccepted`), and
  otherwise shows `TermsDialog` first. The hook's `termsDialog` must be rendered where it is used.
  Used before **publishing** (the Publish/Update button in `ShareListModal`; settings changes on an
  already published list re-publish without asking) and before the **suggestion form**
  (`SuggestPatternModal`). Asking to join sends only a name, and is not gated.
- **`TERMS_VERSION` is the terms' "Last updated" date.** Bump both together, and only for a change
  that matters for what people share: everyone is then asked again before their next share. A
  typo fix keeps the version.

## Reports

- _Report list_ is offered in the Lists screen's sheet for a subscribed list (read-only, with a
  share code) when cloud sharing is configured. `components/ReportListModal.tsx` takes a reason
  (`reports.ts`, mirrored in `firestore.rules`), optional details and an optional email for a
  reply; `src/firebase/ReportService.ts` writes it.
- A report is `reports/{shareCode}_{uid}` (top level, so it outlives the list's removal), one per
  list and reporter: sending again replaces it. Reporting signs in anonymously, as suggesting does,
  so a reporter who abuses it can be blocked (`notBlocked()` in the rules). Nobody can read a report
  through the rules, the reporter and the publisher included; the publisher is never told.
- A new reason goes in `REPORT_REASONS`, its label in all nine locales, the rules' list, the
  dashboard's labels (`tools/report-review/public/index.html`) and the skill's list of reasons.
- A new field on a report: `reportView` in `tools/report-review/lib/review.js` decides whether the
  dashboard shows it, and `agentInput` whether the agent gets it (never contact data or ids).
- Not reportable yet: a single suggestion (the publisher can mute its author) and a publisher's
  own view of a subscriber. Add those here when needed.
