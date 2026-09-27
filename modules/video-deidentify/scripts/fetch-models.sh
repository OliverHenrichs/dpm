#!/usr/bin/env bash
# Downloads the MediaPipe pose model (PoseSkeletons: the dancers' skeleton lines) into the
# module's Android assets. Gitignored, like the EdgeTAM and RF-DETR graphs.
set -euo pipefail
dir="$(cd "$(dirname "$0")/.." && pwd)/android/src/main/assets"
mkdir -p "$dir"
base=https://storage.googleapis.com/mediapipe-models
curl -fsSL -o "$dir/pose_landmarker_full.task" \
  "$base/pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task"
