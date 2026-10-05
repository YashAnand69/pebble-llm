import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createShowcase } from "../scripts/showcase.mjs";
const read = (path) => JSON.parse(readFileSync(path, "utf8"));
const corpus = read("data/corpus.json");
const canonical = read("artifacts/canonical-evaluation.json");
const reserved = read("artifacts/evaluation.json");

test("showcase preserves all measured generations including failures", () => {
  const showcase = createShowcase(corpus, canonical, reserved);
  assert.equal(showcase.length, 40);
  assert.equal(showcase.filter((item) => item.seen.exact).length, 38);
  assert.equal(showcase.filter((item) => item.reserved.exact).length, 4);
  for (const item of showcase) {
    assert.deepEqual(
      item.seen,
      canonical.outputs.find(
        (output) => output.question === item.seen.question,
      ),
    );
    assert.deepEqual(
      item.reserved,
      reserved.outputs.find(
        (output) => output.question === item.reserved.question,
      ),
    );
  }
  const attention = showcase.find((item) => item.topic === "attention");
  assert.equal(attention.seen.exact, true);
  assert.equal(attention.reserved.exact, false);
  assert.notEqual(attention.reserved.generated, attention.reserved.expected);
});

test("showcase refuses missing measurements or misleading exact-match labels", () => {
  assert.throws(
    () => createShowcase(corpus, { ...canonical, outputs: [] }, reserved),
    /Missing published/,
  );
  const changed = structuredClone(reserved);
  changed.outputs[0].exact = !changed.outputs[0].exact;
  assert.throws(() => createShowcase(corpus, canonical, changed));
});
