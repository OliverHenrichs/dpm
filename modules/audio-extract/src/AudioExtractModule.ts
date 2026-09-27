import { NativeModule, requireOptionalNativeModule } from "expo";

export type ExtractedSpeech = {
  /** file:// URI of a 16 kHz mono 16-bit WAV in the cache. */
  uri: string;
  durationSeconds: number;
  sourceSampleRate: number;
  sourceChannels: number;
  elapsedMs: number;
};

declare class AudioExtractModule extends NativeModule {
  /**
   * The video's audio as whisper.cpp wants it. Rejects with `ERR_NO_AUDIO` for a video without an
   * audio track — L3's silhouettes, for one. `maxSeconds` <= 0 means the whole clip.
   */
  extractSpeechWav(
    srcUri: string,
    maxSeconds: number,
  ): Promise<ExtractedSpeech>;
  /** Lower-case hex SHA-256 of a file:// URI, computed natively. */
  sha256File(fileUri: string): Promise<string>;
}

// Optional so that web, iOS (not implemented yet) and Jest load without the native side.
export default requireOptionalNativeModule<AudioExtractModule>("AudioExtract");
