import { AnonymizeProvider } from "@/src/anonymize/providers/AnonymizeProvider";

/**
 * The providers that can run on this device right now. Pure (the list is passed in) so it is
 * testable without the native module; `allProviders.ts` holds the real list.
 */
export const availableProviders = (
  providers: readonly AnonymizeProvider[],
): AnonymizeProvider[] => providers.filter((p) => p.isAvailable());
