import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const aikbDir = join(rootDir, "src", "content", "aikb");

const requiredFiles = [
  "observations.json",
  "signals.json",
  "patterns.json",
  "reflection.json",
  "knowledge_graph.json",
  "indices.json",
  "governance.json"
];

for (const fileName of requiredFiles) {
  const filePath = join(aikbDir, fileName);
  const payload = JSON.parse(readFileSync(filePath, "utf8"));
  if (!payload || typeof payload !== "object") {
    throw new Error(`Invalid AIKB file: ${fileName}`);
  }
}

const observations = JSON.parse(readFileSync(join(aikbDir, "observations.json"), "utf8"));
const signals = JSON.parse(readFileSync(join(aikbDir, "signals.json"), "utf8"));
const patterns = JSON.parse(readFileSync(join(aikbDir, "patterns.json"), "utf8"));

console.info(`AIKB bundle validated (${observations.version}).`);
console.info(`Observations: ${observations.fields.length}`);
console.info(`Signals: ${signals.mappings.length}`);
console.info(`Patterns: ${patterns.entries.length}`);
