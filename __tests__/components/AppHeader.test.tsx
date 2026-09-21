import React from "react";
import { StyleSheet } from "react-native";
import { router } from "expo-router";
import AppHeader from "@/src/common/components/AppHeader";
import { createTestPatternList } from "@/utils/testFactories";
import {
  fireEvent,
  renderWithProviders,
  screen,
  waitFor,
} from "@/utils/renderWithProviders";

const flatten = (style: unknown) =>
  (StyleSheet.flatten(style as never) ?? {}) as Record<string, unknown>;

describe("AppHeader", () => {
  describe("home button", () => {
    it("navigates home when pressed", () => {
      renderWithProviders(<AppHeader />);

      fireEvent.press(screen.getByLabelText("Go to dances"));

      expect(router.navigate).toHaveBeenCalledWith("/");
    });

    it("is a button to assistive technology", () => {
      renderWithProviders(<AppHeader />);

      expect(
        screen.getByLabelText("Go to dances").props.accessibilityRole,
      ).toBe("button");
    });

    it("is at least 48dp square before hit slop", () => {
      renderWithProviders(<AppHeader />);

      const style = flatten(screen.getByLabelText("Go to dances").props.style);
      expect(style.width).toBeGreaterThanOrEqual(48);
      expect(style.height).toBeGreaterThanOrEqual(48);
    });
  });

  describe("menu button", () => {
    it("is a button to assistive technology", () => {
      renderWithProviders(<AppHeader />);

      expect(screen.getByLabelText("Open menu").props.accessibilityRole).toBe(
        "button",
      );
    });

    it("is the same size as the home button, so the title centres on screen", () => {
      renderWithProviders(<AppHeader />);

      const home = flatten(screen.getByLabelText("Go to dances").props.style);
      const menu = flatten(screen.getByLabelText("Open menu").props.style);
      expect(menu.width).toBe(home.width);
    });
  });

  describe("title", () => {
    it("shows the screen name", async () => {
      // usePathname is mocked to "/patterns", which shows the active list.
      renderWithProviders(<AppHeader />, {
        lists: [createTestPatternList({ name: "West Coast Swing" })],
      });

      await waitFor(() =>
        expect(screen.getByText("West Coast Swing")).toBeOnTheScreen(),
      );
    });

    /**
     * A structural guard, not a behavioural one: RNTL has no layout engine, so
     * no test here can detect that one view covers another.
     *
     * The title used to be absolutely positioned across the full header width,
     * relying on `pointerEvents: "none"` to stay out of the way — but that is a
     * View style prop and RN's Text never implements it, so it sat on top of
     * the home button and swallowed most taps. Pinning "the title is laid out
     * in flow" is the closest a unit test can get to preventing a repeat; the
     * real check is tapping the icon on a device.
     */
    it("is laid out in flow rather than over the buttons", async () => {
      renderWithProviders(<AppHeader />, {
        lists: [createTestPatternList({ name: "West Coast Swing" })],
      });

      const style = flatten(
        (await screen.findByText("West Coast Swing")).props.style,
      );
      expect(style.position).not.toBe("absolute");
      expect(style.flex).toBe(1);
    });
  });
});
