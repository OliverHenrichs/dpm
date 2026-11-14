import {
  ASK_AGAIN_DAYS,
  decideUpdatePrompt,
  loadUpdateAsked,
  saveUpdateAsked,
} from "@/src/changelog/appUpdate";
import type { UpdateCheck } from "@/modules/app-update";
import { seedAsyncStorage } from "@/__mocks__/@react-native-async-storage/async-storage";

const DAY = 24 * 60 * 60 * 1000;
const now = 1_000 * DAY;

const check = (over: Partial<UpdateCheck> = {}): UpdateCheck => ({
  available: true,
  flexibleAllowed: true,
  availableVersionCode: 42,
  stalenessDays: 1,
  status: "unknown",
  ...over,
});

describe("decideUpdatePrompt", () => {
  it("asks about a new version the user was never asked about", () => {
    expect(decideUpdatePrompt({ check: check(), asked: null, now })).toBe(
      "ask",
    );
  });

  it("offers a restart for an update downloaded earlier", () => {
    expect(
      decideUpdatePrompt({
        check: check({ available: false, status: "downloaded" }),
        asked: { versionCode: 42, at: now },
        now,
      }),
    ).toBe("restart");
  });

  it("does nothing without an update, or when Play won't run the flexible flow", () => {
    expect(
      decideUpdatePrompt({
        check: check({ available: false }),
        asked: null,
        now,
      }),
    ).toBe("none");
    expect(
      decideUpdatePrompt({
        check: check({ flexibleAllowed: false }),
        asked: null,
        now,
      }),
    ).toBe("none");
  });

  it("does not ask again while an update is downloading", () => {
    for (const status of ["pending", "downloading", "installing"] as const) {
      expect(
        decideUpdatePrompt({ check: check({ status }), asked: null, now }),
      ).toBe("none");
    }
  });

  it("waits a week before asking again about the same version", () => {
    const asked = { versionCode: 42, at: now - (ASK_AGAIN_DAYS - 1) * DAY };
    expect(decideUpdatePrompt({ check: check(), asked, now })).toBe("none");
    expect(
      decideUpdatePrompt({
        check: check(),
        asked,
        now: now + 2 * DAY,
      }),
    ).toBe("ask");
  });

  it("asks at once about a newer version than the one declined", () => {
    expect(
      decideUpdatePrompt({
        check: check({ availableVersionCode: 43 }),
        asked: { versionCode: 42, at: now },
        now,
      }),
    ).toBe("ask");
  });
});

describe("update prompt storage", () => {
  it("round-trips when the dialog was shown", async () => {
    await saveUpdateAsked({ versionCode: 42, at: now });
    expect(await loadUpdateAsked()).toEqual({ versionCode: 42, at: now });
  });

  it("treats a missing or garbled value as never asked", async () => {
    expect(await loadUpdateAsked()).toBeNull();
    seedAsyncStorage({ "@updatePromptAsked": "{not json" });
    expect(await loadUpdateAsked()).toBeNull();
    seedAsyncStorage({ "@updatePromptAsked": '{"versionCode":"42"}' });
    expect(await loadUpdateAsked()).toBeNull();
  });
});
