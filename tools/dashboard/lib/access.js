/**
 * Who may use the dashboard when it serves the home network (on a home
 * server): only browsers holding one of the operator's device
 * certificates get a page at all (the TLS handshake checks that the CA issued
 * it; this file checks it is on the device list and not revoked), and every
 * action that deletes or blocks (and the erasure requests and settings) needs
 * a passkey from that device within the last ten minutes.
 *
 * Passkeys are WebAuthn credentials. The browser hands over the public key
 * at registration (`getPublicKey()`, SPKI), so checking a signature needs
 * only Node's crypto, no CBOR and no library. Registering one needs a
 * one-time code from `npm run ops:pki -- enroll-code` on the server.
 *
 * State lives in `<dir>`: devices.json (written by pki.js), passkeys.json,
 * enroll.json.
 */

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { httpError, now, readJson, writeJson } = require("./http");

const ARMED_MS = 10 * 60 * 1000;
const CHALLENGE_MS = 5 * 60 * 1000;
/** COSE algorithm ids the browser may pick: ES256, EdDSA, RS256. */
const ALGORITHMS = [-7, -8, -257];

const b64u = (buf) => Buffer.from(buf).toString("base64url");
const fromB64u = (s) => Buffer.from(String(s ?? ""), "base64url");
const sha256 = (data) => crypto.createHash("sha256").update(data).digest();

function hashCode(code) {
  return sha256(String(code).trim().toUpperCase()).toString("hex");
}

/** The device list pki.js keeps: [{ name, fingerprint256, addedAt, revokedAt? }]. */
function readDevices(dir) {
  return readJson(path.join(dir, "devices.json")) ?? [];
}

/**
 * @param {{ dir: string, rpId: string, origin: string, clock?: () => number }} opts
 *   rpId is the dashboard's host name (passkeys are bound to it), origin its
 *   https URL as the browser shows it.
 */
