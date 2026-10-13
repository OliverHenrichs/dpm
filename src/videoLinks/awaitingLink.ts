/**
 * The local video the user last sent out to be put online, waiting for its link to come back.
 *
 * Sharing a video opens another app (YouTube, Drive); the link comes back later, shared to DPM
 * from that app (`components/ShareInHandler.tsx`) or pasted into the sheet it was sent from. Like
 * the job queue it lives outside React, so it survives Android recreating the activity while the
 * user is in the other app. It does not survive the process: a link that arrives after that is
 * added to a pattern the user picks instead.
 *
 * Only the latest one waits: someone uploads one video at a time, and a second share means the
 * first is either done or given up.
 */
export type AwaitingLink = {
  listId: string;
  /** The local video, as the pattern references it. */
  sourceUri: string;
  /** For the question that offers the link: "Use this link for the video of …?" */
  patternName: string;
};

let awaiting: AwaitingLink | null = null;

export const awaitingLink = {
  get: (): AwaitingLink | null => awaiting,
  set(next: AwaitingLink) {
    awaiting = next;
  },
  /** Clears it, or only when it is still [sourceUri]'s turn. */
  clear(sourceUri?: string) {
    if (sourceUri === undefined || awaiting?.sourceUri === sourceUri) {
      awaiting = null;
    }
  },
};
