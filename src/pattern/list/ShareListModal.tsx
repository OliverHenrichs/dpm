import React, { useEffect, useState } from "react";
import { ActivityIndicator, Modal, ScrollView, Text, View } from "react-native";
import ModalOverlay from "@/src/common/components/ModalOverlay";
import ShareableCode from "@/src/common/components/ShareableCode";
import {
  Button,
  Chip,
  ListRow,
  SegmentedControl,
  SwitchRow,
} from "@/src/common/ui";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { getCommonDialogCard } from "@/src/common/utils/CommonStyles";
import { alpha } from "@/src/common/theme/tokens";
import { Icon } from "@/src/common/ui/Icon";
import { useTranslation } from "react-i18next";
import {
  IPatternList,
  IPattern,
  ISuggestionPolicy,
} from "@/src/pattern/types/IPatternList";
import {
  DAILY_LIMIT_CHOICES,
  DEFAULT_SUGGESTION_POLICY,
} from "@/src/pattern/suggestions/suggestions";
import { publishList } from "@/src/firebase/FirebaseListService";
import { firebaseAvailable } from "@/src/firebase/firebaseConfig";
import { lastSyncFailure } from "@/src/firebase/SyncStatus";
import {
  ACTIVE_SUBSCRIPTION_DAYS,
  countSubscribers,
} from "@/src/firebase/SubscriptionService";
import AppDialog from "@/src/common/components/AppDialog";
import { withMembersOnly } from "@/src/pattern/members/members";
import { useMembers } from "@/src/pattern/members/useMembers";
import MembersModal from "@/src/pattern/members/MembersModal";
import { useTermsConsent } from "@/src/legal/useTermsConsent";

interface ShareListModalProps {
  visible: boolean;
  list: IPatternList;
  patterns: IPattern[];
  onClose: () => void;
  /** Called after a successful publish/sync with the updated list (carrying shareCode and shareKey). */
  onPublished: (updatedList: IPatternList) => void;
}

/** Which part of the sheet is being published, so only that part shows a spinner. */
type Saving = "publish" | "access" | "suggestions" | null;

type Audience = "anyone" | "members";

/**
 * Publishes a list and, once published, its sharing settings: the code, who can open it and
 * suggestions. A change to a setting is published at once, so the sheet closes with Done.
 * Handing over and stopping sharing live in the list's ⋮ sheet on the Lists screen.
 */
