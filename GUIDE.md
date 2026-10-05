# Using PebbleLM

PebbleLM is an exactly 2,000,000-parameter, character-level transformer for a 40-topic Pebble, programming and machine-learning curriculum. It is an educational model you can inspect and retrain. It is not a general-purpose assistant, and short, fluent output can still be wrong.

## 1. Try the playground

Open https://pebble-llm.vercel.app/#playground. Start with `What is Pebble?`, `What is attention?`, `What is tensors?` or `What is functions?`.

1. Enter a short question using 1–160 ASCII characters.
2. Leave temperature at 0 for greedy, deterministic generation with seed 2026.
3. Select **Generate answer** and allow a few seconds for CPU inference.
4. Compare the output with the topic examples and published evaluations. **Copy answer** copies a successful result.

The playground generates up to 96 character tokens, ending sooner if the model chooses EOS. Higher temperature, up to 1, adds randomness; it does not make answers more accurate. The demo uses top-k 20 and the released checkpoint. It runs inference on the server, not on your device.

The example explorer shows recorded generations rather than new inference. **Try this question live** fills the playground; select **Generate answer** to run it. Compare `What is attention?` with `How does attention work?` to see how wording affects the model.

## 2. Understand the limits

- Seen training wording achieved 38/40 exact greedy answers. Reserved wording achieved 4/40.
- Topics and target answers overlap across training, validation and test. This is a phrasing experiment, not a broad knowledge benchmark.
- The vocabulary has 101 tokens, including printable ASCII, newline, tab and four special tokens. The web demo rejects non-ASCII input; the CLI tokenizer maps unsupported characters to UNK.
- The 299-position context counts character tokens, not words. The model has no chat memory, retrieval, tools or conversation training.
- Do not use it as a factual authority, general coding assistant or production decision system.

See `MODEL_CARD.md`, `artifacts/evaluation.json` and `artifacts/canonical-evaluation.json` for full results, including failures.

## 3. Run the released checkpoint locally

Install Node 24, Git and npm. No GPU, Python trainer, external model API or API key is needed.

```sh
git clone https://github.com/YashAnand69/pebble-llm.git
cd pebble-llm
npm ci
npm run verify:artifacts
npm run inspect
npm run generate -- --prompt "What is Pebble?" --temperature 0 --max-tokens 96 --seed 2026
```

`inspect` confirms 2,000,000 parameters and the WASM backend. `verify:artifacts` checks the published hashes. The released checkpoint is approximately 8 MB; total process memory also includes the runtime, tensor buffers and activations.

Try sampling:

```sh
npm run generate -- --prompt "What is attention?" --temperature 0.5 --top-k 10 --max-tokens 96
```

The CLI supports `--checkpoint`, `--prompt`, `--temperature`, `--top-k`, `--max-tokens` (1–1000) and `--seed`. It loads `checkpoints/best.pebble-weights` by default. Output quality is limited by training even when you increase the generation limit.

## 4. Call the demo API

```sh
curl https://pebble-llm.vercel.app/api/generate \
  -H 'Content-Type: application/json' \
  --data '{"prompt":"What is Pebble?","temperature":0}'
```

The successful JSON response has `answer` (string), `parameters` (2000000) and `elapsedMs` (measured model-run time). Timing varies by prompt and server conditions; it is not an advertised latency guarantee. Responses use `Cache-Control: no-store`.

Node 24 / server-side JavaScript:

```js
const response = await fetch("https://pebble-llm.vercel.app/api/generate", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ prompt: "What is Pebble?", temperature: 0 }),
});
const result = await response.json();
if (!response.ok) throw new Error(result.error);
console.log(result.answer);
```

The endpoint accepts a JSON object with a required ASCII `prompt` (1–160 characters) and optional numeric `temperature` (0–1, default 0). Its output limit is fixed at 96 character tokens. Use POST; other methods return 405 with `Allow: POST`. Invalid inputs return 400; inference failures return a generic 500 error. Platform timeouts can return non-JSON responses, so real integrations should handle them too.

Use the full URL from server-side code. Browser code on the deployed site's origin can use `/api/generate`; cross-origin browser requests are not supported by this API's CORS policy. This public endpoint is an educational demo, not a guaranteed high-volume service. For an independent application, run your own copy and set appropriate traffic controls.

## 5. Inspect, evaluate and retrain

Start with `tokenizer.pebble`, `model.pebble` and `sampling.pebble`. The network uses four decoder blocks, four heads, width 200, a 200 → 800 → 200 feed-forward network, pre-LayerNorm, causal attention and tied token embeddings. Training and evaluation also live in Pebble.

Use a separate clone for experiments: training overwrites local checkpoint and report files, so the release hashes will no longer match. Checkpoints contain weights and metadata, not optimizer moments for seamless resume.

```sh
npm test
npm run prepare:data
npm run train -- --steps 2000 --batch 2 --length 299 --seed 2026 --lr 0.001 --report-every 100
npm run refine -- --steps 1000 --batch 4 --seed 2027 --lr 0.0005 --report-every 100
npm run evaluate
npm run evaluate:canonical
```

Validation selects the checkpoint. Keep reserved test prompts out of training and selection. The published main run took 43.27 minutes and refinement 12.16 minutes on an Apple M5 Pro; other machines will differ. Review `README.md` for the full training protocol and `CONTRIBUTING.md` for contribution rules.

## 6. Run the website locally

```sh
npm run build
npx vercel link
npx vercel dev
```

Select your Vercel project when linking. The build verifies all release hashes and publishes report assets. Serving `public/` alone lets you preview the interface, but does not run `/api/generate`. Vercel account access is required for its local development workflow and deployment; no application environment variables or external model credentials are required.

## Troubleshooting

- **Non-ASCII or empty question:** use a short ASCII question; remove emoji and unsupported characters.
- **Wrong or garbled answer:** try a canonical `What is ...?` question at temperature 0. This is a model limitation, not necessarily a deployment error.
- **Timeout / unavailable:** retry once with a shorter question. For API clients, check the HTTP status and handle non-JSON platform errors.
- **Missing runtime / wrong Node:** use Node 24 and run `npm ci` from the repository root.
- **Hash mismatch:** restore the official artifacts from Git before deploying, or publish a newly evaluated release with its own provenance. Do not disable the verification gate.

Code, original data and released weights are MIT licensed. TensorFlow.js/WASM dependencies retain their Apache-2.0 licenses.
