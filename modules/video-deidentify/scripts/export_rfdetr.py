#!/usr/bin/env python3
"""Exports RF-DETR-Seg Small (Roboflow, Apache-2.0) to TFLite for PersonDetector.kt.

Needs: pip install "rfdetr[tflite]"  (pulls TensorFlow; Python 3.12)
Copy the *_fp16.tflite output to android/src/main/assets/rfdetr/rfdetr-seg-small.tflite and bump
PersonDetector.MODEL_VERSION if it replaces an earlier export.
"""
from rfdetr import RFDETRSegSmall

if __name__ == "__main__":
    print(RFDETRSegSmall().export(output_dir="build/rfdetr", format="tflite", fp16=True))
