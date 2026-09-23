import { NativeModule, requireOptionalNativeModule } from "expo";

import {
  DeidentifyOptions,
  DeidentifyResult,
  VideoDeidentifyModuleEvents,
} from "./VideoDeidentify.types";

declare class VideoDeidentifyModule extends NativeModule<VideoDeidentifyModuleEvents> {
  deidentify(
    srcUri: string,
    options: DeidentifyOptions,
  ): Promise<DeidentifyResult>;
}

// Optional so that web, iOS (not implemented) and Jest load without the native side.
export default requireOptionalNativeModule<VideoDeidentifyModule>(
  "VideoDeidentify",
);
