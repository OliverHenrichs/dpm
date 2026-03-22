import React, { useCallback, useState } from "react";
import {
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { useFocusEffect } from "@react-navigation/native";
import { IPatternList, NewPattern } from "@/src/pattern/types/IPatternList";
import {
  deletePatternList,
  loadAllPatternLists,
  loadPatterns,
  savePatternList,
  savePatterns,
} from "@/src/pattern/data/PatternListStorage";
import { useActivePatternList } from "@/src/pattern/data/components/ActivePatternListContext";
import { useThemeContext } from "@/src/common/components/ThemeContext";
import { getPalette, PaletteColor } from "@/src/common/utils/ColorPalette";
import { getCommonListContainer } from "@/src/common/utils/CommonStyles";
import { useTranslation } from "react-i18next";
import PageContainer from "@/src/common/components/PageContainer";
import AppHeader from "@/src/common/components/AppHeader";
import PlusButton from "@/src/common/components/PlusButton";
import SectionHeader from "@/src/common/components/SectionHeader";
import PatternListTemplateModal from "./PatternListTemplateModal";
import BottomSheet from "@/src/common/components/BottomSheet";
import ShareListModal from "@/src/pattern/list/ShareListModal";
import SubscribeListModal from "@/src/pattern/list/SubscribeListModal";
import { syncPublishedList } from "@/src/firebase/FirebaseListService";
import { firebaseAvailable } from "@/src/firebase/firebaseConfig";
import { PatternListWithPatterns } from "@/src/pattern/data/types/IExportData";

const PatternListSelector: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { t } = useTranslation();
  const { colorScheme } = useThemeContext();
  const palette = getPalette(colorScheme);
  const styles = getStyles(palette);
  const { activeList, setActiveList, refreshActiveList } =
    useActivePatternList();

  const [patternLists, setPatternLists] = useState<IPatternList[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [listActionTarget, setListActionTarget] = useState<IPatternList | null>(
    null,
  );
  const [editingList, setEditingList] = useState<IPatternList | null>(null);
  const [usedTypeIds, setUsedTypeIds] = useState<Set<string>>(new Set());

  // Cloud sharing state
  const [shareTarget, setShareTarget] = useState<IPatternList | null>(null);
  const [sharePatterns, setSharePatterns] = useState<
    PatternListWithPatterns["patterns"]
  >([]);
  const [showSubscribeModal, setShowSubscribeModal] = useState(false);

  const loadLists = useCallback(async () => {
    setIsLoading(true);
    try {
      const lists = await loadAllPatternLists();
      setPatternLists(lists);
    } catch (error) {
      console.error("Error loading pattern lists:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadLists();
    }, [loadLists]),
  );

  const handleSelectList = async (list: IPatternList) => {
    await setActiveList(list);
    navigation.navigate("Patterns");
  };

  const handleDeleteList = (list: IPatternList) => {
    setListActionTarget(null);
    Alert.alert(
      t("deletePatternList"),
      t("deletePatternListConfirm", { name: list.name }),
      [
        { text: t("cancel"), style: "cancel" },
        {
          text: t("delete"),
          style: "destructive",
          onPress: async () => {
            try {
              await deletePatternList(list.id);
              await loadLists();
              await refreshActiveList();
            } catch {
              Alert.alert(t("error"), t("errorDeletingList"));
            }
          },
        },
      ],
    );
  };

  const handleEditList = async (list: IPatternList) => {
    setListActionTarget(null);
    try {
      const patterns = await loadPatterns(list.id);
      const ids = new Set(patterns.map((p) => p.typeId));
      setUsedTypeIds(ids);
      setEditingList(list);
    } catch (error) {
      console.error("Error loading patterns for edit:", error);
    }
  };

  const handleSaveList = async (updatedList: IPatternList) => {
    try {
      await savePatternList(updatedList);
      // If the list is already published, keep Firestore in sync automatically
      if (updatedList.shareCode) {
        const patterns = await loadPatterns(updatedList.id);
        await syncPublishedList(updatedList, patterns).catch((e) =>
          console.warn("Firestore sync after edit failed:", e),
        );
      }
      await loadLists();
      await refreshActiveList();
    } catch (error) {
      console.error("Error saving pattern list:", error);
      Alert.alert(t("error"), t("errorCreatingList"));
    } finally {
      setEditingList(null);
    }
  };

  /** Open the ShareListModal for a list, loading its patterns first. */
  const handleOpenShare = async (list: IPatternList) => {
    setListActionTarget(null);
    try {
      const patterns = await loadPatterns(list.id);
      setSharePatterns(patterns);
      setShareTarget(list);
    } catch (e) {
      Alert.alert(t("error"), String(e));
    }
  };

  /** After a successful publish/unpublish, persist the updated shareCode. */
  const handleShareUpdated = async (updatedList: IPatternList) => {
    try {
      await savePatternList(updatedList);
      await loadLists();
      await refreshActiveList();
    } catch (e) {
      console.error("Error persisting shareCode:", e);
    }
    setShareTarget(updatedList); // keep modal open showing the new code
  };

  const handleUnpublished = async (updatedList: IPatternList) => {
    try {
      await savePatternList(updatedList);
      await loadLists();
      await refreshActiveList();
    } catch (e) {
      console.error("Error persisting unpublish:", e);
    }
    setShareTarget(null);
  };

  /** Called when user confirms subscribing to a shared list. */
  const handleSubscribeConfirm = async (fetched: PatternListWithPatterns) => {
    try {
      await savePatternList(fetched);
      await savePatterns(fetched.id, fetched.patterns);
      await loadLists();
      await setActiveList(fetched);
      navigation.navigate("Patterns");
    } catch (e) {
      Alert.alert(t("error"), String(e));
    }
  };

  const handleCreateList = async (
    newList: IPatternList,
    initialPatterns: NewPattern[],
  ) => {
    try {
      console.log("Creating new pattern list:", newList.id, newList.name);
      await savePatternList(newList);
      if (initialPatterns.length > 0) {
        await savePatterns(
          newList.id,
          initialPatterns.map((p, i) => ({ ...p, id: i + 1 })),
        );
      }
      await loadLists();
      await setActiveList(newList);
      navigation.navigate("Patterns");
    } catch (error) {
      console.error("Error creating list:", error);
      Alert.alert(t("error"), t("errorCreatingList"));
    }
  };

  const renderListItem = ({ item }: { item: IPatternList }) => {
    const isActive = activeList?.id === item.id;

    return (
      <TouchableOpacity
        style={[styles.listCard, isActive && styles.listCardActive]}
        onPress={() => handleSelectList(item)}
        onLongPress={() => setListActionTarget(item)}
      >
        <View style={styles.listCardContent}>
          <Text style={[styles.listName, isActive && styles.listNameActive]}>
            {item.name}
          </Text>
        </View>
        <View style={styles.listCardIndicators}>
          {item.shareCode && (
            <Icon
              name="cloud-check-outline"
              size={18}
              color={palette[PaletteColor.Primary]}
              accessibilityLabel={t("shareToCloud")}
            />
          )}
          {item.readonly && (
            <Icon
              name="lock-outline"
              size={18}
              color={palette[PaletteColor.SecondaryText]}
              accessibilityLabel={t("readonlyList")}
            />
          )}
          {isActive && <Text style={styles.activeIndicator}>✓</Text>}
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>{t("noPatternLists")}</Text>
      <Text style={styles.emptySubtext}>{t("noPatternListsHint")}</Text>
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <PageContainer
        style={{ backgroundColor: palette[PaletteColor.Background] }}
      >
        <AppHeader />
        <View style={styles.container}>
          <SectionHeader
            title={t("patternLists")}
            rightActions={
              <View style={styles.headerActions}>
                {firebaseAvailable && (
                  <TouchableOpacity
                    onPress={() => setShowSubscribeModal(true)}
                    style={styles.subscribeButton}
                    accessibilityLabel={t("subscribeToList")}
                  >
                    <Icon
                      name="cloud-download-outline"
                      size={22}
                      color={palette[PaletteColor.Primary]}
                    />
                  </TouchableOpacity>
                )}
                <PlusButton
                  onPress={() => setShowTemplateModal(true)}
                  palette={palette}
                  accessibilityLabel={t("createPatternList")}
                />
              </View>
            }
          />

          <FlatList
            data={patternLists}
            renderItem={renderListItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContainer}
            ListEmptyComponent={renderEmptyState}
            refreshing={isLoading}
            onRefresh={loadLists}
          />
        </View>

        <PatternListTemplateModal
          visible={showTemplateModal}
          onClose={() => setShowTemplateModal(false)}
          onCreateList={handleCreateList}
        />

        {/* ── Edit modal ───────────────────────────────────────────────── */}
        <PatternListTemplateModal
          visible={editingList !== null}
          onClose={() => setEditingList(null)}
          onCreateList={handleCreateList}
          editList={editingList ?? undefined}
          usedTypeIds={usedTypeIds}
          onSaveList={handleSaveList}
        />

        {/* ── List action bottom sheet ─────────────────────────────────── */}
        <BottomSheet
          visible={listActionTarget !== null}
          onClose={() => setListActionTarget(null)}
          title={listActionTarget?.name ?? ""}
          palette={palette}
          maxHeight="30%"
          minHeight="20%"
        >
          <View style={styles.actionSheetOptions}>
            {!listActionTarget?.readonly && (
              <TouchableOpacity
                style={styles.actionSheetOption}
                onPress={() =>
                  listActionTarget && handleEditList(listActionTarget)
                }
              >
                <Text style={styles.actionSheetOptionText}>
                  {t("editPatternList")}
                </Text>
              </TouchableOpacity>
            )}
            {firebaseAvailable && !listActionTarget?.readonly && (
              <TouchableOpacity
                style={styles.actionSheetOption}
                onPress={() =>
                  listActionTarget && handleOpenShare(listActionTarget)
                }
              >
                <Text style={styles.actionSheetOptionText}>
                  {listActionTarget?.shareCode
                    ? t("manageSharing")
                    : t("shareToCloud")}
                </Text>
              </TouchableOpacity>
            )}
            {!listActionTarget?.readonly && (
              <TouchableOpacity
                style={[
                  styles.actionSheetOption,
                  styles.actionSheetOptionDestructive,
                ]}
                onPress={() =>
                  listActionTarget && handleDeleteList(listActionTarget)
                }
              >
                <Text
                  style={[
                    styles.actionSheetOptionText,
                    styles.actionSheetOptionTextDestructive,
                  ]}
                >
                  {t("deletePatternList")}
                </Text>
              </TouchableOpacity>
            )}
            {listActionTarget?.readonly && (
              <View style={styles.actionSheetOption}>
                <Text style={styles.readonlyHint}>{t("readonlyListHint")}</Text>
              </View>
            )}
          </View>
        </BottomSheet>

        {/* ── Share modal ──────────────────────────────────────────────── */}
        {shareTarget && (
          <ShareListModal
            visible={shareTarget !== null}
            list={shareTarget}
            patterns={sharePatterns}
            onClose={() => setShareTarget(null)}
            onPublished={handleShareUpdated}
            onUnpublished={handleUnpublished}
          />
        )}

        {/* ── Subscribe modal ──────────────────────────────────────────── */}
        <SubscribeListModal
          visible={showSubscribeModal}
          onClose={() => setShowSubscribeModal(false)}
          onSubscribe={handleSubscribeConfirm}
        />
      </PageContainer>
    </View>
  );
};

const getStyles = (palette: Record<PaletteColor, string>) =>
  StyleSheet.create({
    container: {
      ...getCommonListContainer(palette),
      flex: 1,
    },
    listContainer: {
      paddingHorizontal: 8,
      paddingVertical: 8,
      gap: 12,
    },
    listCard: {
      backgroundColor: palette[PaletteColor.CardBackground],
      borderRadius: 12,
      padding: 16,
      borderWidth: 2,
      borderColor: "transparent",
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    listCardActive: {
      borderColor: palette[PaletteColor.Primary],
      backgroundColor: palette[PaletteColor.Primary] + "15",
    },
    listCardContent: {
      flex: 1,
    },
    listName: {
      fontSize: 18,
      fontWeight: "600",
      color: palette[PaletteColor.PrimaryText],
      marginBottom: 4,
    },
    listNameActive: {
      color: palette[PaletteColor.Primary],
    },
    listStyle: {
      fontSize: 12,
      color: palette[PaletteColor.SecondaryText],
      marginBottom: 8,
    },
    typeColorRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    typeColorDot: {
      width: 16,
      height: 16,
      borderRadius: 8,
    },
    moreTypes: {
      fontSize: 12,
      color: palette[PaletteColor.SecondaryText],
      marginLeft: 4,
    },
    activeIndicator: {
      fontSize: 24,
      color: palette[PaletteColor.Primary],
      fontWeight: "bold",
    },
    listCardIndicators: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    readonlyHint: {
      fontSize: 14,
      color: palette[PaletteColor.SecondaryText],
      fontStyle: "italic",
    },
    headerActions: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    subscribeButton: {
      paddingHorizontal: 4,
      paddingVertical: 2,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingVertical: 64,
    },
    emptyText: {
      fontSize: 18,
      fontWeight: "600",
      color: palette[PaletteColor.SecondaryText],
      marginBottom: 8,
    },
    emptySubtext: {
      fontSize: 14,
      color: palette[PaletteColor.SecondaryText],
      textAlign: "center",
    },
    actionSheetOptions: {
      gap: 4,
    },
    actionSheetOption: {
      paddingVertical: 14,
      paddingHorizontal: 4,
      borderBottomWidth: 1,
      borderBottomColor: palette[PaletteColor.Border],
    },
    actionSheetOptionDestructive: {
      borderBottomWidth: 0,
    },
    actionSheetOptionText: {
      fontSize: 16,
      color: palette[PaletteColor.PrimaryText],
    },
    actionSheetOptionTextDestructive: {
      color: palette[PaletteColor.Error],
    },
  });

export default PatternListSelector;
