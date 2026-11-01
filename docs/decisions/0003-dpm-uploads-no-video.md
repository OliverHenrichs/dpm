# 0003: DPM uploads no video; heavy work runs on the phone

- **Status:** accepted
- **Date:** 2026-10-16 (Put online); recorded 2026-11-01
- **Decided by:** Oliver
- **PR:** #85
- **Recorded from:** `src/videoLinks/AGENTS.md` ("Why it exists"), `src/anonymize/AGENTS.md`, `ideas/hosting-videos-ourselves.md` in the project files

## Context

Figures are learned from videos of real dancers, often classmates. Published lists can only carry
links, and the video tools make local files. Something has to get a cut or anonymized clip to
subscribers.

## Decision

- Shorten, anonymize, transcription and AI suggestions run on the phone. No video, audio or
  transcript is sent anywhere by these tools.
- A local video goes online through the user's own apps (YouTube, Vimeo, Drive) via the system
  share menu, and its link comes back into the figure (_Put online_).
- Published lists carry link videos only.

## Alternatives considered

- **Upload through the YouTube Data API**: an unaudited project can only upload private videos.
- **Google Drive links**: they don't stream in the app.
- **Hosting videos ourselves**: paying for storage and moderating footage of identifiable dancers.
  Still an idea for later (Bunny Stream, a paid feature for members-only lists), not built.

## Consequences

- No storage costs, and DPM never holds anyone's footage.
- The round trip through another app takes a few steps, which the _Put online_ sheet explains.
- Video privacy depends on the host's settings (Unlisted, a Vimeo password), so the sheet recommends them.
