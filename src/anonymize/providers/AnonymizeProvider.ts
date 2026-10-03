/**
 * A way of turning a clip into an anonymized one. The UI only talks to this interface, so an
 * on-device pipeline and a remote service (e.g. Viggle's character replacement) are
 * interchangeable, and no vendor's API shape reaches a component.
 */
export type AnonymizeRequest = {
  sourceUri: string;
  /** Seconds into the source; the provider processes [startSeconds, endSeconds). */
  startSeconds: number;
  endSeconds: number;
  /** One normalised point per tracked person on the first frame, when the provider asks. */
  prompts?: { x: number; y: number }[];
};

export type AnonymizeProgress = { stage: string; fraction: number };

export type AnonymizeOutcome = {
  /** Local file URI of the anonymized clip. */
  uri: string;
  /** Provider-specific numbers for diagnostics; never shown as the result. */
  stats?: Record<string, unknown>;
};

export interface AnonymizeProvider {
  readonly id: string;
  /** i18n key of the name shown in the provider picker. */
  readonly labelKey: string;
  /** Shortest and longest clip the provider accepts, in seconds; the trim bar enforces both. */
  readonly minSeconds: number;
  readonly maxSeconds: number;
  /**
   * True when footage leaves the device. The caller must then obtain explicit, recorded consent
   * before calling `run` (Apple 5.1.2(i), GDPR — see L3 in AGENT_TASKS.md); on-device providers
   * need none.
   */
  readonly sendsFootageOffDevice: boolean;
  /**
   * How many points the user taps on the first frame (one per dancer) for providers that track
   * from a prompt; 0 when the provider finds people itself. The most it takes when
   * [minPromptCount] allows fewer.
   */
  readonly promptCount: number;
  /**
   * The fewest points it takes, for a provider that can follow fewer people than
   * [promptCount] — one dancer instead of a couple. Defaults to [promptCount].
   */
  readonly minPromptCount?: number;

  /** False when the provider cannot run here (no native module, no API key, ...). */
  isAvailable(): boolean;

  run(
    request: AnonymizeRequest,
    onProgress: (progress: AnonymizeProgress) => void,
  ): Promise<AnonymizeOutcome>;
}
