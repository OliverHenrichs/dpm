import React, { useCallback, useState } from "react";
import {
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { PatternList } from "@/components/pattern/types/PatternList";
import {
  deletePatternList,
  loadAllPatternLists,
  savePatternList,
} from "@/components/pattern/data/PatternListStorage";
import { useActivePatternList } from "@/components/pattern/context/ActivePatternListContext";
import { useThemeContext } from "@/components/common/ThemeContext";
import { getPalette, PaletteColor } from "@/components/common/ColorPalette";
import { getCommonListContainer } from "@/components/common/CommonStyles";
import { useTranslation } from "react-i18next";
import PageContainer from "@/components/common/PageContainer";
import AppHeader from "@/components/common/AppHeader";
import PlusButton from "@/components/common/PlusButton";
import SectionHeader from "@/components/common/SectionHeader";
import PatternListTemplateModal from "./PatternListTemplateModal";

const PatternListSelector: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { t } = useTranslation();
  const { colorScheme } = useThemeContext();
  const palette = getPalette(colorScheme);
  const styles = getStyles(palette);
  const { activeList, setActiveList, refreshActiveList } =
    useActivePatternList();

  const [patternLists, setPatternLists] = useState<PatternList[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);

  const loadLists = useCallback(async () => {
    setIsLoading(true);
    try {
      const lists = await loadAllPatternLists();
      setPatternLists(lists);
    } catch (error) {
      console.error("Error loading pattern lists:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadLists();
    }, [loadLists]),
  );

  const handleSelectList = async (list: PatternList) => {
    await setActiveList(list);
    navigation.navigate("Patterns");
  };

  const handleDeleteList = (list: PatternList) => {
    Alert.alert(
      t("deletePatternList"),
      t("deletePatternListConfirm", { name: list.name }),
      [
        { text: t("cancel"), style: "cancel" },
        {
          text: t("delete"),
          style: "destructive",
          onPress: async () => {
            try {
              await deletePatternList(list.id);
              await loadLists();
              await refreshActiveList();
            } catch {
              Alert.alert(t("error"), t("errorDeletingList"));
            }
          },
        },
      ],
    );
  };

  const handleCreateList = async (newList: PatternList) => {
    try {
      console.log("Creating new pattern list:", newList.id, newList.name);
      await savePatternList(newList);
      await loadLists();
      await setActiveList(newList);
      navigation.navigate("Patterns");
    } catch (error) {
      console.error("Error creating list:", error);
      Alert.alert(t("error"), t("errorCreatingList"));
    }
  };

  const renderListItem = ({ item }: { item: PatternList }) => {
    const isActive = activeList?.id === item.id;

    return (
      <TouchableOpacity
        style={[styles.listCard, isActive && styles.listCardActive]}
        onPress={() => handleSelectList(item)}
        onLongPress={() => handleDeleteList(item)}
      >
        <View style={styles.listCardContent}>
          <Text style={[styles.listName, isActive && styles.listNameActive]}>
            {item.name}
          </Text>
          <View style={styles.typeColorRow}>
            {item.patternTypes.slice(0, 4).map((type) => (
              <View
                key={type.id}
                style={[styles.typeColorDot, { backgroundColor: type.color }]}
              />
            ))}
          </View>
        </View>
        {isActive && <Text style={styles.activeIndicator}>✓</Text>}
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>{t("noPatternLists")}</Text>
      <Text style={styles.emptySubtext}>{t("noPatternListsHint")}</Text>
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <PageContainer
        style={{ backgroundColor: palette[PaletteColor.Background] }}
      >
        <AppHeader />
        <View style={styles.container}>
          <SectionHeader
            title={t("patternLists")}
            rightActions={
              <PlusButton
                onPress={() => setShowTemplateModal(true)}
                palette={palette}
                accessibilityLabel={t("createPatternList")}
              />
            }
          />

          <FlatList
            data={patternLists}
            renderItem={renderListItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContainer}
            ListEmptyComponent={renderEmptyState}
            refreshing={isLoading}
            onRefresh={loadLists}
          />
        </View>

        <PatternListTemplateModal
          visible={showTemplateModal}
          onClose={() => setShowTemplateModal(false)}
          onCreateList={handleCreateList}
        />
      </PageContainer>
    </View>
  );
};

const getStyles = (palette: Record<PaletteColor, string>) =>
  StyleSheet.create({
    container: {
      ...getCommonListContainer(palette),
      flex: 1,
    },
    listContainer: {
      paddingHorizontal: 8,
      paddingVertical: 8,
      gap: 12,
    },
    listCard: {
      backgroundColor: palette[PaletteColor.CardBackground],
      borderRadius: 12,
      padding: 16,
      borderWidth: 2,
      borderColor: "transparent",
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    listCardActive: {
      borderColor: palette[PaletteColor.Primary],
      backgroundColor: palette[PaletteColor.Primary] + "15",
    },
    listCardContent: {
      flex: 1,
    },
    listName: {
      fontSize: 18,
      fontWeight: "600",
      color: palette[PaletteColor.PrimaryText],
      marginBottom: 4,
    },
    listNameActive: {
      color: palette[PaletteColor.Primary],
    },
    listStyle: {
      fontSize: 12,
      color: palette[PaletteColor.SecondaryText],
      marginBottom: 8,
    },
    typeColorRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    typeColorDot: {
      width: 16,
      height: 16,
      borderRadius: 8,
    },
    moreTypes: {
      fontSize: 12,
      color: palette[PaletteColor.SecondaryText],
      marginLeft: 4,
    },
    activeIndicator: {
      fontSize: 24,
      color: palette[PaletteColor.Primary],
      fontWeight: "bold",
    },
    emptyContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingVertical: 64,
    },
    emptyText: {
      fontSize: 18,
      fontWeight: "600",
      color: palette[PaletteColor.SecondaryText],
      marginBottom: 8,
    },
    emptySubtext: {
      fontSize: 14,
      color: palette[PaletteColor.SecondaryText],
      textAlign: "center",
    },
  });

export default PatternListSelector;
