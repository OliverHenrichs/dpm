import React, { useState } from "react";
import { Modal, ScrollView, Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import ModalOverlay from "@/src/common/components/ModalOverlay";
import { Button, ListRow } from "@/src/common/ui";
import {
  getCommonDialogCard,
  getCommonFormSheet,
} from "@/src/common/utils/CommonStyles";
import { formatTime } from "@/src/common/utils/TImeUtils";
import EditPatternForm from "@/src/pattern/list/EditPatternForm";
import {
  IModifier,
  IPattern,
  NewPattern,
} from "@/src/pattern/types/IPatternList";
import { PatternType } from "@/src/pattern/types/PatternType";
import {
  applyFigureChanges,
  ChangeLine,
  CountsAndRhythm,
} from "@/src/pattern/suggestions/figureEdits";

interface SuggestedEditReviewProps {
  /** The figure as it is now in the list owner's list. */
  figure: IPattern;
  lines: ChangeLine[];
  author: string;
  patterns: IPattern[];
  patternTypes: PatternType[];
  modifiers: IModifier[];
  /** Saves the figure with the chosen changes (`usePatternCrud.editPattern`); false keeps the review. */
  onApply: (figure: IPattern) => Promise<boolean>;
  onReject: () => void;
  onClose: () => void;
}

/**
 * The list owner's review of a suggested change to a figure: one line per change, ticked
 * unless they have changed the same thing themselves since. _Apply selected_ saves the ticked
 * lines; _Edit, then apply_ opens the figure form with them filled in, to correct first.
 */
const SuggestedEditReview: React.FC<SuggestedEditReviewProps> = ({
  figure,
  lines,
  author,
  patterns,
  patternTypes,
  modifiers,
  onApply,
  onReject,
  onClose,
}) => {
  const { t } = useTranslation();
  const [ticked, setTicked] = useState(
    () => new Set(lines.filter((l) => !l.changedSince).map((l) => l.id)),
  );
  const [editing, setEditing] = useState<IPattern | null>(null);
  const chosen = () => lines.filter((l) => ticked.has(l.id));

  const toggle = (id: string) =>
    setTicked((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  if (editing) {
    return (
      <Modal
        visible
        animationType="slide"
        transparent
        onRequestClose={() => setEditing(null)}
      >
        <ModalOverlay padding="none">
          <View style={styles.formContent}>
            <EditPatternForm
              patterns={patterns}
              patternTypes={patternTypes}
              modifiers={modifiers}
              existing={editing}
              onAccepted={(edited: NewPattern | IPattern) =>
                onApply({ ...edited, id: figure.id } as IPattern)
              }
              onCancel={() => setEditing(null)}
              title={t("suggestionReviewTitle")}
              saveLabel={t("suggestionApply")}
              header={
                <Text style={styles.meta}>
                  {t("suggestionFrom", { name: author })}
                </Text>
              }
            />
          </View>
        </ModalOverlay>
      </Modal>
    );
  }

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <ModalOverlay>
        <View style={styles.card}>
          <Text style={styles.title}>
            {t("suggestionEditTitle", { name: figure.name })}
          </Text>
          <Text style={styles.meta}>
            {t("suggestionFrom", { name: author })}
          </Text>
          <Text style={styles.hint}>{t("suggestionEditReviewHint")}</Text>
          <ScrollView style={styles.scroll} contentContainerStyle={styles.body}>
            {lines.map((line) => {
              const { title, detail } = describe(line, {
                t,
                patterns,
                patternTypes,
                modifiers,
              });
              const since =
                line.changedSince &&
                t("suggestionEditChangedSince", {
                  now: describeNow(line, { t, patternTypes }),
                });
              return (
                <ListRow
                  key={line.id}
                  variant="plain"
                  selection="multiple"
                  selected={ticked.has(line.id)}
                  onPress={() => toggle(line.id)}
                  title={title}
                  subtitle={[detail, since].filter(Boolean).join("\n")}
                  subtitleLines={6}
                />
              );
            })}
          </ScrollView>
          <View style={styles.actions}>
            <Button
              title={t("suggestionApplySelected")}
              disabled={ticked.size === 0}
              onPress={() => onApply(applyFigureChanges(figure, chosen()))}
            />
            <Button
              title={t("suggestionEditThenApply")}
              variant="secondary"
              onPress={() => setEditing(applyFigureChanges(figure, chosen()))}
            />
            <Button
              title={t("suggestionReject")}
              variant="dangerGhost"
              onPress={onReject}
            />
            <Button title={t("cancel")} variant="ghost" onPress={onClose} />
          </View>
        </View>
      </ModalOverlay>
    </Modal>
  );
};

interface Context {
  t: TFunction;
  patterns: IPattern[];
  patternTypes: PatternType[];
  modifiers: IModifier[];
}

const typeName = (types: PatternType[], id: string | undefined) =>
  types.find((pt) => pt.id === id)?.slug ?? "?";

const countsText = (c: CountsAndRhythm) =>
  c.rhythm ? `${c.counts} (${c.rhythm})` : String(c.counts);

const startText = (t: TFunction, seconds: number | null | undefined) =>
  seconds == null ? t("suggestionEditFromStart") : formatTime(seconds);

/** What a change line says: what changes, and the detail under it. */
function describe(
  line: ChangeLine,
  { t, patterns, patternTypes, modifiers }: Context,
): { title: string; detail?: string } {
  const modifierName = (id: string | undefined) =>
    id ? (modifiers.find((m) => m.id === id)?.name ?? "?") : undefined;
  const levelText = (level: string | null | undefined) =>
    level ? t(level) : t("noLevel");
  switch (line.kind) {
    case "name":
      return {
        title: t("suggestionEditName", { from: line.from, to: line.to }),
      };
    case "type":
      return {
        title: t("suggestionEditType", {
          from: typeName(patternTypes, line.from),
          to: typeName(patternTypes, line.to),
        }),
      };
    case "level":
      return {
        title: t("suggestionEditLevel", {
          from: levelText(line.from),
          to: levelText(line.to),
        }),
      };
    case "counts":
      return {
        title: t("suggestionEditCounts", {
          from: countsText(line.from),
          to: countsText(line.to),
        }),
      };
    case "description":
      return {
        title: t("suggestionEditDescription"),
        detail: line.to.trim() || t("suggestionEditEmpty"),
      };
    case "tag":
      return {
        title: t(
          line.op === "add"
            ? "suggestionEditTagAdd"
            : "suggestionEditTagRemove",
          { tag: line.tag },
        ),
      };
    case "prerequisite":
      return {
        title: t(
          line.op === "add"
            ? "suggestionEditPrerequisiteAdd"
            : "suggestionEditPrerequisiteRemove",
          {
            name: patterns.find((p) => p.id === line.patternId)?.name ?? "?",
          },
        ),
      };
    case "modifier":
      return {
        title: t(
          line.op === "add"
            ? "suggestionEditModifierAdd"
            : "suggestionEditModifierRemove",
          { name: modifierName(line.modifierId) },
        ),
        detail:
          line.op === "add" && line.videos.length > 0
            ? line.videos.map((v) => v.value).join("\n")
            : undefined,
      };
    case "video": {
      const under = modifierName(line.modifierId);
      return {
        title: [
          t(
            line.op === "add"
              ? "suggestionEditVideoAdd"
              : "suggestionEditVideoRemove",
          ),
          under,
        ]
          .filter(Boolean)
          .join(" · "),
        detail: [
          line.video.value,
          line.op === "add" && line.video.generated
            ? t("suggestionEditAnonymized")
            : undefined,
          line.op === "add" ? t("suggestionEditUploadedBySender") : undefined,
        ]
          .filter(Boolean)
          .join("\n"),
      };
    }
    case "videoStart":
      return {
        title: [
          t("suggestionEditVideoStart", {
            from: startText(t, line.from),
            to: startText(t, line.to),
          }),
          modifierName(line.modifierId),
        ]
          .filter(Boolean)
          .join(" · "),
        detail: line.url,
      };
  }
}

/** The list owner's own value, for a line they have changed since. */
function describeNow(
  line: ChangeLine,
  { t, patternTypes }: Pick<Context, "t" | "patternTypes">,
): string {
  switch (line.kind) {
    case "name":
    case "description":
      return line.now?.trim() || t("suggestionEditEmpty");
    case "type":
      return typeName(patternTypes, line.now);
    case "level":
      return line.now ? t(line.now) : t("noLevel");
    case "counts":
      return line.now ? countsText(line.now) : "";
    case "videoStart":
      return startText(t, line.now);
    default:
      return "";
  }
}

const styles = StyleSheet.create((theme) => ({
  formContent: getCommonFormSheet(theme),
  card: {
    ...getCommonDialogCard(theme),
    maxWidth: 480,
    maxHeight: "100%",
    gap: theme.space.sm,
  },
  scroll: {
    flexGrow: 0,
  },
  body: {
    paddingVertical: theme.space.sm,
  },
  title: {
    ...theme.typography.headline,
    color: theme.colors.text,
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
    gap: theme.space.sm,
  },
}));

export default SuggestedEditReview;
