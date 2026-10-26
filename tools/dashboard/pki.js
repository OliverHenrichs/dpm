#!/usr/bin/env node
/**
 * The dashboard's own small certificate authority, for running it on the
 * Raspberry Pi (`npm run ops -- --lan`): a server certificate for the Pi's
 * name, and one client certificate per device (laptop, PC, phone) that the
 * browser shows to get in. Also hands out the one-time codes that let a
 * device register its passkey. Uses the `openssl` command line.
 *
 * Run on the Pi with `npm run ops:pki -- <command>`; see README.md.
 */

const crypto = require("crypto");
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { dashboardDir } = require("./server");
const { hashCode, readDevices } = require("./lib/access");
const { now, writeJson } = require("./lib/http");

const USAGE = `Usage: npm run ops:pki -- <command>

  init --name <host> [--ip <address>]
                      Make the CA and the Pi's server certificate. <host> is the
                      name the devices open (for example dpm-ops.fritz.box);
                      --ip adds the Pi's address too.
  add-device <name>   A client certificate for one device, as <name>.p12 (with a
                      printed password) to import into its browser.
  revoke-device <name>
                      Stop letting that device in, at once.
  devices             List the devices.
  enroll-code         A one-time code (15 minutes) for registering a passkey on
                      the dashboard's Access page.`;

const DEVICE_NAME = /^[a-z0-9][a-z0-9-]{0,31}$/;

function openssl(args, input) {
  return execFileSync("openssl", args, {
    input,
    stdio: [input === undefined ? "ignore" : "pipe", "pipe", "pipe"],
  }).toString();
}

function dirs(root = dashboardDir()) {
  const tls = path.join(root, "tls");
  const access = path.join(root, "access");
  const devices = path.join(tls, "devices");
  for (const d of [root, tls, access, devices]) {
    fs.mkdirSync(d, { recursive: true, mode: 0o700 });
  }
  return { tls, access, devices };
}

function init(root, { name, ip }) {
  if (!name || !/^[a-z0-9.-]+$/i.test(name) || /^[0-9.]+$/.test(name)) {
    throw new Error(
      "--name needs a host name, not an IP address (passkeys need a name).",
    );
  }
  const { tls } = dirs(root);
  const f = (n) => path.join(tls, n);
  if (fs.existsSync(f("ca.key"))) {
    throw new Error(
      `${tls} already has a CA. Delete the folder to start over (every device then needs a new certificate).`,
    );
  }
  openssl([
    "ecparam",
    "-name",
    "prime256v1",
    "-genkey",
    "-noout",
    "-out",
    f("ca.key"),
  ]);
  openssl([
    "req",
    "-x509",
    "-new",
    "-key",
    f("ca.key"),
    "-sha256",
    "-days",
    "3650",
    "-subj",
    "/CN=DPM Operations CA",
    "-out",
    f("ca.crt"),
    "-addext",
    "basicConstraints=critical,CA:TRUE",
    "-addext",
    "keyUsage=critical,keyCertSign,cRLSign",
  ]);
  openssl([
    "ecparam",
    "-name",
    "prime256v1",
    "-genkey",
    "-noout",
    "-out",
    f("server.key"),
  ]);
  openssl([
    "req",
    "-new",
    "-key",
    f("server.key"),
    "-subj",
    `/CN=${name}`,
    "-out",
    f("server.csr"),
  ]);
  fs.writeFileSync(
    f("server.ext"),
    [
      "basicConstraints=CA:FALSE",
      "keyUsage=critical,digitalSignature",
      "extendedKeyUsage=serverAuth",
      `subjectAltName=DNS:${name}${ip ? `,IP:${ip}` : ""}`,
    ].join("\n"),
  );
  // 825 days: the longest a server certificate may live for Apple devices.
  openssl([
    "x509",
    "-req",
    "-in",
    f("server.csr"),
    "-CA",
    f("ca.crt"),
    "-CAkey",
    f("ca.key"),
    "-CAcreateserial",
    "-days",
    "825",
    "-sha256",
    "-extfile",
    f("server.ext"),
    "-out",
    f("server.crt"),
  ]);
  fs.rmSync(f("server.csr"));
  fs.rmSync(f("server.ext"));
  for (const k of ["ca.key", "server.key"]) fs.chmodSync(f(k), 0o600);
  writeJson(f("server.json"), { name, ip: ip ?? null, createdAt: now() });
  console.log(`Made the CA and a server certificate for ${name} in ${tls}.`);
  console.log(
    `Install ${f("ca.crt")} as a trusted CA on each device, then add each device with add-device.`,
  );
}

