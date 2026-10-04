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
      <DrawerContent navigation={{ closeDrawer }} />
    </SafeAreaProvider>
  );

  it("holds the lists, the open list and Settings", async () => {
    renderWithProviders(menu(), {
      lists: [createTestPatternList({ name: "West Coast Swing" })],
    });

    expect(screen.getByText("Lists")).toBeOnTheScreen();
    expect(screen.getByText("Settings")).toBeOnTheScreen();
    await waitFor(() =>
      expect(screen.getByText("West Coast Swing")).toBeOnTheScreen(),
    );
    expect(screen.queryByText("Map")).toBeNull();
  });

  it("goes back into the open list from its entry", async () => {
    renderWithProviders(menu(), {
      lists: [createTestPatternList({ name: "West Coast Swing" })],
    });

    fireEvent.press(await screen.findByText("West Coast Swing"));

    expect(closeDrawer).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith("/patterns");
  });

  it("leaves the open list out when there is none", () => {
    renderWithProviders(menu(), {
      activeListId: null,
    });

    fireEvent.press(screen.getByText("Settings"));

    expect(router.navigate).toHaveBeenCalledWith("/settings");
    expect(screen.getAllByRole("button")).toHaveLength(2);
  });
});