function createAccess({ dir, rpId, origin, clock = Date.now }) {
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const passkeyFile = path.join(dir, "passkeys.json");
  const enrollFile = path.join(dir, "enroll.json");
  const challenges = new Map();
  const armedUntil = new Map();

  const passkeys = () => readJson(passkeyFile) ?? [];

  /** The device name of a TLS request's client certificate, or a 403. */
  function deviceOf(socket) {
    if (!socket.authorized)
      throw httpError(403, "No valid device certificate.");
    const cert = socket.getPeerCertificate();
    const fp = cert?.fingerprint256;
    const device = readDevices(dir).find(
      (d) => d.fingerprint256 === fp && !d.revokedAt,
    );
    if (!device)
      throw httpError(403, "This device certificate is revoked or unknown.");
    return device.name;
  }

  function challenge(purpose, device) {
    for (const [c, v] of challenges) {
      if (v.expires < clock()) challenges.delete(c);
    }
    const c = b64u(crypto.randomBytes(32));
    challenges.set(c, { purpose, device, expires: clock() + CHALLENGE_MS });
    return c;
  }

  /** Checks clientDataJSON and uses up its challenge. */
  function checkClientData(clientDataJSON, type, purpose, device) {
    let client;
    try {
      client = JSON.parse(fromB64u(clientDataJSON).toString("utf8"));
    } catch {
      throw httpError(400, "Unreadable passkey answer.");
    }
    const pending = challenges.get(client.challenge);
    challenges.delete(client.challenge);
    if (
      client.type !== type ||
      !pending ||
      pending.purpose !== purpose ||
      pending.device !== device ||
      pending.expires < clock()
    ) {
      throw httpError(
        400,
        "The passkey answer doesn't match this request. Try again.",
      );
    }
    if (client.origin !== origin) {
      throw httpError(400, `Open the dashboard at ${origin} to use passkeys.`);
    }
  }

  return {
    rpId,

    deviceOf,

    status(device) {
      const until = armedUntil.get(device) ?? 0;
      return {
        device,
        passkeys: passkeys().filter((p) => p.device === device).length,
        armedUntil: until > clock() ? new Date(until).toISOString() : null,
      };
    },

    /** Whether this device used its passkey in the last ten minutes. */
    isArmed(device) {
      return (armedUntil.get(device) ?? 0) > clock();
    },

    /**
     * Throws 428 unless this device used its passkey in the last ten minutes.
     * Only the passkey arms a device, so a busy session is still asked again.
     */
    requireArmed(device) {
      if (!this.isArmed(device)) {
        throw httpError(428, "Confirm with your passkey first.");
      }
    },

    disarm(device) {
      armedUntil.delete(device);
    },

    /** Starts registering a passkey; needs a fresh code from pki.js. */
    registerOptions(device, code) {
      const enroll = readJson(enrollFile);
      if (
        !enroll ||
        enroll.expires < clock() ||
        enroll.hash !== hashCode(code ?? "")
      ) {
        throw httpError(
          403,
          "Wrong or expired code. Make a new one on the server: npm run ops:pki -- enroll-code",
        );
      }
      return {
        challenge: challenge("register", device),
        rp: { id: rpId, name: "DPM Operations" },
        user: {
          id: b64u(sha256(device).subarray(0, 16)),
          name: device,
          displayName: `DPM operator (${device})`,
        },
        pubKeyCredParams: ALGORITHMS.map((alg) => ({
          type: "public-key",
          alg,
        })),
        excludeCredentials: passkeys()
          .filter((p) => p.device === device)
          .map((p) => ({ type: "public-key", id: p.id })),
      };
    },

    /** Stores the new passkey; the browser sends its public key as SPKI. */
    register(device, { id, publicKey, alg, clientDataJSON }) {
      checkClientData(clientDataJSON, "webauthn.create", "register", device);
      if (!ALGORITHMS.includes(alg))
        throw httpError(400, "Unsupported passkey type.");
      try {
        crypto.createPublicKey({
          key: fromB64u(publicKey),
          format: "der",
          type: "spki",
        });
      } catch {
        throw httpError(400, "Unreadable public key.");
      }
      fs.rmSync(enrollFile, { force: true });
      if (passkeys().some((p) => p.id === id && p.device !== device)) {
        throw httpError(409, "Another device already has this passkey.");
      }
      const list = passkeys().filter((p) => p.id !== id);
      list.push({ id, device, publicKey, alg, signCount: 0, addedAt: now() });
      writeJson(passkeyFile, list);
      return this.status(device);
    },

    assertOptions(device) {
      const mine = passkeys().filter((p) => p.device === device);
      if (mine.length === 0) {
        throw httpError(
          400,
          "This device has no passkey yet. Register one under Access.",
        );
      }
      return {
        challenge: challenge("assert", device),
        rpId,
        allowCredentials: mine.map((p) => ({ type: "public-key", id: p.id })),
        userVerification: "required",
      };
    },

    /** Checks a passkey signature and arms the device for ten minutes. */
    assert(device, { id, clientDataJSON, authenticatorData, signature }) {
      const list = passkeys();
      const key = list.find((p) => p.id === id && p.device === device);
      if (!key) throw httpError(403, "Unknown passkey for this device.");
      checkClientData(clientDataJSON, "webauthn.get", "assert", device);
      const auth = fromB64u(authenticatorData);
      if (auth.length < 37 || !auth.subarray(0, 32).equals(sha256(rpId))) {
        throw httpError(403, "The passkey is for another site.");
      }
      const flags = auth[32];
      // User present and user verified (fingerprint, PIN).
      if ((flags & 0x01) === 0 || (flags & 0x04) === 0) {
        throw httpError(403, "The passkey didn't verify you.");
      }
      const signed = Buffer.concat([auth, sha256(fromB64u(clientDataJSON))]);
      const publicKey = crypto.createPublicKey({
        key: fromB64u(key.publicKey),
        format: "der",
        type: "spki",
      });
      const ok = crypto.verify(
        key.alg === -8 ? null : "sha256",
        signed,
        publicKey,
        fromB64u(signature),
      );
      if (!ok) throw httpError(403, "Passkey signature doesn't match.");
      const count = auth.readUInt32BE(33);
      // A counter that goes backwards means a cloned authenticator. Synced
      // passkeys always report 0, which is fine.
      if (count !== 0 && count <= key.signCount) {
        throw httpError(
          403,
          "Passkey counter went backwards; remove and re-register it.",
        );
      }
      key.signCount = count;
      writeJson(passkeyFile, list);
      armedUntil.set(device, clock() + ARMED_MS);
      return this.status(device);
    },
  };
}

module.exports = { createAccess, hashCode, readDevices, ARMED_MS };
