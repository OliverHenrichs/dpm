/**
 * In-memory stand-in for `expo-alternate-app-icons`.
 *
 * Applied automatically to every test, like the other `__mocks__` beside
 * `node_modules`. It behaves like an Android device that supports alternate
 * icons and starts on the default one; `setAlternateIconsSupported(false)`
 * plays a platform without them. Both setup files reset it per test.
 */
let supported = true;
let current: string | null = null;

export let supportsAlternateIcons = true;

export const getAppIconName = jest.fn((): string | null => current);

export const setAlternateAppIcon = jest.fn(
  async (name: string | null): Promise<string | null> => {
    if (!supported) throw new Error("Alternate icons are not supported");
    current = name;
    return name;
  },
);

export function setAlternateIconsSupported(value: boolean): void {
  supported = value;
  supportsAlternateIcons = value;
}

export function resetAlternateIconsMock(): void {
  setAlternateIconsSupported(true);
  current = null;
}
