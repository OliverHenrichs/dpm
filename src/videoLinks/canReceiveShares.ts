import { requireOptionalNativeModule } from "expo";

/**
 * Whether this build can receive shares: `expo-share-intent`'s native side is there (an Android
 * build with it; not web, Jest, iOS for now, or a dev client built before it was added).
 */
export const canReceiveShares =
  requireOptionalNativeModule("ExpoShareIntentModule") !== null;
