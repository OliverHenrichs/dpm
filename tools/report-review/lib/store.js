/**
 * Where the dashboard gets reports and carries out the operator's actions.
 * `firebaseStore` uses the data removal tool's Admin SDK connection and
 * plans, so a takedown from the dashboard is exactly `npm run data --
 * remove-list`. `demoStore` holds made-up reports in memory, for trying the
 * dashboard without touching Firestore (`--demo`).
 */

const {
  LISTS,
  OWNERS,
  REPORTS,
  makeDoc,
  planListRemoval,
  TAKEDOWN_OWNER,
} = require("../../data-removal/lib/model");
const { reportView } = require("./review");

/**
 * Reads only what the dashboard shows: every report, and for each reported
 * list its document, its owner record and whether the publisher is blocked.
 * A few reads per report, so refreshing every few minutes stays cheap; the
 * full snapshot is loaded only to take a list down.
 */
function firebaseStore(conn) {
  const data = require("../../data-removal/lib/firestore");
  const { db } = conn;
  const plain = (snap) => (snap.exists ? toPlain(snap.data()) : null);

  return {
    projectId: conn.projectId,
    emulated: conn.emulated,

    async load() {
      const reports = (await db.collection(REPORTS).get()).docs.map((d) =>
        makeDoc(d.ref.path, toPlain(d.data())),
      );
      const codes = [...new Set(reports.map((r) => r.code))];
      const about = new Map();
      await Promise.all(
        codes.map(async (code) => {
          const [list, owner] = await Promise.all([
            db.collection(LISTS).doc(code).get(),
            db.collection(OWNERS).doc(code).get(),
          ]);
          const ownerData = plain(owner);
          const uid = ownerData?.ownerUid;
          const blockedSince =
            uid && uid !== TAKEDOWN_OWNER
              ? await data.blockedSince(db, String(uid))
              : null;
          about.set(code, {
            list: plain(list),
            owner: ownerData,
            blockedSince,
          });
        }),
      );
      return reports.map((r) => reportView(r, about.get(r.code)));
    },

    async removeList(code) {
      const docs = await data.loadSnapshot(db);
      await data.removeList(conn, planListRemoval(docs, code));
    },

    blockedSince(uid) {
      return data.blockedSince(db, uid);
    },

    async blockUser(uid) {
      if (!(await data.blockedSince(db, uid))) await data.blockUser(conn, uid);
    },

    async deleteReport(id) {
      await db.collection(REPORTS).doc(id).delete();
    },
  };
}

/** Firestore values as plain JSON: timestamps become ISO strings. */
function toPlain(value) {
  if (value && typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }
  if (Array.isArray(value)) return value.map(toPlain);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, toPlain(v)]),
    );
  }
  return value;
}

/** Made-up West Coast Swing lists and reports, in memory. */
function demoStore() {
  const PUBLISHER = "DemoPublisher000000000000001";
  const lists = {
    WCS2026A: {
      publishedAt: "2026-10-12T18:00:00.000Z",
      list: {
        name: "WCS Thursday course",
        description: "Patterns from the Thursday intermediate course.",
        dance: "wcs",
        modifiers: [{ id: "m1", name: "with inside turn" }],
      },
      patterns: [
        { id: 1, name: "Sugar push", videoRefs: [] },
        {
          id: 2,
          name: "Whip",
          description: "Filmed at the studio, with Mia (12) leading.",
          videoRefs: [
            { type: "url", value: "https://www.youtube.com/watch?v=demo1" },
          ],
          modifierRefs: [{ modifierId: "m1", videoRefs: [] }],
        },
        { id: 3, name: "Underarm turn", videoRefs: [] },
      ],
    },
    SPAM0001: {
      publishedAt: "2026-10-20T09:00:00.000Z",
      list: { name: "Best patterns", description: "" },
      patterns: [
        {
          id: 1,
          name: "Left side pass",
          description: "Cheap sneakers at shoe-deals.example!!!",
          videoRefs: [{ type: "url", value: "https://shoe-deals.example/" }],
        },
      ],
    },
  };
  const owners = {
    WCS2026A: { ownerUid: PUBLISHER },
    SPAM0001: { ownerUid: "DemoSpammer00000000000000001" },
  };
  const blocked = {};
  const reports = [
    makeDoc("reports/WCS2026A_DemoReporter0000000000000001", {
      shareCode: "WCS2026A",
      reporterUid: "DemoReporter0000000000000001",
      reason: "child",
      details:
        "The whip video shows my daughter Mia. Nobody asked me. Please remove it.",
      contact: "parent@example.com",
      createdAt: "2026-10-24T20:15:00.000Z",
    }),
    makeDoc("reports/SPAM0001_DemoReporter0000000000000002", {
      shareCode: "SPAM0001",
      reporterUid: "DemoReporter0000000000000002",
      reason: "spam",
      details: "This is an ad, not a dance list.",
      createdAt: "2026-10-25T08:00:00.000Z",
    }),
    makeDoc("reports/WCS2026A_DemoReporter0000000000000003", {
      shareCode: "WCS2026A",
      reporterUid: "DemoReporter0000000000000003",
      reason: "copyright",
      details: "The sugar push is my choreography.",
      contact: "teacher@example.com",
      createdAt: "2026-10-25T10:30:00.000Z",
    }),
  ];
  return {
    projectId: "demo",
    emulated: true,
    demo: true,
    async load() {
      return reports.map((r) =>
        reportView(r, {
          list: lists[r.code] ?? null,
          owner: owners[r.code] ?? null,
          blockedSince: blocked[owners[r.code]?.ownerUid] ?? null,
        }),
      );
    },
    async removeList(code) {
      delete lists[code];
      owners[code] = { ownerUid: TAKEDOWN_OWNER };
    },
    async blockedSince(uid) {
      return blocked[uid] ?? null;
    },
    async blockUser(uid) {
      blocked[uid] ??= new Date().toISOString();
    },
    async deleteReport(id) {
      const i = reports.findIndex((r) => r.id === id);
      if (i >= 0) reports.splice(i, 1);
    },
  };
}

module.exports = { firebaseStore, demoStore, toPlain };
