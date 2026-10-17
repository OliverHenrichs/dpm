import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";

const SUBSCRIPTION_IDS_KEY = "@subscriptionIds";

const ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

/** 32 characters, 192 bits: what the security rules accept as a subscription id. */
function generateSubscriptionId(): string {
  const bytes = Crypto.getRandomValues(new Uint8Array(32));
  // 256 is a multiple of 64, so `% 64` is unbiased.
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

async function readIds(): Promise<Record<string, string>> {
  const raw = await AsyncStorage.getItem(SUBSCRIPTION_IDS_KEY);
  if (!raw) return {};
  const parsed: unknown = JSON.parse(raw);
  return parsed && typeof parsed === "object"
    ? (parsed as Record<string, string>)
    : {};
}

/**
 * This phone's subscription id for a shared list (`src/firebase/SubscriptionService.ts`), minted
 * on first use. A different random id for every list, kept apart from the lists so no export
 * carries it: two phones sharing one would count once, and either could remove the other's.
 */
export async function getSubscriptionId(shareCode: string): Promise<string> {
  const ids = await readIds();
  const existing = ids[shareCode];
  if (typeof existing === "string" && existing) return existing;
  const id = generateSubscriptionId();
  await AsyncStorage.setItem(
    SUBSCRIPTION_IDS_KEY,
    JSON.stringify({ ...ids, [shareCode]: id }),
  );
  return id;
}

/** The stored id, without minting one: null when this phone never registered. */
export async function peekSubscriptionId(
  shareCode: string,
): Promise<string | null> {
  const id = (await readIds())[shareCode];
  return typeof id === "string" && id ? id : null;
}

export async function forgetSubscriptionId(shareCode: string): Promise<void> {
  const { [shareCode]: _removed, ...rest } = await readIds();
  await AsyncStorage.setItem(SUBSCRIPTION_IDS_KEY, JSON.stringify(rest));
}
