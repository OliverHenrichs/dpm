import React, { useEffect, useState } from "react";
import { useShareIntent } from "expo-share-intent";
import { useTranslation } from "react-i18next";
import AppDialog from "@/src/common/components/AppDialog";
import { useActivePatternList } from "@/src/pattern/data/components/ActivePatternListContext";
import { canReceiveShares } from "@/src/videoLinks/canReceiveShares";
import { AwaitingLink, awaitingLink } from "@/src/videoLinks/awaitingLink";
import { applyVideoLink, videoIsBusy } from "@/src/videoLinks/linkVideo";
import {
  readSharedContent,
  SharedContent,
} from "@/src/videoLinks/sharedContent";
import AddSharedVideoSheet, {
  SharedVideo,
} from "@/src/videoLinks/components/AddSharedVideoSheet";

/**
 * DPM in other apps' share menus (Android): a link or a video shared to it. Mounted once, in the
 * root layout. Nothing happens on a build that cannot receive shares.
 */
const ShareInHandler: React.FC = () =>
  canReceiveShares ? <ShareInReceiver /> : null;

/** What arrived, and what it is about to become. */
type Incoming =
  | { step: "offerLink"; url: string; awaiting: AwaitingLink }
  | { step: "place"; shared: SharedVideo }
  | { step: "unusable" }
  | { step: "added"; patternName: string }
  | { step: "failed" };

/**
 * A link that comes back for the video the user just sent out (`awaitingLink`) is offered for
 * that video first: that is the round trip _Put online_ starts. Anything else, a video file or
 * a link out of the blue, is placed on a pattern the user picks (`AddSharedVideoSheet`).
 */
function ShareInReceiver() {
  const { t } = useTranslation();
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntent();
  const [incoming, setIncoming] = useState<Incoming | null>(null);
  // A share can start the app: what it offers waits until the lists are loaded.
  const { isLoading } = useActivePatternList();

  // Each share is read once, during render; `taken` is the one read last.
  const [taken, setTaken] = useState<typeof shareIntent | null>(null);
  if (hasShareIntent && shareIntent !== taken) {
    setTaken(shareIntent);
    setIncoming(toIncoming(readSharedContent(shareIntent)));
  }
  // Taken: the same share must not be read again when the app comes back to the front.
  useEffect(() => {
    if (hasShareIntent) resetShareIntent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasShareIntent]);

  const close = () => setIncoming(null);
  if (isLoading) return null;

  const takeLink = async (url: string, awaiting: AwaitingLink) => {
    close();
    try {
      await applyVideoLink(awaiting.listId, awaiting.sourceUri, url);
    } catch (e) {
      console.error("Could not use the shared link:", e);
      setIncoming({ step: "failed" });
    }
  };

  return (
    <>
      <AppDialog
        visible={incoming?.step === "offerLink"}
        title={t("shareInLinkTitle")}
        message={
          incoming?.step === "offerLink"
            ? t("shareInLinkMessage", { name: incoming.awaiting.patternName })
            : ""
        }
        closeLabel={t("shareInLinkElsewhere")}
        onClose={() =>
          // Not for that video: the link can still go onto a pattern of its own.
          setIncoming(
            incoming?.step === "offerLink"
              ? { step: "place", shared: { kind: "link", url: incoming.url } }
              : null,
          )
        }
        confirmLabel={t("shareInUseLink")}
        onConfirm={() => {
          if (incoming?.step === "offerLink") {
            void takeLink(incoming.url, incoming.awaiting);
          }
        }}
      />
      <AddSharedVideoSheet
        shared={incoming?.step === "place" ? incoming.shared : null}
        onClose={close}
        onAdded={(patternName) => setIncoming({ step: "added", patternName })}
      />
      <AppDialog
        visible={
          incoming?.step === "unusable" ||
          incoming?.step === "added" ||
          incoming?.step === "failed"
        }
        title={
          incoming?.step === "added"
            ? t("shareInAddedTitle")
            : incoming?.step === "failed"
              ? t("shareInLinkFailedTitle")
              : t("shareInNothingTitle")
        }
        message={
          incoming?.step === "added"
            ? t("shareInAdded", { name: incoming.patternName })
            : incoming?.step === "failed"
              ? t("videoOnlineLinkFailed")
              : t("shareInNothing")
        }
        closeLabel={t("close")}
        onClose={close}
      />
    </>
  );
}

function toIncoming(content: SharedContent): Incoming {
  if (content.kind === "unusable") return { step: "unusable" };
  if (content.kind === "video") return { step: "place", shared: content };
  const awaiting = awaitingLink.get();
  // A video a job still works on keeps its file until the job is done (jobs find it by URI).
  if (awaiting && !videoIsBusy(awaiting.sourceUri)) {
    return { step: "offerLink", url: content.url, awaiting };
  }
  return { step: "place", shared: content };
}

export default ShareInHandler;
