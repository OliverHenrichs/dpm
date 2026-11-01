import React, { useState } from "react";
import { Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { useTranslation } from "react-i18next";
import { IconButton, ListRow } from "@/src/common/ui";
import AppDialog from "@/src/common/components/AppDialog";
import { RevealTextInput } from "@/src/common/components/reveal";
import { getCommonInput } from "@/src/common/utils/CommonStyles";
import {
  addTagEdit,
  tagKey,
  TagEdits,
  TagUsage,
} from "@/src/pattern/list/tagEdits";

interface TagEditorProps {
  /** The list's tags as the edits so far leave them, by name, with their figure counts. */
  tags: TagUsage[];
  /** The renames, merges and deletes so far. */
  edits: TagEdits;
  onChangeEdits: (edits: TagEdits) => void;
}

/**
 * The list's tags in list settings: each with how many figures carry it, renamed or deleted
 * from its row. A new name another tag already has (ignoring case) merges the two after asking;
 * deleting asks too, naming how many figures lose the tag. Nothing is written until Save.
 */
const TagEditor: React.FC<TagEditorProps> = ({
  tags,
  edits,
  onChangeEdits,
}) => {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  // The tag being renamed and the name typed so far.
  const [renaming, setRenaming] = useState<TagUsage | null>(null);
  const [newName, setNewName] = useState("");
  const [showEmptyError, setShowEmptyError] = useState(false);
  // A rename onto another tag's name, waiting for the user to agree to the merge.
  const [merging, setMerging] = useState<{
    from: TagUsage;
    into: TagUsage;
  } | null>(null);
  const [deleting, setDeleting] = useState<TagUsage | null>(null);
  const usedBy = (count: number) =>
    count === 1 ? t("tagUsedByOne") : t("tagUsedByMany", { count });

  const startRename = (tag: TagUsage) => {
    setNewName(tag.tag);
    setShowEmptyError(false);
    setRenaming(tag);
  };

  const confirmRename = () => {
    if (!renaming) return;
    const name = newName.trim();
    if (!name) {
      setShowEmptyError(true);
      return;
    }
    setRenaming(null);
    const into = tags.find(
      (other) =>
        tagKey(other.tag) === tagKey(name) &&
        tagKey(other.tag) !== tagKey(renaming.tag),
    );
    if (into) {
      // The same dialog asks next, so it stays open.
      setMerging({ from: renaming, into });
      return;
    }
    if (name !== renaming.tag) {
      onChangeEdits(addTagEdit(edits, renaming.tag, name));
    }
  };

  const confirmMerge = () => {
    if (merging) {
      // Into the other tag as it is spelled, so its figures keep their tag as it was.
      onChangeEdits(addTagEdit(edits, merging.from.tag, merging.into.tag));
    }
    setMerging(null);
  };

  const confirmDelete = () => {
    if (deleting) onChangeEdits(addTagEdit(edits, deleting.tag, null));
    setDeleting(null);
  };

  return (
    <View>
      {/* The section header in list settings names it. */}
      <Text style={styles.hint}>
        {tags.length > 0 ? t("listTagsHint") : t("listTagsEmpty")}
      </Text>

      {tags.map((tag) => (
        <ListRow
          key={tagKey(tag.tag)}
          title={tag.tag}
          subtitle={usedBy(tag.count)}
          icon="tag-outline"
          iconColor="textMuted"
          style={styles.row}
          trailing={
            <View style={styles.actions}>
              <IconButton
                icon="pencil-outline"
                size={theme.iconSize.md}
                color="textMuted"
                onPress={() => startRename(tag)}
                accessibilityLabel={t("renameTag", { tag: tag.tag })}
              />
              <IconButton
                icon="delete-outline"
                size={theme.iconSize.md}
                color="textMuted"
                onPress={() => setDeleting(tag)}
                accessibilityLabel={t("deleteTag", { tag: tag.tag })}
              />
            </View>
          }
        />
      ))}

      {/* One dialog for the rename and the merge it may turn into: closing one modal while
          opening another in the same moment is what iOS refuses. */}
      <AppDialog
        visible={renaming !== null || merging !== null}
        title={
          merging
            ? t("mergeTagTitle", {
                tag: merging.from.tag,
                target: merging.into.tag,
              })
            : t("renameTag", { tag: renaming?.tag ?? "" })
        }
        message={
          merging
            ? t("mergeTagMessage", {
                tag: merging.from.tag,
                target: merging.into.tag,
              })
            : t("renameTagMessage")
        }
        closeLabel={t("cancel")}
        onClose={() => {
          setRenaming(null);
          setMerging(null);
        }}
        confirmLabel={merging ? t("mergeTagConfirm") : t("renameTagConfirm")}
        onConfirm={merging ? confirmMerge : confirmRename}
      >
        {merging ? null : (
          <>
            <RevealTextInput
              style={styles.input}
              value={newName}
              onChangeText={(value) => {
                setNewName(value);
                setShowEmptyError(false);
              }}
              onSubmitEditing={confirmRename}
              accessibilityLabel={t("tagName")}
              placeholder={t("tagName")}
              placeholderTextColor={theme.colors.textMuted}
              autoCapitalize="none"
              autoFocus
            />
            {showEmptyError && (
              <Text style={styles.error}>{t("emptyTypeSlug")}</Text>
            )}
          </>
        )}
      </AppDialog>

      <AppDialog
        visible={deleting !== null}
        title={t("deleteTag", { tag: deleting?.tag ?? "" })}
        message={
          deleting?.count === 1
            ? t("deleteTagMessageOne", { tag: deleting.tag })
            : t("deleteTagMessageMany", {
                tag: deleting?.tag ?? "",
                count: deleting?.count ?? 0,
              })
        }
        closeLabel={t("cancel")}
        onClose={() => setDeleting(null)}
        confirmLabel={t("delete")}
        confirmDestructive
        onConfirm={confirmDelete}
      />
    </View>
  );
};

const styles = StyleSheet.create((theme) => ({
  hint: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    marginBottom: theme.space.sm,
  },
  row: { paddingHorizontal: 0 },
  actions: {
    flexDirection: "row",
    gap: theme.space.xs,
  },
  input: {
    ...getCommonInput(theme),
    ...theme.typography.body,
  },
  error: {
    ...theme.typography.micro,
    color: theme.colors.danger,
    marginTop: theme.space.xs,
  },
}));

export default TagEditor;
