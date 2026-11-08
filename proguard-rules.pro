# R8 keep rules for the Android release build, appended to android/app/proguard-rules.pro by
# expo-build-properties (app.config.ts). R8 renames and strips Java/Kotlin code that nothing
# references by name in Java. Code reached by name from C++ (JNI) or through reflection breaks
# at run time instead, so each library that does that is kept here. React Native, Expo modules,
# Reanimated, Worklets, react-native-svg and Media3 ship their own rules; Nitro and Unistyles use
# React Native's @DoNotStrip, which React Native's rules keep.
#
# A crash in a release build that a dev build doesn't show (ClassNotFoundException,
# NoSuchMethodError, NoSuchFieldError, often only in one feature) is usually a missing rule here.

# whisper.rn (Transcribe) and llama.rn (Suggest): native methods, JSI setup, and reflection on
# React Native's context to get the JS call invoker.
-keep class com.rnwhisper.** { *; }
-keep class com.rnllama.** { *; }
-keepclassmembers class com.facebook.react.** {
  *** getJSCallInvokerHolder();
  *** getCatalystInstance();
  *** getJavaScriptContextHolder();
}
-keep class com.facebook.react.bridge.JavaScriptContextHolder { *; }
-keep class com.facebook.react.turbomodule.core.CallInvokerHolderImpl { *; }

# MediaPipe Tasks (pose skeletons in Anonymize): its C++ graph calls back into Java, and its
# options travel as protobuf-lite messages, which are read by reflection.
-keep class com.google.mediapipe.** { *; }
-keep class com.google.protobuf.** { *; }
-dontwarn com.google.mediapipe.**
-dontwarn com.google.protobuf.**

# LiteRT (EdgeTAM tracking and RF-DETR detection in Anonymize): JNI into the interpreter and
# its accelerators.
-keep class com.google.ai.edge.litert.** { *; }
-keep class org.tensorflow.lite.** { *; }
-dontwarn com.google.ai.edge.litert.**
-dontwarn org.tensorflow.lite.**

# Nitro (used by Unistyles): hybrid objects are created and called from C++.
-keep class com.margelo.nitro.** { *; }
-keep class com.unistyles.** { *; }

# WebView pages (the YouTube player) call methods on the injected JS interface by name.
-keepclassmembers class * {
  @android.webkit.JavascriptInterface <methods>;
}
