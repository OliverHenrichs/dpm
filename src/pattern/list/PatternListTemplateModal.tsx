import React, { useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Button } from "@/src/common/ui";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { useTranslation } from "react-i18next";
import {
  createBachataList,
  createBlankList,
  createLindyHopList,
  createPatternList,
  createPatternType,
  createSalsaList,
  createTangoList,
  createWestCoastSwingList,
  resolveTemplatePatterns,
  TEMPLATE_FOUNDATIONAL_PATTERNS,
  TemplatePattern,
} from "@/src/pattern/data/DefaultPatternLists";
import { IPatternList, NewPattern } from "@/src/pattern/types/IPatternList";
import {
  isSlugUnique,
  normalizeSlug,
  PATTERN_TYPE_COLORS,
  PatternType,
} from "@/src/pattern/types/PatternType";

interface PatternListTemplateModalProps {
  visible: boolean;
  onClose: () => void;
  onCreateList: (list: IPatternList, initialPatterns: NewPattern[]) => void;
  /** When set the modal opens straight into the configure step in edit mode */
  editList?: IPatternList;
  /** Type IDs that have at least one pattern — their ✕ button is disabled */
  usedTypeIds?: Set<string>;
  /** Called instead of onCreateList when editing an existing list */
  onSaveList?: (updatedList: IPatternList) => void;
}

interface Template {
  id: string;
  nameKey: string;
  descriptionKey: string;
  create: () => IPatternList;
}

interface DraftPatternEntry {
  templatePattern: TemplatePattern;
  included: boolean;
}

/** Applies the edited name/types to an existing list and re-stamps updatedAt. */
function applyListEdits(
  list: IPatternList,
  name: string,
  patternTypes: PatternType[],
): IPatternList {
  return { ...list, name, patternTypes, updatedAt: Date.now() };
}

const COLOR_VALUES = Object.values(PATTERN_TYPE_COLORS) as string[];
const COLOR_NAMES = Object.keys(
  PATTERN_TYPE_COLORS,
) as (keyof typeof PATTERN_TYPE_COLORS)[];

const TEMPLATES: Template[] = [
  {
    id: "blank",
    nameKey: "templateBlankName",
    descriptionKey: "templateBlankDescription",
    create: createBlankList,
  },
  {
    id: "wcs",
    nameKey: "templateWcsName",
    descriptionKey: "templateWcsDescription",
    create: createWestCoastSwingList,
  },
  {
    id: "salsa",
    nameKey: "templateSalsaName",
    descriptionKey: "templateSalsaDescription",
    create: createSalsaList,
  },
  {
    id: "bachata",
    nameKey: "templateBachataName",
    descriptionKey: "templateBachataDescription",
    create: createBachataList,
  },
  {
    id: "tango",
    nameKey: "templateTangoName",
    descriptionKey: "templateTangoDescription",
    create: createTangoList,
  },
  {
    id: "lindy",
    nameKey: "templateLindyName",
    descriptionKey: "templateLindyDescription",
    create: createLindyHopList,
  },
];

type TemplateModalBodyProps = Omit<PatternListTemplateModalProps, "visible">;

const PatternListTemplateModal: React.FC<PatternListTemplateModalProps> = ({
  visible,
  ...bodyProps
}) => {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={bodyProps.onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Keyed by what the modal is currently open on, so opening it (or
              switching to another list) re-mounts the body with its drafts
              seeded from the props, and closing it throws them away. That is
              what replaces the old seed/reset effect. */}
          <TemplateModalBody
            key={visible ? (bodyProps.editList?.id ?? "new") : "closed"}
            {...bodyProps}
          />
        </View>
      </View>
    </Modal>
  );
};

