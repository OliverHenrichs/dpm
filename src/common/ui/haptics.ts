import { Platform } from "react-native";
import * as Haptics from "expo-haptics";

/**
 * Haptic feedback, used sparingly: selection changes and destructive actions,
 * not every tap (both platform guidelines warn against buzzing constantly).
 * A device without a haptic engine, or the web, simply gets nothing.
 */
const run = (feedback: () => Promise<void>) => {
  if (Platform.OS === "web") return;
  feedback().catch(() => {});
};

export const haptics = {
  /** A chip, toggle or option changed. */
  selection: () => run(() => Haptics.selectionAsync()),
  /** A destructive action was confirmed. */
  heavy: () =>
    run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
};
