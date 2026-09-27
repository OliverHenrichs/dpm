// The one place that imports whisper.rn, so that web can swap it out (whisper.web.ts): the
// package reads its native module at import time, and react-native-web has no module registry,
// so importing it at all fails the web bundle's static render.
// The package's `exports` map has no root entry, only "./*": import its index explicitly.
export {
  initWhisper,
  initWhisperVad,
  type WhisperContext,
  type WhisperVadContext,
} from "whisper.rn/index";
