import React from "react";
import { DimensionValue, Modal, Pressable, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { useTranslation } from "react-i18next";
import { AppText, IconButton } from "@/src/common/ui";

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxHeight?: DimensionValue;
  minHeight?: DimensionValue;
}

const BottomSheet: React.FC<BottomSheetProps> = ({
  visible,
  onClose,
  title,
  children,
  maxHeight = "80%",
  minHeight = "50%",
}) => {
  const { t } = useTranslation();
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable
          style={styles.bottomSheet(maxHeight, minHeight)}
          onPress={(e) => e?.stopPropagation?.()}
        >
          <View style={styles.bottomSheetHeader}>
            <AppText variant="title" style={styles.bottomSheetTitle}>
              {title}
            </AppText>
            <IconButton
              icon="close"
              color="textMuted"
              accessibilityLabel={t("close")}
              onPress={onClose}
            />
          </View>
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create((theme) => ({
  modalOverlay: {
    flex: 1,
    backgroundColor: theme.colors.overlay,
    justifyContent: "flex-end",
  },
  bottomSheet: (maxHeight: DimensionValue, minHeight: DimensionValue) => ({
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.radius.xxl,
    borderTopRightRadius: theme.radius.xxl,
    paddingTop: theme.space.lg,
    paddingHorizontal: theme.space.lg,
    paddingBottom: theme.space.xxxl,
    maxHeight,
    minHeight,
  }),
  bottomSheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: theme.space.lg,
  },
  bottomSheetTitle: {
    flexShrink: 1,
  },
}));

export default BottomSheet;
