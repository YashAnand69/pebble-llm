const form = document.querySelector("#question-form");
const prompt = document.querySelector("#prompt");
const button = document.querySelector("#generate");
const answer = document.querySelector("#answer");
const status = document.querySelector("#status");
const timing = document.querySelector("#timing");
const temperature = document.querySelector("#temperature");
const responsePanel = document.querySelector(".response");
const cancelButton = document.querySelector("#cancel");
const copyButton = document.querySelector("#copy-answer");
const recentRuns = [];
let currentController = null;
let lastAnswer = "";
const validPrompt = (value) =>
  typeof value === "string" &&
  value.trim().length > 0 &&
  value.length <= 160 &&
  /^[\x20-\x7e\n\t]+$/.test(value);

function updateCount() {
  document.querySelector("#character-count").textContent =
    `${prompt.value.length} / 160`;
}
function setPrompt(value, focus = true) {
  prompt.value = value;
  prompt.setCustomValidity("");
  updateCount();
  if (focus) prompt.focus();
}
const linkedPrompt = new URLSearchParams(window.location.search).get("prompt");
if (linkedPrompt !== null) {
  const notice = document.querySelector("#link-notice");
  notice.hidden = false;
  if (validPrompt(linkedPrompt)) {
    setPrompt(linkedPrompt, false);
    notice.textContent =
      "Example loaded from your link. Select Generate answer when you are ready.";
  } else {
    notice.textContent =
      "The linked question was not loaded. Examples must use 1–160 ASCII characters.";
  }
}
updateCount();
temperature.addEventListener("input", () => {
  document.querySelector("#temp-value").value = Number(
    temperature.value,
  ).toFixed(1);
});
prompt.addEventListener("input", () => {
  prompt.setCustomValidity("");
  updateCount();
});
document.querySelectorAll("[data-prompt]").forEach((item) => {
  item.addEventListener("click", () => setPrompt(item.dataset.prompt));
});
cancelButton.addEventListener("click", () => currentController?.abort("user"));
copyButton.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(lastAnswer);
    status.textContent = "Output copied";
  } catch {
    status.textContent = "Copy unavailable — select the output text to copy it";
  }
});
function renderRuns() {
  const list = document.querySelector("#runs");
  list.replaceChildren();
  for (const run of recentRuns) {
    const item = document.createElement("li");
    const title = document.createElement("strong");
    title.textContent = run.question;
    const result = document.createElement("p");
    result.textContent =
      run.answer || "(The model ended its answer immediately.)";
    const meta = document.createElement("span");
    meta.textContent = `Temperature ${run.temperature.toFixed(1)} · ${(run.elapsedMs / 1000).toFixed(2)} seconds · seed ${run.seed} · limit ${run.maxNewTokens}`;
    item.append(title, result, meta);
    list.append(item);
  }
  document.querySelector("#recent-runs").hidden = recentRuns.length === 0;
}
document.querySelector("#clear-runs").addEventListener("click", () => {
  recentRuns.length = 0;
  renderRuns();
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (button.disabled) return;
  const question = prompt.value.trim();
  const selectedTemperature = Number(temperature.value);
  const selectedSeed = Number(document.querySelector("#seed").value);
  const selectedLimit = Number(document.querySelector("#max-new-tokens").value);
  if (!validPrompt(prompt.value)) {
    prompt.setCustomValidity("Enter a question using 1–160 ASCII characters.");
    prompt.reportValidity();
    return;
  }
  if (
    !Number.isFinite(selectedTemperature) ||
    selectedTemperature < 0 ||
    selectedTemperature > 1
  ) {
    status.textContent = "Choose a temperature from 0 to 1.";
    return;
  }
  if (
    !document.querySelector("#seed").value.trim() ||
    !Number.isInteger(selectedSeed) ||
    selectedSeed < 0 ||
    selectedSeed > 2147483647 ||
    !Number.isInteger(selectedLimit) ||
    selectedLimit < 16 ||
    selectedLimit > 96
  ) {
    status.textContent =
      "Use a whole-number seed from 0 to 2147483647 and an output limit from 16 to 96.";
    return;
  }
  button.disabled = true;
  button.setAttribute("aria-busy", "true");
  responsePanel.dataset.state = "loading";
  copyButton.disabled = true;
  cancelButton.hidden = false;
  responsePanel.setAttribute("aria-busy", "true");
  status.textContent = "Generating…";
  answer.textContent = "Predicting one character at a time…";
  timing.textContent =
    "The first request may take longer while the model starts.";
  const controller = new AbortController();
  currentController = controller;
  const timeout = setTimeout(() => controller.abort("timeout"), 60000);
  try {
    const response = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: question,
        temperature: selectedTemperature,
        seed: selectedSeed,
        maxNewTokens: selectedLimit,
      }),
      signal: controller.signal,
    });
    const result = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(
        result?.error ||
          (response.status === 504
            ? "This answer took too long. Please try a shorter question."
            : "The model is temporarily unavailable. Please try again."),
      );
    }
    if (
      !result ||
      typeof result.answer !== "string" ||
      !Number.isFinite(result.elapsedMs) ||
      result.elapsedMs < 0 ||
      result.seed !== selectedSeed ||
      result.maxNewTokens !== selectedLimit ||
      result.temperature !== selectedTemperature
    ) {
      throw new Error(
        "The model returned an incomplete response. Please try again.",
      );
    }
    responsePanel.dataset.state = result.answer.length ? "complete" : "empty";
    lastAnswer = result.answer;
    answer.textContent =
      result.answer || "(The model ended its answer immediately.)";
    status.textContent = "Experiment complete";
    timing.textContent = `${(result.elapsedMs / 1000).toFixed(2)} seconds · temperature ${selectedTemperature.toFixed(1)} · seed ${result.seed} · limit ${result.maxNewTokens}`;
    copyButton.disabled = result.answer.length === 0;
    recentRuns.unshift({
      question,
      answer: result.answer,
      temperature: result.temperature,
      seed: result.seed,
      maxNewTokens: result.maxNewTokens,
      elapsedMs: result.elapsedMs,
    });
    recentRuns.length = Math.min(recentRuns.length, 3);
    renderRuns();
  } catch (error) {
    responsePanel.dataset.state = controller.signal.reason === "user" ? "cancelled" : "error";
    status.textContent =
      controller.signal.reason === "user" ? "Request cancelled" : "Try again";
    answer.textContent = controller.signal.aborted
      ? controller.signal.reason === "user"
        ? "Request cancelled. Your recent experiments are still below."
        : "This answer took too long. Please try a shorter question."
      : error instanceof TypeError
        ? "Could not connect to the model. Check your connection and try again."
        : error.message;
    timing.textContent = "No new result was added to your experiments.";
  } finally {
    clearTimeout(timeout);
    if (currentController === controller) currentController = null;
    responsePanel.setAttribute("aria-busy", "false");
    button.disabled = false;
    button.setAttribute("aria-busy", "false");
    cancelButton.hidden = true;
  }
});

