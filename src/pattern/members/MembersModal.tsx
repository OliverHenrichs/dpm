import React, { useState } from "react";
import { Modal, ScrollView, Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { useTranslation } from "react-i18next";
import ModalOverlay from "@/src/common/components/ModalOverlay";
import AppDialog from "@/src/common/components/AppDialog";
import { Button, ListRow } from "@/src/common/ui";
import { IPatternList } from "@/src/pattern/types/IPatternList";
import { ListMember, setMembership } from "@/src/firebase/MembershipService";
import { groupMembers } from "@/src/pattern/members/members";

interface MembersModalProps {
  visible: boolean;
  /** The publisher's own members-only list. */
  list: IPatternList;
  members: ListMember[];
  onClose: () => void;
}

/**
 * Who may read the publisher's members-only list: requests to let in or decline, members to
 * remove, and those turned away, who can still be let in.
 */
const MembersModal: React.FC<MembersModalProps> = (props) =>
  props.visible ? <MembersBody {...props} /> : null;

const MembersBody: React.FC<MembersModalProps> = ({
  list,
  members,
  onClose,
}) => {
  const { t } = useTranslation();
  const [error, setError] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<ListMember | null>(null);
  const { requested, member, declined } = groupMembers(members);
  const nameOf = (m: ListMember) => m.name ?? t("memberAnonymous");

  const answer = async (
    target: ListMember,
    membership: "member" | "declined",
  ) => {
    setError(null);
    try {
      await setMembership(list, target.uid, membership);
    } catch (e) {
      console.warn("MembersModal:", e);
      setError(t("membersActionFailed"));
    }
  };

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <ModalOverlay>
        <View style={styles.card}>
          <Text style={styles.title}>{t("membersTitle")}</Text>
          <Text style={styles.meta}>{list.name}</Text>
          <ScrollView style={styles.scroll} contentContainerStyle={styles.body}>
            <Text style={styles.hint}>{t("membersHint")}</Text>
            {members.length === 0 && (
              <Text style={styles.hint}>{t("membersEmpty")}</Text>
            )}
            {requested.length > 0 && (
              <Text style={styles.section}>{t("membersRequested")}</Text>
            )}
            {requested.map((m) => (
              <ListRow
                key={m.uid}
                variant="plain"
                icon="account-clock-outline"
                title={nameOf(m)}
                trailing={
                  <View style={styles.actions}>
                    <Button
                      title={t("memberLetIn")}
                      size="sm"
                      onPress={() => answer(m, "member")}
                    />
                    <Button
                      title={t("memberDecline")}
                      size="sm"
                      variant="ghost"
                      onPress={() => answer(m, "declined")}
                    />
                  </View>
                }
              />
            ))}
            {member.length > 0 && (
              <Text style={styles.section}>{t("membersMembers")}</Text>
            )}
            {member.map((m) => (
              <ListRow
                key={m.uid}
                variant="plain"
                icon="account-check-outline"
                title={nameOf(m)}
                trailing={
                  <Button
                    title={t("memberRemove")}
                    size="sm"
                    variant="dangerGhost"
                    onPress={() => setRemoveTarget(m)}
                  />
                }
              />
            ))}
            {declined.length > 0 && (
              <Text style={styles.section}>{t("membersDeclined")}</Text>
            )}
            {declined.map((m) => (
              <ListRow
                key={m.uid}
                variant="plain"
                icon="account-cancel-outline"
                title={nameOf(m)}
                trailing={
                  <Button
                    title={t("memberLetIn")}
                    size="sm"
                    variant="ghost"
                    onPress={() => answer(m, "member")}
                  />
                }
              />
            ))}
          </ScrollView>
          {error && <Text style={styles.error}>{error}</Text>}
          <Button title={t("close")} variant="secondary" onPress={onClose} />
        </View>
      </ModalOverlay>

      <AppDialog
        visible={removeTarget !== null}
        title={t("memberRemoveTitle", {
          name: removeTarget ? nameOf(removeTarget) : "",
        })}
        message={t("memberRemoveMessage")}
        closeLabel={t("cancel")}
        onClose={() => setRemoveTarget(null)}
        confirmLabel={t("memberRemove")}
        confirmDestructive
        onConfirm={() => {
          const target = removeTarget;
          setRemoveTarget(null);
          if (target) answer(target, "declined");
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
    maxWidth: 480,
    maxHeight: "100%",
    gap: theme.space.sm,
  },
  scroll: {
    flexGrow: 0,
  },
  body: {
    gap: theme.space.sm,
    paddingVertical: theme.space.sm,
  },
  title: {
    ...theme.typography.headline,
    color: theme.colors.text,
  },
  section: {
    ...theme.typography.caption,
    fontWeight: "600",
    color: theme.colors.textMuted,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginTop: theme.space.md,
  },
  meta: {
    ...theme.typography.bodySmall,
    color: theme.colors.textMuted,
  },
  hint: {
    ...theme.typography.bodySmall,
    color: theme.colors.textMuted,
  },
  actions: {
    flexDirection: "row",
    gap: theme.space.xs,
  },
  error: {
    ...theme.typography.bodySmall,
    color: theme.colors.danger,
  },
}));

export default MembersModal;
