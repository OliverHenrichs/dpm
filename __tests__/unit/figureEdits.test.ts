import {
  applyFigureChanges,
  ChangeLine,
  figureChanges,
} from "@/src/pattern/suggestions/figureEdits";
import { suggestedPattern } from "@/src/pattern/suggestions/suggestions";
import { IPattern, IVideoReference } from "@/src/pattern/types/IPatternList";
import {
  createTestPattern,
  createTestPatternList,
} from "@/utils/testFactories";

const list = createTestPatternList({
  modifiers: [
    {
      id: "inside-turn",
      name: "with Inside Turn",
      position: "amends",
      universal: false,
      videoRefs: [],
    },
    {
      id: "hesitation",
      name: "with Hesitation",
      position: "amends",
      universal: true,
      videoRefs: [],
    },
  ],
});
const [push, pass] = list.patternTypes.map((t) => t.id) as [string, string];

const video = (value: string, startTime?: number): IVideoReference => ({
  type: "url",
  value,
  ...(startTime !== undefined && { startTime }),
});

const sugarPush = createTestPattern(push, { id: 1, name: "Sugar Push" });
const sugarTuck = createTestPattern(push, {
  id: 2,
  name: "Sugar Tuck",
  counts: 6,
  rhythm: "1 2 3&4 5&6",
  level: "beginner",
  prerequisites: [1],
  description: "A sugar push whose tuck sends the follower into a turn.",
  tags: ["Beginner course 2026"],
  videoRefs: [video("https://youtu.be/tuck", 12)],
});
const whip = createTestPattern(pass, {
  id: 3,
  name: "Whip",
  prerequisites: [2],
});
const patterns = [sugarPush, sugarTuck, whip];

/** The base a subscriber's copy sends: the figure as published. */
const base = suggestedPattern(sugarTuck);

const changes = (
  suggested: Partial<IPattern>,
  current: IPattern = sugarTuck,
  from: unknown = base,
) =>
  figureChanges(
    from,
    suggestedPattern({ ...sugarTuck, ...suggested }),
    current,
    list,
    patterns,
  );

const ids = (lines: ChangeLine[]) => lines.map((l) => l.id);

describe("figureChanges", () => {
  it("finds nothing when nothing was changed", () => {
    expect(changes({})).toEqual([]);
  });

  it("lists each changed field once, and counts with their rhythm", () => {
    const lines = changes({
      name: "Sugar Tuck (traveling)",
      counts: 8,
      rhythm: "1 2 3&4 5 6 7&8",
      description: "Travels down the slot.",
    });
    expect(ids(lines)).toEqual(["name", "counts", "description"]);
    expect(lines[1]).toMatchObject({
      kind: "counts",
      from: { counts: 6, rhythm: "1 2 3&4 5&6" },
      to: { counts: 8, rhythm: "1 2 3&4 5 6 7&8" },
    });
    expect(lines.some((l) => l.changedSince)).toBe(false);
  });

  it("splits list fields into one line per item added or removed", () => {
    const lines = changes({
      tags: ["Festival weekend"],
      prerequisites: [],
      videoRefs: [
        video("https://youtu.be/tuck", 12),
        video("https://vimeo.com/42"),
      ],
    });
    expect(ids(lines)).toEqual([
      "tag:add:Festival weekend",
      "tag:remove:Beginner course 2026",
      "prerequisite:remove:1",
      "video:add:https://vimeo.com/42",
    ]);
  });

  it("removes a video", () => {
    expect(ids(changes({ videoRefs: [] }))).toEqual([
      "video:remove:https://youtu.be/tuck",
    ]);
  });

  it("shows a new start time as a change of the same video", () => {
    const lines = changes({ videoRefs: [video("https://youtu.be/tuck", 40)] });
    expect(lines).toEqual([
      expect.objectContaining({
        kind: "videoStart",
        url: "https://youtu.be/tuck",
        from: 12,
        to: 40,
      }),
    ]);
  });

  it("leaves out what the figure already has", () => {
    const current = {
      ...sugarTuck,
      name: "Sugar Tuck (traveling)",
      tags: ["Beginner course 2026", "Festival weekend"],
    };
    expect(
      changes(
        {
          name: "Sugar Tuck (traveling)",
          tags: ["Beginner course 2026", "Festival weekend"],
        },
        current,
      ),
    ).toEqual([]);
  });

  it("marks a change the list owner has overtaken since", () => {
    const current = {
      ...sugarTuck,
      description: "The list owner's own words.",
    };
    expect(changes({ description: "A subscriber's words." }, current)).toEqual([
      expect.objectContaining({
        id: "description",
        changedSince: true,
        now: "The list owner's own words.",
        to: "A subscriber's words.",
      }),
    ]);
  });

  it("drops what the list does not have: a type, a figure, a universal modifier", () => {
    expect(
      changes({
        typeId: "gone",
        prerequisites: [1, 404],
        modifierRefs: [{ modifierId: "hesitation", videoRefs: [] }],
      }),
    ).toEqual([]);
  });

  it("drops a prerequisite that would close a loop", () => {
    // The Whip builds on the Sugar Tuck, so the Sugar Tuck cannot build on the Whip.
    expect(changes({ prerequisites: [1, 3] })).toEqual([]);
  });

  it("adds a variation with its videos, or videos to one the figure has", () => {
    const withTurn = {
      modifierRefs: [
        {
          modifierId: "inside-turn",
          videoRefs: [video("https://youtu.be/turn")],
        },
      ],
    };
    expect(changes(withTurn)).toEqual([
      expect.objectContaining({
        id: "modifier:add:inside-turn",
        videos: [video("https://youtu.be/turn")],
      }),
    ]);
    const current = {
      ...sugarTuck,
      modifierRefs: [{ modifierId: "inside-turn", videoRefs: [] }],
    };
    expect(ids(changes(withTurn, current))).toEqual([
      "video:add:inside-turn:https://youtu.be/turn",
    ]);
  });

  it("reads another phone's snapshots leniently and safely", () => {
    expect(figureChanges(null, base, sugarTuck, list, patterns)).toEqual([]);
    const lines = figureChanges(
      base,
      {
        ...base,
        rhythm: "not a rhythm",
        level: "grandmaster",
        videoRefs: [{ type: "local", value: "file:///x.mp4" }, "junk"],
      },
      sugarTuck,
      list,
      patterns,
    );
    // The rhythm is dropped, so it reads as cleared; a level the list does not have is left
    // out, as a type would be; the videos read as all removed.
    expect(ids(lines)).toEqual([
      "counts",
      "video:remove:https://youtu.be/tuck",
    ]);
  });

  it("suggests a level among the list's own, and leaves out one it does not have", () => {
    const course = {
      ...list,
      levels: [
        { id: "c1", name: "1" },
        { id: "c2", name: "2" },
      ],
    };
    const onCourse = { ...sugarTuck, level: "c1" };
    const baseOnCourse = { ...base, level: "c1" };
    expect(
      figureChanges(
        baseOnCourse,
        { ...baseOnCourse, level: "c2" },
        onCourse,
        course,
        patterns,
      ),
    ).toEqual([{ id: "level", kind: "level", from: "c1", to: "c2" }]);
    expect(
      figureChanges(
        baseOnCourse,
        { ...baseOnCourse, level: "advanced" },
        onCourse,
        course,
        patterns,
      ),
    ).toEqual([]);
    // Clearing the level is always a change the list can take.
    const { level: _level, ...cleared } = baseOnCourse;
    expect(
      ids(figureChanges(baseOnCourse, cleared, onCourse, course, patterns)),
    ).toEqual(["level"]);
  });

  it("keeps the anonymized marker on a suggested video", () => {
    const anonymized = {
      ...video("https://youtu.be/anon"),
      generated: { method: "silhouette", createdAt: 5 },
    };
    const [line] = changes({ videoRefs: [...sugarTuck.videoRefs, anonymized] });
    expect(line).toMatchObject({ kind: "video", video: anonymized });
  });
});