async function loadReport(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error("Report unavailable");
  return response.json();
}
function reportCount(result) {
  if (
    !Number.isInteger(result.exactMatches) ||
    !Number.isInteger(result.total) ||
    result.total < 1 ||
    result.exactMatches < 0 ||
    result.exactMatches > result.total
  )
    throw new Error("Invalid report");
  return `${result.exactMatches} / ${result.total}`;
}
Promise.allSettled([
  loadReport("/results/evaluation.json").then((result) => {
    document.querySelector("#accuracy").textContent = reportCount(result);
    document.querySelector("#reserved-bar").style.width =
      `${(100 * result.exactMatches) / result.total}%`;
  }),
  loadReport("/results/canonical-evaluation.json").then((result) => {
    document.querySelector("#canonical-accuracy").textContent =
      reportCount(result);
    document.querySelector("#canonical-bar").style.width =
      `${(100 * result.exactMatches) / result.total}%`;
  }),
  loadReport("/results/refinement-report.json").then((result) => {
    if (
      !Number.isFinite(result.bestValidationLoss) ||
      result.bestValidationLoss < 0
    )
      throw new Error("Invalid loss");
    document.querySelector("#validation-loss").textContent =
      `${result.bestValidationLoss.toFixed(4)} nats`;
  }),
]).then((results) => {
  document.querySelector("#report-state").textContent = results.every(
    (result) => result.status === "fulfilled",
  )
    ? "Verified release reports loaded"
    : "Showing released measurements; some live reports could not load";
});

