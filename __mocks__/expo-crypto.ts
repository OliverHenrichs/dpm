import { randomFillSync } from "crypto";

/**
 * expo-crypto backed by Node's CSPRNG, so code that mints share codes and
 * share keys runs under jest without the native module. Only the surface the
 * app uses is implemented.
 */
export function getRandomValues(array: Uint8Array): Uint8Array {
  return randomFillSync(array);
}
