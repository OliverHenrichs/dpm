import React from "react";
import { StyleSheet } from "react-native";
import * as Haptics from "expo-haptics";
import {
  AppText,
  Button,
  Card,
  Chip,
  IconButton,
  ListRow,
  SegmentedControl,
  Tappable,
} from "@/src/common/ui";
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

describe("ListRow", () => {
  it("is a named button, and not interactive without a handler", () => {
    const onPress = jest.fn();
    const { rerender } = render(
      <ListRow title="Settings" subtitle="App preferences" onPress={onPress} />,
    );
    fireEvent.press(screen.getByRole("button", { name: "Settings" }));
    expect(onPress).toHaveBeenCalled();
    expect(screen.getByText("App preferences")).toBeOnTheScreen();

    rerender(<ListRow title="Settings" />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("is a radio in a single choice, and ticks when chosen", () => {
    render(
      <>
        <ListRow
          title="English"
          selection="single"
          selected
          onPress={jest.fn()}
        />
        <ListRow title="Deutsch" selection="single" onPress={jest.fn()} />
      </>,
    );
    expect(
      screen.getByRole("radio", { name: "English" }).props.accessibilityState,
    ).toMatchObject({ checked: true, selected: true });
    expect(
      screen.getByRole("radio", { name: "Deutsch" }).props.accessibilityState,
    ).toMatchObject({ checked: false });
  });

  it("is a checkbox in a multiple choice, with a selection tick on press", () => {
    const onPress = jest.fn();
    render(<ListRow title="Salsa" selection="multiple" onPress={onPress} />);
    fireEvent.press(screen.getByRole("checkbox", { name: "Salsa" }));
    expect(onPress).toHaveBeenCalled();
    expect(Haptics.selectionAsync).toHaveBeenCalled();
  });

  it("announces whether it is expanded", () => {
    render(<ListRow title="Whip" expanded onPress={jest.fn()} />);
    expect(
      screen.getByRole("button", { name: "Whip" }).props.accessibilityState,
    ).toMatchObject({ expanded: true });
  });

  it("keeps trailing controls separately pressable", () => {
    const onRow = jest.fn();
    const onEdit = jest.fn();
    render(
      <ListRow
        title="Whip"
        onPress={onRow}
        trailing={
          <IconButton
            icon="pencil"
            accessibilityLabel="Edit"
            onPress={onEdit}
          />
        }
      />,
    );
    fireEvent.press(screen.getByLabelText("Edit"));
    expect(onEdit).toHaveBeenCalled();
    expect(onRow).not.toHaveBeenCalled();
  });
});

describe("SegmentedControl", () => {
  const segments = [
    { value: "a" as const, label: "Patterns" },
    { value: "b" as const, label: "Modifiers", count: 3 },
  ];

  it("announces tabs, with the count in the name", () => {
    render(
      <SegmentedControl segments={segments} value="a" onChange={jest.fn()} />,
    );
    expect(
      screen.getByRole("tab", { name: "Patterns" }).props.accessibilityState,
    ).toMatchObject({ selected: true });
    expect(
      screen.getByRole("tab", { name: "Modifiers (3)" }),
    ).toBeOnTheScreen();
  });

  it("changes on another segment, and ignores the current one", () => {
    const onChange = jest.fn();
    render(
      <SegmentedControl segments={segments} value="a" onChange={onChange} />,
    );
    fireEvent.press(screen.getByRole("tab", { name: "Patterns" }));
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.press(screen.getByRole("tab", { name: "Modifiers (3)" }));
    expect(onChange).toHaveBeenCalledWith("b");
  });

  it("is a radio group when it sets a value", () => {
    render(
      <SegmentedControl
        kind="choice"
        segments={segments}
        value="b"
        onChange={jest.fn()}
      />,
    );
    expect(
      screen.getByRole("radio", { name: "Modifiers (3)" }).props
        .accessibilityState,
    ).toMatchObject({ checked: true });
  });
});

describe("Chip extras", () => {
  it("shows a badge, and removes from its own button without selecting", () => {
    const onPress = jest.fn();
    const onRemove = jest.fn();
    render(
      <Chip
        label="with a spin"
        badge="Prefix"
        onPress={onPress}
        onRemove={onRemove}
        removeLabel="Detach modifier: with a spin"
      />,
    );
    expect(screen.getByText("Prefix")).toBeOnTheScreen();

    fireEvent.press(screen.getByLabelText("Detach modifier: with a spin"));
    expect(onRemove).toHaveBeenCalled();
    expect(onPress).not.toHaveBeenCalled();
  });
});

describe("Tappable", () => {
  it("is a named button around content that has no text", () => {
    const onPress = jest.fn();
    render(
      <Tappable accessibilityLabel="Go to dances" onPress={onPress}>
        <AppText>logo</AppText>
      </Tappable>,
    );
    fireEvent.press(screen.getByRole("button", { name: "Go to dances" }));
    expect(onPress).toHaveBeenCalled();
  });

  it("says when it is disabled, and does not press", () => {
    const onPress = jest.fn();
    render(
      <Tappable accessibilityLabel="Video 1" onPress={onPress} disabled>
        <AppText>thumb</AppText>
      </Tappable>,
    );
    const target = screen.getByLabelText("Video 1");
    fireEvent.press(target);
    expect(onPress).not.toHaveBeenCalled();
    expect(target.props.accessibilityState).toMatchObject({ disabled: true });
  });
});

describe("variants over media and for removal", () => {
  it("puts a media button on the scrim, whatever the theme", () => {
    render(<Button title="Cancel" variant="media" onPress={jest.fn()} />);
    const style = StyleSheet.flatten(
      screen.getByRole("button", { name: "Cancel" }).props.style,
    );
    expect(style.backgroundColor).toBe(lightTheme.media.scrim);
  });

  it("fills a danger icon button with the danger colour", () => {
    render(
      <IconButton
        icon="close"
        variant="filled"
        color="danger"
        accessibilityLabel="Remove video"
        onPress={jest.fn()}
      />,
    );
    const style = StyleSheet.flatten(
      screen.getByLabelText("Remove video").props.style,
    );
    expect(style.backgroundColor).toBe(lightTheme.colors.danger);
  });
});