const ShareListModal: React.FC<ShareListModalProps> = ({
  visible,
  list,
  patterns,
  onClose,
  onPublished,
}) => {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  // Publishing shares the list with others: agreed to the terms of use first (src/legal/).
  const { withTerms, termsDialog } = useTermsConsent();

  const [saving, setSaving] = useState<Saving>(null);
  const [error, setError] = useState<string | null>(null);

  const isPublished = !!list.shareCode;

  // How many phones follow the published list, for the code it was counted for; null when
  // counting failed. Still loading while it belongs to no code or another one.
  const [counted, setCounted] = useState<{
    shareCode: string;
    count: number | null;
  }>();
  // Whether the last automatic push of this list failed (`SyncStatus`), for its code.
  const [syncFailed, setSyncFailed] = useState<{
    shareCode: string;
    failed: boolean;
  }>();
  useEffect(() => {
    const shareCode = list.shareCode;
    if (!firebaseAvailable || !shareCode) return;
    let cancelled = false;
    countSubscribers(list).then(
      (count) => !cancelled && setCounted({ shareCode, count }),
      (e: unknown) => {
        console.warn("Counting subscribers failed:", e);
        if (!cancelled) setCounted({ shareCode, count: null });
      },
    );
    lastSyncFailure(shareCode).then(
      (at) => !cancelled && setSyncFailed({ shareCode, failed: at !== null }),
      () => {},
    );
    return () => {
      cancelled = true;
    };
    // Counted again only for another published list, not on every settings change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list.shareCode]);
  const subscriberCount =
    counted && counted.shareCode === list.shareCode ? counted.count : undefined;
  const lastSyncFailed =
    !!syncFailed &&
    syncFailed.shareCode === list.shareCode &&
    syncFailed.failed;

  // Whether subscribers may suggest figures; set once the list is published, at once.
  const [policy, setPolicy] = useState<ISuggestionPolicy | undefined>(
    list.suggestions,
  );
  const [showPolicy, setShowPolicy] = useState(false);

  // Whether only subscribers let in may read it (src/pattern/members/); published like the policy.
  const [membersOnly, setMembersOnly] = useState(!!list.membersOnly);
  const [confirmMembersOnly, setConfirmMembersOnly] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const { members } = useMembers(list);
  const waiting = members.filter((m) => m.membership === "requested").length;

  /**
   * The list with these settings; none removes the key (Firestore rejects undefined).
   */
  const withSettings = (
    next: ISuggestionPolicy | undefined,
    closed: boolean,
  ): IPatternList => {
    const { suggestions: _previous, ...rest } = withMembersOnly(list, closed);
    return next ? { ...rest, suggestions: next } : rest;
  };

  const handlePublish = async (
    part: Exclude<Saving, null>,
    target: IPatternList = withSettings(policy, membersOnly),
  ) => {
    setError(null);
    setSaving(part);
    try {
      const { shareCode, shareKey } = await publishList(target, patterns);
      if (shareCode) setSyncFailed({ shareCode, failed: false });
      onPublished({ ...target, shareCode, shareKey });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      // What is published did not change; show that.
      if (isPublished) {
        setPolicy(list.suggestions);
        setMembersOnly(!!list.membersOnly);
      }
    } finally {
      setSaving(null);
    }
  };

  const changePolicy = (next: ISuggestionPolicy | undefined) => {
    setPolicy(next);
    handlePublish("suggestions", withSettings(next, membersOnly));
  };

  const changeMembersOnly = (closed: boolean) => {
    setMembersOnly(closed);
    if (isPublished) handlePublish("access", withSettings(policy, closed));
  };

  const busy = saving !== null;

  const sectionLabel = (label: string, part: Saving) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionLabel}>{label}</Text>
      {saving === part && (
        <ActivityIndicator
          size="small"
          color={theme.colors.primary}
          accessibilityLabel={t("savingChanges")}
        />
      )}
    </View>
  );

  const policySummary = (p: ISuggestionPolicy) =>
    [
      t(
        p.per === "list"
          ? "suggestionsSummaryInTotal"
          : "suggestionsSummaryPerSubscriber",
        { count: p.dailyLimit },
      ),
      t(p.edits ? "suggestionsSummaryNewAndChanges" : "suggestionsSummaryNew"),
    ].join(" · ");

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <ModalOverlay>
        <View style={styles.card}>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
          >
            <Text style={styles.title}>
              {isPublished ? t("sharingTitle") : t("shareThisList")}
            </Text>
            <Text style={styles.listName}>{list.name}</Text>

            {!firebaseAvailable && (
              <View style={styles.warningBox}>
                <Icon
                  name="alert-circle-outline"
                  size={18}
                  color={theme.colors.danger}
                />
                <Text style={styles.warningText}>
                  {t("sharingNotAvailable")}
                </Text>
              </View>
            )}

            {firebaseAvailable && !isPublished && (
              <Text style={styles.intro}>{t("publishHint")}</Text>
            )}

            {firebaseAvailable && isPublished && list.shareCode && (
              <View style={styles.section}>
                {sectionLabel(t("shareSection"), "publish")}
                <ShareableCode
                  code={list.shareCode}
                  copyLabel={t("copyShareCode")}
                  large
                />
                <View style={styles.statusRow}>
                  <Icon
                    name="account-multiple-outline"
                    size={theme.iconSize.sm}
                    color={theme.colors.textMuted}
                  />
                  {subscriberCount === undefined ? (
                    <ActivityIndicator
                      size="small"
                      color={theme.colors.primary}
                      accessibilityLabel={t("subscriberCountLoading")}
                    />
                  ) : (
                    <Text style={styles.status}>
                      {subscriberCount === null
                        ? t("subscriberCountUnavailable")
                        : t("subscriberLine", {
                            count: subscriberCount,
                            days: ACTIVE_SUBSCRIPTION_DAYS,
                          })}
                    </Text>
                  )}
                </View>
                <View style={styles.statusRow}>
                  <Icon
                    name={
                      lastSyncFailed
                        ? "cloud-alert-outline"
                        : "cloud-check-outline"
                    }
                    size={theme.iconSize.sm}
                    color={
                      lastSyncFailed
                        ? theme.colors.danger
                        : theme.colors.textMuted
                    }
                  />
                  <Text
                    style={[styles.status, lastSyncFailed && styles.failed]}
                  >
                    {lastSyncFailed ? t("syncFailed") : t("syncUpToDate")}
                  </Text>
                  {lastSyncFailed && (
                    <Button
                      title={t("syncRetry")}
                      variant="ghost"
                      size="sm"
                      disabled={busy}
                      loading={saving === "publish"}
                      onPress={() => void handlePublish("publish")}
                    />
                  )}
                </View>
              </View>
            )}

            {firebaseAvailable && (
              <View style={styles.section}>
                {sectionLabel(t("whoCanOpen"), "access")}
                <SegmentedControl<Audience>
                  kind="choice"
                  accessibilityLabel={t("whoCanOpen")}
                  segments={[
                    { value: "anyone", label: t("anyoneWithCode") },
                    { value: "members", label: t("membersOnly") },
                  ]}
                  value={membersOnly ? "members" : "anyone"}
                  onChange={(audience) => {
                    const closed = audience === "members";
                    if (busy || closed === membersOnly) return;
                    // Closing a published list shuts out everyone subscribed so far.
                    if (closed && isPublished) setConfirmMembersOnly(true);
                    else changeMembersOnly(closed);
                  }}
                />
                {/* Before publishing, the intro already says who can follow it. */}
                {(membersOnly || isPublished) && (
                  <Text style={styles.hint}>
                    {membersOnly ? t("membersOnlyHint") : t("shareCodeHint")}
                  </Text>
                )}
                {isPublished && list.membersOnly && (
                  <ListRow
                    variant="plain"
                    title={t("membersRow")}
                    icon="account-group-outline"
                    meta={
                      waiting > 0
                        ? t("membersWaiting", { count: waiting })
                        : undefined
                    }
                    onPress={() => setShowMembers(true)}
                  />
                )}
              </View>
            )}

            {firebaseAvailable && isPublished && (
              <View style={styles.section}>
                {sectionLabel(t("suggestionsSection"), "suggestions")}
                <SwitchRow
                  title={t("allowSuggestions")}
                  description={t("allowSuggestionsHint")}
                  value={!!policy}
                  disabled={busy}
                  onValueChange={(on) =>
                    changePolicy(
                      on ? (policy ?? DEFAULT_SUGGESTION_POLICY) : undefined,
                    )
                  }
                />
                {policy && (
                  <ListRow
                    variant="plain"
                    title={policySummary(policy)}
                    expanded={showPolicy}
                    onPress={() => setShowPolicy((open) => !open)}
                  />
                )}
                {policy && showPolicy && (
                  <View style={styles.details}>
                    <Text style={styles.detailLabel}>
                      {t("suggestionsDailyLimit")}
                    </Text>
                    <View style={styles.chipRow}>
                      {DAILY_LIMIT_CHOICES.map((n) => (
                        <Chip
                          key={n}
                          label={String(n)}
                          selected={policy.dailyLimit === n}
                          disabled={busy}
                          onPress={() =>
                            policy.dailyLimit !== n &&
                            changePolicy({ ...policy, dailyLimit: n })
                          }
                        />
                      ))}
                    </View>
                    <Text style={styles.detailLabel}>
                      {t("suggestionsCountedFor")}
                    </Text>
                    <SegmentedControl
                      kind="choice"
                      accessibilityLabel={t("suggestionsCountedFor")}
                      segments={[
                        {
                          value: "subscriber",
                          label: t("suggestionsPerSubscriber"),
                        },
                        { value: "list", label: t("suggestionsInTotal") },
                      ]}
                      value={policy.per}
                      onChange={(per) =>
                        !busy &&
                        policy.per !== per &&
                        changePolicy({ ...policy, per })
                      }
                    />
                    <SwitchRow
                      title={t("allowEditSuggestions")}
                      description={t("allowEditSuggestionsHint")}
                      value={!!policy.edits}
                      disabled={busy}
                      onValueChange={(on) => {
                        // Off removes the key: Firestore refuses undefined.
                        const { edits: _edits, ...rest } = policy;
                        changePolicy(on ? { ...rest, edits: true } : rest);
                      }}
                    />
                  </View>
                )}
              </View>
            )}

            {error && <Text style={styles.errorText}>{error}</Text>}
          </ScrollView>
          {/* Outside the scroller, so Publish and Done stay in sight. */}
          <View style={styles.buttonCol}>
            {firebaseAvailable && !isPublished && (
              <Button
                title={t("publishToCloud")}
                icon="cloud-upload-outline"
                loading={saving === "publish"}
                disabled={busy}
                onPress={() => withTerms(() => void handlePublish("publish"))}
              />
            )}
            <Button
              title={isPublished ? t("done") : t("cancel")}
              variant={isPublished ? "primary" : "ghost"}
              onPress={onClose}
            />
          </View>
        </View>
      </ModalOverlay>

      {termsDialog}

      {isPublished && list.membersOnly && (
        <MembersModal
          visible={showMembers}
          list={list}
          members={members}
          onClose={() => setShowMembers(false)}
        />
      )}

      {/* ── Members-only confirmation, on a published list ─────────────── */}
      <AppDialog
        visible={confirmMembersOnly}
        title={t("membersOnlyConfirmTitle")}
        message={t("membersOnlyConfirmMessage")}
        closeLabel={t("cancel")}
        onClose={() => setConfirmMembersOnly(false)}
        confirmLabel={t("membersOnlyConfirm")}
        onConfirm={() => {
          setConfirmMembersOnly(false);
          changeMembersOnly(true);
        }}
      />
    </Modal>
  );
};

