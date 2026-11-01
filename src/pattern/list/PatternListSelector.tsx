import React, { useCallback, useState } from "react";
import { FlatList, Text, View } from "react-native";
import { Button, IconButton, ListRow } from "@/src/common/ui";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { Icon } from "@/src/common/ui/Icon";
import { router, useFocusEffect } from "expo-router";
import { IPattern, IPatternList } from "@/src/pattern/types/IPatternList";
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
import {
  applyLevelMoves,
  applyTypeMoves,
  countPatternsByLevel,
  countPatternsByType,
  LevelMoves,
  TypeMoves,
} from "@/src/pattern/list/typeMoves";
import { applyTagEdits, TagEdits } from "@/src/pattern/list/tagEdits";
import BottomSheet from "@/src/common/components/BottomSheet";
import ShareListModal from "@/src/pattern/list/ShareListModal";
import SubscribeListModal from "@/src/pattern/list/SubscribeListModal";
import AppDialog from "@/src/common/components/AppDialog";
import {
  syncPublishedList,
  unpublishList,
} from "@/src/firebase/FirebaseListService";
import { firebaseAvailable } from "@/src/firebase/firebaseConfig";
import { removeSubscription } from "@/src/firebase/SubscriptionService";
import { PatternListWithPatterns } from "@/src/pattern/data/types/IExportData";
import { createExampleList } from "@/src/pattern/data/ExampleList";
import TakeOverListModal from "@/src/pattern/handover/TakeOverListModal";
import HandOverModal from "@/src/pattern/handover/HandOverModal";
import ReportListModal from "@/src/legal/components/ReportListModal";

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
  const [typeUsage, setTypeUsage] = useState<Record<string, number>>({});
  const [levelUsage, setLevelUsage] = useState<Record<string, number>>({});
  const [figureTags, setFigureTags] = useState<string[][]>([]);

  // Cloud sharing state
  const [shareTarget, setShareTarget] = useState<IPatternList | null>(null);
  const [sharePatterns, setSharePatterns] = useState<
    PatternListWithPatterns["patterns"]
  >([]);
  const [showSubscribeModal, setShowSubscribeModal] = useState(false);
  // A subscribed list being taken over from its owner (src/pattern/handover/).
  const [takeOverTarget, setTakeOverTarget] = useState<IPatternList | null>(
    null,
  );
  const [takenOverName, setTakenOverName] = useState<string | null>(null);
  // The list owner's own published list being handed over, or no longer shared.
  const [handOverTarget, setHandOverTarget] = useState<IPatternList | null>(
    null,
  );
  const [unpublishTarget, setUnpublishTarget] = useState<IPatternList | null>(
    null,
  );
  const [unpublishedName, setUnpublishedName] = useState<string | null>(null);
  // A subscribed list being reported to the operator (src/legal/).
  const [reportTarget, setReportTarget] = useState<IPatternList | null>(null);

  // Dialog state
  const [deleteConfirmTarget, setDeleteConfirmTarget] =
    useState<IPatternList | null>(null);
  const [unsubscribeTarget, setUnsubscribeTarget] =
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

  /**
   * Remove a subscribed list from this phone and stop counting it for the publisher. Works
   * offline too: the subscription record then drops out of the count on its own.
   */
  const confirmUnsubscribe = async () => {
    if (!unsubscribeTarget) return;
    const list = unsubscribeTarget;
    setUnsubscribeTarget(null);
    try {
      if (list.shareCode) {
        await removeSubscription(list.shareCode).catch((e) =>
          console.warn("Removing the subscription failed:", e),
        );
      }
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
      setTypeUsage(countPatternsByType(patterns));
      setLevelUsage(countPatternsByLevel(patterns));
      setFigureTags(patterns.map((pattern) => pattern.tags));
      setEditingList(list);
    } catch (error) {
      console.error("Error loading patterns for edit:", error);
    }
  };

  const handleSaveList = async (
    updatedList: IPatternList,
    typeMoves: TypeMoves,
    levelMoves: LevelMoves,
    tagEdits: TagEdits,
  ) => {
    try {
      // Figures of a removed type or level go where the user chose, before the list drops it,
      // and the tags are renamed, merged and deleted with them.
      const patterns = await loadPatterns(updatedList.id);
      const moved = applyTagEdits(
        applyLevelMoves(applyTypeMoves(patterns, typeMoves), levelMoves),
        tagEdits,
      );
      if (moved !== patterns) await savePatterns(updatedList.id, moved);
      await savePatternList(updatedList);
      // If the list is already published, keep Firestore in sync automatically
      if (updatedList.shareCode) {
        await syncPublishedList(updatedList, moved).catch((e) =>
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

  /** Stop sharing a list: removed from the cloud, kept on this phone. */
  const confirmUnpublish = async () => {
    if (!unpublishTarget) return;
    const list = unpublishTarget;
    setUnpublishTarget(null);
    // The list's pull-to-refresh spinner shows while it is removed from the cloud.
    setIsLoading(true);
    try {
      await unpublishList(list);
    } catch (e) {
      setIsLoading(false);
      showError(e instanceof Error ? e.message : String(e));
      return;
    }
    const { shareCode: _removed, shareKey: _key, ...rest } = list;
    try {
      await savePatternList(rest as IPatternList);
      await loadLists();
      await refreshActiveList();
    } catch (e) {
      console.error("Error persisting unpublish:", e);
    }
    setUnpublishedName(list.name);
  };

  /** The handover went through: the list is this phone's to edit and publish now. */
  const handleTakenOver = async (updatedList: IPatternList) => {
    setTakeOverTarget(null);
    try {
      await savePatternList(updatedList);
      await loadLists();
      await refreshActiveList();
    } catch (e) {
      console.error("Error saving a list taken over:", e);
    }
    setTakenOverName(updatedList.name);
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
    initialPatterns: IPattern[],
  ) => {
    try {
      await savePatternList(newList);
      if (initialPatterns.length > 0) {
        await savePatterns(newList.id, initialPatterns);
      }
      await loadLists();
      await setActiveList(newList);
      router.navigate("/patterns");
    } catch (error) {
      console.error("Error creating list:", error);
      showError(t("errorCreatingList"));
    }
  };

  /** Saves the example list and opens it on the Map, where the idea shows best. */
  const handleOpenExample = async () => {
    const { patterns, ...example } = createExampleList(t);
    try {
      await savePatternList(example);
      await savePatterns(example.id, patterns);
      await loadLists();
      await setActiveList(example);
      router.navigate("/graph");
    } catch (error) {
      console.error("Error creating the example list:", error);
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
      <View style={styles.emptyActions}>
        <Button
          title={t("exploreExampleList")}
          icon="map-outline"
          onPress={handleOpenExample}
        />
        <Button
          title={t("startOwnList")}
          variant="secondary"
          icon="plus"
          onPress={() => setShowTemplateModal(true)}
        />
      </View>
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
          typeUsage={typeUsage}
          levelUsage={levelUsage}
          figureTags={figureTags}
          onSaveList={handleSaveList}
        />

        {/* ── List action bottom sheet ─────────────────────────────────── */}
        <BottomSheet
          visible={listActionTarget !== null}
          onClose={() => setListActionTarget(null)}
          title={listActionTarget?.name ?? ""}
          maxHeight="60%"
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
                    ? t("sharingTitle")
                    : t("shareThisList")
                }
                icon="cloud-upload-outline"
                onPress={() =>
                  listActionTarget && handleOpenShare(listActionTarget)
                }
              />
            )}
            {firebaseAvailable &&
              !listActionTarget?.readonly &&
              listActionTarget?.shareCode && (
                <ListRow
                  title={t("handOverList")}
                  icon="account-switch-outline"
                  onPress={() => {
                    setHandOverTarget(listActionTarget);
                    setListActionTarget(null);
                  }}
                />
              )}
            {firebaseAvailable &&
              !listActionTarget?.readonly &&
              listActionTarget?.shareCode && (
                <ListRow
                  title={t("unpublish")}
                  icon="cloud-off-outline"
                  destructive
                  onPress={() => {
                    setUnpublishTarget(listActionTarget);
                    setListActionTarget(null);
                  }}
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
            {firebaseAvailable &&
              listActionTarget?.readonly &&
              listActionTarget.shareCode && (
                <ListRow
                  title={t("takeOverList")}
                  icon="account-switch-outline"
                  onPress={() => {
                    setTakeOverTarget(listActionTarget);
                    setListActionTarget(null);
                  }}
                />
              )}
            {firebaseAvailable &&
              listActionTarget?.readonly &&
              listActionTarget.shareCode && (
                <ListRow
                  title={t("reportList")}
                  icon="flag-outline"
                  onPress={() => {
                    setReportTarget(listActionTarget);
                    setListActionTarget(null);
                  }}
                />
              )}
            {listActionTarget?.readonly && listActionTarget.shareCode && (
              <ListRow
                title={t("unsubscribeList")}
                icon="cloud-remove-outline"
                destructive
                onPress={() => {
                  setUnsubscribeTarget(listActionTarget);
                  setListActionTarget(null);
                }}
              />
            )}
            {listActionTarget?.readonly && (
              <View style={styles.actionSheetOption}>
                <Text style={styles.readonlyHint}>
                  {t(
                    listActionTarget.shareCode
                      ? "subscribedListHint"
                      : "readonlyListHint",
                  )}
                </Text>
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
          />
        )}
        {handOverTarget && (
          <HandOverModal
            list={handOverTarget}
            onClose={() => setHandOverTarget(null)}
          />
        )}
        <AppDialog
          visible={unpublishTarget !== null}
          title={t("unpublishConfirmTitle")}
          message={t("unpublishConfirmMessage")}
          closeLabel={t("cancel")}
          onClose={() => setUnpublishTarget(null)}
          confirmLabel={t("unpublish")}
          confirmDestructive
          onConfirm={confirmUnpublish}
        />
        <AppDialog
          visible={unpublishedName !== null}
          title={t("unpublishSuccessTitle")}
          message={t("unpublishSuccessMessage")}
          onClose={() => setUnpublishedName(null)}
        />

        {/* ── Subscribe modal ──────────────────────────────────────────── */}
        <SubscribeListModal
          visible={showSubscribeModal}
          existingLists={patternLists}
          onClose={() => setShowSubscribeModal(false)}
          onSubscribe={handleSubscribeConfirm}
        />

        {/* ── Take over a subscribed list ─────────────────────────────── */}
        {takeOverTarget && (
          <TakeOverListModal
            list={takeOverTarget}
            onClose={() => setTakeOverTarget(null)}
            onTakenOver={handleTakenOver}
          />
        )}
        {reportTarget && (
          <ReportListModal
            list={reportTarget}
            onClose={() => setReportTarget(null)}
          />
        )}
        <AppDialog
          visible={takenOverName !== null}
          title={t("takeOverSuccessTitle")}
          message={t("takeOverSuccessMessage", { name: takenOverName ?? "" })}
          onClose={() => setTakenOverName(null)}
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

        {/* ── Unsubscribe confirmation dialog ──────────────────────────── */}
        <AppDialog
          visible={unsubscribeTarget !== null}
          title={t("unsubscribeList")}
          message={t("unsubscribeListConfirm", {
            name: unsubscribeTarget?.name ?? "",
          })}
          closeLabel={t("cancel")}
          onClose={() => setUnsubscribeTarget(null)}
          confirmLabel={t("unsubscribe")}
          confirmDestructive
          onConfirm={confirmUnsubscribe}
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
    paddingHorizontal: theme.space.lg,
  },
  emptyActions: {
    marginTop: theme.space.xl,
    gap: theme.space.md,
    alignSelf: "stretch",
    paddingHorizontal: theme.space.xl,
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
