import AudioExtractModule from "./src/AudioExtractModule";

export type { ExtractedSpeech } from "./src/AudioExtractModule";

export const isAudioExtractAvailable = AudioExtractModule != null;

export { AudioExtractModule };
