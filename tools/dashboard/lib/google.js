/**
 * Calls to Google's APIs with the `dpm-ops` service account key in
 * DPM_OPS_CREDENTIALS: Cloud Monitoring and Firebase Rules for the Usage tab
 * (viewer roles only), Google Play for the Play tab (View app information,
 * and Reply to reviews if granted: the only thing it can send). The Admin key
 * (DPM_ADMIN_CREDENTIALS) is never used for these calls, so nothing here can
 * change or delete any data.
 *
 * Signs its own OAuth token (a JWT with the key, RS256), so it needs no
 * Google client library.
 */

const crypto = require("crypto");
const fs = require("fs");
const { httpError } = require("./http");

/** The Usage tab's token: read-only scopes. */
const SCOPES = [
  "https://www.googleapis.com/auth/monitoring.read",
  "https://www.googleapis.com/auth/firebase.readonly",
];
/**
 * The Play tab's token. Play has no read-only scope for reviews; what the key
 * may do there is what Play Console grants dpm-ops (see README).
 */
const PLAY_SCOPES = [
  "https://www.googleapis.com/auth/playdeveloperreporting",
  "https://www.googleapis.com/auth/androidpublisher",
  "https://www.googleapis.com/auth/devstorage.read_only",
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
function assertion(key, now = Date.now(), scopes = SCOPES) {
  const iat = Math.floor(now / 1000);
  const unsigned = `${b64url({ alg: "RS256", typ: "JWT", kid: key.private_key_id })}.${b64url(
    {
      iss: key.client_email,
      scope: scopes.join(" "),
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
 * @param {{ fetch?: typeof fetch, scopes?: string[] }} [options]
 */
function googleClient(key, { fetch: fetchFn = fetch, scopes = SCOPES } = {}) {
  let token = null;

  async function accessToken() {
    if (token && token.expires - Date.now() > 60_000) return token.value;
    const res = await fetchFn(key.token_uri || TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: assertion(key, Date.now(), scopes),
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

  async function send(url, init = {}) {
    const res = await fetchFn(url, {
      ...init,
      headers: {
        ...init.headers,
        Authorization: `Bearer ${await accessToken()}`,
      },
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      const msg = json.error?.message || res.statusText || String(res.status);
      throw Object.assign(httpError(502, msg), { googleStatus: res.status });
    }
    return res;
  }

  /** GET a Google API URL as JSON; errors carry Google's own message. */
  async function get(url) {
    const res = await send(url);
    return res.json().catch(() => ({}));
  }

  /** POST JSON to a Google API URL (Play's metric queries, a review reply). */
  async function post(url, body) {
    const res = await send(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
    });
    return res.json().catch(() => ({}));
  }

  /** GET a file's bytes (Play's bulk reports in Cloud Storage). */
  async function bytes(url) {
    const res = await send(url);
    return Buffer.from(await res.arrayBuffer());
  }

  return {
    get,
    post,
    bytes,
    email: key.client_email,
    projectId: key.project_id,
  };
}

module.exports = { googleClient, readKey, assertion, SCOPES, PLAY_SCOPES };
