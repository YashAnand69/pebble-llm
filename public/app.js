const form = document.querySelector("#question-form");
const prompt = document.querySelector("#prompt");
const button = document.querySelector("#generate");
const answer = document.querySelector("#answer");
const status = document.querySelector("#status");
const timing = document.querySelector("#timing");
const temperature = document.querySelector("#temperature");
const responsePanel = document.querySelector(".response");

temperature.addEventListener("input", () => {
  document.querySelector("#temp-value").value = Number(
    temperature.value,
  ).toFixed(1);
});
prompt.addEventListener("input", () => prompt.setCustomValidity(""));
document.querySelectorAll("[data-prompt]").forEach((item) => {
  item.addEventListener("click", () => {
    prompt.value = item.dataset.prompt;
    prompt.setCustomValidity("");
    prompt.focus();
  });
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (button.disabled) return;
  const question = prompt.value.trim();
  if (
    !question ||
    prompt.value.length > 160 ||
    !/^[\x20-\x7e\n\t]+$/.test(prompt.value)
  ) {
    prompt.setCustomValidity("Enter a question using 1–160 ASCII characters.");
    prompt.reportValidity();
    return;
  }
  button.disabled = true;
  responsePanel.setAttribute("aria-busy", "true");
  status.textContent = "Generating…";
  answer.textContent = "Thinking one character at a time…";
  timing.textContent = "";
  copyAnswer.disabled = true;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);
  try {
    const response = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: question,
        temperature: Number(temperature.value),
      }),
      signal: controller.signal,
    });
    // Platform errors may be HTML or plain text rather than our API's JSON.
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
      !Number.isFinite(result.elapsedMs)
    ) {
      throw new Error(
        "The model returned an incomplete response. Please try again.",
      );
    }
    answer.textContent =
      result.answer || "(The model ended its answer immediately.)";
    status.textContent = "Complete";
    copyAnswer.disabled = false;
    timing.textContent = `${(result.elapsedMs / 1000).toFixed(2)} seconds · 2,000,000 parameters · seed 2026`;
  } catch (error) {
    status.textContent = "Try again";
    answer.textContent =
      error.name === "AbortError"
        ? "This answer took too long. Please try a shorter question."
        : error instanceof TypeError
          ? "Could not connect to the model. Check your connection and try again."
          : error.message;
  } finally {
    clearTimeout(timeout);
    responsePanel.setAttribute("aria-busy", "false");
    button.disabled = false;
  }
});

fetch("/results/evaluation.json")
  .then((response) => {
    if (!response.ok) throw new Error("Report unavailable");
    return response.json();
  })
  .then((result) => {
    if (
      !Number.isInteger(result.exactMatches) ||
      !Number.isInteger(result.total) ||
      result.total < 1 ||
      result.exactMatches < 0 ||
      result.exactMatches > result.total
    ) {
      throw new Error("Invalid report");
    }
    document.querySelector("#accuracy").textContent =
      `${result.exactMatches} / ${result.total}`;
  })
  .catch(() => {
    document.querySelector("#accuracy").textContent = "See report";
  });

// Load a published example into the real playground without silently generating.
document.querySelectorAll("[data-load-demo]").forEach((item) => {
  item.addEventListener("click", () => {
    document
      .querySelector("#playground")
      .scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
      });
    prompt.focus({ preventScroll: true });
  });
});

const copyAnswer = document.querySelector("#copy-answer");
copyAnswer.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(answer.textContent);
    copyAnswer.textContent = "Copied";
  } catch {
    copyAnswer.textContent = "Select text to copy";
  }
  setTimeout(() => {
    copyAnswer.textContent = "Copy answer";
  }, 2500);
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
      if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        document
          .querySelector(".example-grid")
          .animate([{ opacity: 0.6 }, { opacity: 1 }], { duration: 220 });
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
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      document.querySelector(".workflow-detail").animate(
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
  curl: `curl https://pebble-llm.vercel.app/api/generate \\\n  -H 'Content-Type: application/json' \\\n  --data '{"prompt":"What is Pebble?","temperature":0}'`,
  javascript: `const response = await fetch(\n  'https://pebble-llm.vercel.app/api/generate', {\n    method: 'POST',\n    headers: {'Content-Type': 'application/json'},\n    body: JSON.stringify({\n      prompt: 'What is Pebble?', temperature: 0\n    })\n  }\n);\nconst result = await response.json();\nif (!response.ok) throw new Error(result.error);\nconsole.log(result.answer);`,
};
document.querySelectorAll("[data-code-tab]").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelector("#api-example").textContent =
      codeExamples[button.dataset.codeTab];
    document
      .querySelectorAll("[data-code-tab]")
      .forEach((item) =>
        item.setAttribute("aria-pressed", String(item === button)),
      );
    document.querySelector("#copy-feedback").textContent = "";
  });
});
