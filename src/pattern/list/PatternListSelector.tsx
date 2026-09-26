import React, { useCallback, useState } from "react";
import { FlatList, Text, View } from "react-native";
import { IconButton, ListRow } from "@/src/common/ui";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { router, useFocusEffect } from "expo-router";
import { IPatternList, NewPattern } from "@/src/pattern/types/IPatternList";
import {
  deletePatternList,
  loadAllPatternLists,
  loadPatterns,
  savePatternList,
  savePatterns,
} from "@/src/pattern/data/PatternListStorage";
import { useActivePatternList } from "@/src/pattern/data/components/ActivePatternListContext";
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
import AppDialog from "@/src/common/components/AppDialog";
import { syncPublishedList } from "@/src/firebase/FirebaseListService";
import { firebaseAvailable } from "@/src/firebase/firebaseConfig";
import { PatternListWithPatterns } from "@/src/pattern/data/types/IExportData";

const PatternListSelector: React.FC = () => {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
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

  // Dialog state
  const [deleteConfirmTarget, setDeleteConfirmTarget] =
    useState<IPatternList | null>(null);
  const [errorDialog, setErrorDialog] = useState<{
    title: string;
    message: string;
  } | null>(null);
  const showError = (message: string) =>
    setErrorDialog({ title: t("error"), message });

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
    router.navigate("/patterns");
  };

  const handleDeleteList = (list: IPatternList) => {
    setListActionTarget(null);
    setDeleteConfirmTarget(list);
  };

  const confirmDeleteList = async () => {
    if (!deleteConfirmTarget) return;
    const list = deleteConfirmTarget;
    setDeleteConfirmTarget(null);
    try {
      await deletePatternList(list.id);
      await loadLists();
      await refreshActiveList();
    } catch {
      showError(t("errorDeletingList"));
    }
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
      showError(t("errorCreatingList"));
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
      showError(String(e));
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
      // Firestore does not store readonly — stamp it locally so the subscriber
      // cannot edit the list and the flag survives future sync updates.
      await savePatternList({ ...fetched, readonly: true });
      await savePatterns(fetched.id, fetched.patterns);
      await loadLists();
      await setActiveList({ ...fetched, readonly: true });
      router.navigate("/patterns");
    } catch (e) {
      showError(String(e));
    }
  };

  const handleCreateList = async (
    newList: IPatternList,
    initialPatterns: NewPattern[],
  ) => {
    try {
      await savePatternList(newList);
      if (initialPatterns.length > 0) {
        await savePatterns(
          newList.id,
          initialPatterns.map((p, i) => ({ ...p, id: i + 1 })),
        );
      }
      await loadLists();
      await setActiveList(newList);
      router.navigate("/patterns");
    } catch (error) {
      console.error("Error creating list:", error);
      showError(t("errorCreatingList"));
    }
  };

  const renderListItem = ({ item }: { item: IPatternList }) => {
    const isActive = activeList?.id === item.id;

    return (
      <ListRow
        variant="card"
        title={item.name}
        selection="single"
        selected={isActive}
        onPress={() => handleSelectList(item)}
        // A shortcut only: the "more" button below is the visible way in.
        onLongPress={() => setListActionTarget(item)}
        trailing={
          <View style={styles.listCardIndicators}>
            {item.shareCode && (
              <Icon
                name="cloud-check-outline"
                size={theme.iconSize.sm}
                color={theme.colors.primary}
                accessibilityLabel={t("shareToCloud")}
              />
            )}
            {item.readonly && (
              <Icon
                name="lock-outline"
                size={theme.iconSize.sm}
                color={theme.colors.textMuted}
                accessibilityLabel={t("readonlyList")}
              />
            )}
            <IconButton
              icon="dots-vertical"
              color="textMuted"
              size={theme.iconSize.md}
              onPress={() => setListActionTarget(item)}
              accessibilityLabel={`${t("moreOptions")}: ${item.name}`}
            />
          </View>
        }
      />
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
      <PageContainer style={{ backgroundColor: theme.colors.background }}>
        <AppHeader />
        <View style={styles.container}>
          <SectionHeader
            title={t("patternListsDescription")}
            rightActions={
              <View style={styles.headerActions}>
                {firebaseAvailable && (
                  <IconButton
                    icon="cloud-download-outline"
                    onPress={() => setShowSubscribeModal(true)}
                    accessibilityLabel={t("subscribeToList")}
                  />
                )}
                <PlusButton
                  onPress={() => setShowTemplateModal(true)}
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
          maxHeight="30%"
          minHeight="20%"
        >
          <View style={styles.actionSheetOptions}>
            {!listActionTarget?.readonly && (
              <ListRow
                title={t("editPatternList")}
                icon="pencil-outline"
                onPress={() =>
                  listActionTarget && handleEditList(listActionTarget)
                }
              />
            )}
            {firebaseAvailable && !listActionTarget?.readonly && (
              <ListRow
                title={
                  listActionTarget?.shareCode
                    ? t("manageSharing")
                    : t("shareToCloud")
                }
                icon="cloud-upload-outline"
                onPress={() =>
                  listActionTarget && handleOpenShare(listActionTarget)
                }
              />
            )}
            {!listActionTarget?.readonly && (
              <ListRow
                title={t("deletePatternList")}
                icon="trash-can-outline"
                destructive
                onPress={() =>
                  listActionTarget && handleDeleteList(listActionTarget)
                }
              />
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
            visible={true}
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
          existingLists={patternLists}
          onClose={() => setShowSubscribeModal(false)}
          onSubscribe={handleSubscribeConfirm}
        />

        {/* ── Error dialog ────────────────────────────────────────────── */}
        {errorDialog && (
          <AppDialog
            visible={true}
            title={errorDialog.title}
            message={errorDialog.message}
            onClose={() => setErrorDialog(null)}
          />
        )}

        {/* ── Delete list confirmation dialog ──────────────────────────── */}
        <AppDialog
          visible={deleteConfirmTarget !== null}
          title={t("deletePatternList")}
          message={t("deletePatternListConfirm", {
            name: deleteConfirmTarget?.name ?? "",
          })}
          closeLabel={t("cancel")}
          onClose={() => setDeleteConfirmTarget(null)}
          confirmLabel={t("delete")}
          confirmDestructive
          onConfirm={confirmDeleteList}
        />
      </PageContainer>
    </View>
  );
};

const styles = StyleSheet.create((theme) => ({
  container: {
    ...getCommonListContainer(theme),
    flex: 1,
  },
  listContainer: {
    paddingHorizontal: theme.space.sm,
    paddingVertical: theme.space.sm,
    gap: theme.space.md,
  },
  listCardIndicators: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.space.sm,
  },
  readonlyHint: {
    ...theme.typography.bodySmall,
    color: theme.colors.textMuted,
    fontStyle: "italic",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.space.sm,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 64,
  },
  emptyText: {
    ...theme.typography.title,
    fontWeight: "600",
    color: theme.colors.textMuted,
    marginBottom: theme.space.sm,
  },
  emptySubtext: {
    ...theme.typography.bodySmall,
    color: theme.colors.textMuted,
    textAlign: "center",
  },
  actionSheetOptions: {
    gap: theme.space.xs,
  },
  actionSheetOption: {
    paddingVertical: theme.space.lg,
    paddingHorizontal: theme.space.xs,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
}));

export default PatternListSelector;
