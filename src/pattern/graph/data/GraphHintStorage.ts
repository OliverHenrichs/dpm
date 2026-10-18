import AsyncStorage from "@react-native-async-storage/async-storage";

const DRAG_HINT_KEY = "@graphDragHintDismissed";

/**
 * Whether the "hold a pattern to move it" hint has been dismissed.
 *
 * Its own tiny key rather than part of the layout: the hint is about the
 * *app*, not about any one list, and it must survive clearing a list's
 * arrangement. Read failures answer "not dismissed" — showing the hint again
 * is a far smaller cost than never showing it at all, which is what left the
 * gesture undiscoverable in the first place.
 */
export async function isDragHintDismissed(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(DRAG_HINT_KEY)) === "true";
  } catch (error) {
    console.error("Error reading graph hint state:", error);
    return false;
  }
}

export async function dismissDragHint(): Promise<void> {
  try {
    await AsyncStorage.setItem(DRAG_HINT_KEY, "true");
  } catch (error) {
    console.error("Error saving graph hint state:", error);
  }
}

const LEGEND_SEEN_KEY = "@graphLegendSeen";

/**
 * Whether the legend has been shown once. The Map opens it by itself the first time, because a
 * first-time user cannot know what a node's dots and triangle mean, and a collapsed "Legend"
 * button did not get pressed (tester review 1). Read failures answer "seen": opening it
 * uninvited on every visit would be worse than never.
 */
export async function isLegendSeen(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(LEGEND_SEEN_KEY)) === "true";
  } catch (error) {
    console.error("Error reading graph legend state:", error);
    return true;
  }
}

export async function markLegendSeen(): Promise<void> {
  try {
    await AsyncStorage.setItem(LEGEND_SEEN_KEY, "true");
  } catch (error) {
    console.error("Error saving graph legend state:", error);
  }
}
