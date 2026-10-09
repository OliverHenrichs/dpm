# Local native modules — `modules/`

Two local Expo modules, autolinked, **Android only** (Kotlin). Each exports its module through
`requireOptionalNativeModule`, so on iOS, web, Jest or a dev client built without it the export is
`null` and the matching flag is false; the app gates every action on that flag, never on
`Platform.OS`. Any change here, or adding a module, needs a rebuilt dev client.

| Module | JS surface | Used by |
|---|---|---|
| `video-anonymize` | `VideoAnonymizeModule.anonymize(uri, options)` with an `onProgress` event (`stage`, `progress`); `isAnonymizeAvailable` | `src/anonymize/` (*Shorten* and *Anonymize*) |
| `audio-extract` | `AudioExtractModule.extractSpeechWav(uri, maxSeconds)` (16 kHz mono PCM for Whisper), `sha256File(uri)`; `isAudioExtractAvailable` | `src/transcribe/` (audio, model hashes), `src/suggest/` (model hash) |

## video-anonymize

One native call does both edits. It always transcodes the selection with Media3 (`Transcoder.kt`):
`mode: "passthrough"` with `height: 0` is *Shorten* (source size, audio kept); `mode: "silhouette"`
drops the audio, scales down, then tracks the dancers and renders silhouettes: EdgeTAM tracks each
dancer from the user's tap on the GPU (`EdgeTamTracker.kt`, `EdgeTamSegmenter.kt`), RF-DETR person
detection re-anchors a dancer lost behind their partner, occasionally and on the CPU
(`PersonDetector.kt`), MediaPipe pose adds the skeleton lines (`PoseSkeletons.kt`; on the tracked
frames only, joints interpolated between, like the masks), and
`SilhouetteDrawer` / `SilhouetteRenderer` / `SurfaceEncoder` draw and encode.

**The model weights are not in git** (`modules/video-anonymize/.gitignore`): `android/src/main/assets/`
must hold `edgetam/` (the four LiteRT graphs and their `.bin` constants), `rfdetr/rfdetr-seg-small.tflite`
and `pose_landmarker_full.task`, about 130 MB. They come from the scripts in `scripts/`:

- `fetch-models.sh` downloads the pose model;
- `export_rfdetr.py` exports RF-DETR-Seg Small (see its header for the Python environment);
- `convert_edgetam_video.py` exports EdgeTAM (adapted from john-rocky/LiteRT-Models; see its header).

A build without them still reports the module as available and still shortens, but anonymizing
fails when it opens the assets (`Silhouette render failed: edgetam/encode.tflite`); a production
build shipped that way once. Two things keep them in builds:

- **`.easignore`** at the root: with it present EAS ignores every `.gitignore`, so the weights on the
  machine running `eas build` are uploaded. It mirrors `.gitignore` otherwise; keep the two in step.
- **`npm run assets:check`** (`scripts/check-model-assets.js`) lists every file the native code
  opens and fails when one is missing. It runs as the `eas-build-pre-install` hook, so an Android
  EAS build without the weights fails instead of shipping. A new asset goes in its list. When a graph changes, bump `MODEL_VERSION` in the class that loads
it (`EdgeTamTracker`, `PersonDetector`): models are copied out of the APK once, and a stale copy is
otherwise reused. Keep the third-party licences (`LICENSE`, the scripts' headers) with the code.

Performance and memory matter more than anywhere else in the app: on a Pixel 10a a 7 s couple clip
runs at ~0.75 s per frame and the Java heap sat at its 256 MB cap near 30 s clips. Dev builds log
each run's per-frame stats. Measurements and the tuning history are in `AGENT_TASKS.md` L3.

## audio-extract

Decodes the video's audio track to 16 kHz mono WAV for Whisper (refusing a video without one, which
the app reports as "no sound"), and hashes a file with SHA-256 for the model store's download
check (`src/transcribe/AGENTS.md`). The resampler (`Pcm.kt`) is a windowed-sinc low-pass, flat to
~6 kHz and silent above 8 kHz: plain interpolation folded the music's highs into the speech band.
It costs well under a second per minute of audio; keep it a table lookup and one dot product per
output sample.

## iOS

Neither module has an iOS side. The routes considered (Vision person segmentation or a Core ML
EdgeTAM port; `AVAssetReader` extraction) need a Mac or an EAS build. Until then the actions are
simply absent on iOS.
