// Fails an Android build that would ship without the silhouette pipeline's model weights, after
// fetching them when they are missing.
//
// The weights are gitignored (modules/video-anonymize/.gitignore; see modules/AGENTS.md). A build
// started from a checkout that has them uploads them (.easignore); one that does not, such as an
// EAS Workflow run from GitHub, downloads them here from the `models-v1` GitHub Release and checks
// the archive's SHA-256. Without them the app still offers Anonymize and fails when it runs
// ("Silhouette render failed: edgetam/encode.tflite"), which is how a production build shipped
// without them.
//
// Runs as the `eas-build-pre-install` hook on EAS (fetching), and by hand: `npm run assets:check`
// only checks, `npm run assets:fetch` also downloads.
const { Buffer } = require("buffer");
const { execFileSync } = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
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

// The weights as one archive, paths relative to ASSETS. A changed model is a new release
// (models-v2, …) with its own hash here; never replace the file behind an existing one.
const ARCHIVE = {
  url: "https://github.com/OliverHenrichs/dpm/releases/download/models-v1/dpm-model-assets-v1.tar.gz",
  sha256: "c18b7528572a53178710ac8cf50a075167fbac76d7f24fb8118c3be48e0b1aff",
};

function missingFiles() {
  return REQUIRED.filter((file) => {
    const full = path.join(ASSETS, file);
    return !fs.existsSync(full) || fs.statSync(full).size === 0;
  });
}

async function fetchArchive() {
  console.log(`Model assets: downloading ${ARCHIVE.url}`);
  const response = await fetch(ARCHIVE.url);
  if (!response.ok) {
    throw new Error(`download failed: HTTP ${response.status}`);
  }
  const data = Buffer.from(await response.arrayBuffer());
  const sha256 = crypto.createHash("sha256").update(data).digest("hex");
  if (sha256 !== ARCHIVE.sha256) {
    throw new Error(`archive SHA-256 is ${sha256}, expected ${ARCHIVE.sha256}`);
  }
  const archive = path.join(os.tmpdir(), "dpm-model-assets.tar.gz");
  fs.writeFileSync(archive, data);
  fs.mkdirSync(ASSETS, { recursive: true });
  execFileSync("tar", ["-xzf", archive, "-C", ASSETS], { stdio: "inherit" });
  fs.rmSync(archive);
}

async function main() {
  // Only Android has the native module; an iOS build needs none of this.
  const platform = process.env.EAS_BUILD_PLATFORM;
  if (platform && platform !== "android") {
    console.log(`Model assets: not needed for ${platform}.`);
    return;
  }

  const shouldFetch =
    process.env.EAS_BUILD === "true" || process.argv.includes("--fetch");
  if (shouldFetch && missingFiles().length > 0) {
    try {
      await fetchArchive();
    } catch (error) {
      console.error(`Model assets: ${error.message}`);
    }
  }

  const missing = missingFiles();
  if (missing.length > 0) {
    console.error(
      `Missing model assets in ${path.relative(process.cwd(), ASSETS)}:\n` +
        missing.map((file) => `  ${file}`).join("\n") +
        "\nAnonymize would fail in this build. `npm run assets:fetch` downloads them " +
        "(see modules/AGENTS.md).",
    );
    process.exit(1);
  }
  console.log(`Model assets: all ${REQUIRED.length} present.`);
}

main();
