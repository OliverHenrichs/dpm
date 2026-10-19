/**
 * What a report about a published list says (`src/firebase/ReportService.ts`). The reasons map
 * to TERMS_OF_USE.md §3; `firestore.rules` accepts exactly these, and the lengths below.
 */
export const REPORT_REASONS = [
  "consent",
  "child",
  "copyright",
  "illegal",
  "spam",
  "other",
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number];

/** The translation key of each reason's label. */
export const REPORT_REASON_LABEL_KEYS: Record<ReportReason, string> = {
  consent: "reportReasonConsent",
  child: "reportReasonChild",
  copyright: "reportReasonCopyright",
  illegal: "reportReasonIllegal",
  spam: "reportReasonSpam",
  other: "reportReasonOther",
};

export const MAX_REPORT_DETAILS_LENGTH = 2000;
/** An email address's longest form (RFC 5321). */
export const MAX_REPORT_CONTACT_LENGTH = 254;

/** One report per list and reporter: sending again replaces the earlier one. */
export function reportId(shareCode: string, uid: string): string {
  return `${shareCode}_${uid}`;
}
