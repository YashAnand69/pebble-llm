import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { createShowcase } from "../scripts/showcase.mjs";
const readJSON = async (name) =>
  JSON.parse(await readFile(new URL("../" + name, import.meta.url), "utf8"));
const showcase = createShowcase(
  ...(await Promise.all(
    [
      "data/corpus.json",
      "artifacts/canonical-evaluation.json",
      "artifacts/evaluation.json",
    ].map(readJSON),
  )),
);
const siteSource = await readFile(
  new URL("../public/site.js", import.meta.url),
  "utf8",
);
const source = await readFile(
  new URL("../public/app.js", import.meta.url),
  "utf8",
);
class Element {
  constructor(value = "") {
    this.value = value;
    this.textContent = "";
    this.hidden = false;
    this.disabled = false;
    this.dataset = {};
    this.listeners = new Map();
    this.children = [];
    this.style = { setProperty() {} };
    this.classes = new Map();
    this.classList = { toggle: (name, value) => this.classes.set(name, value) };
    this.nested = new Map();
  }
  addEventListener(name, callback) {
    this.listeners.set(name, callback);
  }
  setCustomValidity(value) {
    this.validityMessage = value;
  }
  reportValidity() {
    this.reported = true;
  }
  focus() {
    this.focused = true;
  }
  setAttribute(name, value) {
    this[name] = value;
  }
  replaceChildren(...children) {
    this.children = children;
    if (children[0]?.value && !this.value) this.value = children[0].value;
  }
  querySelector(selector) {
    if (!this.nested.has(selector)) this.nested.set(selector, new Element());
    return this.nested.get(selector);
  }
  scrollIntoView(options) {
    this.scrollOptions = options;
  }
  append(...items) {
    this.children.push(...items);
  }
  emit(name) {
    return this.listeners.get(name)?.({ preventDefault() {} });
  }
}
function setup(
  search = "",
  generation = async (request) => ({
    answer: "Pebble is a small programming language.",
    elapsedMs: 21,
    ...JSON.parse(request.body),
  }),
) {
  const elements = new Map();
  const get = (selector) => {
    if (!elements.has(selector)) elements.set(selector, new Element());
    return elements.get(selector);
  };
  get("#prompt").value = "What is Pebble?";
  get("#temperature").value = "0";
  get("#seed").value = "2026";
  get("#max-new-tokens").value = "96";
  const starter = new Element();
  starter.dataset.prompt = "What is attention?";
  const calls = [];
  const seen = get("#try-seen");
  const reserved = get("#try-reserved");
  const stageButtons = [0, 1, 2].map((index) => {
    const item = new Element();
    item.dataset.stage = String(index);
    return item;
  });
  const codeButtons = ["curl", "javascript"].map((name) => {
    const item = new Element();
    item.dataset.codeTab = name;
    return item;
  });
  const copyCode = new Element();
  copyCode.dataset.copy = "api-example";
  const collections = {
    "[data-prompt]": [starter, seen, reserved],
    "[data-load-demo]": [seen, reserved],
    "[data-stage]": stageButtons,
    "[data-code-tab]": codeButtons,
    "[data-copy]": [copyCode],
  };
  const context = vm.createContext({
    URLSearchParams,
    AbortController,
    setTimeout,
    clearTimeout,
    TypeError,
    window: {
      location: { search },
      scrollY: 0,
      matchMedia: () => ({ matches: true, addEventListener() {} }),
      addEventListener() {},
    },
    navigator: { clipboard: { writeText: async () => {} } },
    requestAnimationFrame: () => 1,
    document: {
      documentElement: new Element(),
      querySelector: get,
      querySelectorAll: (selector) => collections[selector] || [],
      getElementById: (id) => get("#" + id),
      createElement: () => new Element(),
    },
    fetch: async (path, request) => {
      calls.push({ path, request });
      if (path === "/api/generate")
        return { ok: true, json: async () => generation(request) };
      if (path === "/results/showcase.json")
        return { ok: true, json: async () => showcase };
      return {
        ok: true,
        json: async () =>
          path.includes("refinement")
            ? { bestValidationLoss: 0.055105 }
            : path.includes("canonical")
              ? { exactMatches: 38, total: 40 }
              : { exactMatches: 4, total: 40 },
      };
    },
  });
  vm.runInContext(siteSource, context);
  vm.runInContext(source, context);
  return { get, starter, calls, stageButtons, codeButtons };
}
test("linked examples preload text without generating and reject invalid Unicode or oversized questions", async () => {
  const valid = setup("?prompt=What%20is%20attention%3F");
  assert.equal(valid.get("#prompt").value, "What is attention?");
  assert.equal(
    valid.calls.some((call) => call.path === "/api/generate"),
    false,
  );
  assert.match(valid.get("#link-notice").textContent, /Select Generate/);
  for (const value of ["🙂", "x".repeat(161), "   "]) {
    const invalid = setup("?prompt=" + encodeURIComponent(value));
    assert.equal(invalid.get("#prompt").value, "What is Pebble?");
    assert.match(invalid.get("#link-notice").textContent, /not loaded/);
  }
});
test("starters set prompt only and sampling values are validated before requests", async () => {
  const page = setup();
  page.starter.emit("click");
  assert.equal(page.get("#prompt").value, "What is attention?");
  assert.equal(page.get("#prompt").focused, true);
  for (const [selector, value] of [
    ["#seed", "-1"],
    ["#seed", "2147483648"],
    ["#seed", "1.5"],
    ["#max-new-tokens", "15"],
    ["#max-new-tokens", "97"],
    ["#temperature", "2"],
  ]) {
    page.get("#seed").value = "2026";
    page.get("#max-new-tokens").value = "96";
    page.get("#temperature").value = "0";
    page.get(selector).value = value;
    await page.get("#question-form").emit("submit");
  }
  assert.equal(
    page.calls.some((call) => call.path === "/api/generate"),
    false,
  );
});
test("real response metadata drives output and only three recent runs are retained", async () => {
  const page = setup();
  page.get("#seed").value = "7";
  page.get("#max-new-tokens").value = "32";
  page.get("#temperature").value = "0.4";
  for (let i = 0; i < 4; i++) await page.get("#question-form").emit("submit");
  const calls = page.calls.filter((call) => call.path === "/api/generate");
  assert.deepEqual(JSON.parse(calls[0].request.body), {
    prompt: "What is Pebble?",
    temperature: 0.4,
    seed: 7,
    maxNewTokens: 32,
  });
  assert.match(page.get("#timing").textContent, /seed 7 · limit 32/);
  assert.equal(
    page.get("#answer").textContent,
    "Pebble is a small programming language.",
  );
  assert.equal(page.get("#runs").children.length, 3);
  assert.equal(page.get("#copy-answer").disabled, false);
  page.get("#clear-runs").emit("click");
  assert.equal(page.get("#runs").children.length, 0);
  assert.equal(page.get("#recent-runs").hidden, true);
});
test("incomplete sampling metadata is refused and errors restore the interface", async () => {
  const page = setup("", async () => ({ answer: "Incomplete", elapsedMs: 2 }));
  await page.get("#question-form").emit("submit");
  assert.match(page.get("#answer").textContent, /incomplete response/);
  assert.equal(page.get("#generate").disabled, false);
  assert.equal(page.get("#cancel").hidden, true);
  assert.equal(page.get(".response")["aria-busy"], "false");
  assert.equal(page.get("#runs").children.length, 0);
});

