import assert from "node:assert/strict";

// Derive displayed examples from measured artifacts, never substitute corpus answers.
export function createShowcase(corpus, canonical, reserved) {
  const topics = [...new Set(corpus.train.map((example) => example.topic))];
  return topics.map((topic) => {
    const seen = canonical.outputs.find(
      (output) => output.question === `What is ${topic}?`,
    );
    const heldOut = reserved.outputs.find(
      (output) => output.question === `How does ${topic} work?`,
    );
    assert.ok(seen && heldOut, `Missing published generations for ${topic}`);
    for (const output of [seen, heldOut]) {
      assert.equal(typeof output.generated, "string");
      assert.equal(output.exact, output.generated === output.expected);
    }
    return { topic, seen, reserved: heldOut };
  });
}
