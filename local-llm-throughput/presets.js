(function () {
  "use strict";

  const NVIDIA_GEFORCE = "https://www.nvidia.com/en-us/geforce/graphics-cards/compare/";
  const NVIDIA_DGX = "https://docs.nvidia.com/dgx/dgx-spark/hardware.html";
  const NVIDIA_RTX_PRO = "https://www.nvidia.com/en-us/products/workstations/rtx-pro/";
  const AMD_GRAPHICS = "https://www.amd.com/en/products/specifications/graphics.html";
  const APPLE_M4 = "https://www.apple.com/newsroom/2024/10/apple-introduces-m4-pro-and-m4-max/";
  const APPLE_STUDIO = "https://www.apple.com/mac-studio/specs/";
  const AMD_HALO = "https://www.amd.com/en/products/processors/desktops/ryzen/ryzen-ai-halo/ryzen-ai-max-plus-395.html";

  window.LLM_PRESETS = Object.freeze({
    updated: "August 11, 2026",
    defaults: {
      hardware: "dgx-spark",
      model: "qwen36-27b",
      quantization: "q4-k-m",
      context: 32768,
      kvBits: 16,
      computeBits: "auto",
      cloud: "gpt56-luna"
    },

    hardware: [
      {
        id: "dgx-spark",
        group: "Unified memory systems",
        name: "NVIDIA DGX Spark",
        memoryType: "unified",
        memoryGB: 128,
        bandwidthGBs: 273,
        computeTops: 1000,
        computeBits: 4,
        computeSparse: true,
        source: NVIDIA_DGX,
        note: "128 GB coherent unified memory. 1 PFLOP FP4 is a structured-sparsity peak; the calculator normalizes it to 500 dense TOPS."
      },
      {
        id: "rtx-spark",
        group: "Unified memory systems",
        name: "RTX Spark / GB10 reference",
        memoryType: "unified",
        memoryGB: 128,
        bandwidthGBs: 273,
        computeTops: 1000,
        computeBits: 4,
        computeSparse: true,
        source: NVIDIA_DGX,
        note: "Reference GB10 configuration. OEM RTX Spark systems can vary; edit with Custom hardware when vendor specifications differ."
      },
      {
        id: "apple-m4-max",
        group: "Unified memory systems",
        name: "Apple M4 Max (128 GB)",
        memoryType: "unified",
        memoryGB: 128,
        bandwidthGBs: 546,
        computeTops: null,
        computeBits: null,
        computeSparse: false,
        source: APPLE_M4,
        note: "Top-memory M4 Max configuration. Apple does not publish a directly comparable low-bit GPU TOPS figure."
      },
      {
        id: "apple-m3-ultra",
        group: "Unified memory systems",
        name: "Apple M3 Ultra (512 GB)",
        memoryType: "unified",
        memoryGB: 512,
        bandwidthGBs: 819,
        computeTops: null,
        computeBits: null,
        computeSparse: false,
        source: APPLE_STUDIO,
        note: "Top-memory M3 Ultra Mac Studio configuration. Compute ceiling is omitted because Apple publishes no comparable low-bit GPU TOPS figure."
      },
      {
        id: "ryzen-ai-max-395",
        group: "Unified memory systems",
        name: "AMD Ryzen AI Max+ 395 (128 GB)",
        memoryType: "unified",
        memoryGB: 128,
        bandwidthGBs: 256,
        computeTops: null,
        computeBits: null,
        computeSparse: false,
        source: AMD_HALO,
        note: "Radeon 8060S integrated GPU with 128 GB LPDDR5X. The NPU's TOPS rating is not used as GPU LLM compute."
      },
      {
        id: "rtx-pro-6000-blackwell",
        group: "NVIDIA workstation GPUs",
        name: "RTX PRO 6000 Blackwell Workstation",
        memoryType: "discrete",
        memoryGB: 96,
        bandwidthGBs: 1792,
        computeTops: 4000,
        computeBits: 4,
        computeSparse: true,
        source: NVIDIA_RTX_PRO,
        note: "96 GB GDDR7. Vendor AI peak is normalized from sparse FP4 to a dense ceiling."
      },
      {
        id: "rtx-5090",
        group: "NVIDIA GeForce 50 series",
        name: "GeForce RTX 5090",
        memoryType: "discrete",
        memoryGB: 32,
        bandwidthGBs: 1792,
        computeTops: 3352,
        computeBits: 4,
        computeSparse: true,
        source: "https://www.nvidia.com/en-us/geforce/graphics-cards/50-series/rtx-5090/",
        note: "32 GB GDDR7. Vendor AI peak is normalized for structured sparsity."
      },
      {
        id: "rtx-5080",
        group: "NVIDIA GeForce 50 series",
        name: "GeForce RTX 5080",
        memoryType: "discrete",
        memoryGB: 16,
        bandwidthGBs: 960,
        computeTops: 1801,
        computeBits: 4,
        computeSparse: true,
        source: NVIDIA_GEFORCE,
        note: "16 GB GDDR7. Vendor AI peak is normalized for structured sparsity."
      },
      {
        id: "rtx-5070-ti",
        group: "NVIDIA GeForce 50 series",
        name: "GeForce RTX 5070 Ti",
        memoryType: "discrete",
        memoryGB: 16,
        bandwidthGBs: 896,
        computeTops: 1406,
        computeBits: 4,
        computeSparse: true,
        source: NVIDIA_GEFORCE,
        note: "16 GB GDDR7. Vendor AI peak is normalized for structured sparsity."
      },
      {
        id: "rtx-5070",
        group: "NVIDIA GeForce 50 series",
        name: "GeForce RTX 5070",
        memoryType: "discrete",
        memoryGB: 12,
        bandwidthGBs: 672,
        computeTops: 988,
        computeBits: 4,
        computeSparse: true,
        source: NVIDIA_GEFORCE,
        note: "12 GB GDDR7. Vendor AI peak is normalized for structured sparsity."
      },
      {
        id: "rtx-4090",
        group: "NVIDIA GeForce 40 series",
        name: "GeForce RTX 4090",
        memoryType: "discrete",
        memoryGB: 24,
        bandwidthGBs: 1008,
        computeTops: 1321,
        computeBits: 8,
        computeSparse: true,
        source: NVIDIA_GEFORCE,
        note: "24 GB GDDR6X. Vendor AI peak is normalized for structured sparsity."
      },
      {
        id: "rtx-4080-super",
        group: "NVIDIA GeForce 40 series",
        name: "GeForce RTX 4080 SUPER",
        memoryType: "discrete",
        memoryGB: 16,
        bandwidthGBs: 736,
        computeTops: 836,
        computeBits: 8,
        computeSparse: true,
        source: NVIDIA_GEFORCE,
        note: "16 GB GDDR6X. Vendor AI peak is normalized for structured sparsity."
      },
      {
        id: "rtx-3090-ti",
        group: "NVIDIA GeForce 30 series",
        name: "GeForce RTX 3090 Ti",
        memoryType: "discrete",
        memoryGB: 24,
        bandwidthGBs: 1008,
        computeTops: 320,
        computeBits: 16,
        computeSparse: true,
        source: "https://www.nvidia.com/en-us/geforce/graphics-cards/30-series/rtx-3090-3090ti/",
        note: "24 GB GDDR6X. Peak FP16 tensor throughput is normalized for structured sparsity."
      },
      {
        id: "rtx-3090",
        group: "NVIDIA GeForce 30 series",
        name: "GeForce RTX 3090",
        memoryType: "discrete",
        memoryGB: 24,
        bandwidthGBs: 936,
        computeTops: 285,
        computeBits: 16,
        computeSparse: true,
        source: "https://www.nvidia.com/en-us/geforce/graphics-cards/30-series/rtx-3090-3090ti/",
        note: "24 GB GDDR6X. Peak FP16 tensor throughput is normalized for structured sparsity."
      },
      {
        id: "rtx-3080-ti",
        group: "NVIDIA GeForce 30 series",
        name: "GeForce RTX 3080 Ti",
        memoryType: "discrete",
        memoryGB: 12,
        bandwidthGBs: 912,
        computeTops: 273,
        computeBits: 16,
        computeSparse: true,
        source: NVIDIA_GEFORCE,
        note: "12 GB GDDR6X. Peak FP16 tensor throughput is normalized for structured sparsity."
      },
      {
        id: "radeon-ai-pro-r9700",
        group: "AMD discrete GPUs",
        name: "Radeon AI PRO R9700",
        memoryType: "discrete",
        memoryGB: 32,
        bandwidthGBs: 640,
        computeTops: 766,
        computeBits: 4,
        computeSparse: false,
        source: "https://www.amd.com/en/products/graphics/workstations/radeon-ai-pro/ai-9000-series/amd-radeon-ai-pro-r9700.html",
        note: "32 GB GDDR6 workstation GPU. Uses AMD's published dense INT4 matrix peak."
      },
      {
        id: "radeon-rx-9070-xt",
        group: "AMD discrete GPUs",
        name: "Radeon RX 9070 XT",
        memoryType: "discrete",
        memoryGB: 16,
        bandwidthGBs: 640,
        computeTops: 779,
        computeBits: 4,
        computeSparse: false,
        source: AMD_GRAPHICS,
        note: "Highest-memory current consumer RDNA 4 preset: 16 GB GDDR6 and AMD's published dense INT4 matrix peak."
      },
      {
        id: "custom",
        group: "Custom",
        name: "Custom hardware",
        memoryType: "discrete",
        memoryGB: 32,
        bandwidthGBs: 1000,
        computeTops: null,
        computeBits: 4,
        computeSparse: false,
        source: null,
        note: "Enter the capacity, bandwidth, and optional dense or sparse compute peak supplied by your hardware vendor."
      }
    ],

    models: [
      {
        id: "qwen36-27b",
        group: "Dense models",
        name: "Qwen3.6-27B",
        totalB: 27,
        activeB: 27,
        architecture: "Dense · hybrid attention",
        maxContext: 262144,
        preferredQuant: "q4-k-m",
        kv: { fullLayers: 16, localLayers: 0, localWindow: 0, kvHeads: 4, headDim: 256 },
        source: "https://huggingface.co/Qwen/Qwen3.6-27B",
        note: "Current dense Qwen preset. Hybrid linear/full attention keeps KV growth lower than a 64-layer full-attention model."
      },
      {
        id: "gemma3-27b",
        group: "Dense models",
        name: "Gemma 3 27B",
        totalB: 27,
        activeB: 27,
        architecture: "Dense · global + sliding attention",
        maxContext: 131072,
        preferredQuant: "q4-k-m",
        kv: { fullLayers: 10, localLayers: 52, localWindow: 1024, kvHeads: 16, headDim: 128 },
        source: "https://huggingface.co/google/gemma-3-27b-it",
        note: "Global attention every sixth layer plus a 1K sliding window on local layers."
      },
      {
        id: "qwen3-32b",
        group: "Dense models",
        name: "Qwen3-32B",
        totalB: 32.8,
        activeB: 32.8,
        architecture: "Dense · full attention",
        maxContext: 40960,
        preferredQuant: "q4-k-m",
        kv: { fullLayers: 64, localLayers: 0, localWindow: 0, kvHeads: 8, headDim: 128 },
        source: "https://huggingface.co/Qwen/Qwen3-32B",
        note: "A larger dense Qwen reference with conventional full-attention KV growth."
      },
      {
        id: "qwen36-35b-a3b",
        group: "Mixture-of-experts models",
        name: "Qwen3.6-35B-A3B",
        totalB: 35,
        activeB: 3,
        architecture: "MoE · 3B active · hybrid attention",
        maxContext: 262144,
        preferredQuant: "q4-k-m",
        kv: { fullLayers: 10, localLayers: 0, localWindow: 0, kvHeads: 2, headDim: 256 },
        source: "https://huggingface.co/Qwen/Qwen3.6-35B-A3B",
        note: "The full 35B weight set must fit, but only about 3B parameters are active for each generated token."
      },
      {
        id: "gpt-oss-120b",
        group: "Mixture-of-experts models",
        name: "GPT-OSS-120B",
        totalB: 117,
        activeB: 5.1,
        architecture: "MoE · 5.1B active · global + sliding attention",
        maxContext: 131072,
        preferredQuant: "native-mxfp4",
        nativeSizeGB: 60.8,
        kv: { fullLayers: 18, localLayers: 18, localWindow: 128, kvHeads: 8, headDim: 64 },
        source: "https://huggingface.co/openai/gpt-oss-120b",
        note: "Released in native MXFP4. The 60.8 GB checkpoint size is used when that native format is selected."
      },
      {
        id: "nemotron3-super",
        group: "Mixture-of-experts models",
        name: "Nemotron 3 Super 120B-A12B",
        totalB: 120,
        activeB: 12,
        architecture: "MoE · 12B active · Mamba hybrid",
        maxContext: 262144,
        preferredQuant: "native-nvfp4",
        nativeSizeGB: 72,
        kv: { fullLayers: 8, localLayers: 0, localWindow: 0, kvHeads: 2, headDim: 128 },
        source: "https://huggingface.co/nvidia/NVIDIA-Nemotron-3-Super-120B-A12B-BF16",
        note: "Hybrid Mamba/MoE model. The native NVFP4 size is an estimate; use the file-size override for a specific checkpoint."
      },
      {
        id: "glm45-air",
        group: "Mixture-of-experts models",
        name: "GLM-4.5-Air 106B-A12B",
        totalB: 106,
        activeB: 12,
        architecture: "MoE · 12B active · full attention",
        maxContext: 131072,
        preferredQuant: "q4-k-m",
        kv: { fullLayers: 46, localLayers: 0, localWindow: 0, kvHeads: 8, headDim: 128 },
        source: "https://huggingface.co/zai-org/GLM-4.5-Air",
        note: "A notable mid-size MoE that can fit in 128 GB-class systems at practical low-bit formats."
      },
      {
        id: "qwen3-235b-a22b",
        group: "Mixture-of-experts models",
        name: "Qwen3-235B-A22B-Instruct-2507",
        totalB: 235,
        activeB: 22,
        architecture: "MoE · 22B active · full attention",
        maxContext: 262144,
        preferredQuant: "q3-k-s",
        kv: { fullLayers: 94, localLayers: 0, localWindow: 0, kvHeads: 4, headDim: 128 },
        source: "https://huggingface.co/Qwen/Qwen3-235B-A22B-Instruct-2507",
        note: "Requires roughly 3-bit weights to fit a 128 GB-class system after runtime reserve and KV cache."
      },
      {
        id: "custom",
        group: "Custom",
        name: "Custom model",
        totalB: 30,
        activeB: 30,
        architecture: "Custom",
        maxContext: null,
        preferredQuant: "q4-k-m",
        kvMiBPer1K: 256,
        source: null,
        note: "Enter total parameters, active parameters, and a linear FP16 KV-cache estimate."
      }
    ],

    quantizations: [
      { id: "fp32", name: "FP32", bitsPerWeight: 32, computeBits: 32, kind: "Full precision" },
      { id: "fp16", name: "FP16 / BF16", bitsPerWeight: 16, computeBits: 16, kind: "Half precision" },
      { id: "q8-0", name: "Q8_0", bitsPerWeight: 8.50, computeBits: 8, kind: "Post-training quantization" },
      { id: "q6-k", name: "Q6_K", bitsPerWeight: 6.56, computeBits: 8, kind: "Post-training quantization" },
      { id: "q5-k-m", name: "Q5_K_M", bitsPerWeight: 5.70, computeBits: 8, kind: "Post-training quantization" },
      { id: "q4-k-m", name: "Q4_K_M", bitsPerWeight: 4.89, computeBits: 4, kind: "Post-training quantization" },
      { id: "q3-k-m", name: "Q3_K_M", bitsPerWeight: 4.00, computeBits: 4, kind: "Post-training quantization" },
      { id: "q3-k-s", name: "Q3_K_S", bitsPerWeight: 3.64, computeBits: 4, kind: "Post-training quantization" },
      { id: "q2-k", name: "Q2_K", bitsPerWeight: 3.16, computeBits: 4, kind: "Post-training quantization" },
      { id: "iq2-xs", name: "IQ2_XS", bitsPerWeight: 2.59, computeBits: 4, kind: "Post-training quantization" },
      { id: "native-fp4", name: "Native FP4", bitsPerWeight: 4, computeBits: 4, kind: "Native low-bit weights" },
      { id: "native-mxfp4", name: "Native MXFP4", bitsPerWeight: 4, computeBits: 4, kind: "Native low-bit weights" },
      { id: "native-nvfp4", name: "Native NVFP4", bitsPerWeight: 4, computeBits: 4, kind: "Native low-bit weights" },
      { id: "native-ternary", name: "Native ternary (1.585-bit theoretical)", bitsPerWeight: 1.585, computeBits: 2, kind: "Purpose-built ternary weights" }
    ],

    cloud: [
      {
        id: "gpt56-luna",
        name: "GPT-5.6 Luna (max)",
        speed: 199.6,
        source: "https://artificialanalysis.ai/models/gpt-5-6-luna/",
        note: "Artificial Analysis, OpenAI API output speed snapshot. Editable for your own observed rate."
      },
      {
        id: "gpt56-terra",
        name: "GPT-5.6 Terra (max)",
        speed: 136.8,
        source: "https://artificialanalysis.ai/models/gpt-5-6-terra",
        note: "Artificial Analysis median/provider snapshot. Editable for your own observed rate."
      },
      {
        id: "gpt56-sol",
        name: "GPT-5.6 Sol (max)",
        speed: 70.6,
        source: "https://artificialanalysis.ai/models/gpt-5-6-sol",
        note: "Artificial Analysis, OpenAI API output speed snapshot. Editable for your own observed rate."
      },
      {
        id: "claude-opus-5",
        name: "Claude Opus 5 (medium)",
        speed: 53.6,
        source: "https://artificialanalysis.ai/models/claude-opus-5-medium",
        note: "Artificial Analysis, Anthropic API output speed snapshot. Editable for your own observed rate."
      },
      {
        id: "claude-fable-5",
        name: "Claude Fable 5 (max, fallback)",
        speed: 73.4,
        source: "https://artificialanalysis.ai/models/claude-fable-5",
        note: "Artificial Analysis benchmark with Opus fallback behavior. Editable for your own observed rate."
      },
      {
        id: "claude-mythos-5",
        name: "Claude Mythos 5 (Fable proxy)",
        speed: 73.4,
        source: "https://platform.claude.com/docs/en/about-claude/models/introducing-claude-fable-5-and-claude-mythos-5",
        note: "Uses Fable 5 speed as an editable proxy because Anthropic documents shared capabilities, but Mythos access is limited and no independent public benchmark is available."
      },
      {
        id: "custom",
        name: "Custom cloud reference",
        speed: 70,
        source: null,
        note: "Enter the streamed output rate you actually observe."
      }
    ]
  });
})();
