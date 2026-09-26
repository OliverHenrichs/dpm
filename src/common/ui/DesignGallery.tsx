import React, { useState } from "react";
import { ScrollView, View } from "react-native";
import { Redirect } from "expo-router";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import AppHeader from "@/src/common/components/AppHeader";
import PageContainer from "@/src/common/components/PageContainer";
import { useThemeContext } from "@/src/common/components/ThemeContext";
import type { ThemeType } from "@/src/settings/types/Themes";
import type { ColorTokens } from "@/src/common/theme/tokens";
import {
  AppText,
  Button,
  ButtonVariant,
  Card,
  Chip,
  IconButton,
  ListRow,
  SegmentedControl,
  TextVariant,
} from "@/src/common/ui";

/**
 * Every token and primitive on one screen, in whichever theme is active — the
 * quick loop for design work: edit `theme/tokens.ts` or a primitive, save, and
 * see the whole system change here. Development builds only.
 *
 * Its strings are deliberately not translated: no user ever sees this screen.
 */
const DesignGallery: React.FC = () => {
  const { theme } = useUnistyles();
  const { theme: preference, setTheme } = useThemeContext();
  const [selected, setSelected] = useState<string[]>(["Salsa"]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"patterns" | "modifiers">("patterns");
  const [language, setLanguage] = useState("en");
  const [expanded, setExpanded] = useState(false);

  if (!__DEV__) return <Redirect href="/" />;

  const toggle = (label: string) =>
    setSelected((s) =>
      s.includes(label) ? s.filter((l) => l !== label) : [...s, label],
    );

  return (
    <PageContainer>
      <AppHeader title="Design gallery" />
      <ScrollView contentContainerStyle={styles.content}>
        <Section title="Theme">
          <View style={styles.row}>
            {(["system", "light", "dark"] as ThemeType[]).map((value) => (
              <Chip
                key={value}
                label={value}
                selected={preference === value}
                onPress={() => setTheme(value)}
              />
            ))}
          </View>
        </Section>

        <Section title="Colour roles">
          <View style={styles.swatches}>
            {(Object.keys(theme.colors) as (keyof ColorTokens)[]).map(
              (role) => (
                <View key={role} style={styles.swatchItem}>
                  <View style={styles.swatch(theme.colors[role])} />
                  <AppText variant="caption" color="textMuted">
                    {role}
                  </AppText>
                </View>
              ),
            )}
          </View>
        </Section>

        <Section title="Typography">
          {(Object.keys(theme.typography) as TextVariant[]).map((variant) => (
            <AppText key={variant} variant={variant}>
              {variant} · {theme.typography[variant].fontSize}/
              {theme.typography[variant].lineHeight}
            </AppText>
          ))}
        </Section>

        <Section title="Spacing">
          {Object.entries(theme.space).map(([name, value]) => (
            <View key={name} style={styles.row}>
              <AppText variant="caption" style={styles.scaleLabel}>
                {name} {value}
              </AppText>
              <View style={styles.spaceBar(value)} />
            </View>
          ))}
        </Section>

        <Section title="Radius and elevation">
          <View style={styles.row}>
            {Object.entries(theme.radius)
              .filter(([name]) => name !== "none")
              .map(([name, value]) => (
                <View key={name} style={styles.radiusBox(value)}>
                  <AppText variant="badge" color="onSurfaceVariant">
                    {name}
                  </AppText>
                </View>
              ))}
          </View>
          <View style={styles.row}>
            {(["sm", "md", "lg"] as const).map((level) => (
              <View key={level} style={styles.elevationBox(level)}>
                <AppText variant="caption">{level}</AppText>
              </View>
            ))}
          </View>
        </Section>

        <Section title="Buttons">
          {(
            [
              "primary",
              "secondary",
              "outline",
              "ghost",
              "danger",
              "dangerOutline",
            ] as ButtonVariant[]
          ).map((variant) => (
            <View key={variant} style={styles.row}>
              <Button title={variant} variant={variant} onPress={() => {}} />
              <Button
                title="Small"
                icon="plus"
                size="sm"
                variant={variant}
                onPress={() => {}}
              />
              <Button
                title="Off"
                variant={variant}
                disabled
                onPress={() => {}}
              />
            </View>
          ))}
          <Button
            title={loading ? "Working" : "Tap to load"}
            icon="cloud-upload-outline"
            loading={loading}
            onPress={() => {
              setLoading(true);
              setTimeout(() => setLoading(false), 1500);
            }}
          />
        </Section>

        <Section title="Icon buttons">
          <View style={styles.row}>
            <IconButton
              icon="sort"
              accessibilityLabel="Sort"
              onPress={() => {}}
            />
            <IconButton
              icon="filter"
              color="success"
              accessibilityLabel="Filter"
              onPress={() => {}}
            />
            <IconButton
              icon="trash-can-outline"
              color="danger"
              accessibilityLabel="Delete"
              onPress={() => {}}
            />
            <IconButton
              icon="magnify"
              variant="filled"
              accessibilityLabel="Search"
              onPress={() => {}}
            />
            <IconButton
              icon="pencil"
              disabled
              accessibilityLabel="Edit"
              onPress={() => {}}
            />
          </View>
        </Section>

        <Section title="Chips">
          <View style={styles.row}>
            {["Salsa", "Bachata", "Kizomba"].map((label) => (
              <Chip
                key={label}
                label={label}
                selected={selected.includes(label)}
                onPress={() => toggle(label)}
              />
            ))}
            <Chip label="Tagged" icon="tag-outline" onPress={() => {}} />
            <Chip label="Push" swatch="#e11d48" onPress={() => {}} />
            <Chip label="Off" disabled onPress={() => {}} />
          </View>
        </Section>

        <Section title="Segmented control">
          <SegmentedControl
            segments={[
              { value: "patterns", label: "Patterns" },
              { value: "modifiers", label: "Modifiers", count: 2 },
            ]}
            value={tab}
            onChange={setTab}
          />
        </Section>

        <Section title="List rows">
          <View>
            <ListRow
              title="Edit list"
              icon="pencil-outline"
              onPress={() => {}}
            />
            <ListRow
              title="Delete list"
              icon="trash-can-outline"
              destructive
              onPress={() => {}}
            />
            {[
              { code: "en", label: "English" },
              { code: "de", label: "Deutsch", meta: "German" },
            ].map((lang) => (
              <ListRow
                key={lang.code}
                title={lang.label}
                meta={lang.meta}
                selection="single"
                selected={language === lang.code}
                onPress={() => setLanguage(lang.code)}
              />
            ))}
          </View>
          <ListRow
            variant="card"
            title="Salsa"
            subtitle="12 patterns"
            selection="multiple"
            selected={selected.includes("Salsa")}
            onPress={() => toggle("Salsa")}
          />
          <ListRow
            variant="card"
            title="Cross body lead"
            expanded={expanded}
            onPress={() => setExpanded((e) => !e)}
            trailing={
              <IconButton
                icon="pencil"
                size={theme.iconSize.md}
                accessibilityLabel="Edit"
                onPress={() => {}}
              />
            }
          />
        </Section>

        <Section title="Cards">
          <Card>
            <AppText variant="title">Outlined</AppText>
            <AppText color="textMuted">A list item or grouped content.</AppText>
          </Card>
          <Card variant="elevated">
            <AppText variant="title">Elevated</AppText>
            <AppText color="textMuted">Something that floats.</AppText>
          </Card>
          <Card selected onPress={() => {}} accessibilityLabel="Selected card">
            <AppText variant="title">Selected and pressable</AppText>
            <AppText color="textMuted">The chosen one of a set.</AppText>
          </Card>
        </Section>
      </ScrollView>
    </PageContainer>
  );
};

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({
  title,
  children,
}) => (
  <View style={styles.section}>
    <AppText variant="label" color="textMuted" style={styles.sectionTitle}>
      {title.toUpperCase()}
    </AppText>
    {children}
  </View>
);

const styles = StyleSheet.create((theme) => ({
  content: {
    paddingBottom: theme.space.xxxl,
  },
  section: {
    gap: theme.space.md,
    marginBottom: theme.space.xxl,
  },
  sectionTitle: {
    letterSpacing: 1,
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: theme.space.sm,
  },
  swatches: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.space.md,
  },
  swatchItem: {
    width: 88,
    gap: theme.space.xs,
  },
  swatch: (color: string) => ({
    height: 40,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: color,
  }),
  scaleLabel: {
    width: 64,
  },
  spaceBar: (width: number) => ({
    height: 12,
    width: Math.max(width, 1) * 4,
    borderRadius: theme.radius.xs,
    backgroundColor: theme.colors.primary,
  }),
  radiusBox: (radius: number) => ({
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Math.min(radius, 28),
    backgroundColor: theme.colors.surfaceVariant,
  }),
  elevationBox: (level: "sm" | "md" | "lg") => ({
    width: 88,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surface,
    ...theme.elevation[level],
  }),
}));

export default DesignGallery;