describe("applyFigureChanges", () => {
  it("applies only the chosen lines, to the figure as it is now", () => {
    const current = {
      ...sugarTuck,
      description: "The list owner's own words.",
    };
    const lines = changes(
      {
        name: "Sugar Tuck (traveling)",
        description: "A subscriber's words.",
        tags: ["Beginner course 2026", "Festival weekend"],
      },
      current,
    );
    const chosen = lines.filter((l) => !l.changedSince);
    const applied = applyFigureChanges(current, chosen);
    expect(applied).toMatchObject({
      id: 2,
      name: "Sugar Tuck (traveling)",
      description: "The list owner's own words.",
      tags: ["Beginner course 2026", "Festival weekend"],
    });
  });

  it("applies every kind of line", () => {
    const current: IPattern = {
      ...sugarTuck,
      videoRefs: [
        { type: "local", value: "file:///mine.mp4" },
        ...sugarTuck.videoRefs,
      ],
    };
    const lines = changes(
      {
        typeId: pass,
        level: undefined,
        counts: 8,
        rhythm: "1 2 3&4 5 6 7&8",
        prerequisites: [],
        videoRefs: [
          video("https://youtu.be/tuck"),
          video("https://vimeo.com/42"),
        ],
        modifierRefs: [{ modifierId: "inside-turn", videoRefs: [] }],
      },
      current,
    );
    const applied = applyFigureChanges(current, lines);
    expect(applied.typeId).toBe(pass);
    expect(applied).not.toHaveProperty("level");
    expect(applied.counts).toBe(8);
    expect(applied.rhythm).toBe("1 2 3&4 5 6 7&8");
    expect(applied.prerequisites).toEqual([]);
    // The list owner's own file stays; the link loses its start time; the new link is added.
    expect(applied.videoRefs).toEqual([
      { type: "local", value: "file:///mine.mp4" },
      video("https://youtu.be/tuck"),
      video("https://vimeo.com/42"),
    ]);
    expect(applied.modifierRefs).toEqual([
      { modifierId: "inside-turn", videoRefs: [] },
    ]);
    // The figure it was given is untouched.
    expect(current.videoRefs).toHaveLength(2);
  });

  it("clears a rhythm along with new counts that have none", () => {
    const lines = changes({ counts: 4, rhythm: undefined });
    const applied = applyFigureChanges(sugarTuck, lines);
    expect(applied.counts).toBe(4);
    expect(applied).not.toHaveProperty("rhythm");
  });
});
