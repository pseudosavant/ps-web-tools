(function () {
  "use strict";

  const presets = window.LLM_PRESETS;
  const STORAGE_KEY = "local-llm-throughput-v1";
  const GB = 1e9;
  const MIB = 1024 * 1024;

  if (!presets) {
    throw new Error("Calculator presets did not load.");
  }

  const byId = (items, id) => items.find((item) => item.id === id);
  const element = (id) => document.getElementById(id);

  const ui = {
    form: element("calculator-form"),
    hardwarePreset: element("hardware-preset"),
    hardwareSummary: element("hardware-summary"),
    customHardwareFields: element("custom-hardware-fields"),
    customMemoryType: element("custom-memory-type"),
    customMemoryGB: element("custom-memory-gb"),
    customBandwidth: element("custom-bandwidth"),
    customCompute: element("custom-compute"),
    customComputeBits: element("custom-compute-bits"),
    customComputeSparse: element("custom-compute-sparse"),
    modelPreset: element("model-preset"),
    modelSummary: element("model-summary"),
    customModelFields: element("custom-model-fields"),
    customTotalParams: element("custom-total-params"),
    customActiveParams: element("custom-active-params"),
    customKvMiB: element("custom-kv-mib"),
    quantization: element("quantization"),
    contextLength: element("context-length"),
    cloudPreset: element("cloud-preset"),
    cloudSpeed: element("cloud-speed"),
    cloudSourceNote: element("cloud-source-note"),
    kvPrecision: element("kv-precision"),
    modelSizeOverride: element("model-size-override"),
    computePrecision: element("compute-precision"),
    memoryReserve: element("memory-reserve"),
    copyLink: element("copy-link"),
    reset: element("reset-calculator"),
    toast: element("toast"),
    dataUpdated: element("data-updated"),
    resultStatusLabel: element("result-status-label"),
    throughputValue: element("throughput-value"),
    fitBadge: element("fit-badge"),
    bottleneckBadge: element("bottleneck-badge"),
    heroExplanation: element("hero-explanation"),
    resultGuidance: element("result-guidance"),
    resultAnnouncement: element("result-announcement"),
    validationNote: element("input-validation-note"),
    capacityDriver: element("capacity-driver"),
    bandwidthDriver: element("bandwidth-driver"),
    computeDriver: element("compute-driver"),
    localSpeedBar: element("local-speed-bar"),
    cloudMarker: element("cloud-marker"),
    cloudSpeedLabel: element("cloud-speed-label"),
    comparisonCopy: element("comparison-copy"),
    footprintValue: element("footprint-value"),
    headroomValue: element("headroom-value"),
    bandwidthCeiling: element("bandwidth-ceiling"),
    bandwidthDetail: element("bandwidth-detail"),
    computeCeiling: element("compute-ceiling"),
    computeDetail: element("compute-detail"),
    cloudRatio: element("cloud-ratio"),
    cloudDetail: element("cloud-detail"),
    memoryTitle: element("memory-title"),
    usableMemoryValue: element("usable-memory-value"),
    memoryBar: element("memory-bar"),
    weightsSegment: element("weights-segment"),
    kvSegment: element("kv-segment"),
    weightsMemory: element("weights-memory"),
    kvMemory: element("kv-memory"),
    freeMemory: element("free-memory"),
    mathWeights: element("math-weights"),
    mathKv: element("math-kv"),
    mathTraffic: element("math-traffic"),
    mathBandwidth: element("math-bandwidth"),
    mathOps: element("math-ops"),
    mathCompute: element("math-compute")
  };

  let toastTimer;

  function appendGroupedOptions(select, items) {
    const groups = new Map();
    items.forEach((item) => {
      const groupName = item.group || "Other";
      if (!groups.has(groupName)) groups.set(groupName, []);
      groups.get(groupName).push(item);
    });

    groups.forEach((groupItems, groupName) => {
      const group = document.createElement("optgroup");
      group.label = groupName;
      groupItems.forEach((item) => {
        const option = document.createElement("option");
        option.value = item.id;
        option.textContent = item.name;
        group.appendChild(option);
      });
      select.appendChild(group);
    });
  }

  function appendFlatOptions(select, items) {
    items.forEach((item) => {
      const option = document.createElement("option");
      option.value = item.id;
      option.textContent = item.name;
      select.appendChild(option);
    });
  }

  function numberValue(input, fallback = 0) {
    const value = Number(input.value);
    return Number.isFinite(value) ? value : fallback;
  }

  function positive(value, fallback) {
    return Number.isFinite(value) && value > 0 ? value : fallback;
  }

  function currentHardware() {
    const preset = byId(presets.hardware, ui.hardwarePreset.value) || presets.hardware[0];
    if (preset.id !== "custom") return preset;

    const compute = numberValue(ui.customCompute, 0);
    return {
      ...preset,
      memoryType: ui.customMemoryType.value,
      memoryGB: positive(numberValue(ui.customMemoryGB), 32),
      bandwidthGBs: positive(numberValue(ui.customBandwidth), 1000),
      computeTops: compute > 0 ? compute : null,
      computeBits: positive(numberValue(ui.customComputeBits), 4),
      computeSparse: ui.customComputeSparse.checked
    };
  }

  function currentModel() {
    const preset = byId(presets.models, ui.modelPreset.value) || presets.models[0];
    if (preset.id !== "custom") return preset;

    const totalB = positive(numberValue(ui.customTotalParams), 30);
    const activeB = Math.min(positive(numberValue(ui.customActiveParams), totalB), totalB);
    return {
      ...preset,
      totalB,
      activeB,
      kvMiBPer1K: Math.max(0, numberValue(ui.customKvMiB, 256))
    };
  }

  function currentQuantization() {
    return byId(presets.quantizations, ui.quantization.value) || presets.quantizations[0];
  }

  function currentCloud() {
    return byId(presets.cloud, ui.cloudPreset.value) || presets.cloud[0];
  }

  function createPill(icon, text) {
    const pill = document.createElement("span");
    pill.className = "summary-pill";
    const iconElement = document.createElement("i");
    iconElement.className = `fa-solid ${icon}`;
    iconElement.setAttribute("aria-hidden", "true");
    const label = document.createElement("span");
    label.textContent = text;
    pill.append(iconElement, label);
    return pill;
  }

  function appendPresetNote(container, preset) {
    const details = document.createElement("details");
    details.className = "preset-details";
    const summary = document.createElement("summary");
    summary.innerHTML = '<i class="fa-solid fa-circle-info" aria-hidden="true"></i><span>About this preset</span><i class="fa-solid fa-chevron-down preset-chevron" aria-hidden="true"></i>';
    const note = document.createElement("p");
    note.className = "preset-note";
    note.append(document.createTextNode(`${preset.note || ""} `));
    if (preset.source) {
      const link = document.createElement("a");
      link.href = preset.source;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = "Source";
      note.appendChild(link);
    }
    details.append(summary, note);
    container.appendChild(details);
  }

  function renderPresetSummaries() {
    const hardware = currentHardware();
    const model = currentModel();
    const context = Math.max(128, numberValue(ui.contextLength, presets.defaults.context));

    ui.customHardwareFields.hidden = ui.hardwarePreset.value !== "custom";
    ui.customModelFields.hidden = ui.modelPreset.value !== "custom";

    ui.hardwareSummary.replaceChildren(
      createPill("fa-memory", `${formatCompact(hardware.memoryGB)} GB ${hardware.memoryType === "unified" ? "unified" : "VRAM"}`),
      createPill("fa-water", `${formatCompact(hardware.bandwidthGBs)} GB/s`)
    );
    if (hardware.computeTops) {
      const dense = hardware.computeTops / (hardware.computeSparse ? 2 : 1);
      ui.hardwareSummary.appendChild(createPill("fa-microchip", `${formatCompact(dense)} dense TOPS @ ${hardware.computeBits}-bit`));
    } else {
      ui.hardwareSummary.appendChild(createPill("fa-microchip", "Compute ceiling unavailable"));
    }
    appendPresetNote(ui.hardwareSummary, hardware);

    ui.modelSummary.replaceChildren(
      createPill("fa-cubes", `${formatCompact(model.totalB)}B total`),
      createPill("fa-bolt", `${formatCompact(model.activeB)}B active`),
      createPill("fa-diagram-project", model.architecture)
    );
    if (model.maxContext) {
      const contextLabel = context > model.maxContext
        ? `${formatTokenCount(context)} exceeds published ${formatTokenCount(model.maxContext)}`
        : `Up to ${formatTokenCount(model.maxContext)} published context`;
      ui.modelSummary.appendChild(createPill("fa-align-left", contextLabel));
    }
    appendPresetNote(ui.modelSummary, model);

    const cloud = currentCloud();
    ui.cloudSourceNote.replaceChildren(document.createTextNode(`${cloud.note} `));
    if (cloud.source) {
      const link = document.createElement("a");
      link.href = cloud.source;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = "Source";
      ui.cloudSourceNote.appendChild(link);
    }
  }

  function kvCacheBytes(model, context, kvBits) {
    if (model.kv) {
      const bytesPerElement = kvBits / 8;
      const bytesPerLayerToken = 2 * model.kv.kvHeads * model.kv.headDim * bytesPerElement;
      const fullTokenLayers = model.kv.fullLayers * context;
      const localContext = Math.min(context, model.kv.localWindow || context);
      const localTokenLayers = model.kv.localLayers * localContext;
      return bytesPerLayerToken * (fullTokenLayers + localTokenLayers);
    }

    return (model.kvMiBPer1K || 0) * MIB * (context / 1000) * (kvBits / 16);
  }

  function nativeCheckpointSize(model, quantization) {
    if (model.id === "gpt-oss-120b" && quantization.id === "native-mxfp4") return model.nativeSizeGB;
    if (model.id === "nemotron3-super" && quantization.id === "native-nvfp4") return model.nativeSizeGB;
    return null;
  }

  function updateInputValidation() {
    let hasInvalidInput = false;
    ui.form.querySelectorAll('input[type="number"]').forEach((input) => {
      const inputWrapper = input.closest(".input-with-unit");
      if (input.validity.valid) {
        input.removeAttribute("aria-invalid");
        inputWrapper?.classList.remove("has-error");
      } else {
        input.setAttribute("aria-invalid", "true");
        inputWrapper?.classList.add("has-error");
        hasInvalidInput = true;
      }
    });
    ui.validationNote.hidden = !hasInvalidInput;
  }

  function calculate() {
    updateInputValidation();
    const hardware = currentHardware();
    const model = currentModel();
    const quantization = currentQuantization();
    const cloud = currentCloud();
    const context = Math.max(128, Math.round(numberValue(ui.contextLength, presets.defaults.context)));
    const kvBits = positive(numberValue(ui.kvPrecision), 16);
    const cloudSpeed = positive(numberValue(ui.cloudSpeed), cloud.speed);
    const overrideGB = numberValue(ui.modelSizeOverride, 0);
    const nativeSize = nativeCheckpointSize(model, quantization);

    const weightBytes = overrideGB > 0
      ? overrideGB * GB
      : nativeSize
        ? nativeSize * GB
        : model.totalB * 1e9 * quantization.bitsPerWeight / 8;

    const kvBytes = kvCacheBytes(model, context, kvBits);
    const footprintBytes = weightBytes + kvBytes;
    const automaticReserveGB = hardware.memoryType === "unified"
      ? Math.max(hardware.memoryGB * 0.10, 8)
      : hardware.memoryGB * 0.10;
    const reserveInput = numberValue(ui.memoryReserve, 0);
    const reserveGB = reserveInput > 0 ? reserveInput : automaticReserveGB;
    const usableGB = Math.max(0, hardware.memoryGB - reserveGB);
    const usableBytes = usableGB * GB;
    const fits = footprintBytes <= usableBytes;
    const headroomBytes = usableBytes - footprintBytes;

    const activeShare = Math.min(1, model.activeB / model.totalB);
    const activeWeightTrafficBytes = weightBytes * activeShare;
    const trafficBytes = activeWeightTrafficBytes + kvBytes;
    const bandwidthTps = hardware.bandwidthGBs * GB / Math.max(trafficBytes, 1);

    const computeBits = ui.computePrecision.value === "auto"
      ? quantization.computeBits
      : positive(Number(ui.computePrecision.value), quantization.computeBits);
    const operationsPerToken = 2 * model.activeB * 1e9;
    let denseComputeTops = null;
    let adjustedComputeTops = null;
    let computeTps = null;

    if (hardware.computeTops) {
      denseComputeTops = hardware.computeTops / (hardware.computeSparse ? 2 : 1);
      adjustedComputeTops = denseComputeTops;
      if (computeBits > hardware.computeBits) {
        adjustedComputeTops *= hardware.computeBits / computeBits;
      }
      computeTps = adjustedComputeTops * 1e12 / operationsPerToken;
    }

    const limitingTps = computeTps === null ? bandwidthTps : Math.min(bandwidthTps, computeTps);
    const bottleneck = computeTps !== null && computeTps < bandwidthTps ? "compute" : "bandwidth";

    const result = {
      hardware,
      model,
      quantization,
      cloud,
      context,
      kvBits,
      cloudSpeed,
      weightBytes,
      kvBytes,
      footprintBytes,
      reserveGB,
      usableGB,
      usableBytes,
      fits,
      headroomBytes,
      activeWeightTrafficBytes,
      trafficBytes,
      bandwidthTps,
      computeBits,
      operationsPerToken,
      denseComputeTops,
      adjustedComputeTops,
      computeTps,
      limitingTps,
      bottleneck,
      nativeSize,
      overrideGB
    };

    renderPresetSummaries();
    renderResults(result);
    persistState();
    updateUrl();
  }

  function renderResults(result) {
    const {
      hardware,
      model,
      quantization,
      cloud,
      context,
      kvBits,
      cloudSpeed,
      weightBytes,
      kvBytes,
      footprintBytes,
      usableGB,
      usableBytes,
      fits,
      headroomBytes,
      activeWeightTrafficBytes,
      trafficBytes,
      bandwidthTps,
      computeBits,
      operationsPerToken,
      adjustedComputeTops,
      computeTps,
      limitingTps,
      bottleneck,
      nativeSize,
      overrideGB
    } = result;

    const isMoe = model.activeB < model.totalB;
    const weightBasis = overrideGB > 0
      ? `${formatGB(weightBytes / GB)} file`
      : nativeSize
        ? `${formatGB(weightBytes / GB)} native checkpoint`
        : `${formatGB(weightBytes / GB)} weights`;
    const activeTrafficLabel = isMoe ? "active weights" : "weights";

    ui.capacityDriver.textContent = `${formatCompact(model.totalB)}B total · ${quantization.name} · ${weightBasis}`;
    ui.bandwidthDriver.textContent = `Ideal: ${formatGB(activeWeightTrafficBytes / GB)} ${activeTrafficLabel} + ${formatGB(kvBytes / GB)} KV/token`;
    ui.computeDriver.textContent = `${formatCompact(model.activeB)}B active · ≈${formatCompact(operationsPerToken / 1e12)} TOP/token`;

    ui.footprintValue.textContent = `${formatGB(footprintBytes / GB)} used`;
    ui.headroomValue.textContent = fits
      ? `${formatGB(headroomBytes / GB)} usable headroom`
      : `${formatGB(Math.abs(headroomBytes) / GB)} over usable memory`;
    ui.bandwidthCeiling.textContent = `${formatRate(bandwidthTps)} tok/s`;
    ui.bandwidthDetail.textContent = `${formatGB(trafficBytes / GB)} read per output token`;
    ui.computeCeiling.textContent = computeTps === null ? "Not published" : `${formatRate(computeTps)} tok/s`;
    ui.computeDetail.textContent = computeTps === null
      ? "Bandwidth-only estimate"
      : `${formatCompact(adjustedComputeTops)} dense TOPS at ${computeBits}-bit assumption`;

    ui.fitBadge.classList.toggle("does-not-fit", !fits);
    ui.fitBadge.innerHTML = fits
      ? '<i class="fa-solid fa-circle-check" aria-hidden="true"></i><span>Fits in memory</span>'
      : '<i class="fa-solid fa-circle-xmark" aria-hidden="true"></i><span>Does not fit</span>';

    if (!fits) {
      ui.resultStatusLabel.textContent = "Offload required";
      ui.throughputValue.textContent = "—";
      ui.bottleneckBadge.hidden = true;
      ui.heroExplanation.textContent = `Does not fit: ${formatGB(footprintBytes / GB)} required versus ${formatGB(usableGB)} usable ${hardware.memoryType === "unified" ? "unified memory" : "VRAM"}.`;
      ui.resultGuidance.textContent = "Try a smaller model, lower-bit quantization, or an accelerator with more memory.";
      ui.resultAnnouncement.textContent = `${model.name} does not fit in usable accelerator memory.`;
    } else {
      ui.resultStatusLabel.textContent = "Ideal output speed";
      ui.throughputValue.textContent = formatRate(limitingTps);
      ui.bottleneckBadge.hidden = false;
      const limitText = bottleneck === "compute" ? "Limited by compute" : "Limited by RAM bandwidth";
      ui.bottleneckBadge.textContent = limitText;
      const contextWarning = model.maxContext && context > model.maxContext
        ? ` Context exceeds the preset’s published ${formatTokenCount(model.maxContext)} limit.`
        : "";
      const missingCompute = computeTps === null
        ? " No comparable compute peak is published."
        : " Real software will be slower than this ideal ceiling.";
      ui.heroExplanation.textContent = `${model.name} fits without offload.${missingCompute}${contextWarning}`;
      ui.resultGuidance.textContent = bottleneck === "compute"
        ? "More compute or fewer active parameters would help most."
        : "Faster RAM or fewer bytes per token would help most.";
      ui.resultAnnouncement.textContent = `${model.name}: ${formatRate(limitingTps)} tokens per second ideal output speed. ${limitText}.`;
    }

    renderCloudComparison(fits ? limitingTps : null, cloudSpeed, cloud.name);
    renderMemoryBar(weightBytes, kvBytes, usableBytes, fits, result.reserveGB, hardware.memoryGB);

    const ratio = fits ? limitingTps / cloudSpeed : null;
    if (ratio === null) {
      ui.cloudRatio.textContent = "No comparison";
      ui.cloudDetail.textContent = "Model must fit first";
    } else if (ratio >= 1) {
      ui.cloudRatio.textContent = `${formatRatio(ratio)}× cloud`;
      ui.cloudDetail.textContent = "Ideal local ceiling versus streamed output";
    } else {
      ui.cloudRatio.textContent = `${formatPercent(ratio)} of cloud`;
      ui.cloudDetail.textContent = `${formatRatio(1 / ratio)}× slower than the reference`;
    }

    const storageBasis = overrideGB > 0
      ? `${formatGB(overrideGB)} GB file-size override`
      : nativeSize
        ? `${formatGB(nativeSize)} GB native checkpoint`
        : `${formatCompact(model.totalB)}B × ${quantization.bitsPerWeight} bits ÷ 8`;
    ui.mathWeights.textContent = `${storageBasis} = ${formatGB(weightBytes / GB)} GB`;
    ui.mathKv.textContent = `${formatTokenCount(context)} context × ${kvBits}-bit KV = ${formatGB(kvBytes / GB)} GB`;
    ui.mathTraffic.textContent = `${formatGB(activeWeightTrafficBytes / GB)} active weights + ${formatGB(kvBytes / GB)} KV = ${formatGB(trafficBytes / GB)} GB`;
    ui.mathBandwidth.textContent = `${formatCompact(hardware.bandwidthGBs)} GB/s ÷ ${formatGB(trafficBytes / GB)} GB = ${formatRate(bandwidthTps)} tok/s`;
    ui.mathOps.textContent = `2 × ${formatCompact(model.activeB)}B active parameters = ${formatCompact(operationsPerToken / 1e12)} TOP/token`;
    ui.mathCompute.textContent = computeTps === null
      ? "No comparable preset compute figure"
      : `${formatCompact(adjustedComputeTops)} TOP/s ÷ ${formatCompact(operationsPerToken / 1e12)} TOP/token = ${formatRate(computeTps)} tok/s`;
  }

  function renderCloudComparison(localSpeed, cloudSpeed, cloudName) {
    const maxSpeed = Math.max(localSpeed || 0, cloudSpeed, 1);
    const localPercent = localSpeed === null ? 0 : Math.max(1, localSpeed / maxSpeed * 100);
    const cloudPercent = Math.max(0, Math.min(100, cloudSpeed / maxSpeed * 100));
    ui.localSpeedBar.style.width = `${localPercent}%`;
    ui.cloudMarker.style.left = `${cloudPercent}%`;
    ui.cloudSpeedLabel.textContent = `${cloudName}: ${formatRate(cloudSpeed)} tok/s`;

    if (localSpeed === null) {
      ui.comparisonCopy.textContent = "No local throughput comparison is shown until the model fits entirely in usable accelerator memory.";
      return;
    }

    const ratio = localSpeed / cloudSpeed;
    ui.comparisonCopy.textContent = ratio >= 1
      ? `The ideal local ceiling is ${formatRatio(ratio)}× the selected cloud output rate.`
      : `The selected cloud output rate is ${formatRatio(1 / ratio)}× the ideal local ceiling.`;
  }

  function renderMemoryBar(weightBytes, kvBytes, usableBytes, fits, reserveGB, totalMemoryGB) {
    const weightPercentRaw = usableBytes > 0 ? weightBytes / usableBytes * 100 : 100;
    const kvPercentRaw = usableBytes > 0 ? kvBytes / usableBytes * 100 : 0;
    const weightPercent = Math.min(100, weightPercentRaw);
    const kvPercent = Math.min(Math.max(0, 100 - weightPercent), kvPercentRaw);
    const freeBytes = Math.max(0, usableBytes - weightBytes - kvBytes);

    ui.weightsSegment.style.width = `${weightPercent}%`;
    ui.kvSegment.style.width = `${kvPercent}%`;
    ui.memoryBar.classList.toggle("over-capacity", !fits);
    ui.weightsMemory.textContent = formatGB(weightBytes / GB);
    ui.kvMemory.textContent = formatGB(kvBytes / GB);
    ui.freeMemory.textContent = fits ? formatGB(freeBytes / GB) : "0 GB";
    ui.usableMemoryValue.textContent = `${formatGB(usableBytes / GB)} usable`;
    ui.memoryTitle.textContent = `${formatGB(totalMemoryGB)} installed minus ${formatGB(reserveGB)} runtime reserve.`;
  }

  function formatRate(value) {
    if (!Number.isFinite(value)) return "—";
    if (value >= 100) return Math.round(value).toLocaleString();
    if (value >= 10) return value.toFixed(1);
    return value.toFixed(2);
  }

  function formatCompact(value) {
    if (!Number.isFinite(value)) return "—";
    return value.toLocaleString(undefined, { maximumFractionDigits: value < 10 ? 2 : 1 });
  }

  function formatGB(value) {
    if (!Number.isFinite(value)) return "—";
    if (value >= 100) return `${value.toFixed(0)} GB`;
    if (value >= 10) return `${value.toFixed(1)} GB`;
    return `${value.toFixed(2)} GB`;
  }

  function formatTokenCount(value) {
    if (value >= 1024 && value % 1024 === 0) return `${value / 1024}K`;
    return Math.round(value).toLocaleString();
  }

  function formatRatio(value) {
    if (value >= 10) return value.toFixed(0);
    return value.toFixed(1);
  }

  function formatPercent(value) {
    const percent = value * 100;
    return percent >= 10 ? `${percent.toFixed(0)}%` : `${percent.toFixed(1)}%`;
  }

  function readState() {
    return {
      hardware: ui.hardwarePreset.value,
      model: ui.modelPreset.value,
      quantization: ui.quantization.value,
      context: Math.max(128, Math.round(numberValue(ui.contextLength, presets.defaults.context))),
      kvBits: positive(numberValue(ui.kvPrecision), 16),
      computeBits: ui.computePrecision.value,
      cloud: ui.cloudPreset.value,
      cloudSpeed: positive(numberValue(ui.cloudSpeed), currentCloud().speed),
      modelSize: numberValue(ui.modelSizeOverride, 0),
      reserve: numberValue(ui.memoryReserve, 0),
      customMemoryType: ui.customMemoryType.value,
      customMemoryGB: positive(numberValue(ui.customMemoryGB), 32),
      customBandwidth: positive(numberValue(ui.customBandwidth), 1000),
      customCompute: numberValue(ui.customCompute, 0),
      customComputeBits: positive(numberValue(ui.customComputeBits), 4),
      customComputeSparse: ui.customComputeSparse.checked,
      customTotalB: positive(numberValue(ui.customTotalParams), 30),
      customActiveB: positive(numberValue(ui.customActiveParams), 30),
      customKvMiB: Math.max(0, numberValue(ui.customKvMiB, 256))
    };
  }

  function persistState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(readState()));
    } catch (_) {
      // Storage is optional; the URL remains shareable.
    }
  }

  function storedState() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY));
      return value && typeof value === "object" ? value : null;
    } catch (_) {
      return null;
    }
  }

  function urlState() {
    const query = new URLSearchParams(window.location.search);
    if (![...query.keys()].length) return null;
    const bool = (key) => query.get(key) === "1";
    const number = (key) => query.has(key) ? Number(query.get(key)) : undefined;
    return {
      hardware: query.get("h") || undefined,
      model: query.get("m") || undefined,
      quantization: query.get("q") || undefined,
      context: number("ctx"),
      kvBits: number("kv"),
      computeBits: query.get("cb") || undefined,
      cloud: query.get("cloud") || undefined,
      cloudSpeed: number("cloudTps"),
      modelSize: number("size"),
      reserve: number("reserve"),
      customMemoryType: query.get("cmt") || undefined,
      customMemoryGB: number("cmem"),
      customBandwidth: number("cbw"),
      customCompute: number("ctops"),
      customComputeBits: number("ctbits"),
      customComputeSparse: query.has("cts") ? bool("cts") : undefined,
      customTotalB: number("mt"),
      customActiveB: number("ma"),
      customKvMiB: number("mkv")
    };
  }

  function validId(items, value, fallback) {
    return value && byId(items, value) ? value : fallback;
  }

  function applyState(state) {
    const merged = {
      hardware: presets.defaults.hardware,
      model: presets.defaults.model,
      quantization: presets.defaults.quantization,
      context: presets.defaults.context,
      kvBits: presets.defaults.kvBits,
      computeBits: presets.defaults.computeBits,
      cloud: presets.defaults.cloud,
      cloudSpeed: byId(presets.cloud, presets.defaults.cloud).speed,
      modelSize: 0,
      reserve: 0,
      customMemoryType: "discrete",
      customMemoryGB: 32,
      customBandwidth: 1000,
      customCompute: 0,
      customComputeBits: 4,
      customComputeSparse: false,
      customTotalB: 30,
      customActiveB: 30,
      customKvMiB: 256,
      ...(state || {})
    };

    ui.hardwarePreset.value = validId(presets.hardware, merged.hardware, presets.defaults.hardware);
    ui.modelPreset.value = validId(presets.models, merged.model, presets.defaults.model);
    ui.quantization.value = validId(presets.quantizations, merged.quantization, presets.defaults.quantization);
    ui.contextLength.value = positive(Number(merged.context), presets.defaults.context);
    ui.kvPrecision.value = [4, 8, 16].includes(Number(merged.kvBits)) ? String(merged.kvBits) : "16";
    ui.computePrecision.value = ["auto", "2", "4", "8", "16", "32"].includes(String(merged.computeBits)) ? String(merged.computeBits) : "auto";
    ui.cloudPreset.value = validId(presets.cloud, merged.cloud, presets.defaults.cloud);
    ui.cloudSpeed.value = positive(Number(merged.cloudSpeed), currentCloud().speed);
    ui.modelSizeOverride.value = Number(merged.modelSize) > 0 ? Number(merged.modelSize) : "";
    ui.memoryReserve.value = Number(merged.reserve) > 0 ? Number(merged.reserve) : "";
    ui.customMemoryType.value = merged.customMemoryType === "unified" ? "unified" : "discrete";
    ui.customMemoryGB.value = positive(Number(merged.customMemoryGB), 32);
    ui.customBandwidth.value = positive(Number(merged.customBandwidth), 1000);
    ui.customCompute.value = Number(merged.customCompute) > 0 ? Number(merged.customCompute) : "";
    ui.customComputeBits.value = [4, 8, 16, 32].includes(Number(merged.customComputeBits)) ? String(merged.customComputeBits) : "4";
    ui.customComputeSparse.checked = Boolean(merged.customComputeSparse);
    ui.customTotalParams.value = positive(Number(merged.customTotalB), 30);
    ui.customActiveParams.value = positive(Number(merged.customActiveB), 30);
    ui.customKvMiB.value = Math.max(0, Number(merged.customKvMiB) || 256);
  }

  function updateUrl() {
    const state = readState();
    const query = new URLSearchParams();
    query.set("h", state.hardware);
    query.set("m", state.model);
    query.set("q", state.quantization);
    query.set("ctx", state.context);
    query.set("kv", state.kvBits);
    query.set("cb", state.computeBits);
    query.set("cloud", state.cloud);
    query.set("cloudTps", state.cloudSpeed);
    if (state.modelSize > 0) query.set("size", state.modelSize);
    if (state.reserve > 0) query.set("reserve", state.reserve);

    if (state.hardware === "custom") {
      query.set("cmt", state.customMemoryType);
      query.set("cmem", state.customMemoryGB);
      query.set("cbw", state.customBandwidth);
      if (state.customCompute > 0) query.set("ctops", state.customCompute);
      query.set("ctbits", state.customComputeBits);
      if (state.customComputeSparse) query.set("cts", "1");
    }

    if (state.model === "custom") {
      query.set("mt", state.customTotalB);
      query.set("ma", state.customActiveB);
      query.set("mkv", state.customKvMiB);
    }

    const nextUrl = `${window.location.pathname}?${query.toString()}${window.location.hash}`;
    try {
      history.replaceState(null, "", nextUrl);
    } catch (_) {
      // Some file:// environments restrict history updates; calculation still works.
    }
  }

  async function copyShareLink() {
    updateUrl();
    const link = window.location.href;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(link);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = link;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        textarea.remove();
      }
      showToast("Share link copied");
    } catch (_) {
      showToast("Could not copy the link");
    }
  }

  function showToast(message) {
    clearTimeout(toastTimer);
    ui.toast.textContent = message;
    ui.toast.classList.add("visible");
    toastTimer = setTimeout(() => ui.toast.classList.remove("visible"), 1800);
  }

  function resetCalculator() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (_) {
      // Storage is optional.
    }
    applyState(null);
    calculate();
    showToast("Defaults restored");
  }

  function onModelChange() {
    const model = byId(presets.models, ui.modelPreset.value);
    if (!model) return;
    ui.quantization.value = model.preferredQuant || presets.defaults.quantization;
    if (model.maxContext && numberValue(ui.contextLength) > model.maxContext) {
      ui.contextLength.value = model.maxContext;
    }
  }

  function onCloudChange() {
    const cloud = currentCloud();
    ui.cloudSpeed.value = cloud.speed;
  }

  function initialize() {
    appendGroupedOptions(ui.hardwarePreset, presets.hardware);
    appendGroupedOptions(ui.modelPreset, presets.models);
    appendFlatOptions(ui.quantization, presets.quantizations);
    appendFlatOptions(ui.cloudPreset, presets.cloud);
    ui.dataUpdated.textContent = presets.updated;

    applyState(urlState() || storedState());

    ui.modelPreset.addEventListener("change", onModelChange);
    ui.cloudPreset.addEventListener("change", onCloudChange);
    ui.form.addEventListener("input", calculate);
    ui.form.addEventListener("change", calculate);
    ui.copyLink.addEventListener("click", copyShareLink);
    ui.reset.addEventListener("click", resetCalculator);
    document.querySelectorAll("[data-context]").forEach((button) => {
      button.addEventListener("click", () => {
        ui.contextLength.value = button.dataset.context;
        calculate();
      });
    });

    calculate();
  }

  initialize();
})();
