import { StyleSheet } from "react-native-unistyles";
import {
  getCommonBorder,
  getCommonInput,
  getCommonLabel,
} from "@/src/common/utils/CommonStyles";

export const filterStyles = StyleSheet.create((theme) => ({
  filterSection: {
    marginBottom: theme.space.xl,
  },
  label: {
    ...getCommonLabel(theme),
    ...theme.typography.body,
    fontWeight: "600",
    marginBottom: theme.space.sm,
  },
  input: {
    ...getCommonInput(theme),
    ...theme.typography.body,
  },
  chipContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.space.sm,
  },
  chip: {
    ...getCommonBorder(theme),
    backgroundColor: theme.colors.surfaceVariant,
    paddingVertical: theme.space.sm,
    paddingHorizontal: theme.space.md,
    borderRadius: theme.radius.xl,
  },
  chipSelected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  chipText: {
    ...theme.typography.bodySmall,
    color: theme.colors.onSurfaceVariant,
  },
  chipTextSelected: {
    color: theme.colors.onPrimary,
    fontWeight: "bold",
  },
}));
