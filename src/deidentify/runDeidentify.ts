import {
  DeidentifyOutcome,
  DeidentifyProgress,
  DeidentifyProvider,
  DeidentifyRequest,
} from "@/src/deidentify/providers/DeidentifyProvider";

/** When the user agreed to send this clip off the device; the audit trail L3 asks for. */
export type Consent = { givenAt: number };

export class ConsentRequiredError extends Error {
  constructor(providerId: string) {
    super(
      `Provider "${providerId}" sends footage off the device and needs consent first`,
    );
    this.name = "ConsentRequiredError";
  }
}

export class TrimOutOfLimitsError extends Error {
  constructor(providerId: string, length: number, min: number, max: number) {
    super(
      `Provider "${providerId}" accepts ${min}–${max} s, got ${length.toFixed(1)} s`,
    );
    this.name = "TrimOutOfLimitsError";
  }
}

export class PromptsRequiredError extends Error {
  constructor(providerId: string, needed: number, got: number) {
    super(
      `Provider "${providerId}" needs ${needed} prompt point(s), got ${got}`,
    );
    this.name = "PromptsRequiredError";
  }
}

/** Slack for float drift from pixel-to-second conversion in the trim bar. */
const EPSILON = 0.01;

/**
 * The only way the UI starts a provider. Enforces, in code rather than only in the UI, that
 * footage never leaves the device without recorded consent, and that the trim window fits the
 * provider's limits — a remote provider bills per second.
 */
export const runDeidentify = (
  provider: DeidentifyProvider,
  request: DeidentifyRequest,
  onProgress: (progress: DeidentifyProgress) => void,
  consent?: Consent,
): Promise<DeidentifyOutcome> => {
  if (provider.sendsFootageOffDevice && !consent) {
    return Promise.reject(new ConsentRequiredError(provider.id));
  }
  const length = request.endSeconds - request.startSeconds;
  if (
    length < provider.minSeconds - EPSILON ||
    length > provider.maxSeconds + EPSILON
  ) {
    return Promise.reject(
      new TrimOutOfLimitsError(
        provider.id,
        length,
        provider.minSeconds,
        provider.maxSeconds,
      ),
    );
  }
  const prompts = request.prompts?.length ?? 0;
  if (prompts !== provider.promptCount) {
    return Promise.reject(
      new PromptsRequiredError(provider.id, provider.promptCount, prompts),
    );
  }
  return provider.run(request, onProgress);
};
