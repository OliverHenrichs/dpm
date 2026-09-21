import { ChainMode } from "@/src/pattern/graph/model/selectSubgraph";

/**
 * The chain modes the graph screen offers.
 *
 * `selectSubgraph` also supports `dependents` on its own. It is deliberately
 * not exposed: four segments do not fit a phone, and "what leads out of this,
 * but not what leads into it" is a question almost nobody asks — whereas
 * "what do I need before I can do this?" is the dominant one, which is why
 * `prerequisites` is the default.
 */
export const OFFERED_CHAIN_MODES = [
  "matchesOnly",
  "prerequisites",
  "fullChain",
] as const satisfies readonly ChainMode[];

export const DEFAULT_CHAIN_MODE: ChainMode = "prerequisites";

/** i18n key per offered mode. */
export const CHAIN_MODE_LABELS: Record<
  (typeof OFFERED_CHAIN_MODES)[number],
  string
> = {
  matchesOnly: "chainModeMatchesOnly",
  prerequisites: "chainModePrerequisites",
  fullChain: "chainModeFullChain",
};