const styles = StyleSheet.create((theme) => ({
  card: {
    ...getCommonDialogCard(theme),
    maxWidth: 420,
    maxHeight: "100%",
  },
  scroll: {
    flexGrow: 0,
    flexShrink: 1,
  },
  scrollContent: {
    flexGrow: 0,
  },
  section: {
    gap: theme.space.sm,
    marginBottom: theme.space.xl,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.space.sm,
    minHeight: 20,
  },
  details: {
    gap: theme.space.sm,
    paddingLeft: theme.space.md,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.space.sm,
  },
  title: {
    ...theme.typography.headline,
    color: theme.colors.text,
    marginBottom: theme.space.xs,
  },
  listName: {
    ...theme.typography.bodySmall,
    color: theme.colors.textMuted,
    marginBottom: theme.space.xl,
  },
  intro: {
    ...theme.typography.body,
    color: theme.colors.text,
    marginBottom: theme.space.xl,
  },
  sectionLabel: {
    ...theme.typography.caption,
    fontWeight: "600",
    color: theme.colors.textMuted,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  detailLabel: {
    ...theme.typography.bodySmall,
    color: theme.colors.textMuted,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.space.sm,
    minHeight: 28,
  },
  status: {
    ...theme.typography.bodySmall,
    color: theme.colors.textMuted,
    flexShrink: 1,
  },
  failed: {
    color: theme.colors.danger,
  },
  hint: {
    ...theme.typography.bodySmall,
    color: theme.colors.textMuted,
  },
  warningBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.space.sm,
    backgroundColor: alpha(theme.colors.danger, 0.08),
    borderRadius: theme.radius.md,
    padding: theme.space.md,
    marginBottom: theme.space.xl,
  },
  warningText: {
    ...theme.typography.bodySmall,
    flex: 1,
    color: theme.colors.danger,
  },
  errorText: {
    ...theme.typography.bodySmall,
    color: theme.colors.danger,
    marginBottom: theme.space.md,
  },
  buttonCol: {
    gap: theme.space.md,
    marginTop: theme.space.md,
  },
}));

export default ShareListModal;
