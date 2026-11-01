import { generateUUID } from "@/src/pattern/types/PatternType";
import { IVideoReference } from "@/src/pattern/types/IPatternList";

/**
 * Hands a shared video from the share sheet to the List tab's add form.
 *
 * The video itself stays in memory; the route carries only a one-off token. Expo Router makes
 * every route a deep link, so a video named in the route (`?newVideo=file:///…`) could be put
 * there by any web page or app, and the form would open with a file it chose. A token only
 * matches a video this app offered, in this run.
 */
let pending: { token: string; ref: IVideoReference } | null = null;

/** Keeps the video for the add form and returns the token the route carries. */
export function offerNewVideo(ref: IVideoReference): string {
  const token = generateUUID();
  pending = { token, ref };
  return token;
}

/** The video offered under [token], or undefined for any other token. */
export function newVideoFor(
  token: string | undefined,
): IVideoReference | undefined {
  return token && pending?.token === token ? pending.ref : undefined;
}

/** Forgets the offered video once the form has it. */
export function clearNewVideo(token: string | undefined): void {
  if (token && pending?.token === token) pending = null;
}
