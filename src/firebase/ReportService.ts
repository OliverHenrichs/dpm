import { doc, serverTimestamp, setDoc, Timestamp } from "firebase/firestore";
import { APP_TOKEN, REPORTS } from "@/src/firebase/firebaseConfig";
import { ensureSignedIn } from "@/src/firebase/auth";
import { requireDb } from "@/src/firebase/firestoreAccess";
import {
  MAX_REPORT_CONTACT_LENGTH,
  MAX_REPORT_DETAILS_LENGTH,
  ReportReason,
  reportId,
} from "@/src/legal/reports";

/** `reports/{shareCode}_{uid}`, as `reportList` writes it. */
export interface ReportDocument {
  shareCode: string;
  reporterUid: string;
  reason: ReportReason;
  details?: string;
  contact?: string;
  createdAt: Timestamp;
  appToken: string;
}

/**
 * Reports a published list to the operator (TERMS_OF_USE.md §4, the DSA's notice and action).
 * Signs in anonymously, as suggesting does, so a report has an author the operator can block if
 * reports are abused; the publisher never sees it. Sending again replaces this phone's earlier
 * report about the same list. Empty details and contact are left out, not stored empty.
 */
export async function reportList(
  shareCode: string,
  reason: ReportReason,
  details?: string,
  contact?: string,
): Promise<void> {
  const firestore = requireDb();
  const uid = await ensureSignedIn();
  const text = details?.trim().slice(0, MAX_REPORT_DETAILS_LENGTH);
  const email = contact?.trim().slice(0, MAX_REPORT_CONTACT_LENGTH);
  await setDoc(doc(firestore, REPORTS, reportId(shareCode, uid)), {
    shareCode,
    reporterUid: uid,
    reason,
    ...(text && { details: text }),
    ...(email && { contact: email }),
    createdAt: serverTimestamp(),
    appToken: APP_TOKEN,
  });
}
