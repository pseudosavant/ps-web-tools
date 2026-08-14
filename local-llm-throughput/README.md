# Local LLM Throughput Calculator

A no-build, client-side calculator for estimating whether an open-weight model fits in one GPU or unified-memory accelerator and its ideal batch-1 output-token ceiling.

## Scope

- One discrete GPU VRAM pool or one integrated/unified-memory system
- Batch size 1 interactive decode
- Hard capacity gate: configurations that require CPU/GPU offload do not receive a throughput estimate
- Separate memory-bandwidth and peak-compute ceilings
- Dense, MoE, native low-bit, and theoretical native ternary weight formats
- Context-sensitive KV-cache estimates, including global/sliding/hybrid attention presets
- Editable cloud output-speed comparisons
- URL-encoded share state and local last-state persistence
- A model-side driver summary showing how total parameters, quantization, and active parameters affect the result

## Estimation model

The calculator presents three first-order model economics:

- **Total parameters are the capacity bill.** All model weights must fit, including inactive experts in an MoE model.
- **Quantization is the compression factor.** Fewer bits per weight reduce estimated storage and weight traffic; compute gains depend on available low-bit kernels.
- **Active parameters are the work per token.** Dense models activate all parameters, while MoE models can use fewer parameters for each generated token.

The model footprint is weight storage plus KV cache. The memory-bandwidth ceiling is:

```text
tokens/s = memory bandwidth / (active weight bytes + readable KV-cache bytes)
```

The compute ceiling is:

```text
tokens/s = adjusted dense TOPS / (2 × active parameters)
```

The displayed result is the lower available ceiling. It intentionally omits time to first token, prompt ingestion, framework overhead, kernel efficiency, routing overhead, sampling, and recurrent-state traffic, so it should be treated as an optimistic upper bound rather than a benchmark.

Hardware values come from vendor specification pages linked in `presets.js`. Model architecture and KV-cache inputs come from the linked official model cards/configurations. GPT-5.6 family labels follow [official OpenAI model guidance](https://developers.openai.com/api/docs/guides/latest-model); editable output-speed snapshots are sourced separately from Artificial Analysis.
