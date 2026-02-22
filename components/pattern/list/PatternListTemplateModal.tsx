import React, { useState } from "react";
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { getPalette, PaletteColor } from "@/components/common/ColorPalette";
import { useTranslation } from "react-i18next";
import { useThemeContext } from "@/components/common/ThemeContext";
import {
  createBachataList,
  createSalsaList,
  createTangoList,
  createWestCoastSwingList,
} from "@/components/pattern/data/DefaultPatternLists";
import { PatternList } from "@/components/pattern/types/PatternList";

interface PatternListTemplateModalProps {
  visible: boolean;
  onClose: () => void;
  onCreateList: (list: PatternList) => void;
}

interface Template {
  id: string;
  name: string;
  description: string;
  create: () => PatternList;
}

const TEMPLATES: Template[] = [
  {
    id: "wcs",
    name: "West Coast Swing",
    description: "4 pattern types: Push, Pass, Whip, Tuck",
    create: createWestCoastSwingList,
  },
  {
    id: "salsa",
    name: "Salsa",
    description:
      "5 pattern types: Basic, Cross-body, Right turn, Left turn, Shine",
    create: createSalsaList,
  },
  {
    id: "bachata",
    name: "Bachata",
    description: "4 pattern types: Basic, Turn, Dip, Wave",
    create: createBachataList,
  },
  {
    id: "tango",
    name: "Argentine Tango",
    description: "5 pattern types: Walk, Ochos, Giros, Sacadas, Boleos",
    create: createTangoList,
  },
  {
    id: "lindy",
    name: "Lindy Hop",
    description: "5 pattern types: Walk, Ochos, Giros, Sacadas, Boleos",
    create: createTangoList,
  },
];

const PatternListTemplateModal: React.FC<PatternListTemplateModalProps> = ({
  visible,
  onClose,
  onCreateList,
}) => {
  const { t } = useTranslation();
  const { colorScheme } = useThemeContext();
  const palette = getPalette(colorScheme);
  const styles = getStyles(palette);

  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(
    null,
  );
  const [customName, setCustomName] = useState("");
  const [showNameInput, setShowNameInput] = useState(false);

  const handleSelectTemplate = (template: Template) => {
    setSelectedTemplate(template);
    setCustomName(template.name);
    setShowNameInput(true);
  };

  const handleCreate = () => {
    if (!selectedTemplate) return;

    const newList = selectedTemplate.create();

    // Update name if customized
    if (customName.trim() && customName !== selectedTemplate.name) {
      newList.name = customName.trim();
    }

    onCreateList(newList);
    handleClose();
  };

  const handleClose = () => {
    setSelectedTemplate(null);
    setCustomName("");
    setShowNameInput(false);
    onClose();
  };

  const renderTemplateList = () => (
    <View>
      <Text style={styles.title}>{t("chooseTemplate")}</Text>
      <Text style={styles.subtitle}>{t("chooseTemplateHint")}</Text>

      <ScrollView style={styles.templateList}>
        {TEMPLATES.map((template) => (
          <TouchableOpacity
            key={template.id}
            style={styles.templateCard}
            onPress={() => handleSelectTemplate(template)}
          >
            <Text style={styles.templateName}>{template.name}</Text>
            <Text style={styles.templateDescription}>
              {template.description}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <TouchableOpacity style={styles.cancelButton} onPress={handleClose}>
        <Text style={styles.cancelButtonText}>{t("cancel")}</Text>
      </TouchableOpacity>
    </View>
  );

  const renderNameInput = () => (
    <View>
      <Text style={styles.title}>{t("nameYourList")}</Text>
      <Text style={styles.subtitle}>
        {t("customizeListName", { template: selectedTemplate?.name })}
      </Text>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>{t("listName")}</Text>
        <TextInput
          style={styles.input}
          value={customName}
          onChangeText={setCustomName}
          placeholder={selectedTemplate?.name}
          placeholderTextColor={palette[PaletteColor.SecondaryText]}
          autoFocus
        />
      </View>

      {selectedTemplate && (
        <View style={styles.previewContainer}>
          <Text style={styles.label}>{t("patternTypes")}:</Text>
          <View style={styles.typeColorRow}>
            {selectedTemplate.create().patternTypes.map((type) => (
              <View key={type.id} style={styles.typeChip}>
                <View
                  style={[styles.typeColorDot, { backgroundColor: type.color }]}
                />
                <Text style={styles.typeSlug}>{type.slug}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => setShowNameInput(false)}
        >
          <Text style={styles.backButtonText}>{t("back")}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.createButton,
            !customName.trim() && styles.createButtonDisabled,
          ]}
          onPress={handleCreate}
          disabled={!customName.trim()}
        >
          <Text style={styles.createButtonText}>{t("create")}</Text>
        </TouchableOpacity>
      </View>
    </View>
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
          {showNameInput ? renderNameInput() : renderTemplateList()}
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
      maxHeight: "80%",
    },
    title: {
      fontSize: 24,
      fontWeight: "bold",
      color: palette[PaletteColor.PrimaryText],
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 14,
      color: palette[PaletteColor.SecondaryText],
      marginBottom: 24,
    },
    templateList: {
      maxHeight: 400,
    },
    templateCard: {
      backgroundColor: palette[PaletteColor.CardBackground],
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: palette[PaletteColor.Border],
    },
    templateName: {
      fontSize: 18,
      fontWeight: "600",
      color: palette[PaletteColor.PrimaryText],
      marginBottom: 4,
    },
    templateDescription: {
      fontSize: 14,
      color: palette[PaletteColor.SecondaryText],
    },
    inputContainer: {
      marginBottom: 24,
    },
    label: {
      fontSize: 14,
      fontWeight: "600",
      color: palette[PaletteColor.PrimaryText],
      marginBottom: 8,
    },
    input: {
      backgroundColor: palette[PaletteColor.Background],
      borderRadius: 8,
      padding: 12,
      fontSize: 16,
      color: palette[PaletteColor.PrimaryText],
      borderWidth: 1,
      borderColor: palette[PaletteColor.Border],
    },
    previewContainer: {
      marginBottom: 24,
    },
    typeColorRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginTop: 8,
    },
    typeChip: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: palette[PaletteColor.CardBackground],
      borderRadius: 16,
      paddingHorizontal: 12,
      paddingVertical: 6,
      gap: 6,
    },
    typeColorDot: {
      width: 12,
      height: 12,
      borderRadius: 6,
    },
    typeSlug: {
      fontSize: 12,
      color: palette[PaletteColor.PrimaryText],
      textTransform: "uppercase",
    },
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
      marginTop: 12,
      padding: 14,
      alignItems: "center",
    },
    cancelButtonText: {
      fontSize: 16,
      color: palette[PaletteColor.SecondaryText],
    },
  });

export default PatternListTemplateModal;
