# Contributing

Use Node 24 and `npm ci`. Run `npm test` and `npm run inspect`. The tests verify the exact parameter count, tied weights, tokenizer, causal behavior, gradient training and packed batching. CI also recreates the corpus and performs a disposable one-step training run.

Keep the model, tokenizer, dataset, training and inference in Pebble. JavaScript should only launch the interpreter, run tests, or implement host infrastructure in the upstream Pebble project. Do not replace the model with a Python/JavaScript training implementation or a hosted language-model API.

Describe experiment changes and preserve honest split/evaluation reporting. Validation selects checkpoints; keep reserved test prompts out of training and selection. Do not commit private data or credentials. New datasets need explicit redistribution and training rights. This repository's source, original curriculum and released checkpoint are MIT licensed.
