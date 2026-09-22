import React from "react";
import { Pressable, Text } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import {
  ThemeProvider,
  useThemeContext,
} from "@/src/common/components/ThemeContext";
import {
  peekAsyncStorage,
  seedAsyncStorage,
} from "@/__mocks__/@react-native-async-storage/async-storage";

function Probe() {
  const { theme, setTheme } = useThemeContext();
  return (
    <>
      <Text testID="theme">{theme}</Text>
      <Pressable onPress={() => setTheme("light")}>
        <Text>choose light</Text>
      </Pressable>
    </>
  );
}

function renderTheme(onRestored = jest.fn()) {
  render(
    <ThemeProvider onRestored={onRestored}>
      <Probe />
    </ThemeProvider>,
  );
  return onRestored;
}

describe("ThemeProvider persistence", () => {
  it("comes up in the stored theme", async () => {
    seedAsyncStorage({ "@theme": "dark" });

    const onRestored = renderTheme();

    await waitFor(() => expect(onRestored).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId("theme")).toHaveTextContent("dark");
  });

  it("follows the system when nothing was ever chosen", async () => {
    const onRestored = renderTheme();

    await waitFor(() => expect(onRestored).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId("theme")).toHaveTextContent("system");
  });

  it("stores a choice", async () => {
    const onRestored = renderTheme();
    await waitFor(() => expect(onRestored).toHaveBeenCalled());

    fireEvent.press(screen.getByText("choose light"));

    await waitFor(() => expect(peekAsyncStorage()["@theme"]).toBe("light"));
    expect(screen.getByTestId("theme")).toHaveTextContent("light");
  });

  it("does not let a slow read undo a choice made meanwhile", async () => {
    seedAsyncStorage({ "@theme": "dark" });
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const realGetItem = AsyncStorage.getItem.bind(AsyncStorage);
    jest.spyOn(AsyncStorage, "getItem").mockImplementationOnce(async (key) => {
      await gate;
      return realGetItem(key);
    });

    const onRestored = renderTheme();
    fireEvent.press(screen.getByText("choose light"));
    release();

    await waitFor(() => expect(onRestored).toHaveBeenCalled());
    expect(screen.getByTestId("theme")).toHaveTextContent("light");
  });

  it("still reports restored when storage cannot be read", async () => {
    const consoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});
    jest
      .spyOn(AsyncStorage, "getItem")
      .mockRejectedValueOnce(new Error("store unavailable"));

    const onRestored = renderTheme();

    await waitFor(() => expect(onRestored).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId("theme")).toHaveTextContent("system");
    consoleError.mockRestore();
  });
});