function addDevice(root, name) {
  if (!DEVICE_NAME.test(name ?? "")) {
    throw new Error(
      "A device name is lowercase letters, digits and dashes, like laptop or pixel.",
    );
  }
  const { tls, access, devices } = dirs(root);
  const ca = (n) => path.join(tls, n);
  if (!fs.existsSync(ca("ca.key"))) throw new Error("Run init first.");
  const list = readDevices(access);
  if (list.some((d) => d.name === name && !d.revokedAt)) {
    throw new Error(
      `${name} already has a certificate. Revoke it first to make a new one.`,
    );
  }
  const f = (ext) => path.join(devices, `${name}.${ext}`);
  openssl([
    "ecparam",
    "-name",
    "prime256v1",
    "-genkey",
    "-noout",
    "-out",
    f("key"),
  ]);
  openssl([
    "req",
    "-new",
    "-key",
    f("key"),
    "-subj",
    `/CN=${name}/O=DPM Operations`,
    "-out",
    f("csr"),
  ]);
  fs.writeFileSync(
    f("ext"),
    "basicConstraints=CA:FALSE\nkeyUsage=critical,digitalSignature\nextendedKeyUsage=clientAuth\n",
  );
  openssl([
    "x509",
    "-req",
    "-in",
    f("csr"),
    "-CA",
    ca("ca.crt"),
    "-CAkey",
    ca("ca.key"),
    "-CAcreateserial",
    "-days",
    "730",
    "-sha256",
    "-extfile",
    f("ext"),
    "-out",
    f("crt"),
  ]);
  const password = crypto.randomBytes(9).toString("base64url");
  // 3DES and SHA-1 in the .p12 wrapper only: Android's certificate installer
  // still refuses OpenSSL 3's default (AES) .p12 files.
  openssl(
    [
      "pkcs12",
      "-export",
      "-inkey",
      f("key"),
      "-in",
      f("crt"),
      "-certfile",
      ca("ca.crt"),
      "-name",
      `DPM Operations (${name})`,
      "-out",
      f("p12"),
      "-passout",
      "stdin",
      "-keypbe",
      "PBE-SHA1-3DES",
      "-certpbe",
      "PBE-SHA1-3DES",
      "-macalg",
      "sha1",
    ],
    `${password}\n`,
  );
  const cert = new crypto.X509Certificate(fs.readFileSync(f("crt")));
  for (const ext of ["csr", "ext", "key"]) fs.rmSync(f(ext));
  fs.chmodSync(f("p12"), 0o600);
  writeJson(path.join(access, "devices.json"), [
    ...list,
    {
      name,
      fingerprint256: cert.fingerprint256,
      serial: cert.serialNumber,
      addedAt: now(),
    },
  ]);
  console.log(`Made ${f("p12")}, password ${password}`);
  console.log(
    "Copy it to the device, import it into the browser (Android: Settings → Security → Install a certificate → VPN & app user certificate), then delete the copies.",
  );
}

function revokeDevice(root, name) {
  const { access } = dirs(root);
  const list = readDevices(access);
  const hits = list.filter((d) => d.name === name && !d.revokedAt);
  if (hits.length === 0) throw new Error(`No active device called ${name}.`);
  hits.forEach((d) => (d.revokedAt = now()));
  writeJson(path.join(access, "devices.json"), list);
  // Its passkeys go with it.
  const keysFile = path.join(access, "passkeys.json");
  if (fs.existsSync(keysFile)) {
    const keys = JSON.parse(fs.readFileSync(keysFile, "utf8"));
    writeJson(
      keysFile,
      keys.filter((k) => k.device !== name),
    );
  }
  console.log(
    `Revoked ${name}; the dashboard refuses it from its next request.`,
  );
}

function listDevices(root) {
  const { access } = dirs(root);
  const list = readDevices(access);
  if (list.length === 0)
    console.log("No devices yet. add-device <name> makes one.");
  for (const d of list) {
    console.log(
      `${d.name.padEnd(16)} added ${d.addedAt}${d.revokedAt ? `  revoked ${d.revokedAt}` : ""}`,
    );
  }
}

function enrollCode(root) {
  const { access } = dirs(root);
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const code = Array.from(
    crypto.randomBytes(8),
    (b) => alphabet[b % alphabet.length],
  ).join("");
  writeJson(path.join(access, "enroll.json"), {
    hash: hashCode(code),
    expires: Date.now() + 15 * 60 * 1000,
  });
  console.log(`Passkey code: ${code} (valid 15 minutes, once)`);
}

function main(argv = process.argv.slice(2), root = dashboardDir()) {
  const [command, ...rest] = argv;
  const flag = (n) => {
    const i = rest.indexOf(n);
    return i >= 0 ? rest[i + 1] : undefined;
  };
  switch (command) {
    case "init":
      return init(root, { name: flag("--name"), ip: flag("--ip") });
    case "add-device":
      return addDevice(root, rest[0]);
    case "revoke-device":
      return revokeDevice(root, rest[0]);
    case "devices":
      return listDevices(root);
    case "enroll-code":
      return enrollCode(root);
    default:
      console.log(USAGE);
      process.exitCode = command ? 1 : 0;
  }
}

if (require.main === module) {
  try {
    main();
  } catch (e) {
    console.error(e.message ?? e);
    process.exitCode = 1;
  }
}

module.exports = { main };
