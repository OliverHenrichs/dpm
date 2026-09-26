import React from "react";
import { StyleSheet } from "react-native";
import * as Haptics from "expo-haptics";
import { AppText, Button, Card, Chip, IconButton } from "@/src/common/ui";
import { lightTheme } from "@/src/common/theme/tokens";
import DesignGallery from "@/src/common/ui/DesignGallery";
import {
  act,
  fireEvent,
  render,
  renderWithProviders,
  screen,
} from "@/utils/renderWithProviders";

describe("Button", () => {
  it("presses, and exposes itself as a button", () => {
    const onPress = jest.fn();
    render(<Button title="Save" onPress={onPress} />);
    fireEvent.press(screen.getByRole("button", { name: "Save" }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("does not press while disabled, and says so", () => {
    const onPress = jest.fn();
    render(<Button title="Save" onPress={onPress} disabled />);
    const button = screen.getByRole("button", { name: "Save" });
    fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
    expect(button.props.accessibilityState).toMatchObject({ disabled: true });
  });

  it("blocks presses and reports busy while loading", () => {
    const onPress = jest.fn();
    render(<Button title="Upload" onPress={onPress} loading />);
    const button = screen.getByRole("button", { name: "Upload" });
    fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
    expect(button.props.accessibilityState).toMatchObject({
      disabled: true,
      busy: true,
    });
  });

  it("buzzes for a destructive action only", () => {
    render(
      <>
        <Button title="Save" onPress={jest.fn()} />
        <Button title="Delete" variant="danger" onPress={jest.fn()} />
      </>,
    );
    fireEvent.press(screen.getByText("Save"));
    expect(Haptics.impactAsync).not.toHaveBeenCalled();
    fireEvent.press(screen.getByText("Delete"));
    expect(Haptics.impactAsync).toHaveBeenCalledTimes(1);
  });
});

describe("IconButton", () => {
  it("is announced by its label", () => {
    const onPress = jest.fn();
    render(
      <IconButton icon="sort" accessibilityLabel="Sort" onPress={onPress} />,
    );
    fireEvent.press(screen.getByRole("button", { name: "Sort" }));
    expect(onPress).toHaveBeenCalled();
  });

  it("reaches the minimum touch target through hitSlop, at any icon size", () => {
    for (const size of [16, 24]) {
      const { unmount } = render(
        <IconButton
          icon="close"
          accessibilityLabel="Close"
          size={size}
          onPress={jest.fn()}
        />,
      );
      const button = screen.getByLabelText("Close");
      const { padding } = StyleSheet.flatten(button.props.style);
      const { top, bottom } = button.props.hitSlop;
      expect(size + padding * 2 + top + bottom).toBeGreaterThanOrEqual(
        lightTheme.touchTarget,
      );
      unmount();
    }
  });
});

describe("Chip", () => {
  it("reports its selection, and gives a selection tick", () => {
    const onPress = jest.fn();
    render(<Chip label="Beginner" selected onPress={onPress} />);
    const chip = screen.getByRole("button", { name: "Beginner" });
    expect(chip.props.accessibilityState).toMatchObject({ selected: true });
    fireEvent.press(chip);
    expect(onPress).toHaveBeenCalled();
    expect(Haptics.selectionAsync).toHaveBeenCalled();
  });

  it("is unselected by default", () => {
    render(<Chip label="Advanced" onPress={jest.fn()} />);
    expect(
      screen.getByRole("button", { name: "Advanced" }).props.accessibilityState,
    ).toMatchObject({ selected: false });
  });
});

describe("Card", () => {
  it("is plain content without a handler", () => {
    render(
      <Card>
        <AppText>Inside</AppText>
      </Card>,
    );
    expect(screen.getByText("Inside")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("becomes one button with a handler", () => {
    const onPress = jest.fn();
    render(
      <Card onPress={onPress} accessibilityLabel="Salsa list" selected>
        <AppText>Salsa</AppText>
      </Card>,
    );
    const card = screen.getByRole("button", { name: "Salsa list" });
    expect(card.props.accessibilityState).toMatchObject({ selected: true });
    fireEvent.press(card);
    expect(onPress).toHaveBeenCalled();
  });
});

describe("AppText", () => {
  it("takes the variant's text style and the colour role", () => {
    render(
      <AppText variant="title" color="textMuted">
        Heading
      </AppText>,
    );
    const style = StyleSheet.flatten(screen.getByText("Heading").props.style);
    expect(style.fontSize).toBe(lightTheme.typography.title.fontSize);
    expect(style.color).toBe(lightTheme.colors.textMuted);
  });
});

describe("DesignGallery", () => {
  it("renders every primitive, and switches the theme from its chips", async () => {
    renderWithProviders(<DesignGallery />);
    expect(await screen.findByText("dangerOutline")).toBeOnTheScreen();
    expect(screen.getByText("Selected and pressable")).toBeOnTheScreen();

    fireEvent.press(screen.getByRole("button", { name: "dark" }));
    expect(
      screen.getByRole("button", { name: "dark" }).props.accessibilityState,
    ).toMatchObject({ selected: true });
  });

  it("toggles its sample chips and runs the loading button", () => {
    jest.useFakeTimers();
    renderWithProviders(<DesignGallery />);
    fireEvent.press(screen.getByRole("button", { name: "Bachata" }));
    expect(
      screen.getByRole("button", { name: "Bachata" }).props.accessibilityState,
    ).toMatchObject({ selected: true });
    fireEvent.press(screen.getByRole("button", { name: "Salsa" }));
    expect(
      screen.getByRole("button", { name: "Salsa" }).props.accessibilityState,
    ).toMatchObject({ selected: false });

    fireEvent.press(screen.getByText("Tap to load"));
    expect(screen.getByText("Working")).toBeOnTheScreen();
    act(() => jest.advanceTimersByTime(1500));
    expect(screen.getByText("Tap to load")).toBeOnTheScreen();
    jest.useRealTimers();
  });
});
