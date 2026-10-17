import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Clipboard,
  Modal,
  ScrollView,
  Text,
  View,
} from "react-native";
import ModalOverlay from "@/src/common/components/ModalOverlay";
import {
  Button,
  Chip,
  IconButton,
  SegmentedControl,
  SwitchRow,
} from "@/src/common/ui";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { alpha } from "@/src/common/theme/tokens";
import { Icon } from "@/src/common/ui/Icon";
import QRCode from "react-native-qrcode-svg";
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
import { publishList, unpublishList } from "@/src/firebase/FirebaseListService";
import { firebaseAvailable } from "@/src/firebase/firebaseConfig";
import {
  ACTIVE_SUBSCRIPTION_DAYS,
  countSubscribers,
} from "@/src/firebase/SubscriptionService";
import AppDialog from "@/src/common/components/AppDialog";
import { withMembersOnly } from "@/src/pattern/members/members";

interface ShareListModalProps {
  visible: boolean;
  list: IPatternList;
  patterns: IPattern[];
  onClose: () => void;
  /** Called after a successful publish/sync with the updated list (carrying shareCode and shareKey). */
  onPublished: (updatedList: IPatternList) => void;
  /** Called after the user confirms unpublishing. */
  onUnpublished: (updatedList: IPatternList) => void;
}

