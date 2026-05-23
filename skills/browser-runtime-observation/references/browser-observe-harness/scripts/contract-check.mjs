import fs from "node:fs";
import path from "node:path";

const required = [
  "package.json",
  "README.md",
  "scripts/real-smoke.mjs",
  "scripts/contract-check.mjs",
  "scenarios/public-homepage.json",
  "scenarios/wikipedia-homepage.json"
];

const root = path.resolve(process.cwd());
const missing = required.filter((rel) => !fs.existsSync(path.join(root, rel)));

if (missing.length > 0) {
  console.error(JSON.stringify({ status: "FAIL", missing }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ status: "PASS", checked: required }, null, 2));
