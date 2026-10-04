import { getAuth, signInAnonymously } from "firebase/auth";
import { app } from "@/src/firebase/firebaseConfig";

/**
 * Web counterpart of `auth.ts`. The browser build of firebase/auth persists
 * the session itself and has no `getReactNativePersistence`, which is why
 * this is a platform split.
 */
export async function ensureSignedIn(): Promise<string> {
  if (!app) throw new Error("Firebase is not configured.");
  const appAuth = getAuth(app);
  await appAuth.authStateReady();
  if (appAuth.currentUser) return appAuth.currentUser.uid;
  const { user } = await signInAnonymously(appAuth);
  return user.uid;
}
