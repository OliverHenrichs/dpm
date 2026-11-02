import React, { useState } from "react";
import { View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { ListRow } from "@/src/common/ui";

type FormSectionProps = {
  title: string;
  /** What the section holds, one line, shown while it is closed. */
  summary: string;
  /** Whether it starts open; the pattern editor opens the sections that hold something. */
  initiallyOpen: boolean;
  /**
   * Why the section cannot be edited here ("Same for every variant"): it then shows only its
   * summary, with this beside the title, and does not open.
   */
  lockedNote?: string;
  children: React.ReactNode;
};

/**
 * A part of a form that folds away behind a header row, so the fields used on every pattern
 * (name, counts, videos) fit on about one screen and the rest is a tap away. Closed, the
 * header says what is inside, so nothing is hidden without a trace.
 */
const FormSection: React.FC<FormSectionProps> = ({
  title,
  summary,
  initiallyOpen,
  lockedNote,
  children,
}) => {
  const [open, setOpen] = useState(initiallyOpen);
  if (lockedNote) {
    return (
      <View style={styles.section}>
        <ListRow
          title={title}
          meta={lockedNote}
          subtitle={summary}
          disabled
          style={styles.header}
        />
      </View>
    );
  }
  return (
    <View style={styles.section}>
      <ListRow
        title={title}
        subtitle={open ? undefined : summary}
        expanded={open}
        onPress={() => setOpen((o) => !o)}
        style={styles.header}
      />
      {open && <View style={styles.body}>{children}</View>}
    </View>
  );
};

const styles = StyleSheet.create((theme) => ({
  section: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  header: { paddingHorizontal: 0 },
  body: { paddingBottom: theme.space.sm },
}));

export default FormSection;
