import React, { useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { getPalette, PaletteColor } from "@/src/common/utils/ColorPalette";
import { useTranslation } from "react-i18next";
import { useThemeContext } from "@/src/common/components/ThemeContext";
import {
  createBachataList,
  createBlankList,
  createLindyHopList,
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
  generateUUID,
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

const PatternListTemplateModal: React.FC<PatternListTemplateModalProps> = ({
  visible,
  onClose,
  onCreateList,
  editList,
  usedTypeIds,
  onSaveList,
}) => {
  const { t } = useTranslation();
  const { colorScheme } = useThemeContext();
  const palette = getPalette(colorScheme);
  const styles = getStyles(palette);

  const isEditMode = !!editList; // this operator ensures editList is not undefined or null, treating both as "not in edit mode"

  type Step = "pick" | "configure";
  const [step, setStep] = useState<Step>("pick");
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(
    null,
  );
  const [draftName, setDraftName] = useState("");
  const [draftTypes, setDraftTypes] = useState<PatternType[]>([]);
  const [draftPatterns, setDraftPatterns] = useState<DraftPatternEntry[]>([]);
  const [colorPopoverId, setColorPopoverId] = useState<string | null>(null);

  // When the modal opens in edit mode, seed draft state from the existing list
  useEffect(() => {
    if (visible && isEditMode && editList) {
      setDraftName(editList.name);
      setDraftTypes(editList.patternTypes.map((pt) => ({ ...pt })));
      setDraftPatterns([]);
      setColorPopoverId(null);
      setStep("configure");
    }
    if (!visible) {
      // Reset everything when closed
      setStep("pick");
      setSelectedTemplate(null);
      setDraftName("");
      setDraftTypes([]);
      setDraftPatterns([]);
      setColorPopoverId(null);
    }
  }, [visible, isEditMode, editList]);

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
    const now = Date.now();
    const finalTypes: PatternType[] = draftTypes.map((dt) => ({
      ...dt,
      slug: normalizeSlug(dt.slug),
    }));

    if (isEditMode && editList && onSaveList) {
      // ── Edit path ─────────────────────────────────────────────────────
      const updatedList: IPatternList = {
        ...editList,
        name: draftName.trim(),
        patternTypes: finalTypes,
        updatedAt: now,
      };
      onSaveList(updatedList);
    } else {
      // ── Create path ───────────────────────────────────────────────────
      const newList: IPatternList = {
        id: generateUUID(),
        name: draftName.trim(),
        patternTypes: finalTypes,
        modifiers: [],
        createdAt: now,
        updatedAt: now,
      };
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
          placeholder={t(selectedTemplate?.nameKey ?? "templateBlankName")}
          placeholderTextColor={palette[PaletteColor.SecondaryText]}
          autoFocus
        />

        {/* ── Pattern Types ─────────────────────────────────────────────── */}
        <Text style={[styles.label, { marginTop: 20 }]}>
          {t("patternTypes")}
        </Text>
        {draftTypes.map((dt) => {
          const isInUse = usedTypeIds?.has(dt.id) ?? false;
          return (
            <View key={dt.id} style={styles.typeRow}>
              {/* Color dot → popover */}
              <TouchableOpacity
                onPress={(e) => {
                  e.stopPropagation();
                  setColorPopoverId((prev) => (prev === dt.id ? null : dt.id));
                }}
                style={[styles.typeColorDot, { backgroundColor: dt.color }]}
              />
              {colorPopoverId === dt.id && renderColorPopover(dt.id, dt.color)}

              <TextInput
                style={[
                  styles.typeSlugInput,
                  slugErrors[dt.id] ? styles.typeSlugInputError : undefined,
                ]}
                value={dt.slug}
                onChangeText={(v) => handleTypeSlugChange(dt.id, v)}
                placeholder={t("typeName")}
                placeholderTextColor={palette[PaletteColor.SecondaryText]}
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
          <TouchableOpacity
            style={styles.backButton}
            onPress={isEditMode ? handleClose : () => setStep("pick")}
          >
            <Text style={styles.backButtonText}>
              {isEditMode ? t("cancel") : t("back")}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.createButton,
              !canCreate && styles.createButtonDisabled,
            ]}
            onPress={handleCreate}
            disabled={!canCreate}
          >
            <Text style={styles.createButtonText}>
              {isEditMode ? t("saveChanges") : t("create")}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </Pressable>
  );
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {step === "pick" ? renderPickStep() : renderConfigureStep()}
        </View>
      </View>
    </Modal>
  );
};

const getStyles = (palette: Record<PaletteColor, string>) =>
  StyleSheet.create({
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      justifyContent: "center",
      alignItems: "center",
      padding: 20,
    },
    modalContent: {
      backgroundColor: palette[PaletteColor.Surface],
      borderRadius: 16,
      padding: 24,
      width: "100%",
      maxWidth: 500,
      maxHeight: "88%",
      flexShrink: 1,
    },
    title: {
      fontSize: 22,
      fontWeight: "bold",
      color: palette[PaletteColor.PrimaryText],
      marginBottom: 6,
    },
    subtitle: {
      fontSize: 13,
      color: palette[PaletteColor.SecondaryText],
      marginBottom: 20,
    },
    templateList: {
      maxHeight: 420,
    },
    templateCard: {
      backgroundColor: palette[PaletteColor.CardBackground],
      borderRadius: 12,
      padding: 16,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: palette[PaletteColor.Border],
    },
    templateCardBlank: {
      borderStyle: "dashed",
      borderColor: palette[PaletteColor.Primary],
    },
    templateName: {
      fontSize: 17,
      fontWeight: "600",
      color: palette[PaletteColor.PrimaryText],
      marginBottom: 4,
    },
    templateDescription: {
      fontSize: 13,
      color: palette[PaletteColor.SecondaryText],
    },
    label: {
      fontSize: 13,
      fontWeight: "600",
      color: palette[PaletteColor.PrimaryText],
      marginBottom: 6,
    },
    sectionHint: {
      fontSize: 12,
      color: palette[PaletteColor.SecondaryText],
      marginBottom: 8,
    },
    input: {
      backgroundColor: palette[PaletteColor.Background],
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 16,
      color: palette[PaletteColor.PrimaryText],
      borderWidth: 1,
      borderColor: palette[PaletteColor.Border],
    },
    // ── Type rows ──────────────────────────────────────────────────────────
    typeRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 8,
      gap: 8,
      zIndex: 10,
    },
    typeColorDot: {
      width: 28,
      height: 28,
      borderRadius: 14,
      borderWidth: 2,
      borderColor: palette[PaletteColor.Border],
    },
    colorPopover: {
      position: "absolute",
      left: 36,
      top: 0,
      backgroundColor: palette[PaletteColor.Surface],
      borderRadius: 10,
      padding: 8,
      borderWidth: 1,
      borderColor: palette[PaletteColor.Border],
      zIndex: 100,
      elevation: 8,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 4,
    },
    colorSwatchGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      width: 148,
      gap: 6,
    },
    colorSwatch: {
      width: 28,
      height: 28,
      borderRadius: 14,
      borderWidth: 2,
      borderColor: "transparent",
    },
    colorSwatchSelected: {
      borderColor: palette[PaletteColor.PrimaryText],
    },
    typeSlugInput: {
      flex: 1,
      backgroundColor: palette[PaletteColor.Background],
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 7,
      fontSize: 14,
      color: palette[PaletteColor.PrimaryText],
      borderWidth: 1,
      borderColor: palette[PaletteColor.Border],
    },
    typeSlugInputError: {
      borderColor: palette[PaletteColor.Error],
    },
    slugError: {
      fontSize: 11,
      color: palette[PaletteColor.Error],
      marginBottom: 4,
      marginLeft: 36,
    },
    removeTypeButton: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: palette[PaletteColor.Background],
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: palette[PaletteColor.Border],
    },
    removeTypeButtonDisabled: {
      opacity: 0.35,
    },
    removeTypeButtonText: {
      fontSize: 12,
      color: palette[PaletteColor.SecondaryText],
    },
    removeTypeButtonTextDisabled: {
      color: palette[PaletteColor.SecondaryText],
    },
    addTypeButton: {
      marginTop: 4,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: palette[PaletteColor.Primary],
      alignSelf: "flex-start",
    },
    addTypeButtonText: {
      fontSize: 13,
      color: palette[PaletteColor.Primary],
      fontWeight: "600",
    },
    // ── Pattern toggles ────────────────────────────────────────────────────
    patternToggleRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 8,
      paddingHorizontal: 4,
      borderRadius: 8,
      marginBottom: 4,
      gap: 10,
    },
    patternToggleRowOff: {
      opacity: 0.4,
    },
    checkbox: {
      width: 22,
      height: 22,
      borderRadius: 5,
      borderWidth: 2,
      borderColor: palette[PaletteColor.Border],
      alignItems: "center",
      justifyContent: "center",
    },
    checkboxChecked: {
      backgroundColor: palette[PaletteColor.Primary],
      borderColor: palette[PaletteColor.Primary],
    },
    checkmark: {
      color: "#fff",
      fontSize: 13,
      fontWeight: "bold",
    },
    patternToggleInfo: {
      flex: 1,
    },
    patternToggleName: {
      fontSize: 14,
      fontWeight: "500",
      color: palette[PaletteColor.PrimaryText],
    },
    patternToggleNameOff: {
      color: palette[PaletteColor.SecondaryText],
    },
    patternToggleMeta: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 2,
      gap: 4,
    },
    typeColorPip: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    patternToggleSlug: {
      fontSize: 11,
      color: palette[PaletteColor.SecondaryText],
      textTransform: "uppercase",
    },
    patternToggleCounts: {
      fontSize: 11,
      color: palette[PaletteColor.SecondaryText],
    },
    // ── Buttons ────────────────────────────────────────────────────────────
    buttonRow: {
      flexDirection: "row",
      gap: 12,
    },
    backButton: {
      flex: 1,
      backgroundColor: palette[PaletteColor.Background],
      borderRadius: 8,
      padding: 14,
      alignItems: "center",
      borderWidth: 1,
      borderColor: palette[PaletteColor.Border],
    },
    backButtonText: {
      fontSize: 16,
      fontWeight: "600",
      color: palette[PaletteColor.PrimaryText],
    },
    createButton: {
      flex: 1,
      backgroundColor: palette[PaletteColor.Primary],
      borderRadius: 8,
      padding: 14,
      alignItems: "center",
    },
    createButtonDisabled: {
      opacity: 0.5,
    },
    createButtonText: {
      fontSize: 16,
      fontWeight: "600",
      color: palette[PaletteColor.Surface],
    },
    cancelButton: {
      marginTop: 10,
      padding: 14,
      alignItems: "center",
    },
    cancelButtonText: {
      fontSize: 16,
      color: palette[PaletteColor.SecondaryText],
    },
  });

export default PatternListTemplateModal;
