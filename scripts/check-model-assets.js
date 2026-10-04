// Fails an Android build that would ship without the silhouette pipeline's model weights.
//
// The weights are gitignored (modules/video-anonymize/.gitignore; see modules/AGENTS.md), so a
// build only has them when they were uploaded from a checkout that has them. Without them the
// app still offers Anonymize and fails when it runs ("Silhouette render failed:
// edgetam/encode.tflite"), which is how a production build shipped without them.
//
// Runs as the `eas-build-pre-install` hook on EAS, and by hand: `npm run assets:check`.
const fs = require("fs");
const path = require("path");

// npm runs scripts from the project root, on EAS as locally.
const ASSETS = path.resolve("modules/video-anonymize/android/src/main/assets");

// What the native code opens: EdgeTamTracker.kt, PersonDetector.kt, PoseSkeletons.kt.
const REQUIRED = [
  "edgetam/encode.tflite",
  "edgetam/memcond.tflite",
  "edgetam/decode.tflite",
  "edgetam/memorize.tflite",
  "edgetam/no_memory.bin",
  "edgetam/mtpe.bin",
  "edgetam/no_objptr.bin",
  "edgetam/track_sparse.bin",
  "edgetam/video_prompt.bin",
  "rfdetr/rfdetr-seg-small.tflite",
  "pose_landmarker_full.task",
];

// Only Android has the native module; an iOS build needs none of this.
const platform = process.env.EAS_BUILD_PLATFORM;
if (platform && platform !== "android") {
  console.log(`Model assets: not needed for ${platform}.`);
  process.exit(0);
}

const missing = REQUIRED.filter((file) => {
  const full = path.join(ASSETS, file);
  return !fs.existsSync(full) || fs.statSync(full).size === 0;
});

if (missing.length > 0) {
  console.error(
    `Missing model assets in ${path.relative(process.cwd(), ASSETS)}:\n` +
      missing.map((file) => `  ${file}`).join("\n") +
      "\nAnonymize would fail in this build. Start the build from a checkout that has them " +
      "(see modules/AGENTS.md); .easignore uploads them although git ignores them.",
  );
  process.exit(1);
}
console.log(`Model assets: all ${REQUIRED.length} present.`);
