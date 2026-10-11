import React from "react";
import { View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { useTranslation } from "react-i18next";
import { AppText } from "@/src/common/ui";
import { ChangelogEntry, notesFor } from "@/src/changelog/changelog";

interface ChangelogEntriesProps {
  entries: ChangelogEntry[];
}

/** A day as the user's language writes it; the raw `YYYY-MM-DD` if that fails. */
function formatDate(date: string, language: string): string {
  try {
    // Noon UTC, so no time zone moves it to the day before or after.
    return new Date(`${date}T12:00:00Z`).toLocaleDateString(language, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return date;
  }
}

/** Changelog entries, newest first: a version heading over its notes, one bullet each. */
const ChangelogEntries: React.FC<ChangelogEntriesProps> = ({ entries }) => {
  const { t, i18n } = useTranslation();

  return (
    <View style={styles.entries}>
      {entries.map((entry) => (
        <View key={entry.version} style={styles.entry}>
          <View style={styles.heading}>
            <AppText variant="rowTitle" accessibilityRole="header">
              {t("changelogVersion", { version: entry.version })}
            </AppText>
            {entry.date && (
              <AppText variant="caption" color="textMuted">
                {formatDate(entry.date, i18n.language)}
              </AppText>
            )}
          </View>
          {notesFor(entry, i18n.language).map((note) => (
            <View key={note} style={styles.note}>
              <AppText color="primary" importantForAccessibility="no">
                {"•"}
              </AppText>
              <AppText variant="bodySmall" style={styles.noteText}>
                {note}
              </AppText>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create((theme) => ({
  entries: { gap: theme.space.xl },
  entry: { gap: theme.space.xs },
  heading: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: theme.space.sm,
    marginBottom: theme.space.xs,
  },
  note: { flexDirection: "row", gap: theme.space.sm },
  noteText: { flex: 1 },
}));

export default ChangelogEntries;
