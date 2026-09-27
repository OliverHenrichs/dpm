import React, { useEffect, useState } from "react";
import {
  DimensionValue,
  LayoutChangeEvent,
  Modal,
  Pressable,
  View,
  useWindowDimensions,
} from "react-native";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
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

/** Share of the sheet's height a drag must pass to close it on release. */
const CLOSE_DISTANCE = 0.25;
/** Downward speed (px/s) that closes the sheet whatever the distance — a flick. */
const CLOSE_VELOCITY = 900;

/**
 * A sheet that rises from the bottom over a fading scrim. It closes from its
 * close button, a tap on the scrim, the Android back button, or a downward
 * swipe on its handle and header — the swipe is limited to those, so content
 * inside can still scroll.
 *
 * The scrim is a sibling behind the sheet, not a wrapper around it, so touches
 * on the sheet's content never reach it (see `src/common/AGENTS.md`).
 */
const BottomSheet: React.FC<BottomSheetProps> = ({
  visible,
  onClose,
  title,
  children,
  maxHeight = "80%",
  minHeight = "50%",
}) => {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const reduceMotion = useReducedMotion();
  const { height: screenHeight } = useWindowDimensions();

  // Stays mounted through the closing animation, then unmounts. Mounting on
  // open is adjusted during render, not in the effect below, so opening does
  // not cost a second render pass.
  const [mounted, setMounted] = useState(visible);
  if (visible && !mounted) setMounted(true);
  /** 0 = off screen, 1 = fully up. */
  const progress = useSharedValue(0);
  /** How far the sheet is dragged down, in px. */
  const drag = useSharedValue(0);
  const sheetHeight = useSharedValue(screenHeight);

  // Shared values go through get()/set(), the form the React Compiler can
  // tell apart from mutating props or state.
  useEffect(() => {
    if (visible) {
      drag.set(0);
      progress.set(
        reduceMotion
          ? withTiming(1, { duration: 0 })
          : withSpring(1, theme.motion.spring),
      );
    } else {
      progress.set(
        withTiming(
          0,
          { duration: reduceMotion ? 0 : theme.motion.duration.normal },
          (finished) => {
            if (finished) runOnJS(setMounted)(false);
          },
        ),
      );
    }
    // Shared values are stable; only a change of `visible` drives this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const pan = Gesture.Pan()
    .onChange((event) => {
      drag.set(Math.max(0, drag.get() + event.changeY));
    })
    .onEnd((event) => {
      const far = drag.get() > sheetHeight.get() * CLOSE_DISTANCE;
      const flicked = event.velocityY > CLOSE_VELOCITY;
      if (far || flicked) {
        runOnJS(onClose)();
      } else {
        drag.set(withSpring(0, theme.motion.spring));
      }
    });

  const sheetMotion = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: (1 - progress.get()) * sheetHeight.get() + drag.get(),
      },
    ],
  }));
  const scrimMotion = useAnimatedStyle(() => ({
    opacity:
      progress.get() *
      (1 - Math.min(1, drag.get() / Math.max(1, sheetHeight.get()))),
  }));

  return (
    <Modal
      visible={mounted}
      animationType="none"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <GestureHandlerRootView style={styles.root}>
        <Animated.View style={[styles.scrim, scrimMotion]}>
          {/* For touch only: a screen reader closes from the button or back. */}
          <Pressable
            style={styles.fill}
            onPress={onClose}
            accessible={false}
            importantForAccessibility="no"
            testID="bottom-sheet-scrim"
          />
        </Animated.View>
        <Animated.View
          style={[styles.sheet(maxHeight, minHeight), sheetMotion]}
          onLayout={(e: LayoutChangeEvent) => {
            sheetHeight.set(e.nativeEvent.layout.height);
          }}
          accessibilityViewIsModal
        >
          <GestureDetector gesture={pan}>
            <View>
              <View style={styles.handle} />
              <View style={styles.header}>
                <AppText variant="title" style={styles.title}>
                  {title}
                </AppText>
                <IconButton
                  icon="close"
                  color="textMuted"
                  accessibilityLabel={t("close")}
                  onPress={onClose}
                />
              </View>
            </View>
          </GestureDetector>
          {children}
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
};

const styles = StyleSheet.create((theme, rt) => ({
  root: {
    flex: 1,
    justifyContent: "flex-end",
    // A tall sheet stops below the status bar instead of sliding under it.
    paddingTop: rt.insets.top,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.colors.overlay,
  },
  fill: {
    flex: 1,
  },
  sheet: (maxHeight: DimensionValue, minHeight: DimensionValue) => ({
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.radius.xxl,
    borderTopRightRadius: theme.radius.xxl,
    paddingHorizontal: theme.space.lg,
    // Clear of the gesture bar, with at least the usual room below the content.
    paddingBottom: Math.max(
      theme.space.xxxl,
      rt.insets.bottom + theme.space.lg,
    ),
    maxHeight,
    minHeight,
    ...theme.elevation.lg,
  }),
  handle: {
    alignSelf: "center",
    width: 36,
    height: 4,
    marginTop: theme.space.sm,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.borderStrong,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: theme.space.sm,
    marginBottom: theme.space.md,
  },
  title: {
    flexShrink: 1,
  },
}));

export default BottomSheet;
