import { collection, doc, Firestore } from "firebase/firestore";
import * as Crypto from "expo-crypto";
import {
  db,
  firebaseAvailable,
  SHARED_LISTS_COLLECTION,
} from "@/src/firebase/firebaseConfig";
import { IPatternList } from "@/src/pattern/types/IPatternList";

/** What every Firestore service starts from: the database, a list's code, how a refusal reads. */

/** A share code's length (`sharedLists/{code}`). */
export const SHARE_CODE_LENGTH = 8;

const CODE_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/**
 * A random code of 0-9 and A-Z, from expo-crypto's CSPRNG rather than `Math.random()`, so it
 * cannot be guessed (GDPR Art. 32, security of processing). Share codes and handover codes.
 */
export function randomCode(length: number): string {
  const bytes = Crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join(
    "",
  );
}

/** The database, or a throw when Firebase is not configured (the app runs local-only). */
export function requireDb(): Firestore {
  if (!firebaseAvailable || !db) {
    throw new Error(
      "Firebase is not configured. Set the FIREBASE_* variables (see .env.example).",
    );
  }
  return db;
}

/** The share code of a published list, or a throw when it is not published. */
export function requireShareCode(list: IPatternList): string {
  if (!list.shareCode) throw new Error("The list is not published.");
  return list.shareCode;
}

/** A subcollection of a shared list, `sharedLists/{code}/{name}`. */
export function sharedListCollection(
  firestore: Firestore,
  code: string,
  name: string,
) {
  return collection(doc(firestore, SHARED_LISTS_COLLECTION, code), name);
}

/** Whether the security rules refused a request. They never say why. */
export function isPermissionDenied(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    (e as { code?: string }).code === "permission-denied"
  );
}