const visual = document.querySelector(".model-visual");
const modelReducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)",
);
let frame = null;
function updateVisual() {
  frame = null;
  const offset = (modelReducedMotion.matches || document.documentElement.dataset.motion === "off") ? 0 : Math.min(window.scrollY, 700);
  visual.style.setProperty("--scroll-tilt", `${offset / 100}deg`);
  visual.style.setProperty("--scroll-lift", `${-offset / 22}px`);
}
window.addEventListener(
  "scroll",
  () => {
    if (!frame && !modelReducedMotion.matches)
      frame = requestAnimationFrame(updateVisual);
  },
  { passive: true },
);
modelReducedMotion.addEventListener("change", updateVisual);
window.addEventListener("pebble-motion-change", updateVisual);
updateVisual();

// Load a published example into the real playground without silently generating.
document.querySelectorAll("[data-load-demo]").forEach((item) => {
  item.addEventListener("click", () => {
    setPrompt(item.dataset.prompt, false);
    document.querySelector("#playground").scrollIntoView({
      behavior: (window.matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.motion === "off")
        ? "auto"
        : "smooth",
    });
    prompt.focus({ preventScroll: true });
  });
});

const topicSelect = document.querySelector("#example-topic");
const exampleNote = document.querySelector("#example-note");
fetch("/results/showcase.json")
  .then((response) => {
    if (!response.ok) throw new Error("Examples unavailable");
    return response.json();
  })
  .then((examples) => {
    if (!Array.isArray(examples) || !examples.length)
      throw new Error("No examples");
    const validOutput = (output) =>
      output &&
      typeof output.question === "string" &&
      typeof output.generated === "string" &&
      typeof output.expected === "string" &&
      typeof output.exact === "boolean";
    if (
      !examples.every(
        (item) =>
          typeof item.topic === "string" &&
          validOutput(item.seen) &&
          validOutput(item.reserved),
      )
    ) {
      throw new Error("Invalid examples");
    }
    topicSelect.replaceChildren(
      ...examples.map((item) => {
        const option = document.createElement("option");
        option.value = item.topic;
        option.textContent = item.topic;
        return option;
      }),
    );
    function showTopic() {
      const example = examples.find((item) => item.topic === topicSelect.value);
      if (!example) return;
      for (const name of ["seen", "reserved"]) {
        const output = example[name];
        document.querySelector(`#${name}-question`).textContent =
          output.question;
        document.querySelector(`#${name}-output`).textContent =
          output.generated || "(The model ended immediately.)";
        const verdict = document.querySelector(`#${name}-verdict`);
        verdict.textContent = output.exact ? "Exact match" : "Does not match";
        verdict.classList.toggle("mismatch", !output.exact);
        document.querySelector(`#try-${name}`).dataset.prompt = output.question;
      }
      const target = document.querySelector("#reserved-target");
      target.hidden = example.reserved.exact;
      target.querySelector("span").textContent = example.reserved.expected;
      exampleNote.textContent = `${example.topic} · ${examples.length} topics · recorded greedy outputs`;
      if (!(window.matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.motion === "off")) {
        document
          .querySelector(".example-grid")
          .animate?.([{ opacity: 0.6 }, { opacity: 1 }], { duration: 220 });
      }
    }
    topicSelect.addEventListener("change", showTopic);
    showTopic();
  })
  .catch(() => {
    topicSelect.disabled = true;
    exampleNote.textContent =
      "Example reports are unavailable. The Pebble sample shown is a published result.";
  });

