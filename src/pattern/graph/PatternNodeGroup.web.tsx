import { FC, ReactNode, useCallback, useEffect, useRef } from "react";
import { G, GProps } from "react-native-svg";

export type PatternNodeGroupProps = {
  onPress: () => void;
  /** See the native file: dims a context node without touching its fill. */
  opacity?: number;
  children: ReactNode;
};

/**
 * `forwardedRef` hands back the DOM node. react-native-svg declares it in the
 * web half of its typings (`web/types.d.ts`), which the native types we compile
 * against do not include.
 */
type WebGProps = GProps & {
  forwardedRef?: (element: SVGGElement | null) => void;
};
const WebG = G as unknown as FC<WebGProps>;

/**
 * An SVG group that reports taps — the tappable wrapper around a graph node.
 *
 * Giving react-native-svg an `onPress` makes its web build spread six
 * react-native responder handlers (`onStartShouldSetResponder` and friends)
 * onto the DOM node, and React logs an error for each one, on every node. Its
 * `onClick` prop is not a way out either — `prepare()` overwrites whatever came
 * in with `props.onPress`, which is `undefined` here. So take the DOM node and
 * bind the listener ourselves, leaving the group's press props unset.
 */
const PatternNodeGroup: FC<PatternNodeGroupProps> = ({
  onPress,
  opacity,
  children,
}) => {
  // Callers pass a fresh closure every render; read it through a ref so the
  // listener is bound once per node rather than rebound on every re-render.
  const handler = useRef(onPress);
  useEffect(() => {
    handler.current = onPress;
  }, [onPress]);

  const unbind = useRef<(() => void) | null>(null);
  const bind = useCallback((element: SVGGElement | null) => {
    unbind.current?.();
    unbind.current = null;
    if (!element) return;
    const listener = () => handler.current();
    element.addEventListener("click", listener);
    unbind.current = () => element.removeEventListener("click", listener);
  }, []);

  return (
    <WebG forwardedRef={bind} opacity={opacity}>
      {children}
    </WebG>
  );
};

export default PatternNodeGroup;
