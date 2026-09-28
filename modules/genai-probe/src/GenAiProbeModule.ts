import { NativeModule, requireOptionalNativeModule } from "expo";

declare class GenAiProbeModule extends NativeModule {
  status(): Promise<{ status: number; name: string }>;
  download(): Promise<string>;
  generate(prompt: string): Promise<{ text: string; ms: number }>;
}

// SPIKE (L4 suggestions): Android only, and absent under Jest and on web.
export default requireOptionalNativeModule<GenAiProbeModule>("GenAiProbe");
