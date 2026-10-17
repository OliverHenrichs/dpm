const {
  TAKEDOWN_OWNER,
  describePath,
  makeDoc,
  search,
  groupByList,
  fieldLabel,
  isTakenDown,
  planListRemoval,
  planUserRemoval,
  looksLikeShareCode,
  looksLikeUid,
} = require("@/tools/data-removal/lib/model");

const CODE = "AB12CD34";
const OTHER = "ZZ99ZZ99";
const PUBLISHER = "Pub0000000000000000000000001";
const KID = "Kid0000000000000000000000001";

function snapshot() {
  return [
    makeDoc(`sharedLists/${CODE}`, {
      appToken: "secret-token",
      publishedAt: "2026-10-17T00:00:00.000Z",
      list: {
        name: "WCS Thursday",
        modifiers: [{ name: "with inside turn", videoRefs: [] }],
      },
      patterns: [
        { id: 1, name: "Sugar push", description: "basic" },
        {
          id: 2,
          name: "Whip",
          description: "Emma, age 11",
          videoRefs: [{ type: "url", value: "https://youtu.be/emma" }],
        },
      ],
    }),
    makeDoc(`sharedListOwners/${CODE}`, {
      ownerUid: PUBLISHER,
      key: "emma".repeat(11),
    }),
    makeDoc(`sharedLists/${CODE}/suggestions/s1`, {
      authorUid: KID,
      authorName: "Emma",
      pattern: { name: "Tuck turn" },
    }),
    makeDoc(`sharedLists/${CODE}/suggestions/s2`, {
      authorUid: "Someone00000000000000000001",
      pattern: { name: "Left side pass" },
    }),
    makeDoc(`sharedLists/${CODE}/suggestionCounters/d20000_${KID}`, {
      count: 1,
      last: "s1",
    }),
    makeDoc(`sharedLists/${CODE}/suggestionCounters/d20000`, {
      count: 2,
      last: "s2",
    }),
    makeDoc(`sharedLists/${CODE}/subscribers/${KID}`, {
      membership: "requested",
      name: "Emma S.",
    }),
    makeDoc(`sharedLists/${OTHER}/subscribers/${KID}`, { status: "muted" }),
  ];
}

describe("describePath", () => {
  it("knows every document the app writes", () => {
    expect(describePath(`sharedLists/${CODE}`)).toEqual({
      kind: "list",
      code: CODE,
      id: CODE,
    });
    expect(describePath(`sharedListOwners/${CODE}`).kind).toBe("owner");
    expect(describePath(`sharedLists/${CODE}/suggestions/x`)).toEqual({
      kind: "suggestion",
      code: CODE,
      id: "x",
    });
    expect(describePath(`sharedLists/${CODE}/suggestionCounters/x`).kind).toBe(
      "counter",
    );
    expect(describePath(`sharedLists/${CODE}/subscribers/x`).kind).toBe(
      "subscriber",
    );
  });

  it("refuses anything else", () => {
    expect(describePath("other/x")).toBeNull();
    expect(() => makeDoc(`sharedLists/${CODE}/other/x`, {})).toThrow();
  });
});

describe("search", () => {
  it("finds text anywhere, ignoring case", () => {
    const hits = search(snapshot(), "EMMA");
    const where = hits.map((h) => `${h.doc.path} ${h.field}`);
    expect(where).toEqual([
      `sharedLists/${CODE} patterns[1].description`,
      `sharedLists/${CODE} patterns[1].videoRefs[0].value`,
      `sharedLists/${CODE}/suggestions/s1 authorName`,
      `sharedLists/${CODE}/subscribers/${KID} name`,
    ]);
  });

  it("never searches the share key or the app token", () => {
    expect(search(snapshot(), "secret-token")).toEqual([]);
    expect(search(snapshot(), "emmaemma")).toEqual([]);
  });

  it("finds a user id in document ids and fields", () => {
    const paths = search(snapshot(), KID).map((h) => h.doc.path);
    expect(paths).toEqual([
      `sharedLists/${CODE}/suggestions/s1`,
      `sharedLists/${CODE}/suggestionCounters/d20000_${KID}`,
      `sharedLists/${CODE}/subscribers/${KID}`,
      `sharedLists/${OTHER}/subscribers/${KID}`,
    ]);
  });

  it("finds nothing for blank text", () => {
    expect(search(snapshot(), "  ")).toEqual([]);
  });

  it("groups hits by list", () => {
    const groups = groupByList(search(snapshot(), KID));
    expect([...groups.keys()]).toEqual([CODE, OTHER]);
    expect(groups.get(CODE)).toHaveLength(3);
  });
});

