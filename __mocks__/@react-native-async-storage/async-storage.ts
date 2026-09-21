/**
 * In-memory stand-in for `@react-native-async-storage/async-storage`.
 *
 * Jest picks this up automatically for every test, because a `__mocks__`
 * directory adjacent to `node_modules` is applied to node modules without an
 * explicit `jest.mock()` call.
 *
 * It implements the real v3 surface and actually stores things, so storage
 * tests can assert on *behaviour* ("the key is gone") instead of on call
 * bookkeeping ("removeMany was called with …"). The previous hand-stubbed
 * `jest.fn()` mock silently lacked `getAllKeys`, which meant production code
 * could call an AsyncStorage method that no test could ever exercise.
 *
 * Call `resetAsyncStorageMock()` in `beforeEach` to get a clean store.
 */

let store = new Map<string, string>();

const AsyncStorageMock = {
  async getItem(key: string): Promise<string | null> {
    return store.has(key) ? store.get(key)! : null;
  },

  async setItem(key: string, value: string): Promise<void> {
    store.set(key, value);
  },

  async removeItem(key: string): Promise<void> {
    store.delete(key);
  },

  async getMany(keys: string[]): Promise<Record<string, string | null>> {
    const result: Record<string, string | null> = {};
    for (const key of keys) {
      result[key] = store.has(key) ? store.get(key)! : null;
    }
    return result;
  },

  async setMany(entries: Record<string, string>): Promise<void> {
    for (const [key, value] of Object.entries(entries)) {
      store.set(key, value);
    }
  },

  async removeMany(keys: string[]): Promise<void> {
    for (const key of keys) {
      store.delete(key);
    }
  },

  async getAllKeys(): Promise<string[]> {
    return Array.from(store.keys());
  },

  async clear(): Promise<void> {
    store.clear();
  },
};

/** Empty the backing store. Call from `beforeEach`. */
export function resetAsyncStorageMock(): void {
  store = new Map<string, string>();
}

/** Seed the store directly, bypassing the async API. */
export function seedAsyncStorage(entries: Record<string, string>): void {
  for (const [key, value] of Object.entries(entries)) {
    store.set(key, value);
  }
}

/** Read the raw store, for assertions that don't want to await. */
export function peekAsyncStorage(): Record<string, string> {
  return Object.fromEntries(store);
}

export default AsyncStorageMock;
