# Video links — `src/videoLinks/`

Getting a video from the phone online and its link back, and taking links and videos other apps
share to DPM. DPM uploads nothing itself: the user's own apps (YouTube, Drive, …) do, through the
system share menu. Unqualified paths are relative to `src/videoLinks/`.

## Why it exists

A published list carries URL videos only (`src/firebase/publishedContent.ts`), and the video
tools (Shorten, Anonymize) make local files. Before this, a cut video reached subscribers only
through a manual round trip outside the app, and the link came back as a new video without the
transcript. Uploading through an API was weighed and rejected for now: the YouTube Data API locks
uploads from an unaudited project to private, Drive links do not stream, and hosting the videos
ourselves means paying for and moderating footage of identifiable dancers.

## The round trip (_Put online_)

1. A local video's tile in the pattern editor has a cloud button (`PatternVideos`'
   `onPutOnlineAt`); it opens `components/PutOnlineSheet.tsx`.
2. _Share video_ records the video as **awaiting its link** (`awaitingLink.ts`) and opens the
   system share sheet on the file (`shareVideo.ts`, `expo-sharing`). The user uploads it there.
3. The link comes back either shared from that app to DPM (`components/ShareInHandler.tsx` offers
   it for the awaiting video) or pasted into the sheet. The share menu reports nothing about the
   other app, so once it returns the sheet marks step 1 done and turns to the link; it carries
   per-app steps (YouTube, Drive) and a _Paste copied link_ button (`clipboard.ts`).
4. `applyVideoLink` (`linkVideo.ts`) swaps the local reference for a URL one that keeps its
   `transcript` and `generated` provenance (`linkedVideo` in `videoLinks.ts`). It goes through
   `jobStore.updateVideo`, the path a kept job result takes, so the stored list, the mounted tree
   and any open form's draft all get it (`src/anonymize/AGENTS.md`, "Review, then keep or
   discard"). A published list is pushed at once. The file itself is not deleted, as removing a
   video never deletes one.

Rules:

- **A link DPM cannot play needs a second tap** (`playsInApp`: YouTube, Vimeo, or a direct link
  to a video file or an HLS/DASH stream). A Drive page would reach subscribers as a video that
  does not play; the sheet, the share-in dialog and the plain _Add video_ → link form
  (`src/pattern/list/AddVideoModal.tsx`) all say so. YouTube and Vimeo are the hosts recommended.
- **Hosts live in `src/common/utils/videoHosts.ts`.** `embeddedHost` says which links play in
  their host's own player (`src/common/components/EmbeddedVideoItem.tsx`: YouTube, Vimeo);
  everything else goes to `expo-video`. `playableLink` rewrites a Dropbox share link to `raw=1`,
  which serves the file instead of a page; links are stored rewritten (Add video, the swap,
  share-in), and players rewrite again for links saved before. A new host is an entry there, a
  player beside `VimeoVideoItem` (with its `.web.tsx`), a thumbnail in `generateVideoThumbnails`,
  and a line in `PRIVACY_POLICY.md` 3.4.
- **A Vimeo link keeps its privacy hash** (`vimeo.com/ID/HASH`, `?h=`): an unlisted video does
  not play without it. A password-protected one asks for the password in Vimeo's player.
- **The clipboard is read only on a tap.** `clipboard.ts` requires `expo-clipboard` lazily, behind
  `requireOptionalNativeModule`, because the package reads its native module at import; without
  it (web, Jest, an older dev client) the paste button is hidden.
- **Never swap a video a job still works on** (`videoIsBusy`): jobs find their video by URI.
- Only the latest share waits for a link. It lives in memory, like the job queue: it survives
  Android recreating the activity while the user is in the other app, not the process. A link
  that arrives without one is placed like any other shared link.
- Not offered for a universal modifier's videos yet: the swap path updates patterns, and those
  videos live on the list.

## Share-in (Android)

`expo-share-intent` registers DPM for `text/*` and `video/*` shares (`app.config.ts`, iOS
disabled: its share extension is a second target with its own app group and signing).
`ShareInHandler` is mounted once in `app/_layout.tsx` and renders nothing unless the native module
is in the build (`canReceiveShares`), so web, Jest and an older dev client are unaffected.

- `sharedContent.ts` reads a share: a video file wins over text; text counts only when it holds
  an http(s) link (`findWebUrl`), since apps wrap links in words.
- A link while a video awaits one: a dialog offers it for that video; declining places it
  elsewhere. Otherwise `components/AddSharedVideoSheet.tsx` puts it onto a pattern of the active
  list (through `usePatternCrud`) or into a new one: it hands the video to `newVideoHandoff.ts`
  and navigates to `/patterns` with the token it gets back as the `newVideo` route param, which
  `PatternListManager` reads once to seed the add form, as _From a video_ does. **Never put the
  video itself in the route**: Expo Router makes every route a deep link, so any web page or app
  could open the form with a file path of its choosing.
- A shared file is copied into the app's storage (`persistVideo`) only once a place is chosen.
- Each share is read once, during render, and then cleared in the native module, or it would be
  read again whenever the app returns to the front.
- Adding the native module, or changing its intent filters, needs a rebuilt dev client.