const TemplateModalBody: React.FC<TemplateModalBodyProps> = ({
  onClose,
  onCreateList,
  editList,
  usedTypeIds,
  onSaveList,
}) => {
  const { t } = useTranslation();
  const { theme } = useUnistyles();

  const isEditMode = !!editList; // this operator ensures editList is not undefined or null, treating both as "not in edit mode"

  type Step = "pick" | "configure";
  // In edit mode the drafts start out mirroring the list being edited and the
  // template picker is skipped; otherwise everything starts empty.
  const [step, setStep] = useState<Step>(isEditMode ? "configure" : "pick");
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(
    null,
  );
  const [draftName, setDraftName] = useState(editList?.name ?? "");
  const [draftTypes, setDraftTypes] = useState<PatternType[]>(() =>
    (editList?.patternTypes ?? []).map((pt) => ({ ...pt })),
  );
  const [draftPatterns, setDraftPatterns] = useState<DraftPatternEntry[]>([]);
  const [colorPopoverId, setColorPopoverId] = useState<string | null>(null);

  // ── Slug validation ────────────────────────────────────────────────────────
  const slugErrors: Record<string, string> = {};
  draftTypes.forEach((type) => {
    const normalized = normalizeSlug(type.slug);
    if (!normalized) {
      slugErrors[type.id] = t("emptyTypeSlug");
    } else if (!isSlugUnique(type.slug, draftTypes, type.id)) {
      slugErrors[type.id] = t("duplicateTypeSlug");
    }
  });
  const canCreate =
    draftName.trim().length > 0 && Object.keys(slugErrors).length === 0;

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleSelectTemplate = (template: Template) => {
    const baseList = template.create();
    const foundational = TEMPLATE_FOUNDATIONAL_PATTERNS[template.id] ?? [];
    setSelectedTemplate(template);
    setDraftName(template.id === "blank" ? "" : t(template.nameKey));
    setDraftTypes(baseList.patternTypes.map((pt) => ({ ...pt })));
    setDraftPatterns(
      foundational.map((tp) => ({ templatePattern: tp, included: true })),
    );
    setColorPopoverId(null);
    setStep("configure");
  };

  const handleCreate = () => {
    if (!canCreate) return;
    const finalTypes: PatternType[] = draftTypes.map((dt) => ({
      ...dt,
      slug: normalizeSlug(dt.slug),
    }));

    if (isEditMode && editList && onSaveList) {
      // ── Edit path ─────────────────────────────────────────────────────
      onSaveList(applyListEdits(editList, draftName.trim(), finalTypes));
    } else {
      // ── Create path ───────────────────────────────────────────────────
      const newList = createPatternList(draftName.trim(), finalTypes);
      const includedPatterns = draftPatterns
        .filter((e) => e.included)
        .map((e) => e.templatePattern);
      const initialPatterns = resolveTemplatePatterns(
        includedPatterns,
        finalTypes,
      );
      onCreateList(newList, initialPatterns);
    }
    handleClose();
  };

  const handleClose = () => {
    onClose();
  };

  // ── Type editing ──────────────────────────────────────────────────────────
  const handleTypeSlugChange = (id: string, slug: string) => {
    setDraftTypes((prev) =>
      prev.map((dt) => (dt.id === id ? { ...dt, slug } : dt)),
    );
  };

  const handleTypeColorChange = (id: string, color: string) => {
    setDraftTypes((prev) =>
      prev.map((dt) => (dt.id === id ? { ...dt, color } : dt)),
    );
    setColorPopoverId(null);
  };

  const handleAddType = () => {
    const usedColors = new Set(draftTypes.map((dt) => dt.color));
    const nextColor =
      COLOR_VALUES.find((c) => !usedColors.has(c)) ?? COLOR_VALUES[0];
    setDraftTypes((prev) => [...prev, createPatternType("", nextColor)]);
  };

  const handleRemoveType = (id: string) => {
    setDraftTypes((prev) => prev.filter((dt) => dt.id !== id));
    // Auto-uncheck patterns whose typeSlug no longer has a matching type
    const remaining = draftTypes.filter((dt) => dt.id !== id);
    setDraftPatterns((prev) =>
      prev.map((entry) => {
        const stillExists = remaining.some(
          (dt) =>
            dt.slug.toLowerCase() ===
            entry.templatePattern.typeSlug.toLowerCase(),
        );
        return stillExists ? entry : { ...entry, included: false };
      }),
    );
  };

  const togglePattern = (index: number) => {
    setDraftPatterns((prev) =>
      prev.map((e, i) => (i === index ? { ...e, included: !e.included } : e)),
    );
  };

  // ── Render helpers ────────────────────────────────────────────────────────
  const getTypeColor = (slug: string): string | undefined => {
    return draftTypes.find((dt) => dt.slug.toLowerCase() === slug.toLowerCase())
      ?.color;
  };

  const renderColorPopover = (typeId: string, currentColor: string) => (
    <View style={styles.colorPopover}>
      <View style={styles.colorSwatchGrid}>
        {COLOR_VALUES.map((color, idx) => (
          <TouchableOpacity
            key={COLOR_NAMES[idx]}
            style={[
              styles.colorSwatch,
              { backgroundColor: color },
              color === currentColor && styles.colorSwatchSelected,
            ]}
            onPress={() => handleTypeColorChange(typeId, color)}
          />
        ))}
      </View>
    </View>
  );

  const renderPickStep = () => (
    <View style={{ flexShrink: 1 }}>
      <Text style={styles.title}>{t("chooseTemplate")}</Text>
      <Text style={styles.subtitle}>{t("chooseTemplateHint")}</Text>
      <ScrollView
        style={styles.templateList}
        keyboardShouldPersistTaps="handled"
      >
        {TEMPLATES.map((template) => (
          <TouchableOpacity
            key={template.id}
            style={[
              styles.templateCard,
              template.id === "blank" && styles.templateCardBlank,
            ]}
            onPress={() => handleSelectTemplate(template)}
          >
            <Text style={styles.templateName}>{t(template.nameKey)}</Text>
            <Text style={styles.templateDescription}>
              {t(template.descriptionKey)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <TouchableOpacity style={styles.cancelButton} onPress={handleClose}>
        <Text style={styles.cancelButtonText}>{t("cancel")}</Text>
      </TouchableOpacity>
    </View>
  );

  const renderConfigureStep = () => (
    <Pressable
      style={{ flexShrink: 1 }}
      onPress={() => setColorPopoverId(null)}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>{t("configureYourList")}</Text>
        <Text style={styles.subtitle}>{t("configureListHint")}</Text>

        {/* ── Name ──────────────────────────────────────────────────────── */}
        <Text style={styles.label}>{t("listName")}</Text>
        <TextInput
          style={styles.input}
          value={draftName}
          onChangeText={setDraftName}
          // The placeholder is the template's name, so it cannot double as the
          // field's label — a screen reader would announce the suggestion and
          // never say what the field is for.
          accessibilityLabel={t("listName")}
          placeholder={t(selectedTemplate?.nameKey ?? "templateBlankName")}
          placeholderTextColor={theme.colors.textMuted}
        />

        {/* ── Pattern Types ─────────────────────────────────────────────── */}
        <Text style={[styles.label, { marginTop: 20 }]}>
          {t("patternTypes")}
        </Text>
        {draftTypes.map((dt) => {
          const isInUse = usedTypeIds?.has(dt.id) ?? false;
          const isPickingColor = colorPopoverId === dt.id;
          return (
            <View
              key={dt.id}
              style={[styles.typeRow, isPickingColor && styles.typeRowRaised]}
            >
              {/* Color dot → popover, which is rendered last inside the row */}
              <TouchableOpacity
                onPress={(e) => {
                  e?.stopPropagation?.();
                  setColorPopoverId((prev) => (prev === dt.id ? null : dt.id));
                }}
                style={[styles.typeColorDot, { backgroundColor: dt.color }]}
              />

              <TextInput
                style={[
                  styles.typeSlugInput,
                  slugErrors[dt.id] ? styles.typeSlugInputError : undefined,
                ]}
                value={dt.slug}
                onChangeText={(v) => handleTypeSlugChange(dt.id, v)}
                placeholder={t("typeName")}
                placeholderTextColor={theme.colors.textMuted}
                onFocus={() => setColorPopoverId(null)}
              />
              <TouchableOpacity
                style={[
                  styles.removeTypeButton,
                  isInUse && styles.removeTypeButtonDisabled,
                ]}
                onPress={() => !isInUse && handleRemoveType(dt.id)}
                disabled={isInUse}
                accessibilityLabel={
                  isInUse ? t("cannotRemoveTypeHasPatterns") : undefined
                }
              >
                <Text
                  style={[
                    styles.removeTypeButtonText,
                    isInUse && styles.removeTypeButtonTextDisabled,
                  ]}
                >
                  ✕
                </Text>
              </TouchableOpacity>
              {/* Last child on purpose: it overlays the row's own slug input,
                  and paint order is what decides that where zIndex does not. */}
              {isPickingColor && renderColorPopover(dt.id, dt.color)}
            </View>
          );
        })}
        {/* Slug error messages */}
        {draftTypes.map((dt) =>
          slugErrors[dt.id] ? (
            <Text key={`err-${dt.id}`} style={styles.slugError}>
              {dt.slug || t("typeName")}: {slugErrors[dt.id]}
            </Text>
          ) : null,
        )}

        <TouchableOpacity style={styles.addTypeButton} onPress={handleAddType}>
          <Text style={styles.addTypeButtonText}>+ {t("addPatternType")}</Text>
        </TouchableOpacity>

        {/* ── Foundational Patterns ─────────────────────────────────────── */}
        {draftPatterns.length > 0 && (
          <View style={{ marginTop: 20 }}>
            <Text style={styles.label}>{t("startingPatterns")}</Text>
            <Text style={styles.sectionHint}>{t("startingPatternsHint")}</Text>
            {draftPatterns.map((entry, idx) => {
              const color = getTypeColor(entry.templatePattern.typeSlug);
              const typeRemoved = color === undefined;
              return (
                <TouchableOpacity
                  key={idx}
                  style={[
                    styles.patternToggleRow,
                    (!entry.included || typeRemoved) &&
                      styles.patternToggleRowOff,
                  ]}
                  onPress={() => !typeRemoved && togglePattern(idx)}
                  disabled={typeRemoved}
                >
                  <View
                    style={[
                      styles.checkbox,
                      entry.included && !typeRemoved && styles.checkboxChecked,
                    ]}
                  >
                    {entry.included && !typeRemoved && (
                      <Text style={styles.checkmark}>✓</Text>
                    )}
                  </View>
                  <View style={styles.patternToggleInfo}>
                    <Text
                      style={[
                        styles.patternToggleName,
                        (!entry.included || typeRemoved) &&
                          styles.patternToggleNameOff,
                      ]}
                    >
                      {entry.templatePattern.name}
                    </Text>
                    <View style={styles.patternToggleMeta}>
                      {color && (
                        <View
                          style={[
                            styles.typeColorPip,
                            { backgroundColor: color },
                          ]}
                        />
                      )}
                      <Text style={styles.patternToggleSlug}>
                        {entry.templatePattern.typeSlug}
                      </Text>
                      <Text style={styles.patternToggleCounts}>
                        · {entry.templatePattern.counts} {t("counts")}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* ── Buttons ───────────────────────────────────────────────────── */}
        <View style={[styles.buttonRow, { marginTop: 24 }]}>
          <Button
            title={isEditMode ? t("cancel") : t("back")}
            variant="secondary"
            onPress={isEditMode ? handleClose : () => setStep("pick")}
            style={styles.footerButton}
          />
          <Button
            title={isEditMode ? t("saveChanges") : t("create")}
            onPress={handleCreate}
            disabled={!canCreate}
            style={styles.footerButton}
          />
        </View>
      </ScrollView>
    </Pressable>
  );
  return step === "pick" ? renderPickStep() : renderConfigureStep();
};

const styles = StyleSheet.create((theme) => ({
  modalOverlay: {
    flex: 1,
    backgroundColor: theme.colors.overlay,
    justifyContent: "center",
    alignItems: "center",
    padding: theme.space.xl,
  },
  modalContent: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl,
    padding: theme.space.xxl,
    width: "100%",
    maxWidth: 500,
    maxHeight: "88%",
    flexShrink: 1,
  },
  title: {
    ...theme.typography.headline,
    color: theme.colors.text,
    marginBottom: theme.space.sm,
  },
  subtitle: {
    ...theme.typography.bodySmall,
    color: theme.colors.textMuted,
    marginBottom: theme.space.xl,
  },
  templateList: {
    maxHeight: 420,
  },
  templateCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.space.lg,
    marginBottom: theme.space.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  templateCardBlank: {
    borderStyle: "dashed",
    borderColor: theme.colors.primary,
  },
  templateName: {
    ...theme.typography.button,
    color: theme.colors.text,
    marginBottom: theme.space.xs,
  },
  templateDescription: {
    ...theme.typography.bodySmall,
    color: theme.colors.textMuted,
  },
  label: {
    ...theme.typography.label,
    color: theme.colors.text,
    marginBottom: theme.space.sm,
  },
  sectionHint: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    marginBottom: theme.space.sm,
  },
  input: {
    ...theme.typography.body,
    backgroundColor: theme.colors.background,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.space.md,
    paddingVertical: theme.space.md,
    color: theme.colors.text,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  // ── Type rows ──────────────────────────────────────────────────────────
  typeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: theme.space.sm,
    gap: theme.space.sm,
    zIndex: 10,
  },
  // The open swatch grid hangs down over the rows beneath it. Those rows are
  // later siblings with the same zIndex, so they would paint over it: the row
  // holding the popover has to be lifted above them for the whole time it is
  // open. zIndex does that on iOS and web; on Android sibling draw order
  // follows elevation, hence both. The popover's own zIndex only orders it
  // against the other children of its row, never against another row.
  typeRowRaised: {
    zIndex: 100,
    elevation: 8,
  },
  typeColorDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: theme.colors.border,
  },
  colorPopover: {
    position: "absolute",
    left: 36,
    top: 0,
    backgroundColor: theme.colors.surface,
    borderRadius: 10,
    padding: theme.space.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    zIndex: 100,
    ...theme.elevation.md,
    elevation: 8,
  },
  colorSwatchGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    width: 148,
    gap: theme.space.sm,
  },
  colorSwatch: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "transparent",
  },
  colorSwatchSelected: {
    borderColor: theme.colors.text,
  },
  typeSlugInput: {
    ...theme.typography.bodySmall,
    flex: 1,
    backgroundColor: theme.colors.background,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.space.md,
    paddingVertical: theme.space.sm,
    color: theme.colors.text,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  typeSlugInputError: {
    borderColor: theme.colors.danger,
  },
  slugError: {
    ...theme.typography.micro,
    color: theme.colors.danger,
    marginBottom: theme.space.xs,
    marginLeft: 36,
  },
  removeTypeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.colors.background,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  removeTypeButtonDisabled: {
    opacity: 0.35,
  },
  removeTypeButtonText: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
  },
  removeTypeButtonTextDisabled: {
    color: theme.colors.textMuted,
  },
  addTypeButton: {
    marginTop: theme.space.xs,
    paddingVertical: theme.space.sm,
    paddingHorizontal: theme.space.md,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    alignSelf: "flex-start",
  },
  addTypeButtonText: {
    ...theme.typography.label,
    color: theme.colors.primary,
  },
  // ── Pattern toggles ────────────────────────────────────────────────────
  patternToggleRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: theme.space.sm,
    paddingHorizontal: theme.space.xs,
    borderRadius: theme.radius.md,
    marginBottom: theme.space.xs,
    gap: theme.space.md,
  },
  patternToggleRowOff: {
    opacity: 0.4,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: theme.radius.xs,
    borderWidth: 2,
    borderColor: theme.colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  checkmark: {
    ...theme.typography.label,
    color: theme.colors.onPrimary,
    fontWeight: "bold",
  },
  patternToggleInfo: {
    flex: 1,
  },
  patternToggleName: {
    ...theme.typography.bodySmall,
    fontWeight: "500",
    color: theme.colors.text,
  },
  patternToggleNameOff: {
    color: theme.colors.textMuted,
  },
  patternToggleMeta: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: theme.space.xxs,
    gap: theme.space.xs,
  },
  typeColorPip: {
    width: 8,
    height: 8,
    borderRadius: theme.radius.xs,
  },
  patternToggleSlug: {
    ...theme.typography.micro,
    color: theme.colors.textMuted,
    textTransform: "uppercase",
  },
  patternToggleCounts: {
    ...theme.typography.micro,
    color: theme.colors.textMuted,
  },
  // ── Buttons ────────────────────────────────────────────────────────────
  buttonRow: {
    flexDirection: "row",
    gap: theme.space.md,
  },
  footerButton: { flex: 1 },
  cancelButton: {
    marginTop: theme.space.md,
    padding: theme.space.lg,
    alignItems: "center",
  },
  cancelButtonText: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
  },
}));

export default PatternListTemplateModal;
