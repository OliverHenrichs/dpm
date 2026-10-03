import { File, Paths } from "expo-file-system";
import { generateUUID } from "@/src/pattern/types/PatternType";

/**
 * Copies a local video into the app's document directory and returns the copy's URI.
 *
 * The image picker hands out URIs in its *cache*, which Android may clear at any time — a
 * pattern that kept such a URI silently lost its video one day. The same goes for anything the
 * app generates (anonymized videos land in the cache first). The document directory is where
 * import already writes videos, so it is where every local video a pattern references lives.
 *
 * A URI already in the document directory is returned unchanged, so this is safe to call twice.
 */
export async function persistVideo(
  uri: string,
  prefix = "video",
): Promise<string> {
  if (uri.startsWith(Paths.document.uri)) return uri;
  const ext = /\.([a-z0-9]{2,4})$/i.exec(uri)?.[1]?.toLowerCase() ?? "mp4";
  const target = new File(Paths.document, `${prefix}-${generateUUID()}.${ext}`);
  await new File(uri).copy(target);
  return target.uri;
}

/**
 * [persistVideo] for freshly picked videos, falling back to the picker's URI when a copy fails
 * (storage full, say): a video that might vanish later beats one that is lost now.
 */
export async function persistPickedVideos(uris: string[]): Promise<string[]> {
  return Promise.all(
    uris.map(async (uri) => {
      try {
        return await persistVideo(uri);
      } catch (e) {
        console.warn("Could not copy a picked video into app storage", e);
        return uri;
      }
    }),
  );
}
