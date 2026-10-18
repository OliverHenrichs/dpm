import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  dismissDragHint,
  isDragHintDismissed,
  isLegendSeen,
  markLegendSeen,
} from "@/src/pattern/graph/data/GraphHintStorage";

describe("GraphHintStorage", () => {
  beforeEach(() => jest.spyOn(console, "error").mockImplementation(() => {}));
  afterEach(() => jest.restoreAllMocks());

  it("remembers the legend was seen", async () => {
    expect(await isLegendSeen()).toBe(false);
    await markLegendSeen();
    expect(await isLegendSeen()).toBe(true);
  });

  it("counts an unreadable legend state as seen, so it never opens uninvited", async () => {
    jest.spyOn(AsyncStorage, "getItem").mockRejectedValue(new Error("io"));

    expect(await isLegendSeen()).toBe(true);
  });

  it("shows the drag hint again when its state is unreadable", async () => {
    jest.spyOn(AsyncStorage, "getItem").mockRejectedValue(new Error("io"));

    expect(await isDragHintDismissed()).toBe(false);
  });

  it("survives a failed write", async () => {
    jest.spyOn(AsyncStorage, "setItem").mockRejectedValue(new Error("io"));

    await expect(markLegendSeen()).resolves.toBeUndefined();
    await expect(dismissDragHint()).resolves.toBeUndefined();
  });
});
