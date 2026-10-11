import {
  AnonymizeOutcome,
  AnonymizeProgress,
  AnonymizeProvider,
  AnonymizeRequest,
} from "@/src/anonymize/providers/AnonymizeProvider";

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
  constructor(providerId: string, needed: string, got: number) {
    super(
      `Provider "${providerId}" needs ${needed} prompt point(s), got ${got}`,
    );
    this.name = "PromptsRequiredError";
  }
}

/** Slack for float drift from pixel-to-second conversion in the trim bar. */
const EPSILON = 0.01;

/** How much of the selection a preview renders, in seconds. */
export const PREVIEW_SECONDS = 0.5;

export type RunOptions = {
  /**
   * A preview of the first [PREVIEW_SECONDS] of the selection, to see whether the silhouettes
   * take before the full render. Shorter than the provider's minimum on purpose, so it is
   * allowed only on the device: a remote provider would bill for it.
   */
  preview?: boolean;
};

/**
 * The only way the UI starts a provider. Enforces, in code rather than only in the UI, that
 * footage never leaves the device without recorded consent, and that the trim window fits the
 * provider's limits — a remote provider bills per second. A preview is cut to its first
 * [PREVIEW_SECONDS] here, so a caller cannot render more by mistake.
 */
export const runAnonymize = (
  provider: AnonymizeProvider,
  request: AnonymizeRequest,
  onProgress: (progress: AnonymizeProgress) => void,
  consent?: Consent,
  { preview = false }: RunOptions = {},
): Promise<AnonymizeOutcome> => {
  // A remote provider is never previewed (see RunOptions), consent or not.
  if (provider.sendsFootageOffDevice && (preview || !consent)) {
    return Promise.reject(new ConsentRequiredError(provider.id));
  }
  if (preview) {
    request = {
      ...request,
      endSeconds: Math.min(
        request.endSeconds,
        request.startSeconds + PREVIEW_SECONDS,
      ),
    };
  }
  const length = request.endSeconds - request.startSeconds;
  const min = preview ? 0 : provider.minSeconds;
  if (
    length <= 0 ||
    length < min - EPSILON ||
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
  const fewest = provider.minPromptCount ?? provider.promptCount;
  if (prompts < fewest || prompts > provider.promptCount) {
    const needed =
      fewest === provider.promptCount
        ? String(fewest)
        : `${fewest}–${provider.promptCount}`;
    return Promise.reject(
      new PromptsRequiredError(provider.id, needed, prompts),
    );
  }
  return provider.run(request, onProgress);
};
