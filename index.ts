// Themes have to be registered before any screen module calls
// `StyleSheet.create`, and expo-router loads every route as soon as it starts.
import "@/src/common/theme/unistyles";
import "expo-router/entry";
