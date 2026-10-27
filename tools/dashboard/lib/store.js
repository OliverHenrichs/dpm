/**
 * Where the dashboard reads Firestore and carries out the operator's actions.
 * `firebaseStore` uses the data removal tool's Admin SDK connection and
 * plans, so a takedown from the dashboard is exactly `npm run data --
 * remove-list`. `demoStore` holds made-up lists and reports in memory, for
 * trying the dashboard without touching Firestore (`--demo`).
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
 * Reports are read on their own (a few reads per report, so refreshing every
 * few minutes stays cheap). The full snapshot, which the Data tab searches,
 * is read only when asked for, and kept in memory for a minute so a search,
 * a look at the list and a removal read it once.
 */
function firebaseStore(conn, { snapshotTtlMs = 60_000 } = {}) {
  const data = require("../../data-removal/lib/firestore");
  const { db } = conn;
  const plain = (snap) => (snap.exists ? toPlain(snap.data()) : null);
  let cached = null;

  async function snapshot({ fresh = false } = {}) {
    if (!fresh && cached && Date.now() - cached.at < snapshotTtlMs) {
      return cached.docs;
    }
    cached = { at: Date.now(), docs: await data.loadSnapshot(db) };
    return cached.docs;
  }
  const changed = () => {
    cached = null;
  };

  return {
    projectId: conn.projectId,
    emulated: conn.emulated,
    snapshot,

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

    /** A list's owner record, read now (never cached). */
    async owner(code) {
      return plain(await db.collection(OWNERS).doc(code).get());
    },

    findUser(uid) {
      return data.findUser(conn.auth, uid);
    },

    blockedSince(uid) {
      return data.blockedSince(db, uid);
    },

    /** Every blocked id, oldest block first. */
    blocks() {
      return data.listBlocked(db);
    },

    async removeList(code, { allowRepublish = false } = {}) {
      const docs = await snapshot({ fresh: true });
      await data.removeList(
        conn,
        planListRemoval(docs, code, { allowRepublish }),
      );
      changed();
    },

    async release(code) {
      await data.releaseTakedown(conn, code);
      changed();
    },

    async removeUser(plan) {
      await data.removeUser(conn, plan);
      changed();
    },

    async deleteDocs(docs) {
      await data.deleteDocs(db, docs);
      changed();
    },

    async blockUser(uid) {
      if (!(await data.blockedSince(db, uid))) await data.blockUser(conn, uid);
    },

    async unblockUser(uid) {
      await data.unblockUser(conn, uid);
    },

    async deleteReport(id) {
      await db.collection(REPORTS).doc(id).delete();
      changed();
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

/** Made-up West Coast Swing lists, suggestions and reports, in memory. */
function demoStore() {
  const PUBLISHER = "DemoPublisher000000000000001";
  const SPAMMER = "DemoSpammer00000000000000001";
  const STUDENT = "DemoStudent00000000000000001";
  let docs = [
    makeDoc(`${LISTS}/WCS2026A`, {
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
    }),
    makeDoc(`${OWNERS}/WCS2026A`, { ownerUid: PUBLISHER, key: "secret" }),
    makeDoc(`${LISTS}/WCS2026A/suggestions/s1`, {
      authorUid: STUDENT,
      authorName: "Jonas",
      pattern: { name: "Left side pass" },
      createdAt: "2026-10-20T19:00:00.000Z",
    }),
    makeDoc(`${LISTS}/WCS2026A/subscribers/${STUDENT}`, {
      name: "Jonas",
      membership: "member",
      status: "accepted",
    }),
    makeDoc(`${LISTS}/SPAM0001`, {
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
    }),
    makeDoc(`${OWNERS}/SPAM0001`, { ownerUid: SPAMMER, key: "secret" }),
    makeDoc(`${OWNERS}/OLDLIST1`, {
      ownerUid: TAKEDOWN_OWNER,
      removedAt: "2026-09-30T12:00:00.000Z",
    }),
    makeDoc(`${REPORTS}/WCS2026A_DemoReporter0000000000000001`, {
      shareCode: "WCS2026A",
      reporterUid: "DemoReporter0000000000000001",
      reason: "child",
      details:
        "The whip video shows my daughter Mia. Nobody asked me. Please remove it.",
      contact: "parent@example.com",
      createdAt: "2026-10-24T20:15:00.000Z",
    }),
    makeDoc(`${REPORTS}/SPAM0001_DemoReporter0000000000000002`, {
      shareCode: "SPAM0001",
      reporterUid: "DemoReporter0000000000000002",
      reason: "spam",
      details: "This is an ad, not a dance list.",
      createdAt: "2026-10-25T08:00:00.000Z",
    }),
    makeDoc(`${REPORTS}/WCS2026A_DemoReporter0000000000000003`, {
      shareCode: "WCS2026A",
      reporterUid: "DemoReporter0000000000000003",
      reason: "copyright",
      details: "The sugar push is my choreography.",
      contact: "teacher@example.com",
      createdAt: "2026-10-25T10:30:00.000Z",
    }),
  ];
  const users = Object.fromEntries(
    [PUBLISHER, SPAMMER, STUDENT].map((uid) => [
      uid,
      {
        uid,
        created: "2026-09-01T10:00:00.000Z",
        lastSignIn: "2026-10-24T18:00:00.000Z",
        anonymous: true,
      },
    ]),
  );
  const blocked = { DemoBlocked00000000000000001: "2026-10-01T08:00:00.000Z" };
  const find = (kind, code) =>
    docs.find((d) => d.kind === kind && d.code === code)?.data ?? null;
  const drop = (paths) => {
    const gone = new Set(paths);
    docs = docs.filter((d) => !gone.has(d.path));
  };

  return {
    projectId: "demo",
    emulated: true,
    demo: true,

    async snapshot() {
      return structuredClone(docs);
    },

    async load() {
      return docs
        .filter((d) => d.kind === "report")
        .map((r) => {
          const owner = find("owner", r.code);
          return reportView(r, {
            list: find("list", r.code),
            owner,
            blockedSince: blocked[owner?.ownerUid] ?? null,
          });
        });
    },

    async owner(code) {
      return structuredClone(find("owner", code));
    },

    async findUser(uid) {
      return users[uid] ?? null;
    },

    async blockedSince(uid) {
      return blocked[uid] ?? null;
    },

    async blocks() {
      return Object.entries(blocked)
        .map(([uid, blockedAt]) => ({ uid, blockedAt }))
        .sort((a, b) => a.blockedAt.localeCompare(b.blockedAt));
    },

    async removeList(code, { allowRepublish = false } = {}) {
      const plan = planListRemoval(docs, code, { allowRepublish });
      drop(plan.deletes.map((d) => d.path));
      if (plan.takedown) {
        drop([`${OWNERS}/${code}`]);
        docs.push(
          makeDoc(`${OWNERS}/${code}`, {
            ownerUid: TAKEDOWN_OWNER,
            removedAt: new Date().toISOString(),
          }),
        );
      }
    },

    async release(code) {
      drop([`${OWNERS}/${code}`]);
    },

    async removeUser(plan) {
      drop(plan.deletes.map((d) => d.path));
      delete blocked[plan.uid];
      delete users[plan.uid];
    },

    async deleteDocs(list) {
      drop(list.map((d) => d.path));
    },

    async blockUser(uid) {
      blocked[uid] ??= new Date().toISOString();
    },

    async unblockUser(uid) {
      delete blocked[uid];
    },

    async deleteReport(id) {
      drop([`${REPORTS}/${id}`]);
    },
  };
}

module.exports = { firebaseStore, demoStore, toPlain };
