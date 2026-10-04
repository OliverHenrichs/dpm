import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  Auth,
  getAuth,
  getReactNativePersistence,
  initializeAuth,
  signInAnonymously,
} from "firebase/auth";
import { app } from "@/src/firebase/firebaseConfig";

let auth: Auth | undefined;

/**
 * Created on first use, not at import: subscribing never signs in, and
 * nothing about auth should run for a user who never publishes.
 */
function getAppAuth(): Auth {
  if (!app) throw new Error("Firebase is not configured.");
  if (!auth) {
    try {
      // Persisted, so the publisher keeps the same anonymous id across
      // launches, and with it control of the lists it published.
      auth = initializeAuth(app, {
        persistence: getReactNativePersistence(AsyncStorage),
      });
    } catch {
      // Already initialised (a fast refresh re-ran this module).
      auth = getAuth(app);
    }
  }
  return auth;
}

/**
 * Sign in anonymously if not signed in yet, and return the user id.
 *
 * There is no account and nothing to show: the id only lets the security
 * rules tell a list's publisher from its subscribers. See
 * `src/firebase/AGENTS.md`.
 */
export async function ensureSignedIn(): Promise<string> {
  const appAuth = getAppAuth();
  await appAuth.authStateReady();
  if (appAuth.currentUser) return appAuth.currentUser.uid;
  const { user } = await signInAnonymously(appAuth);
  return user.uid;
}
