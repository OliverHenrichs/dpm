import { DeidentifyProvider } from "@/src/deidentify/providers/DeidentifyProvider";

/**
 * The providers that can run on this device right now. Pure (the list is passed in) so it is
 * testable without the native module; `allProviders.ts` holds the real list.
 */
export const availableProviders = (
  providers: readonly DeidentifyProvider[],
): DeidentifyProvider[] => providers.filter((p) => p.isAvailable());