test("remote showcase retains measured failures and loads a chosen question without inference", async () => {
  const page = setup();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(page.get("#example-topic").children.length, 40);
  page.get("#example-topic").value = "attention";
  page.get("#example-topic").emit("change");
  const expected = showcase.find((item) => item.topic === "attention");
  assert.equal(
    page.get("#reserved-output").textContent,
    expected.reserved.generated,
  );
  assert.equal(page.get("#reserved-verdict").textContent, "Does not match");
  assert.equal(
    page.get("#reserved-target").querySelector("span").textContent,
    expected.reserved.expected,
  );
  page.get("#try-reserved").emit("click");
  assert.equal(page.get("#prompt").value, expected.reserved.question);
  assert.equal(
    page.calls.some((call) => call.path === "/api/generate"),
    false,
  );
});
test("remote interactive tour and developer tabs coexist with sampling controls", () => {
  const page = setup();
  page.stageButtons[1].emit("click");
  assert.match(page.get("#stage-title").textContent, /Four blocks/);
  assert.match(page.get("#stage-source").href, /model.pebble$/);
  assert.equal(page.stageButtons[1]["aria-pressed"], "true");
  page.codeButtons[1].emit("click");
  assert.match(page.get("#api-example").textContent, /maxNewTokens: 96/);
  assert.match(page.get("#api-example").textContent, /seed: 2026/);
  assert.equal(page.get("#seed").value, "2026");
});
