# PebbleLM 2M model card

## Intended use

Education and experiments with a transformer built and trained in the Pebble programming language. This is a character-level language model for a small synthetic Pebble/programming/machine-learning curriculum. It is not a broadly pretrained assistant, factual reference or production decision system.

## Implementation and architecture

Exactly 2,000,000 trainable float32 weights in 18 unique tensors. Four pre-normalized decoder blocks, four attention heads, width 200, feed-forward width 800, learned context length 299, vocabulary 101. Input/output embeddings are tied. LayerNorm has no affine weights; there are no biases or dropout. Residual output initialization is scaled by the square root of twice the layer count.

`model.pebble` defines the network; other Pebble files define tokenization, data preparation, batching, training, generation and evaluation. The Pebble 2.1 host extension uses TensorFlow.js 4.22.0 and its WASM CPU backend for numerical kernels and automatic differentiation. AdamW is a host primitive. No Python training implementation or external model API is involved.

The parameter equation is `(101 + 299) * 200 + 4 * (4 * 200² + 2 * 200 * 800) = 2,000,000`. All 299 learned positions participate in packed training. This exact context size meets the requested parameter count.

## Data and split

An original MIT-licensed synthetic curriculum authored in `prepare.pebble`: 40 topics, six training question formats per topic (240 examples), two validation formats (80), and one reserved test format (40). No external corpus, TinyTransformer code, TinyTransformer data or pretrained weights were used.

Complete questions differ by split. **Topic answers are shared across training, validation and test.** This is a seen-topic paraphrase benchmark, not evidence of new knowledge or broad reasoning. The corpus is intentionally small and repetitive. Token vocabulary is fixed before evaluation: four special tokens, 95 printable ASCII characters, newline and tab. Unsupported characters become UNK.

## Training and checkpoint selection

Seed 2026; 2,000 AdamW updates; packed batch size 2 × 299 positions; prompt targets and padding masked, EOS supervised. Learning rate warms up for 50 steps toward 0.001 and follows cosine decay to 0.0001. Betas 0.9/0.95, weight decay 0.05, global gradient norm clipped at 1.0. Attention spans the packed row without a separate document-boundary mask.

Validation uses individual padded 96-position examples, with learned positions restarting at zero. Cross entropy is averaged over each example's supervised answer tokens, then equally over examples; units are natural-log nats. Perplexity is the exponential of that document-mean loss. Best checkpoint selection uses validation answer loss only, checked at step 1, every 100 steps and the final step. Reserved test prompts do not select weights.

A second stage refines the selected checkpoint for 1,000 updates using batch 4 with single 96-position documents and a fresh optimizer. Its objective is `(full answer mean CE + 7 * first-32 answer-token mean CE) / 8`. Seed 2027, peak rate 0.0005, 25-step warmup, cosine decay to 0.00005; other AdamW settings stay the same. This trains on the same training split and is designed to improve answer beginnings and the position-zero generation layout. Selection still uses unweighted validation loss; test prompts remain untouched until final evaluation. If refinement does not improve validation, the earlier checkpoint is retained.

Measured results and artifact hashes are recorded in `artifacts/training-report.json`, `artifacts/evaluation.json` and `artifacts/provenance.json` after the run completes. The training history includes every selection checkpoint, not every optimizer update. The reported training duration excludes model construction and initial baseline validation.

## Reproducibility

The runtime release and its source commit are pinned; `package-lock.json` records the distribution integrity. Seeded initialization, document sampling and generation are reproducible within the same environment. Float32 kernels can produce small differences on other architectures or versions. Model checkpoints contain weights and metadata, not AdamW moments; they do not reproduce a seamless resumed optimizer run.

The released checkpoint uses a non-executable header plus contiguous little-endian float32 arrays. Names, shapes, payload length and finite values are validated before parameters are assigned. `npm run verify:artifacts` checks the published SHA-256 hashes.

## Limitations

The model learns patterns and answers from a tiny curriculum. It may produce a fluent answer about the wrong topic, fail on new wording, repeat characters or fail to terminate before the generation limit. Teacher-forced loss can look strong while free generation fails; every generated test answer is included in the evaluation report. Exact match is deliberately strict and does not award semantically similar wording.

It has no retrieval, tool use, conversation training, instruction hierarchy, safety alignment or reliable reasoning capability. There is no basis to claim broad benchmark quality from this dataset. Unknown topics and non-ASCII text are outside its training domain. The 299-position architectural window is not a claim of long-context generalization: evaluation prompts fit in 96 positions.

## License

Source, original curriculum and the released checkpoint are MIT licensed, copyright 2026 Yash Anand. TensorFlow.js/WASM dependencies are Apache-2.0 licensed. The TinyTransformer repository was consulted only for architectural context and size; it is not a source of this checkpoint.
