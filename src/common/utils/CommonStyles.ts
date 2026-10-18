import { TextStyle, ViewStyle } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import type { AppTheme } from "@/src/common/theme/tokens";

/**
 * Style fragments shared across features. Each takes the Unistyles `theme` and is spread into a
 * `StyleSheet.create((theme) => …)` — spread them there, never at a `style=` prop, where a
 * spread would cut the style off from theme updates.
 */

export const getCommonBorder = (theme: AppTheme) =>
  ({
    borderWidth: 1,
    borderRadius: theme.radius.md,
    borderColor: theme.colors.border,
  }) satisfies Pick<ViewStyle, "borderWidth" | "borderRadius" | "borderColor">;

const createCommonLabel = (
  theme: AppTheme,
  defaultColor: string,
  color?: string,
) =>
  ({
    ...theme.typography.label,
    fontWeight: "500",
    marginBottom: theme.space.xs,
    color: color || defaultColor,
  }) satisfies TextStyle;

export const getCommonLabel = (theme: AppTheme, color?: string) =>
  createCommonLabel(theme, theme.colors.text, color);

export const getCommon2ndOrderLabel = (theme: AppTheme, color?: string) =>
  createCommonLabel(theme, theme.colors.textMuted, color);

export const getCommonRow = () =>
  ({
    flexDirection: "row",
    alignItems: "center",
  }) satisfies ViewStyle;

export const getCommonInput = (theme: AppTheme) =>
  ({
    ...getCommonBorder(theme),
    borderColor: theme.colors.borderStrong,
    padding: theme.space.sm,
    fontFamily: theme.typography.body.fontFamily,
    color: theme.colors.text,
    backgroundColor: theme.colors.surfaceVariant,
  }) satisfies ViewStyle & TextStyle;

export const getCommonPrereqContainer = (theme: AppTheme) =>
  ({
    ...getCommonBorder(theme),
    backgroundColor: theme.colors.surfaceVariant,
    padding: theme.space.sm,
    marginVertical: theme.space.sm,
  }) satisfies ViewStyle;

export const getCommonPrereqItem = (theme: AppTheme) =>
  ({
    ...getCommonBorder(theme),
    padding: theme.space.sm,
    marginRight: theme.space.xs,
    backgroundColor: theme.colors.surface,
  }) satisfies ViewStyle;

export const getCommonTagItem = (theme: AppTheme) =>
  ({
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.surfaceVariant,
    paddingHorizontal: theme.space.sm,
    marginRight: theme.space.xs,
    marginBottom: theme.space.xs,
    ...getCommonBorder(theme),
  }) satisfies ViewStyle;

export const getCommonTagText = (theme: AppTheme) =>
  ({
    ...theme.typography.caption,
    color: theme.colors.onSurfaceVariant,
  }) satisfies TextStyle;

export const getCommonListContainer = (theme: AppTheme) =>
  ({
    borderRadius: theme.radius.lg,
    padding: theme.space.sm,
    marginBottom: theme.space.sm,
    ...theme.elevation.sm,
    backgroundColor: theme.colors.background,
  }) satisfies ViewStyle;

/** A dialog's card inside `ModalOverlay`. Each dialog adds its own `maxWidth`. */
export const getCommonDialogCard = (theme: AppTheme) =>
  ({
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl,
    padding: theme.space.xxl,
    width: "100%",
  }) satisfies ViewStyle;

/**
 * A pattern form inside `ModalOverlay` (add, edit, suggest, review a suggestion). The full width,
 * always: sized to its content, the form narrowed and widened as its sections folded and opened.
 */
export const getCommonFormSheet = (theme: AppTheme) =>
  ({
    borderRadius: theme.radius.none,
    padding: theme.space.xl,
    width: "100%",
    maxHeight: "100%",
    ...theme.elevation.md,
    backgroundColor: theme.colors.surface,
  }) satisfies ViewStyle;

/** A field for typing a code someone passed on (a share or handover code). */
export const getCommonCodeInput = (theme: AppTheme) =>
  ({
    ...theme.typography.headline,
    flex: 1,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
    paddingHorizontal: theme.space.lg,
    paddingVertical: theme.space.md,
    letterSpacing: 3,
    color: theme.colors.text,
  }) satisfies ViewStyle & TextStyle;

export const commonStyles = StyleSheet.create((theme) => ({
  sectionTitle: {
    ...theme.typography.title,
    color: theme.colors.text,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: theme.space.sm,
    minHeight: 39, // Ensures consistent height with + button
  },
}));
