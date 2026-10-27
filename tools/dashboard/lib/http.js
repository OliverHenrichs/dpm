/** Small helpers the tabs and the server share. */

const fs = require("fs");

function now() {
  return new Date().toISOString();
}

function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

/** Writes JSON readable only by the operator, atomically. */
function writeJson(file, value) {
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, file);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (d) => {
      body += d;
      if (body.length > 1e6) {
        reject(httpError(413, "Too large."));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(httpError(400, "Not JSON."));
      }
    });
  });
}

module.exports = { now, httpError, readJson, writeJson, readBody };
