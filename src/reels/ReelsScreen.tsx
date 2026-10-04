import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  LayoutChangeEvent,
  View,
  ViewToken,
} from "react-native";
import { useTranslation } from "react-i18next";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import AppHeader from "@/src/common/components/AppHeader";
import PageContainer from "@/src/common/components/PageContainer";
import { AppText, SegmentedControl } from "@/src/common/ui";
import ReelPage from "@/src/reels/components/ReelPage";
import { ReelScope, useReels } from "@/src/reels/hooks/useReels";
import { Reel } from "@/src/reels/reels";

// FlatList requires a referentially stable viewability config.
const VIEWABILITY_CONFIG = { itemVisiblePercentThreshold: 60 };

/**
 * Reels: the patterns that have videos, one per page. Swipe up and down between patterns and
 * sideways through a pattern's videos; tap to play. For browsing before a social, from the open
 * list or from every list on the phone.
 */
export default function ReelsScreen() {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const [scope, setScope] = useState<ReelScope>("list");
  const { reels, isLoading } = useReels(scope);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [activeKey, setActiveKey] = useState<string | null>(null);

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setSize({ width, height });
  };

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken<Reel>[] }) => {
      setActiveKey(viewableItems[0]?.key ?? null);
    },
    [],
  );

  // Before anything has been seen, the first page is the one on screen.
  const currentKey = activeKey ?? reels[0]?.key;

  let body: React.ReactNode;
  if (isLoading) {
    body = <ActivityIndicator color={theme.colors.primary} />;
  } else if (reels.length === 0) {
    body = (
      <AppText variant="body" color="textMuted" style={styles.empty}>
        {scope === "list" ? t("reelsEmptyList") : t("reelsEmptyAll")}
      </AppText>
    );
  } else if (size.height > 0) {
    body = (
      <FlatList
        // A new scope starts from its first page.
        key={scope}
        data={reels}
        keyExtractor={(reel) => reel.key}
        renderItem={({ item }) => (
          <ReelPage
            reel={item}
            active={item.key === currentKey}
            width={size.width}
            height={size.height}
            showListName={scope === "all"}
          />
        )}
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
      <SegmentedControl
        kind="choice"
        segments={[
          { value: "list", label: t("reelsScopeList") },
          { value: "all", label: t("reelsScopeAll") },
        ]}
        value={scope}
        onChange={(value) => {
          setActiveKey(null);
          setScope(value);
        }}
        accessibilityLabel={t("reelsScope")}
        style={styles.scope}
      />
      <View style={styles.stage} onLayout={onLayout} testID="reels-stage">
        {body}
      </View>
    </PageContainer>
  );
}

const styles = StyleSheet.create((theme) => ({
  scope: { marginBottom: theme.space.sm },
  stage: {
    flex: 1,
    justifyContent: "center",
    borderRadius: theme.radius.lg,
    overflow: "hidden",
  },
  empty: { textAlign: "center", paddingHorizontal: theme.space.xl },
}));
