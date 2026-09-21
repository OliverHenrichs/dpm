/**
 * In-memory stand-in for `expo-file-system`'s `File` / `Paths` API.
 *
 * Applied automatically to every test (a `__mocks__` directory adjacent to
 * `node_modules` needs no `jest.mock()` call), so no suite can touch the real
 * filesystem by accident.
 *
 * It stores real bytes and does real base64 encoding/decoding, which is what
 * makes an export→import round-trip meaningful: a video that survives the trip
 * has to come back byte-identical, not merely non-empty.
 *
 * Only the surface the app actually uses is implemented — `uri`, `exists`,
 * `text()`, `base64()`, `write()` and `Paths.document`. Anything else throws
 * loudly rather than returning undefined, so a new call site is noticed here
 * instead of silently no-oping in a test.
 */

const DOCUMENT_URI = "file:///document/";
const CACHE_URI = "file:///cache/";

/** uri -> raw contents, as bytes. */
let files = new Map<string, Buffer>();

function join(parts: (string | { uri: string })[]): string {
  return parts
    .map((part) => (typeof part === "string" ? part : part.uri))
    .reduce((acc, part) => {
      if (acc === "") return part;
      return acc.endsWith("/") ? acc + part : `${acc}/${part}`;
    }, "");
}

class Directory {
  readonly uri: string;

  constructor(uri: string) {
    this.uri = uri;
  }
}

class File {
  readonly uri: string;

  constructor(...uris: (string | File | Directory)[]) {
    this.uri = join(uris as (string | { uri: string })[]);
  }

  get exists(): boolean {
    return files.has(this.uri);
  }

  get name(): string {
    return this.uri.split("/").pop() ?? "";
  }

  async text(): Promise<string> {
    const contents = files.get(this.uri);
    if (contents === undefined) {
      throw new Error(`ENOENT: no such file '${this.uri}'`);
    }
    return contents.toString("utf8");
  }

  async base64(): Promise<string> {
    const contents = files.get(this.uri);
    if (contents === undefined) {
      throw new Error(`ENOENT: no such file '${this.uri}'`);
    }
    return contents.toString("base64");
  }

  write(
    contents: string,
    options?: { encoding?: "utf8" | "base64" | string },
  ): void {
    const encoding = options?.encoding === "base64" ? "base64" : "utf8";
    files.set(this.uri, Buffer.from(contents, encoding));
  }

  delete(): void {
    files.delete(this.uri);
  }
}

const Paths = {
  get document() {
    return new Directory(DOCUMENT_URI);
  },
  get cache() {
    return new Directory(CACHE_URI);
  },
};

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/** Empty the filesystem. Call from `beforeEach`. */
export function resetFileSystemMock(): void {
  files = new Map<string, Buffer>();
}

/** Create a file with the given text contents. */
export function seedFile(uri: string, contents: string): void {
  files.set(uri, Buffer.from(contents, "utf8"));
}

/** Create a file with arbitrary bytes — use for "video" fixtures. */
export function seedBinaryFile(uri: string, bytes: Buffer): void {
  files.set(uri, Buffer.from(bytes));
}

/** Raw bytes of a file, or undefined when it does not exist. */
export function readFileBytes(uri: string): Buffer | undefined {
  const contents = files.get(uri);
  return contents === undefined ? undefined : Buffer.from(contents);
}

/** Text contents of a file, or undefined when it does not exist. */
export function readFileText(uri: string): string | undefined {
  return files.get(uri)?.toString("utf8");
}

/** Every uri currently present. */
export function listFileUris(): string[] {
  return [...files.keys()];
}

export const DOCUMENT_DIRECTORY_URI = DOCUMENT_URI;

export { Directory, File, Paths };
