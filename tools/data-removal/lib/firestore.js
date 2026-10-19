/**
 * The Firebase half of the data removal tool: loading a snapshot of the
 * shared data with the Admin SDK, and carrying out removal plans. The Admin
 * SDK is not bound by firestore.rules, so everything here runs as the
 * project's operator.
 */

const { randomBytes } = require("crypto");
const { readFileSync } = require("fs");
const {
  LISTS,
  OWNERS,
  SUGGESTIONS,
  COUNTERS,
  SUBSCRIBERS,
  HANDOVERS,
  BLOCKED,
  REPORTS,
  TAKEDOWN_OWNER,
  makeDoc,
} = require("./model");

function loadAdmin() {
  try {
    return {
      app: require("firebase-admin/app"),
      firestore: require("firebase-admin/firestore"),
      auth: require("firebase-admin/auth"),
    };
  } catch {
    throw new Error(
      "firebase-admin is not installed. Run `npm --prefix tools/data-removal install` once.",
    );
  }
}

/**
 * Connects to the project in FIREBASE_PROJECT_ID with the service account key
 * in DPM_ADMIN_CREDENTIALS, or else Google's application default credentials
 * (`gcloud auth application-default login`). The emulators need neither.
 */
function connect(env = process.env) {
  const admin = loadAdmin();
  const projectId = env.FIREBASE_PROJECT_ID;
  if (!projectId) {
    throw new Error("FIREBASE_PROJECT_ID is not set; see .env.example.");
  }
  const emulated = !!env.FIRESTORE_EMULATOR_HOST;
  const keyPath = env.DPM_ADMIN_CREDENTIALS;
  const app = admin.app.initializeApp({
    projectId,
    ...(keyPath && {
      credential: admin.app.cert(JSON.parse(readFileSync(keyPath, "utf8"))),
    }),
  });
  return {
    projectId,
    emulated,
    db: admin.firestore.getFirestore(app),
    auth: admin.auth.getAuth(app),
    Timestamp: admin.firestore.Timestamp,
  };
}

/** Firestore values as plain JSON: timestamps become ISO strings. */
function plain(value) {
  if (value && typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }
  if (Array.isArray(value)) return value.map(plain);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, plain(v)]),
    );
  }
  return value;
}

/**
 * Every document the app writes. Reads the whole of it, which is what lets a
 * search find text anywhere; the collection-group reads also find documents
 * left under a list that no longer exists.
 */
async function loadSnapshot(db) {
  const snaps = await Promise.all([
    db.collection(LISTS).get(),
    db.collection(OWNERS).get(),
    db.collectionGroup(SUGGESTIONS).get(),
    db.collectionGroup(COUNTERS).get(),
    db.collectionGroup(SUBSCRIBERS).get(),
    db.collectionGroup(HANDOVERS).get(),
    db.collection(REPORTS).get(),
  ]);
  return snaps.flatMap((snap) =>
    snap.docs.map((d) => makeDoc(d.ref.path, plain(d.data()))),
  );
}

/** The Authentication account of a user id, or null. */
async function findUser(auth, uid) {
  try {
    const user = await auth.getUser(uid);
    return {
      uid: user.uid,
      created: user.metadata.creationTime,
      lastSignIn: user.metadata.lastSignInTime,
      anonymous: user.providerData.length === 0,
    };
  } catch (e) {
    if (e.code === "auth/user-not-found") return null;
    throw e;
  }
}

/**
 * Carries out `planListRemoval`. Deletes the list with everything under it
 * as it stands now (not only what the snapshot saw), then either writes the
 * takedown record or deletes the owner record.
 */
async function removeList(conn, plan) {
  const { db, Timestamp } = conn;
  await db.recursiveDelete(db.collection(LISTS).doc(plan.code));
  const ownerRef = db.collection(OWNERS).doc(plan.code);
  if (plan.takedown) {
    // A fresh key nobody holds: the publisher's phone can neither take the
    // list back nor publish under this code again.
    await ownerRef.set({
      ownerUid: TAKEDOWN_OWNER,
      key: randomBytes(32).toString("hex"),
      removedAt: Timestamp.now(),
    });
  } else {
    await ownerRef.delete();
  }
}

/** Lets the publisher's phone publish under a taken-down code again. */
async function releaseTakedown(conn, code) {
  await conn.db.collection(OWNERS).doc(code).delete();
}

/** When an id was blocked, or null. */
async function blockedSince(db, uid) {
  const snap = await db.collection(BLOCKED).doc(uid).get();
  return snap.exists ? plain(snap.get("blockedAt")) : null;
}

/**
 * Blocks an id: the rules then refuse its publishing, suggesting and asking
 * to join. Its account stays, so the phone keeps the blocked id; a deleted
 * account would let it sign in afresh.
 */
async function blockUser(conn, uid) {
  await conn.db
    .collection(BLOCKED)
    .doc(uid)
    .set({ blockedAt: conn.Timestamp.now() });
}

async function unblockUser(conn, uid) {
  await conn.db.collection(BLOCKED).doc(uid).delete();
}

/** Deletes single documents by path, in batches of at most 500. */
async function deleteDocs(db, docs) {
  for (let i = 0; i < docs.length; i += 500) {
    const batch = db.batch();
    docs.slice(i, i + 500).forEach((d) => batch.delete(db.doc(d.path)));
    await batch.commit();
  }
}

/** Carries out `planUserRemoval` (the lists they own are removed separately). */
async function removeUser(conn, plan) {
  await deleteDocs(conn.db, plan.deletes);
  // The block holds the id too, and protects nothing once the account goes.
  await unblockUser(conn, plan.uid);
  if (await findUser(conn.auth, plan.uid)) {
    await conn.auth.deleteUser(plan.uid);
  }
}

module.exports = {
  connect,
  loadSnapshot,
  findUser,
  removeList,
  releaseTakedown,
  blockedSince,
  blockUser,
  unblockUser,
  deleteDocs,
  removeUser,
};
