#!/usr/bin/env node
/**
 * Setting up and running the dashboard on a home server. Hands out the
 * one-time codes that enrol a device (a passkey on that device), lists and
 * revokes devices. For `--lan`, where the dashboard serves HTTPS itself,
 * also makes a small CA of its own and the server's certificate (behind a
 * proxy with `--proxy`, the proxy has the certificate). Uses the `openssl`
 * command line for that.
 *
 * Run on the server with `npm run ops:pki -- <command>`; see README.md.
 */

const crypto = require("crypto");
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { dashboardDir } = require("./server");
const { hashCode, readDevices, DEVICE_NAME } = require("./lib/access");
const { now, writeJson } = require("./lib/http");

const USAGE = `Usage: npm run ops:pki -- <command>

  enroll-code <device>
                      A one-time code (15 minutes) to type on the sign-in page
                      of that device (laptop, pixel): it then registers a
                      passkey and is in.
  devices             List the devices and their passkeys.
  revoke-device <name>
                      Remove that device's passkeys; its sessions end at their
                      next request.
  init --name <host> [--ip <address>]
                      Only for --lan: make a CA and the server certificate.
                      <host> is the name the devices open (for example
                      ops-host.local); --ip adds the server's address too.`;

function openssl(args, input) {
  return execFileSync("openssl", args, {
    input,
    stdio: [input === undefined ? "ignore" : "pipe", "pipe", "pipe"],
  }).toString();
}

function dirs(root = dashboardDir()) {
  const tls = path.join(root, "tls");
  const access = path.join(root, "access");
  for (const d of [root, tls, access]) {
    fs.mkdirSync(d, { recursive: true, mode: 0o700 });
  }
  return { tls, access };
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
    `Install ${f("ca.crt")} as a trusted CA on each device, then enrol each device with enroll-code <name>.`,
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
    `Revoked ${name}; its passkeys are gone and its sessions end at their next request.`,
  );
}

function listDevices(root) {
  const { access } = dirs(root);
  const list = readDevices(access);
  const keys =
    (fs.existsSync(path.join(access, "passkeys.json")) &&
      JSON.parse(
        fs.readFileSync(path.join(access, "passkeys.json"), "utf8"),
      )) ||
    [];
  if (list.length === 0)
    console.log("No devices yet. enroll-code <name> enrols one.");
  for (const d of list) {
    const mine = d.revokedAt ? [] : keys.filter((k) => k.device === d.name);
    const last = mine
      .map((k) => k.lastUsedAt)
      .filter(Boolean)
      .sort()
      .pop();
    console.log(
      `${d.name.padEnd(16)} added ${d.addedAt}${d.revokedAt ? `  revoked ${d.revokedAt}` : `  ${mine.length} passkey(s)${last ? `, last used ${last}` : ""}`}`,
    );
  }
}

function enrollCode(root, device) {
  if (!DEVICE_NAME.test(device ?? "")) {
    throw new Error(
      "enroll-code <device>: a device name is lowercase letters, digits and dashes, like laptop or pixel.",
    );
  }
  const { access } = dirs(root);
  // 32 letters and digits, no look-alikes: 10 of them are 50 bits.
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const code = Array.from(
    crypto.randomBytes(10),
    (b) => alphabet[b % alphabet.length],
  ).join("");
  writeJson(path.join(access, "enroll.json"), {
    hash: hashCode(code),
    device,
    tries: 0,
    expires: Date.now() + 15 * 60 * 1000,
  });
  console.log(
    `Code for ${device}: ${code} (valid 15 minutes, once). Open the dashboard on ${device} and type it under "New device".`,
  );
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
    case "revoke-device":
      return revokeDevice(root, rest[0]);
    case "devices":
      return listDevices(root);
    case "enroll-code":
      return enrollCode(root, rest[0]);
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
