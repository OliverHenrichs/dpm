import { useEffect, useRef, useState } from "react";
import {
  AnonymizeProvider,
  DancerOutline,
  OutlineRequest,
} from "@/src/anonymize/providers/AnonymizeProvider";

/**
 * Finds who the taps picked (`outlineDancers`) and throws a found image away; keeps the model
 * ready while the user taps (`prepareOutline`) and frees it after (`releaseOutline`).
 */
export type DancerOutliner = {
  find: (
    provider: AnonymizeProvider,
    request: OutlineRequest,
  ) => Promise<DancerOutline>;
  discard: (uri: string) => void;
  prepare: (
    provider: AnonymizeProvider,
    request: Omit<OutlineRequest, "prompts">,
  ) => Promise<void>;
  release: (provider: AnonymizeProvider) => Promise<void>;
};

export type OutlineState =
  | { status: "idle" }
  /** [shown] is the outline of the earlier taps, kept on screen until the new one arrives. */
  | { status: "finding"; shown?: DancerOutline }
  | { status: "ready"; outline: DancerOutline }
  | { status: "failed" };

/**
 * The tap frame's highlight of the tapped dancers: one at a time, and only the latest counts. An
 * outline found for taps that have changed since is thrown away when it arrives, and so is the
 * one on screen when it is replaced, the taps are cleared, or the editor closes. The model is
 * readied as the tap frame opens ([prepare]) and freed when it is left ([release]) or the editor
 * closes.
 */
export function useDancerOutline(outliner: DancerOutliner | undefined) {
  const [outline, setOutline] = useState<OutlineState>({ status: "idle" });
  const run = useRef(0);
  const shown = useRef<DancerOutline | null>(null);
  // The provider holding the model, if any, to free it on the way out.
  const holder = useRef<AnonymizeProvider | null>(null);

  useEffect(
    () => () => {
      run.current++;
      if (shown.current) outliner?.discard(shown.current.uri);
      shown.current = null;
      if (holder.current) outliner?.release(holder.current);
      holder.current = null;
    },
    [outliner],
  );

  const prepare = (
    provider: AnonymizeProvider,
    request: Omit<OutlineRequest, "prompts">,
  ) => {
    if (!outliner) return;
    holder.current = provider;
    outliner.prepare(provider, request);
  };

  const release = () => {
    if (holder.current) outliner?.release(holder.current);
    holder.current = null;
  };

  const reset = () => {
    run.current++;
    if (shown.current) outliner?.discard(shown.current.uri);
    shown.current = null;
    setOutline({ status: "idle" });
  };

  const find = async (provider: AnonymizeProvider, request: OutlineRequest) => {
    if (!outliner) return;
    holder.current = provider;
    const mine = ++run.current;
    setOutline({ status: "finding", shown: shown.current ?? undefined });
    try {
      const found = await outliner.find(provider, request);
      if (run.current !== mine) {
        outliner.discard(found.uri);
        return;
      }
      if (shown.current) outliner.discard(shown.current.uri);
      shown.current = found;
      setOutline({ status: "ready", outline: found });
    } catch {
      if (run.current !== mine) return;
      if (shown.current) outliner.discard(shown.current.uri);
      shown.current = null;
      setOutline({ status: "failed" });
    }
  };

  return { outline, find, reset, prepare, release };
}