const ShareListModal: React.FC<ShareListModalProps> = ({
  visible,
  list,
  patterns,
  onClose,
  onPublished,
  onUnpublished,
}) => {
  const { t } = useTranslation();
  const { theme } = useUnistyles();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [confirmUnpublish, setConfirmUnpublish] = useState(false);
  // Pending unpublished list — shown in success dialog before closing the modal
  const [unpublishPending, setUnpublishPending] = useState<IPatternList | null>(
    null,
  );

  const isPublished = !!list.shareCode;

  // How many phones follow the published list, for the code it was counted for; null when
  // counting failed. Still loading while it belongs to no code or another one.
  const [counted, setCounted] = useState<{
    shareCode: string;
    count: number | null;
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
    return () => {
      cancelled = true;
    };
    // Counted again only for another published list, not on every settings change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list.shareCode]);
  const subscriberCount =
    counted && counted.shareCode === list.shareCode ? counted.count : undefined;
  // Whether subscribers may suggest patterns. Before the first publish it waits for the
  // Publish button; on a published list a change is published at once.
  const [policy, setPolicy] = useState<ISuggestionPolicy | undefined>(
    list.suggestions,
  );

  // Whether only subscribers let in may read it (src/pattern/members/); published like the policy.
  const [membersOnly, setMembersOnly] = useState(!!list.membersOnly);
  const [confirmMembersOnly, setConfirmMembersOnly] = useState(false);

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
    target: IPatternList = withSettings(policy, membersOnly),
  ) => {
    setError(null);
    setIsLoading(true);
    try {
      const { shareCode, shareKey } = await publishList(target, patterns);
      onPublished({ ...target, shareCode, shareKey });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      // What is published did not change; show that.
      if (isPublished) {
        setPolicy(list.suggestions);
        setMembersOnly(!!list.membersOnly);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const changePolicy = (next: ISuggestionPolicy | undefined) => {
    setPolicy(next);
    if (isPublished) handlePublish(withSettings(next, membersOnly));
  };

  const changeMembersOnly = (closed: boolean) => {
    setMembersOnly(closed);
    if (isPublished) handlePublish(withSettings(policy, closed));
  };

  const handleUnpublish = async () => {
    if (!list.shareCode) return;
    setError(null);
    setIsLoading(true);
    try {
      await unpublishList(list);
      const { shareCode: _removed, shareKey: _key, ...rest } = list;
      // Show success dialog before propagating — the modal stays visible until dismissed
      setUnpublishPending(rest as IPatternList);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    if (!list.shareCode) return;
    Clipboard.setString(list.shareCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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
            <Text style={styles.title}>{t("shareToCloud")}</Text>
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

            {firebaseAvailable && isPublished && list.shareCode && (
              <>
                <Text style={styles.sectionLabel}>{t("shareCode")}</Text>
                <View style={styles.codeRow}>
                  <Text style={styles.code}>{list.shareCode}</Text>
                  <IconButton
                    icon={copied ? "check" : "content-copy"}
                    size={theme.iconSize.md}
                    color={copied ? "success" : "primary"}
                    onPress={handleCopy}
                    accessibilityLabel={t("copyShareCode")}
                  />
                  <IconButton
                    icon={showQr ? "qrcode-remove" : "qrcode"}
                    size={theme.iconSize.md}
                    onPress={() => setShowQr((v) => !v)}
                    accessibilityLabel={t(showQr ? "hideQrCode" : "showQrCode")}
                  />
                </View>
                {showQr && (
                  <View style={styles.qrContainer}>
                    <QRCode
                      value={list.shareCode}
                      size={160}
                      color={theme.colors.text}
                      backgroundColor={theme.colors.surface}
                    />
                  </View>
                )}
                <Text style={styles.hint}>{t("shareCodeHint")}</Text>

                <Text style={styles.sectionLabel}>{t("subscriberCount")}</Text>
                <View style={styles.countRow}>
                  <Icon
                    name="account-multiple-outline"
                    size={theme.iconSize.md}
                    color={theme.colors.primary}
                  />
                  {subscriberCount === undefined ? (
                    <ActivityIndicator
                      size="small"
                      color={theme.colors.primary}
                      accessibilityLabel={t("subscriberCountLoading")}
                    />
                  ) : (
                    <Text style={styles.count}>
                      {subscriberCount === null
                        ? t("subscriberCountUnavailable")
                        : String(subscriberCount)}
                    </Text>
                  )}
                </View>
                <Text style={styles.hint}>
                  {t("subscriberCountHint", { days: ACTIVE_SUBSCRIPTION_DAYS })}
                </Text>
              </>
            )}

            {firebaseAvailable && (
              <View style={styles.suggestions}>
                <SwitchRow
                  title={t("membersOnly")}
                  description={t("membersOnlyHint")}
                  value={membersOnly}
                  disabled={isLoading}
                  onValueChange={(on) =>
                    // Closing a published list shuts out everyone subscribed so far.
                    on && isPublished
                      ? setConfirmMembersOnly(true)
                      : changeMembersOnly(on)
                  }
                />
              </View>
            )}

            {firebaseAvailable && (
              <View style={styles.suggestions}>
                <SwitchRow
                  title={t("allowSuggestions")}
                  description={t("allowSuggestionsHint")}
                  value={!!policy}
                  disabled={isLoading}
                  onValueChange={(on) =>
                    changePolicy(
                      on ? (policy ?? DEFAULT_SUGGESTION_POLICY) : undefined,
                    )
                  }
                />
                {policy && (
                  <>
                    <Text style={styles.sectionLabel}>
                      {t("suggestionsDailyLimit")}
                    </Text>
                    <View style={styles.chipRow}>
                      {DAILY_LIMIT_CHOICES.map((n) => (
                        <Chip
                          key={n}
                          label={String(n)}
                          selected={policy.dailyLimit === n}
                          disabled={isLoading}
                          onPress={() =>
                            policy.dailyLimit !== n &&
                            changePolicy({ ...policy, dailyLimit: n })
                          }
                        />
                      ))}
                    </View>
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
                        !isLoading &&
                        policy.per !== per &&
                        changePolicy({ ...policy, per })
                      }
                    />
                  </>
                )}
              </View>
            )}

            {error && <Text style={styles.errorText}>{error}</Text>}

            {isLoading ? (
              <ActivityIndicator
                size="large"
                color={theme.colors.primary}
                style={styles.spinner}
              />
            ) : (
              <View style={styles.buttonCol}>
                {firebaseAvailable && (
                  <Button
                    title={isPublished ? t("syncToCloud") : t("publishToCloud")}
                    icon="cloud-upload-outline"
                    onPress={() => handlePublish()}
                  />
                )}
                {firebaseAvailable && isPublished && (
                  <Button
                    title={t("unpublish")}
                    icon="cloud-off-outline"
                    variant="dangerOutline"
                    onPress={() => setConfirmUnpublish(true)}
                  />
                )}
                <Button
                  title={t("cancel")}
                  variant="secondary"
                  onPress={onClose}
                />
              </View>
            )}
          </ScrollView>
        </View>
      </ModalOverlay>

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

      {/* ── Unpublish confirmation dialog ────────────────────────────── */}
      <AppDialog
        visible={confirmUnpublish}
        title={t("unpublishConfirmTitle")}
        message={t("unpublishConfirmMessage")}
        closeLabel={t("cancel")}
        onClose={() => setConfirmUnpublish(false)}
        confirmLabel={t("unpublish")}
        confirmDestructive
        onConfirm={() => {
          setConfirmUnpublish(false);
          handleUnpublish();
        }}
      />

      {/* ── Unpublish success dialog ─────────────────────────────────── */}
      <AppDialog
        visible={unpublishPending !== null}
        title={t("unpublishSuccessTitle")}
        message={t("unpublishSuccessMessage")}
        onClose={() => {
          const pending = unpublishPending;
          setUnpublishPending(null);
          if (pending) {
            onUnpublished(pending);
            onClose();
          }
        }}
      />
    </Modal>
  );
};

const styles = StyleSheet.create((theme) => ({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl,
    padding: theme.space.xxl,
    width: "100%",
    maxWidth: 420,
    maxHeight: "100%",
  },
  scroll: {
    flexGrow: 0,
  },
  scrollContent: {
    flexGrow: 0,
  },
  suggestions: {
    gap: theme.space.sm,
    marginBottom: theme.space.xl,
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
  sectionLabel: {
    ...theme.typography.caption,
    fontWeight: "600",
    color: theme.colors.textMuted,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: theme.space.sm,
  },
  codeRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.background,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.space.lg,
    paddingVertical: theme.space.md,
    marginBottom: theme.space.sm,
  },
  code: {
    ...theme.typography.display,
    flex: 1,
    letterSpacing: 4,
    color: theme.colors.primary,
    fontVariant: ["tabular-nums"],
  },
  countRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.space.sm,
    marginBottom: theme.space.sm,
  },
  count: {
    ...theme.typography.title,
    color: theme.colors.text,
    fontVariant: ["tabular-nums"],
  },
  qrContainer: {
    alignItems: "center",
    paddingVertical: theme.space.lg,
  },
  hint: {
    ...theme.typography.bodySmall,
    color: theme.colors.textMuted,
    marginBottom: theme.space.xl,
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
  spinner: {
    marginVertical: theme.space.xl,
  },
  buttonCol: {
    gap: theme.space.md,
  },
}));

export default ShareListModal;
