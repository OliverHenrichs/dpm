import * as Crypto from "expo-crypto";

const ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

/**
 * A publisher's secret for one published list: 43 characters, 256 bits.
 *
 * It is stored on the publisher's list (`IPatternList.shareKey`) and in the
 * list's owner record in Firestore, which nobody can read. Whoever holds it
 * can take the published list over — that is how a new phone, given an
 * editable export of the list, gets control back. It is never part of the
 * published document, and read-only exports leave it out.
 */
export function generateShareKey(): string {
  const bytes = Crypto.getRandomValues(new Uint8Array(43));
  // 256 is a multiple of 64, so `% 64` is unbiased.
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}