const stages = [
  {
    label: "01 / ENCODE CHARACTERS",
    title: "A fixed vocabulary. Learned vectors.",
    copy: "The tokenizer maps printable ASCII, newline, tab and four special tokens into 101 IDs. Each ID gets a learned 200-dimensional vector, plus a learned position embedding.",
    code: "101 tokens × 200 dimensions + 299 positions × 200 dimensions",
    source: "tokenizer.pebble",
    link: "Inspect the tokenizer ↗",
  },
  {
    label: "02 / ATTEND TO CONTEXT",
    title: "Four blocks. Only earlier tokens.",
    copy: "Four decoder blocks combine causal attention with a 200 → 800 → 200 feed-forward network. Four heads per block attend to the available context. Pre-LayerNorm and residual connections stabilize the computation; future tokens are masked.",
    code: "4 decoder blocks · 4 heads × 50 dimensions · 18 unique trainable tensors",
    source: "model.pebble",
    link: "Inspect the model ↗",
  },
  {
    label: "03 / PREDICT & REPEAT",
    title: "One new character at a time.",
    copy: "The tied embedding projects hidden states into vocabulary scores. Greedy decoding picks the highest score at temperature 0; higher temperatures sample with randomness. Each new token joins the context until EOS or the generation limit.",
    code: "Context → vocabulary scores → next token → updated context",
    source: "sampling.pebble",
    link: "Inspect sampling ↗",
  },
];
document.querySelectorAll("[data-stage]").forEach((button) => {
  button.addEventListener("click", () => {
    const stage = stages[Number(button.dataset.stage)];
    if (!stage) return;
    document.querySelectorAll("[data-stage]").forEach((item) => {
      const active = item === button;
      item.classList.toggle("active", active);
      item.setAttribute("aria-pressed", String(active));
    });
    for (const [id, value] of [
      ["stage-label", stage.label],
      ["stage-title", stage.title],
      ["stage-copy", stage.copy],
      ["stage-code", stage.code],
    ]) {
      document.getElementById(id).textContent = value;
    }
    const link = document.querySelector("#stage-source");
    link.href = `https://github.com/YashAnand69/pebble-llm/blob/main/${stage.source}`;
    link.textContent = stage.link;
    if (!(window.matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.motion === "off")) {
      document.querySelector(".workflow-detail").animate?.(
        [
          { opacity: 0.65, transform: "translateY(4px)" },
          { opacity: 1, transform: "translateY(0)" },
        ],
        { duration: 240, easing: "ease-out" },
      );
    }
  });
});

const codeExamples = {
  curl: `curl https://pebble-llm.vercel.app/api/generate \\\n  -H 'Content-Type: application/json' \\\n  --data '{"prompt":"What is Pebble?","temperature":0,"seed":2026,"maxNewTokens":96}'`,
  javascript: `const response = await fetch(\n  'https://pebble-llm.vercel.app/api/generate', {\n    method: 'POST',\n    headers: {'Content-Type': 'application/json'},\n    body: JSON.stringify({\n      prompt: 'What is Pebble?', temperature: 0,\n      seed: 2026, maxNewTokens: 96\n    })\n  }\n);\nconst result = await response.json();\nif (!response.ok) throw new Error(result.error);\nconsole.log(result.answer);`,
};
document.querySelectorAll("[data-code-tab]").forEach((button) => {
  button.addEventListener("click", () => {
    const code = codeExamples[button.dataset.codeTab];
    if (typeof code !== "string") return;
    document.querySelector("#api-example").textContent = code;
    document
      .querySelectorAll("[data-code-tab]")
      .forEach((item) =>
        item.setAttribute("aria-pressed", String(item === button)),
      );
    document.querySelector("#copy-feedback").textContent = "";
  });
});