describe("fieldLabel", () => {
  it("names patterns and modifiers", () => {
    const list = snapshot()[0];
    expect(fieldLabel(list, "patterns[1].description")).toBe(
      'pattern "Whip" › description',
    );
    expect(fieldLabel(list, "list.modifiers[0].name")).toBe(
      'modifier "with inside turn" › name',
    );
    expect(fieldLabel(list, "list.name")).toBe("list.name");
  });
});

describe("planListRemoval", () => {
  it("deletes the list and everything under it, and takes the code down", () => {
    const plan = planListRemoval(snapshot(), CODE);
    expect(plan.exists).toBe(true);
    expect(plan.takedown).toBe(true);
    expect(plan.ownerUid).toBe(PUBLISHER);
    expect(plan.deletes.map((d) => d.kind).sort()).toEqual([
      "counter",
      "counter",
      "list",
      "subscriber",
      "suggestion",
      "suggestion",
    ]);
  });

  it("deletes the owner record instead when republishing is allowed", () => {
    const plan = planListRemoval(snapshot(), CODE, { allowRepublish: true });
    expect(plan.takedown).toBe(false);
    expect(plan.deletes.some((d) => d.kind === "owner")).toBe(true);
  });

  it("finds leftovers under a list that is gone", () => {
    const plan = planListRemoval(snapshot(), OTHER);
    expect(plan.exists).toBe(false);
    expect(plan.deletes.map((d) => d.path)).toEqual([
      `sharedLists/${OTHER}/subscribers/${KID}`,
    ]);
  });

  it("knows a code that is taken down", () => {
    const docs = [
      makeDoc(`sharedListOwners/${CODE}`, { ownerUid: TAKEDOWN_OWNER }),
    ];
    expect(isTakenDown(docs, CODE)).toBe(true);
    expect(isTakenDown(snapshot(), CODE)).toBe(false);
    expect(planListRemoval(docs, CODE)).toMatchObject({
      exists: false,
      deletes: [],
      ownerUid: null,
    });
  });
});

describe("planUserRemoval", () => {
  it("collects a subscriber's suggestions, records and own counters", () => {
    const plan = planUserRemoval(snapshot(), KID);
    expect(plan.ownedLists).toEqual([]);
    expect(plan.deletes.map((d) => d.path)).toEqual([
      `sharedLists/${CODE}/suggestions/s1`,
      `sharedLists/${CODE}/suggestionCounters/d20000_${KID}`,
      `sharedLists/${CODE}/subscribers/${KID}`,
      `sharedLists/${OTHER}/subscribers/${KID}`,
    ]);
  });

  it("collects the handover offers a user made or accepted", () => {
    const docs = [
      ...snapshot(),
      makeDoc(`sharedLists/${CODE}/handovers/HND0VER123`, {
        fromUid: PUBLISHER,
        acceptedBy: KID,
      }),
      makeDoc(`sharedLists/${OTHER}/handovers/HND0VER456`, {
        fromUid: KID,
      }),
    ];
    expect(describePath(`sharedLists/${CODE}/handovers/HND0VER123`).kind).toBe(
      "handover",
    );
    const paths = planUserRemoval(docs, KID).deletes.map((d) => d.path);
    expect(paths).toContain(`sharedLists/${CODE}/handovers/HND0VER123`);
    expect(paths).toContain(`sharedLists/${OTHER}/handovers/HND0VER456`);
    expect(planUserRemoval(docs, PUBLISHER).deletes.map((d) => d.path)).toEqual(
      [`sharedLists/${CODE}/handovers/HND0VER123`],
    );
  });

  it("names the lists a publisher owns", () => {
    expect(planUserRemoval(snapshot(), PUBLISHER)).toEqual({
      uid: PUBLISHER,
      deletes: [],
      ownedLists: [CODE],
    });
  });
});

describe("query shapes", () => {
  it("tells share codes and user ids from text", () => {
    expect(looksLikeShareCode(CODE)).toBe(true);
    expect(looksLikeShareCode("ab12cd34")).toBe(false);
    expect(looksLikeUid(KID)).toBe(true);
    expect(looksLikeUid("Emma Smith")).toBe(false);
    expect(looksLikeUid(CODE)).toBe(false);
  });
});
