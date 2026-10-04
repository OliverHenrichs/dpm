// firebase/auth's default typings describe the browser build. Metro resolves
// the react-native build, which also exports getReactNativePersistence.
import type { Persistence, ReactNativeAsyncStorage } from "firebase/auth";

declare module "firebase/auth" {
  export function getReactNativePersistence(
    storage: ReactNativeAsyncStorage,
  ): Persistence;
}
