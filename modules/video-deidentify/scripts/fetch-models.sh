#!/usr/bin/env bash
# Downloads the segmentation models into the module's Android assets. They are
# gitignored: ~28 MB of binaries do not belong in the repo for a spike.
set -euo pipefail
dir="$(cd "$(dirname "$0")/.." && pwd)/android/src/main/assets"
mkdir -p "$dir"
base=https://storage.googleapis.com/mediapipe-models
curl -fsSL -o "$dir/pose_landmarker_full.task" \
  "$base/pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task"
curl -fsSL -o "$dir/selfie_multiclass_256x256.tflite" \
  "$base/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite"
curl -fsSL -o "$dir/deeplab_v3.tflite" \
  "$base/image_segmenter/deeplab_v3/float32/latest/deeplab_v3.tflite"
