import React from "react";
import { router } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import DrawerContent from "@/src/common/components/DrawerContent";
import ListTabsLayout from "@/src/common/components/ListTabsLayout";
import { createTestPatternList } from "@/utils/testFactories";
import {
  fireEvent,
  renderWithProviders,
  screen,
  waitFor,
  within,
} from "@/utils/renderWithProviders";

// expo-router's global mock has no navigators; this stands in for Tabs, rendering each screen's
// title and icon the way the tab bar would.
jest.mock("expo-router", () => {
  const { Text, View } = jest.requireActual("react-native");
  function Tabs({ children }: { children: React.ReactNode }) {
    return <View>{children}</View>;
  }
  Tabs.Screen = function TabScreen({
    name,
    options,
  }: {
    name: string;
    options: {
      title: string;
      tabBarIcon: (p: { color: string; size: number }) => React.ReactNode;
    };
  }) {
    return (
      <View testID={`tab-${name}`}>
        <Text>{options.title}</Text>
        {options.tabBarIcon({ color: "#000000", size: 24 })}
      </View>
    );
  };
  return {
    Tabs,
    router: { navigate: jest.fn() },
    usePathname: () => "/patterns",
    useNavigation: () => ({ openDrawer: jest.fn() }),
  };
});

describe("list tabs", () => {
  it("offers the active list as List, Map and Reels", () => {
    renderWithProviders(<ListTabsLayout />);

    expect(screen.getByTestId("tab-patterns")).toHaveTextContent(/List/);
    expect(screen.getByTestId("tab-graph")).toHaveTextContent(/Map/);
    expect(screen.getByTestId("tab-reels")).toHaveTextContent(/Reels/);
  });
});

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

describe("drawer menu", () => {
  const closeDrawer = jest.fn();
  const menu = () => (
    <SafeAreaProvider initialMetrics={metrics}>
      <DrawerContent navigation={{ closeDrawer }} isOpen />
    </SafeAreaProvider>
  );
  const salsa = createTestPatternList({ id: "salsa", name: "Salsa" });
  const wcs = createTestPatternList({ id: "wcs", name: "West Coast Swing" });

  beforeEach(() => jest.clearAllMocks());

  it("holds Lists, every list and Settings", async () => {
    renderWithProviders(menu(), { lists: [salsa, wcs], activeListId: "wcs" });

    expect(screen.getByText("Lists")).toBeOnTheScreen();
    expect(screen.getByText("Settings")).toBeOnTheScreen();
    expect(await screen.findByText("Salsa")).toBeOnTheScreen();
    expect(screen.getByText("West Coast Swing")).toBeOnTheScreen();
    expect(screen.queryByText("Map")).toBeNull();
  });

  it("highlights the open list", async () => {
    renderWithProviders(menu(), { lists: [salsa, wcs], activeListId: "wcs" });

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "West Coast Swing" }),
      ).toBeSelected(),
    );
    expect(screen.getByRole("button", { name: "Salsa" })).not.toBeSelected();
  });

  it("goes back into the open list from its entry", async () => {
    renderWithProviders(menu(), { lists: [wcs] });

    fireEvent.press(await screen.findByText("West Coast Swing"));

    expect(closeDrawer).toHaveBeenCalled();
    await waitFor(() =>
      expect(router.navigate).toHaveBeenCalledWith("/patterns"),
    );
  });

  it("switches to another list and opens it", async () => {
    renderWithProviders(menu(), { lists: [salsa, wcs], activeListId: "wcs" });

    fireEvent.press(await screen.findByText("Salsa"));

    expect(closeDrawer).toHaveBeenCalled();
    await waitFor(() =>
      expect(router.navigate).toHaveBeenCalledWith("/patterns"),
    );
    expect(screen.getByRole("button", { name: "Salsa" })).toBeSelected();
  });

  it("scrolls only the lists, so Lists and Settings stay in reach", async () => {
    renderWithProviders(menu(), { lists: [salsa, wcs] });

    const scroller = screen.getByTestId("drawer-lists");
    expect(await within(scroller).findByText("Salsa")).toBeOnTheScreen();
    expect(within(scroller).queryByText("Lists")).toBeNull();
    expect(within(scroller).queryByText("Settings")).toBeNull();
  });

  it("shows no lists when there are none", () => {
    renderWithProviders(menu(), {
      activeListId: null,
    });

    fireEvent.press(screen.getByText("Settings"));

    expect(router.navigate).toHaveBeenCalledWith("/settings");
    expect(screen.getAllByRole("button")).toHaveLength(2);
  });
});
