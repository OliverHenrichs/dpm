import {
  parseSuggestion,
  suggestionMessages,
  vocabularyFor,
} from "@/src/suggest/suggestPrompt";

describe("suggestion prompt (L4 suggestions spike)", () => {
  it("asks for the transcript's language by name", () => {
    const [, user] = suggestionMessages("Das ist der Whip.", "de", ["Whip"]);
    expect(user.content).toContain("Vocabulary: Whip");
    expect(user.content).toContain("Das ist der Whip.");
    expect(user.content).toContain("in German");
  });

  it("falls back to the transcript's own language when it is unknown", () => {
    const [, user] = suggestionMessages("…", "und", []);
    expect(user.content).toContain("Vocabulary: (none)");
    expect(user.content).toContain("language of the transcript");
  });

  it("collects the list's words once each, first spelling wins", () => {
    expect(
      vocabularyFor(
        {
          patternTypes: [
            { id: "1", slug: "whip", color: "#000" },
            { id: "2", slug: "pass", color: "#000" },
          ],
          modifiers: [],
        },
        [{ name: "Whip " }, { name: "Sugar Push" }],
      ),
    ).toEqual(["Whip", "Sugar Push", "pass"]);
  });
});

describe("parseSuggestion", () => {
  it("reads a clean answer", () => {
    expect(
      parseSuggestion('{"name":"Sugar Push","description":"In on 1-2."}'),
    ).toEqual({ name: "Sugar Push", description: "In on 1-2." });
  });

  it("tolerates text around the object and collapses whitespace", () => {
    expect(
      parseSuggestion(
        'Sure!\n```json\n{"name": " Whip ", "description": "Eight\\n counts."}\n```',
      ),
    ).toEqual({ name: "Whip", description: "Eight counts." });
  });

  it("gives empty fields for missing or non-string values", () => {
    expect(parseSuggestion('{"name": 3}')).toEqual({
      name: "",
      description: "",
    });
  });

  it("gives up on something that is not JSON", () => {
    expect(parseSuggestion("I cannot help with that.")).toBeNull();
    expect(parseSuggestion("{name: Whip}")).toBeNull();
  });
});
