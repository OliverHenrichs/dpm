import { NativeModule, requireOptionalNativeModule } from "expo";

import {
  AnonymizeOptions,
  AnonymizeResult,
  OutlineOptions,
  OutlineResult,
  VideoAnonymizeModuleEvents,
} from "./VideoAnonymize.types";

declare class VideoAnonymizeModule extends NativeModule<VideoAnonymizeModuleEvents> {
  anonymize(
    srcUri: string,
    options: AnonymizeOptions,
  ): Promise<AnonymizeResult>;
  /** Loads the outline's graphs and encodes the tap frame, so each tap only decodes. */
  prepareOutline(
    srcUri: string,
    options: Pick<OutlineOptions, "atSeconds">,
  ): Promise<{ ms: number }>;
  outline(srcUri: string, options: OutlineOptions): Promise<OutlineResult>;
  /** Frees what [prepareOutline] holds; an anonymize run does it too. */
  releaseOutline(): Promise<void>;
}

// Optional so that web, iOS (not implemented) and Jest load without the native side.
export default requireOptionalNativeModule<VideoAnonymizeModule>(
  "VideoAnonymize",
);
