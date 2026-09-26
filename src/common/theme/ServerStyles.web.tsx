import { useServerUnistyles } from "react-native-unistyles/server";

/**
 * Static rendering gives every element a Unistyles class name, but the CSS
 * behind those classes only exists in the renderer's memory. This writes it
 * into the page, and on the client hands it back to Unistyles, so the
 * pre-rendered HTML is styled before any JavaScript runs.
 */
export default function ServerStyles() {
  return useServerUnistyles();
}
