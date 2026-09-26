import type { ComponentProps } from "react";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";

/**
 * The app's one icon set. Import `Icon` from here rather than from a package,
 * so a switch of set is one line; `IconName` makes a misspelt glyph a type
 * error instead of a "?" on screen.
 */
export const Icon = MaterialCommunityIcons;
export type IconName = ComponentProps<typeof MaterialCommunityIcons>["name"];
