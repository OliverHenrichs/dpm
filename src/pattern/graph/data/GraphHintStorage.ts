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
