import { Platform } from "react-native";

/** Above this many nodes the graph is expensive enough to be worth rasterising. */
const RASTERIZE_THRESHOLD = 100;

/**
 * Props that ask iOS to rasterise a large graph.
 *
 * `shouldRasterizeIOS` does nothing off iOS, and react-native-svg forwards
 * props it does not recognise straight to the DOM node on web, so React logs an
 * error for every `<Svg>` carrying it. Spread this instead of passing the prop
 * directly, so it is absent rather than false everywhere else.
 */
export const rasterizeLargeGraph = (nodeCount: number) =>
  Platform.OS === "ios" && nodeCount > RASTERIZE_THRESHOLD
    ? { shouldRasterizeIOS: true as const }
    : {};
