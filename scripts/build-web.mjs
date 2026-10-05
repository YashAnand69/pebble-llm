import { mkdir, copyFile, readFile, writeFile } from "node:fs/promises";
import "./verify-web.mjs";
import { createShowcase } from "./showcase.mjs";
import "./verify-artifacts.mjs";
await mkdir("public/results", { recursive: true });
for (const name of [
  "training-report.json",
  "refinement-report.json",
  "evaluation.json",
  "canonical-evaluation.json",
  "training-curve.svg",
])
  await copyFile(`artifacts/${name}`, `public/results/${name}`);
const [corpus, canonical, reserved] = await Promise.all(
  [
    "data/corpus.json",
    "artifacts/canonical-evaluation.json",
    "artifacts/evaluation.json",
  ].map(async (path) => JSON.parse(await readFile(path, "utf8"))),
);
await writeFile(
  "public/results/showcase.json",
  JSON.stringify(createShowcase(corpus, canonical, reserved)),
);
await copyFile("GUIDE.md", "public/results/usage-guide.md");
