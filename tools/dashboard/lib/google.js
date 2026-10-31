/**
 * Read-only calls to Google's APIs (Cloud Monitoring, Firebase Rules) with
 * the `dpm-ops` service account key in DPM_OPS_CREDENTIALS. That account has
 * viewer roles only, so nothing here can change or delete anything; the Admin
 * key (DPM_ADMIN_CREDENTIALS) is never used for these calls.
 *
 * Signs its own OAuth token (a JWT with the key, RS256), so it needs no
 * Google client library.
 */

const crypto = require("crypto");
const fs = require("fs");
const { httpError } = require("./http");

const SCOPES = [
  "https://www.googleapis.com/auth/monitoring.read",
  "https://www.googleapis.com/auth/firebase.readonly",
];
const TOKEN_URL = "https://oauth2.googleapis.com/token";

const b64url = (v) =>
  Buffer.from(typeof v === "string" ? v : JSON.stringify(v)).toString(
    "base64url",
  );

/** The key file, checked enough to give a useful message, or null without one. */
function readKey(env = process.env) {
  const file = env.DPM_OPS_CREDENTIALS;
  if (!file) return null;
  let key;
  try {
    key = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    throw new Error(`DPM_OPS_CREDENTIALS: can't read ${file} (${e.message}).`);
  }
  if (key.type !== "service_account" || !key.private_key || !key.client_email) {
    throw new Error(
      "DPM_OPS_CREDENTIALS must be a service account key (JSON) of dpm-ops.",
    );
  }
  return key;
}

/** A signed token request for the key: exported for the tests. */
function assertion(key, now = Date.now()) {
  const iat = Math.floor(now / 1000);
  const unsigned = `${b64url({ alg: "RS256", typ: "JWT", kid: key.private_key_id })}.${b64url(
    {
      iss: key.client_email,
      scope: SCOPES.join(" "),
      aud: key.token_uri || TOKEN_URL,
      iat,
      exp: iat + 3600,
    },
  )}`;
  const sig = crypto
    .createSign("RSA-SHA256")
    .update(unsigned)
    .sign(key.private_key, "base64url");
  return `${unsigned}.${sig}`;
}

/**
 * @param {object} key a service account key
 * @param {{ fetch?: typeof fetch }} [options]
 */
function googleClient(key, { fetch: fetchFn = fetch } = {}) {
  let token = null;

  async function accessToken() {
    if (token && token.expires - Date.now() > 60_000) return token.value;
    const res = await fetchFn(key.token_uri || TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: assertion(key),
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.access_token) {
      throw httpError(
        502,
        `Google refused the dpm-ops key: ${json.error_description || json.error || res.status}.`,
      );
    }
    token = {
      value: json.access_token,
      expires: Date.now() + (json.expires_in ?? 3600) * 1000,
    };
    return token.value;
  }

  /** GET a Google API URL as JSON; errors carry Google's own message. */
  async function get(url) {
    const res = await fetchFn(url, {
      headers: { Authorization: `Bearer ${await accessToken()}` },
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = json.error?.message || res.statusText || String(res.status);
      throw Object.assign(httpError(502, msg), { googleStatus: res.status });
    }
    return json;
  }

  return { get, email: key.client_email, projectId: key.project_id };
}

module.exports = { googleClient, readKey, assertion, SCOPES };
