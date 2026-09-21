/**
 * A minimal `react-native-worklets`.
 *
 * Mocked for the same reason as Reanimated: importing the real package
 * initialises a native runtime jest has no equivalent for. `scheduleOnRN`
 * queues a call back to the React Native runtime from a worklet; here there is
 * only one runtime, so it simply calls through — synchronously, which is what
 * lets a test drive a gesture handler and then assert on the state it set.
 */
export function scheduleOnRN<Args extends unknown[]>(
  fn: (...args: Args) => unknown,
  ...args: Args
): void {
  fn(...args);
}

export function scheduleOnUI<Args extends unknown[]>(
  fn: (...args: Args) => unknown,
  ...args: Args
): void {
  fn(...args);
}

export function runOnUI<T extends (...args: never[]) => unknown>(fn: T): T {
  return fn;
}

export function createWorkletRuntime() {
  return {};
}
