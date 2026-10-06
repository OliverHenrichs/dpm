import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  loadCorrections,
  rememberCorrections,
} from "@/src/transcribe/data/CorrectionStorage";
import { getTranscriptCorrectionsKey } from "@/src/transcribe/data/CorrectionKeys";

const LIST = "list-1";

describe("transcript correction storage", () => {
  it("remembers fixes per list, newest first", async () => {
    await rememberCorrections(LIST, "a sugar bush", "a sugar push");
    await rememberCorrections(LIST, "the wipe", "the whip");

    expect(await loadCorrections(LIST)).toEqual([
      { from: "wipe", to: "whip" },
      { from: "bush", to: "push" },
    ]);
    expect(await loadCorrections("other")).toEqual([]);
  });

  it("does not lose a fix when two edits overlap", async () => {
    await Promise.all([
      rememberCorrections(LIST, "a sugar bush", "a sugar push"),
      rememberCorrections(LIST, "the wipe", "the whip"),
    ]);

    expect(await loadCorrections(LIST)).toHaveLength(2);
  });

  it("writes nothing for an edit that fixes no word", async () => {
    await rememberCorrections(LIST, "the whip", "The whip!");

    expect(
      await AsyncStorage.getItem(getTranscriptCorrectionsKey(LIST)),
    ).toBeNull();
  });

  it("reads damaged storage as no corrections", async () => {
    await AsyncStorage.setItem(getTranscriptCorrectionsKey(LIST), "{not json");
    expect(await loadCorrections(LIST)).toEqual([]);

    await AsyncStorage.setItem(
      getTranscriptCorrectionsKey(LIST),
      JSON.stringify([{ from: "bush", to: "push" }, { from: 3 }, null]),
    );
    expect(await loadCorrections(LIST)).toEqual([{ from: "bush", to: "push" }]);
  });
});
