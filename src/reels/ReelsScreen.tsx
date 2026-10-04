import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  FlatList,
  LayoutChangeEvent,
  View,
  ViewToken,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { useTranslation } from "react-i18next";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import AppHeader from "@/src/common/components/AppHeader";
import PageContainer from "@/src/common/components/PageContainer";
import { AppText, IconButton, SegmentedControl } from "@/src/common/ui";
import ReelCard from "@/src/reels/components/ReelCard";
import ReelPage from "@/src/reels/components/ReelPage";
import { ReelScope, useReels } from "@/src/reels/hooks/useReels";
import { Reel } from "@/src/reels/reels";

// FlatList requires a referentially stable viewability config.
const VIEWABILITY_CONFIG = { itemVisiblePercentThreshold: 60 };

/**
 * Reels: the patterns that have videos. The overview shows several at once, as stills; tapping
 * one opens them one per screen, where swiping up and down moves between patterns and sideways
 * through a pattern's videos, and back returns to the overview. For browsing before a social,
 * from the open list or from every list on the phone.
 */
export default function ReelsScreen() {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const [scope, setScope] = useState<ReelScope>("list");
  const { reels, isLoading } = useReels(scope);
  const [size, setSize] = useState({ width: 0, height: 0 });
  /** The reel the one-at-a-time view opened on; null shows the overview. */
  const [openedAt, setOpenedAt] = useState<number | null>(null);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  // The tabs keep this screen mounted. Leaving it must stop the video, so a player only exists
  // while the screen is the one in front.
  const [screenFocused, setScreenFocused] = useState(true);

  useFocusEffect(
    useCallback(() => {
      setScreenFocused(true);
      return () => setScreenFocused(false);
    }, []),
  );

  const open = (index: number) => {
    setActiveKey(reels[index]?.key ?? null);
    setOpenedAt(index);
  };
  const close = useCallback(() => {
    setOpenedAt(null);
    setActiveKey(null);
  }, []);

  // Android's back leaves the one-at-a-time view for the overview, not the tab.
  useEffect(() => {
    if (openedAt === null || !screenFocused) return;
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        close();
        return true;
      },
    );
    return () => subscription.remove();
  }, [openedAt, screenFocused, close]);

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setSize({ width, height });
  };

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken<Reel>[] }) => {
      if (viewableItems[0]) setActiveKey(viewableItems[0].key);
    },
    [],
  );

  const changeScope = (value: ReelScope) => {
    close();
    setScope(value);
  };

  let body: React.ReactNode;
  if (isLoading) {
    body = <ActivityIndicator color={theme.colors.primary} />;
  } else if (reels.length === 0) {
    body = (
      <AppText variant="body" color="textMuted" style={styles.empty}>
        {scope === "list" ? t("reelsEmptyList") : t("reelsEmptyAll")}
      </AppText>
    );
  } else if (openedAt === null) {
    body = (
      <FlatList
        key={`overview:${scope}`}
        data={reels}
        keyExtractor={(reel) => reel.key}
        renderItem={({ item, index }) => (
          <ReelCard
            reel={item}
            showListName={scope === "all"}
            onPress={() => open(index)}
          />
        )}
        showsVerticalScrollIndicator={false}
      />
    );
  } else if (size.height > 0) {
    body = (
      <FlatList
        key={`pages:${scope}`}
        data={reels}
        keyExtractor={(reel) => reel.key}
        renderItem={({ item }) => (
          <ReelPage
            reel={item}
            active={screenFocused && item.key === activeKey}
            width={size.width}
            height={size.height}
            showListName={scope === "all"}
          />
        )}
        initialScrollIndex={Math.min(openedAt, reels.length - 1)}
        pagingEnabled
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        getItemLayout={(_, i) => ({
          length: size.height,
          offset: size.height * i,
          index: i,
        })}
        windowSize={3}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={VIEWABILITY_CONFIG}
      />
    );
  }

  return (
    <PageContainer>
      <AppHeader />
      {openedAt === null ? (
        <SegmentedControl
          kind="choice"
          segments={[
            { value: "list", label: t("reelsScopeList") },
            { value: "all", label: t("reelsScopeAll") },
          ]}
          value={scope}
          onChange={changeScope}
          accessibilityLabel={t("reelsScope")}
          style={styles.toolbar}
        />
      ) : (
        <View style={styles.toolbar}>
          <IconButton
            icon="view-grid-outline"
            onPress={close}
            accessibilityLabel={t("reelsBack")}
          />
        </View>
      )}
      <View style={styles.stage} onLayout={onLayout} testID="reels-stage">
        {body}
      </View>
    </PageContainer>
  );
}

const styles = StyleSheet.create((theme) => ({
  toolbar: { marginBottom: theme.space.sm, alignItems: "flex-start" },
  stage: { flex: 1, justifyContent: "center" },
  empty: { textAlign: "center", paddingHorizontal: theme.space.xl },
}));
