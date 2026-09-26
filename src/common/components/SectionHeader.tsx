import React from "react";
import { Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { commonStyles } from "@/src/common/utils/CommonStyles";

interface SectionHeaderProps {
  title: string;
  rightActions?: React.ReactNode;
}

const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  rightActions,
}) => {
  return (
    <View style={[commonStyles.sectionHeaderRow, styles.headerContainer]}>
      <Text style={commonStyles.sectionTitle}>{title}</Text>
      {rightActions && (
        <View style={styles.actionsContainer}>{rightActions}</View>
      )}
    </View>
  );
};

const styles = StyleSheet.create((theme) => ({
  headerContainer: {
    backgroundColor: theme.colors.background,
    paddingBottom: theme.space.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  actionsContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.space.sm,
  },
}));

export default SectionHeader;
