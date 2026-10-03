import { NativeModule, requireOptionalNativeModule } from "expo";

import {
  AnonymizeOptions,
  AnonymizeResult,
  VideoAnonymizeModuleEvents,
} from "./VideoAnonymize.types";

declare class VideoAnonymizeModule extends NativeModule<VideoAnonymizeModuleEvents> {
  anonymize(
    srcUri: string,
    options: AnonymizeOptions,
  ): Promise<AnonymizeResult>;
}

// Optional so that web, iOS (not implemented) and Jest load without the native side.
export default requireOptionalNativeModule<VideoAnonymizeModule>(
  "VideoAnonymize",
);
