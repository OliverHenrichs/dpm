import { useEffect, useRef, useState } from "react";
import {
  AnonymizeProvider,
  AnonymizeRequest,
} from "@/src/anonymize/providers/AnonymizeProvider";

/**
 * Renders the start of an anonymization for the user to check before the full render
 * (`previewAnonymize`), and throws a rendered one away.
 */
export type AnonymizePreviewer = {
  render: (
    provider: AnonymizeProvider,
    request: AnonymizeRequest,
    onProgress: (fraction: number) => void,
  ) => Promise<string>;
  discard: (uri: string) => void;
};

export type PreviewState =
  | { status: "idle" }
  | { status: "rendering"; progress: number }
  | { status: "ready"; uri: string }
  | { status: "failed" };

/**
 * The video editor's preview of an anonymization: one at a time, and only the latest counts.
 * A render started before a `reset` (the taps changed) is thrown away when it arrives, and so
 * is a ready one when the editor closes.
 */
export function useAnonymizePreview(previewer: AnonymizePreviewer | undefined) {
  const [preview, setPreview] = useState<PreviewState>({ status: "idle" });
  const run = useRef(0);
  const readyUri = useRef<string | null>(null);

  useEffect(
    () => () => {
      run.current++;
      if (readyUri.current) previewer?.discard(readyUri.current);
      readyUri.current = null;
    },
    [previewer],
  );

  const reset = () => {
    run.current++;
    if (readyUri.current) previewer?.discard(readyUri.current);
    readyUri.current = null;
    setPreview({ status: "idle" });
  };

  const render = async (
    provider: AnonymizeProvider,
    request: AnonymizeRequest,
  ) => {
    if (!previewer) return;
    reset();
    const mine = run.current;
    setPreview({ status: "rendering", progress: 0 });
    try {
      const uri = await previewer.render(provider, request, (progress) => {
        if (run.current === mine) setPreview({ status: "rendering", progress });
      });
      if (run.current !== mine) {
        previewer.discard(uri);
        return;
      }
      readyUri.current = uri;
      setPreview({ status: "ready", uri });
    } catch {
      if (run.current === mine) setPreview({ status: "failed" });
    }
  };

  return { preview, render, reset };
}
