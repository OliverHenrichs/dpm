import { useEffect, useRef, useState } from "react";
import {
  AnonymizeProvider,
  DancerOutline,
  OutlineRequest,
} from "@/src/anonymize/providers/AnonymizeProvider";

/** Finds who the taps picked (`outlineDancers`), and throws a found image away. */
export type DancerOutliner = {
  find: (
    provider: AnonymizeProvider,
    request: OutlineRequest,
  ) => Promise<DancerOutline>;
  discard: (uri: string) => void;
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
 * one on screen when it is replaced, the taps are cleared, or the editor closes.
 */
export function useDancerOutline(outliner: DancerOutliner | undefined) {
  const [outline, setOutline] = useState<OutlineState>({ status: "idle" });
  const run = useRef(0);
  const shown = useRef<DancerOutline | null>(null);

  useEffect(
    () => () => {
      run.current++;
      if (shown.current) outliner?.discard(shown.current.uri);
      shown.current = null;
    },
    [outliner],
  );

  const reset = () => {
    run.current++;
    if (shown.current) outliner?.discard(shown.current.uri);
    shown.current = null;
    setOutline({ status: "idle" });
  };

  const find = async (provider: AnonymizeProvider, request: OutlineRequest) => {
    if (!outliner) return;
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

  return { outline, find, reset };
}
