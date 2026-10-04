/**
 * Deploys firestore.rules to the project named in .env (FIREBASE_PROJECT_ID),
 * so the project id never has to be committed. Needs `firebase login` once.
 * This changes production: every installed app is checked against the result.
 */
const { execFileSync } = require("child_process");

const project = process.env.FIREBASE_PROJECT_ID;
if (!project) {
  console.error("FIREBASE_PROJECT_ID is not set; see .env.example.");
  process.exit(1);
}

execFileSync(
  "npx",
  [
    "-y",
    "firebase-tools@15.32.1",
    "deploy",
    "--only",
    "firestore:rules",
    "--project",
    project,
  ],
  { stdio: "inherit" },
);
