
const G = 9.80665;
const MPH_PER_MPS = 2.2369362921;
const MAX_HISTORY = 20;
const ROLLING_WINDOW_MS = 30000;
const ROLLING_NODE_COUNT = 240;
const ROLLING_BUCKET_MS = ROLLING_WINDOW_MS / (ROLLING_NODE_COUNT - 1);
const SPEED_DISPLAY_WINDOW_MS = 1000;
const SPEED_DISPLAY_BUFFER_MAX = 80;
const DISPLAY_SPEED_RECENCY_FLOOR = 0.15;
const CALIBRATION_TAP_SETTLE_MS = 120;
const CALIBRATION_CAPTURE_MS = 1500;
const CALIBRATION_MIN_CAPTURE_MS = 900;
const CALIBRATION_MIN_SAMPLES = 12;
const CALIBRATION_RETRY_BACKOFF_MS = 1200;
const URL_MAX_LENGTH = 7000;
const PRECAL_STILL_MS = 450;
const PRECAL_LINEAR_STILL_MS2 = 0.18;
const READY_STATIONARY_MS = 320;
const LAUNCH_HORIZONTAL_THRESHOLD_MS2 = 1.05;
const LAUNCH_INFERENCE_MIN_MS = 220;
const LAUNCH_INFERENCE_MAX_MS = 520;
const LAUNCH_DIRECTION_CONFIDENCE_MIN = 0.82;
const LAUNCH_DIRECTION_MIN_IMPULSE_MPS = 0.18;
const STOP_COMPLETE_MPH = 1.0;
const RUN_MIN_COMPLETE_MS = 1800;
const MAX_RUN_DURATION_MS = 30000;
const RUN_REJECT_LATERAL_G = 0.22;
const RUN_REJECT_LATERAL_MS = 220;
const LINEAR_ACCEL_MISSING_LIMIT = 6;
const MAX_LONG_ACCEL_MS2 = 14;
const MAX_SPEED_MPH = 130;
const SPLIT_SPEEDS_MPH = [30, 45, 60, 100];
const URL_COMPRESSION_PREFIXES = {
  "deflate-raw": "zdr:",
  gzip: "zg:",
};

const STORAGE_KEYS = {
  calibration: "accellab:calibration:v1",
  history: "accellab:history:v1",
  settings: "accellab:settings:v1",
};

const SMOOTHING_TAU_SEC = {
  off: 0,
  normal: 0.07,
  high: 0.14,
};

const el = {
  testType: document.getElementById("testType"),
  enableSensors: document.getElementById("enableSensors"),
  audioToggle: document.getElementById("audioToggle"),
  hapticToggle: document.getElementById("hapticToggle"),
  autoDisarmToggle: document.getElementById("autoDisarmToggle"),
  smoothingSelect: document.getElementById("smoothingSelect"),
  vehicleWeight: document.getElementById("vehicleWeight"),
  statusLine: document.getElementById("statusLine"),
  speedDisplay: document.getElementById("speedDisplay"),
  runSignal: document.getElementById("runSignal"),
  longG: document.getElementById("longG"),
  latG: document.getElementById("latG"),
  accelMs2: document.getElementById("accelMs2"),
  longChart: document.getElementById("longChart"),
  latChart: document.getElementById("latChart"),
  speedChart: document.getElementById("speedChart"),
  accelChart: document.getElementById("accelChart"),
  historyList: document.getElementById("historyList"),
  runResult: document.getElementById("runResult"),
  runSplits: document.getElementById("runSplits"),
  hpEstimate: document.getElementById("hpEstimate"),
};

const state = {
  testType: "accel",
  sensorEnabled: false,
  lastMotionTs: 0,
  calibration: null,
  settings: {
    audio: true,
    haptics: false,
    autoDisarmOnComplete: true,
    smoothing: "normal",
    vehicleWeightLb: 3600,
  },
  rolling: createRollingState(),
  filters: {
    initialized: false,
    longEmaMs2: 0,
    latEmaMs2: 0,
    biasMs2: 0,
    stationaryMs: 0,
  },
  live: {
    longG: 0,
    latG: 0,
    longMs2: 0,
    speedMps: 0,
    displaySpeedMps: 0,
  },
  speedDisplayWindow: [],
  calibrationCapture: null,
  preCalStillMs: 0,
  preCalRetryBlockedUntilTs: 0,
  readyStillMs: 0,
  launchInference: null,
  isRunning: false,
  currentRun: null,
  history: [],
  selectedRunId: null,
  urlSyncTimer: 0,
  lastUiDrawTs: 0,
  lastScoreSample: null,
  lastMotionSample: null,
  missingLinearAccelSamples: 0,
};

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
let urlCompressionFormatPromise = null;

function setStatus(message, tone = "neutral") {
  el.statusLine.textContent = message;
  el.statusLine.className = `status ${tone}`;
}

function updateArmButton() {
  el.enableSensors.textContent = state.sensorEnabled ? "Disarm sensors" : "Arm sensors";
}

function setRunSignal(message, mode = "ready") {
  el.runSignal.textContent = message;
  el.runSignal.className = "run-signal";
  if (mode === "running") {
    el.runSignal.classList.add("running");
  } else if (mode === "alert") {
    el.runSignal.classList.add("alert");
  }
}

function nowPerf() {
  return performance.now();
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function vec(x = 0, y = 0, z = 0) {
  return { x, y, z };
}

function add(a, b) {
  return vec(a.x + b.x, a.y + b.y, a.z + b.z);
}

function sub(a, b) {
  return vec(a.x - b.x, a.y - b.y, a.z - b.z);
}

function scale(v, s) {
  return vec(v.x * s, v.y * s, v.z * s);
}

function dot(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function norm(v) {
  return Math.hypot(v.x, v.y, v.z);
}

function normalize(v) {
  const n = norm(v);
  return n > 1e-6 ? scale(v, 1 / n) : vec(0, 0, 0);
}

function cross(a, b) {
  return vec(
    a.y * b.z - a.z * b.y,
    a.z * b.x - a.x * b.z,
    a.x * b.y - a.y * b.x,
  );
}

function projectOntoPlane(v, normalUnit) {
  return sub(v, scale(normalUnit, dot(v, normalUnit)));
}

function mphToMps(mph) {
  return mph / MPH_PER_MPS;
}

function mpsToMph(mps) {
  return mps * MPH_PER_MPS;
}

function alphaForTimeConstant(dtSec, tauSec) {
  if (!Number.isFinite(tauSec) || tauSec <= 0) {
    return 1;
  }
  return 1 - Math.exp(-dtSec / tauSec);
}

function interpolateValue(a, b, ratio) {
  return a + (b - a) * ratio;
}

function interpolateVec(a, b, ratio) {
  return vec(
    interpolateValue(a.x, b.x, ratio),
    interpolateValue(a.y, b.y, ratio),
    interpolateValue(a.z, b.z, ratio),
  );
}

function projectHorizontal(dynamic, vertical) {
  return vertical ? projectOntoPlane(dynamic, vertical) : dynamic;
}

function createMotionSample(perfTs, dtSec, dynamic, vertical) {
  const horizontal = projectHorizontal(dynamic, vertical);
  return {
    perfTs,
    dtSec,
    dynamic,
    horizontal,
    horizontalMagMs2: norm(horizontal),
  };
}

function rebaseMotionSampleDt(sample, startPerfTs) {
  return {
    ...sample,
    dtSec: Math.max(0, (sample.perfTs - startPerfTs) / 1000),
  };
}

function interpolateMotionSample(prevSample, nextSample, ratio) {
  const dynamic = interpolateVec(prevSample.dynamic, nextSample.dynamic, ratio);
  const horizontal = interpolateVec(prevSample.horizontal, nextSample.horizontal, ratio);
  return {
    perfTs: interpolateValue(prevSample.perfTs, nextSample.perfTs, ratio),
    dtSec: interpolateValue(prevSample.dtSec, nextSample.dtSec, ratio),
    dynamic,
    horizontal,
    horizontalMagMs2: norm(horizontal),
  };
}

function createScoreSample(baseSample, longMs2, latG, speedMps) {
  return {
    ...baseSample,
    longMs2,
    longG: longMs2 / G,
    latG,
    speedMps,
    speedMph: mpsToMph(speedMps),
  };
}

function interpolateScoreSample(prevSample, nextSample, ratio) {
  return {
    perfTs: interpolateValue(prevSample.perfTs, nextSample.perfTs, ratio),
    dtSec: interpolateValue(prevSample.dtSec, nextSample.dtSec, ratio),
    longMs2: interpolateValue(prevSample.longMs2, nextSample.longMs2, ratio),
    longG: interpolateValue(prevSample.longG, nextSample.longG, ratio),
    latG: interpolateValue(prevSample.latG, nextSample.latG, ratio),
    speedMps: interpolateValue(prevSample.speedMps, nextSample.speedMps, ratio),
    speedMph: interpolateValue(prevSample.speedMph, nextSample.speedMph, ratio),
  };
}

function findMotionThresholdCrossing(prevSample, nextSample, target) {
  if (!prevSample || !nextSample) {
    return null;
  }
  const start = prevSample.horizontalMagMs2;
  const end = nextSample.horizontalMagMs2;
  if (!Number.isFinite(start) || !Number.isFinite(end) || !(start < target && end >= target)) {
    return null;
  }
  const span = end - start;
  if (Math.abs(span) < 1e-6) {
    return nextSample;
  }
  return interpolateMotionSample(prevSample, nextSample, clamp((target - start) / span, 0, 1));
}

function findScoreThresholdCrossing(prevSample, nextSample, key, target, direction = "either") {
  if (!prevSample || !nextSample) {
    return null;
  }
  const start = prevSample[key];
  const end = nextSample[key];
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return null;
  }

  const crossed = direction === "rising"
    ? start < target && end >= target
    : direction === "falling"
      ? start > target && end <= target
      : (start < target && end >= target) || (start > target && end <= target);
  if (!crossed) {
    return null;
  }

  const span = end - start;
  if (Math.abs(span) < 1e-6) {
    return nextSample;
  }
  const ratio = clamp((target - start) / span, 0, 1);
  return interpolateScoreSample(prevSample, nextSample, ratio);
}

function appendRunSample(run, sample) {
  const entry = {
    t: Math.max(0, sample.perfTs - run.startPerfTs),
    longG: sample.longG,
    latG: sample.latG,
    speedMph: sample.speedMph,
  };
  const last = run.samples[run.samples.length - 1];
  if (last && Math.abs(last.t - entry.t) < 0.5) {
    run.samples[run.samples.length - 1] = entry;
    return;
  }
  run.samples.push(entry);
  if (run.samples.length > 3000) {
    run.samples.shift();
  }
}

function createLaunchInference(anchorSample) {
  return {
    startPerfTs: anchorSample.perfTs,
    anchorSample,
    samples: [],
    vectorImpulse: vec(0, 0, 0),
    totalImpulse: 0,
  };
}

function resetLaunchInference() {
  state.launchInference = null;
}

function captureLaunchInferenceSample(sample) {
  if (!state.launchInference) {
    return;
  }
  const last = state.launchInference.samples[state.launchInference.samples.length - 1];
  if (!last || Math.abs(last.perfTs - sample.perfTs) >= 0.5) {
    state.launchInference.samples.push(sample);
  } else {
    state.launchInference.samples[state.launchInference.samples.length - 1] = sample;
  }
  state.launchInference.vectorImpulse = add(
    state.launchInference.vectorImpulse,
    scale(sample.horizontal, sample.dtSec),
  );
  state.launchInference.totalImpulse += sample.horizontalMagMs2 * sample.dtSec;
}

function base64UrlEncodeBytes(bytes) {
  let binary = "";
  for (const b of bytes) {
    binary += String.fromCharCode(b);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecodeBytes(encoded) {
  const pad = "=".repeat((4 - (encoded.length % 4)) % 4);
  const b64 = encoded.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function base64UrlEncodeString(text) {
  return base64UrlEncodeBytes(textEncoder.encode(text));
}

function base64UrlDecodeString(encoded) {
  return textDecoder.decode(base64UrlDecodeBytes(encoded));
}

async function readStreamBytes(stream) {
  const response = new Response(stream);
  const buffer = await response.arrayBuffer();
  return new Uint8Array(buffer);
}

async function compressBytes(bytes, format) {
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream(format));
  return readStreamBytes(stream);
}

async function decompressBytes(bytes, format) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream(format));
  return readStreamBytes(stream);
}

async function detectUrlCompressionFormat() {
  if (typeof CompressionStream !== "function" || typeof DecompressionStream !== "function") {
    return null;
  }
  for (const format of ["deflate-raw", "gzip"]) {
    try {
      const probeInput = textEncoder.encode("accellab");
      const compressed = await compressBytes(probeInput, format);
      const restored = await decompressBytes(compressed, format);
      if (textDecoder.decode(restored) === "accellab") {
        return format;
      }
    } catch {
      // Try the next supported format.
    }
  }
  return null;
}

function getUrlCompressionFormat() {
  if (!urlCompressionFormatPromise) {
    urlCompressionFormatPromise = detectUrlCompressionFormat();
  }
  return urlCompressionFormatPromise;
}

function getCompressionPrefix(format) {
  return URL_COMPRESSION_PREFIXES[format] || null;
}

function parseCompressedUrlPrefix(encoded) {
  for (const [format, prefix] of Object.entries(URL_COMPRESSION_PREFIXES)) {
    if (encoded.startsWith(prefix)) {
      return { format, encodedPayload: encoded.slice(prefix.length) };
    }
  }
  return null;
}

async function encodePayloadForUrl(payload) {
  const json = JSON.stringify(payload);
  const plain = base64UrlEncodeString(json);
  const format = await getUrlCompressionFormat();
  if (!format) {
    return plain;
  }

  try {
    const compressed = await compressBytes(textEncoder.encode(json), format);
    const prefix = getCompressionPrefix(format);
    if (!prefix) {
      return plain;
    }
    const encodedCompressed = `${prefix}${base64UrlEncodeBytes(compressed)}`;
    return encodedCompressed.length < plain.length ? encodedCompressed : plain;
  } catch {
    return plain;
  }
}

async function decodePayloadFromUrl(encoded) {
  const compressedMeta = parseCompressedUrlPrefix(encoded);
  if (!compressedMeta) {
    return safeJsonParse(base64UrlDecodeString(encoded));
  }

  const compressedBytes = base64UrlDecodeBytes(compressedMeta.encodedPayload);
  const restored = await decompressBytes(compressedBytes, compressedMeta.format);
  return safeJsonParse(textDecoder.decode(restored));
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function createRollingSeries() {
  return {
    values: new Array(ROLLING_NODE_COUNT).fill(0),
    valid: new Array(ROLLING_NODE_COUNT).fill(false),
    head: ROLLING_NODE_COUNT - 1,
    lastBucket: null,
    lastValue: 0,
  };
}

function createRollingState() {
  return {
    long: createRollingSeries(),
    lat: createRollingSeries(),
  };
}

function resetRollingState() {
  state.rolling = createRollingState();
}

function ingestRollingSeries(series, value, timestampMs) {
  const bucket = Math.floor(timestampMs / ROLLING_BUCKET_MS);
  if (series.lastBucket == null) {
    series.lastBucket = bucket;
    series.head = (series.head + 1) % ROLLING_NODE_COUNT;
    series.values[series.head] = value;
    series.valid[series.head] = true;
    series.lastValue = value;
    return;
  }

  if (bucket <= series.lastBucket) {
    series.values[series.head] = value;
    series.lastValue = value;
    return;
  }

  const steps = Math.min(ROLLING_NODE_COUNT, bucket - series.lastBucket);
  for (let i = 0; i < steps; i += 1) {
    series.head = (series.head + 1) % ROLLING_NODE_COUNT;
    const nextValue = i === steps - 1 ? value : series.lastValue;
    series.values[series.head] = nextValue;
    series.valid[series.head] = true;
  }
  series.lastBucket = bucket;
  series.lastValue = value;
}

function rollingSeriesPoints(series, width, height, yMin, yMax) {
  const pad = 18;
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;
  const points = [];

  for (let i = 0; i < ROLLING_NODE_COUNT; i += 1) {
    const idx = (series.head + 1 + i) % ROLLING_NODE_COUNT;
    if (!series.valid[idx]) {
      continue;
    }
    const x = pad + (i / (ROLLING_NODE_COUNT - 1)) * innerW;
    const y = pad + (1 - (series.values[idx] - yMin) / (yMax - yMin || 1)) * innerH;
    points.push(`${clamp(x, pad, width - pad).toFixed(2)} ${clamp(y, pad, height - pad).toFixed(2)}`);
  }

  return points;
}

function packSamples(samples) {
  return samples.map((s) => [
    Math.round(s.t),
    Math.round(s.longG * 1000),
    Math.round(s.latG * 1000),
    Math.round(s.speedMph * 10),
  ]);
}

function unpackSamples(packed) {
  if (!Array.isArray(packed)) {
    return [];
  }
  return packed.map((row) => ({
    t: Number(row[0]) || 0,
    longG: (Number(row[1]) || 0) / 1000,
    latG: (Number(row[2]) || 0) / 1000,
    speedMph: (Number(row[3]) || 0) / 10,
  }));
}

function normalizeRunMode(value) {
  return value === "accel-brake" ? "accel-brake" : "accel";
}

function packSplits(splits) {
  if (!splits || typeof splits !== "object") {
    return [];
  }
  return Object.entries(splits)
    .filter(([, value]) => Number.isFinite(value) && value > 0)
    .map(([label, value]) => [label, Math.round(value * 1000)]);
}

function unpackSplits(packed) {
  const splits = {};
  if (Array.isArray(packed)) {
    for (const entry of packed) {
      if (!Array.isArray(entry) || entry.length < 2) {
        continue;
      }
      const label = String(entry[0] || "");
      const value = Number(entry[1]);
      if (label && Number.isFinite(value) && value > 0) {
        splits[label] = value / 1000;
      }
    }
    return splits;
  }
  if (packed && typeof packed === "object") {
    for (const [label, value] of Object.entries(packed)) {
      const numeric = Number(value);
      if (Number.isFinite(numeric) && numeric > 0) {
        splits[label] = numeric;
      }
    }
  }
  return splits;
}

function primaryResultForRun(run) {
  if (!run) {
    return { label: "Run", seconds: 0 };
  }
  const splits = run.splits || {};
  const priorities = run.testType === "accel-brake"
    ? ["0-100-0", "0-60-0", "100-0", "60-0", "0-100", "0-60", "0-45", "0-30"]
    : ["0-100", "0-60", "0-45", "0-30"];
  for (const label of priorities) {
    if (Number.isFinite(splits[label])) {
      return { label, seconds: splits[label] };
    }
  }
  return { label: "Run", seconds: Number(run.resultSeconds) || 0 };
}

function downsampleSamples(samples, targetCount) {
  if (targetCount <= 0 || samples.length <= targetCount) {
    return samples;
  }
  const step = Math.ceil(samples.length / targetCount);
  const output = [];
  for (let i = 0; i < samples.length; i += step) {
    output.push(samples[i]);
  }
  const last = samples[samples.length - 1];
  if (output[output.length - 1] !== last) {
    output.push(last);
  }
  return output;
}

function serializeRun(run, { sampleCap = 2000, downsampleTarget = 0 } = {}) {
  const clipped = run.samples.slice(-sampleCap);
  const finalSamples = downsampleTarget > 0 ? downsampleSamples(clipped, downsampleTarget) : clipped;
  const primary = primaryResultForRun(run);
  return {
    id: run.id,
    timestamp: run.timestamp,
    testType: normalizeRunMode(run.testType),
    resultSeconds: primary.seconds,
    resultLabel: primary.label,
    completion: run.completion,
    peakSpeedMph: Math.round((Number(run.peakSpeedMph) || 0) * 10) / 10,
    splits: packSplits(run.splits),
    samples: packSamples(finalSamples),
  };
}

function deserializeRun(payload) {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const testType = normalizeRunMode(payload.testType);
  const splits = unpackSplits(payload.splits);
  const resultSeconds = Number(payload.resultSeconds) || 0;
  if (!Object.keys(splits).length && resultSeconds > 0) {
    if (payload.testType === "0-60" || payload.resultLabel === "0-60") {
      splits["0-60"] = resultSeconds;
    } else if (payload.testType === "0-100" || payload.resultLabel === "0-100") {
      splits["0-100"] = resultSeconds;
    } else if (payload.testType === "0-60-0" || payload.resultLabel === "0-60-0") {
      splits["0-60-0"] = resultSeconds;
    }
  }
  const run = {
    id: String(payload.id || `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`),
    timestamp: Number(payload.timestamp) || Date.now(),
    testType,
    resultSeconds,
    resultLabel: String(payload.resultLabel || ""),
    completion: String(payload.completion || "complete"),
    peakSpeedMph: Number(payload.peakSpeedMph) || 0,
    splits,
    samples: unpackSamples(payload.samples),
  };
  const primary = primaryResultForRun(run);
  run.resultSeconds = primary.seconds;
  run.resultLabel = primary.label;
  return run;
}

function compactVec(v) {
  if (!v || typeof v !== "object") {
    return null;
  }
  return [
    Number(v.x || 0).toFixed(4),
    Number(v.y || 0).toFixed(4),
    Number(v.z || 0).toFixed(4),
  ];
}

function expandVec(arr) {
  if (!Array.isArray(arr) || arr.length < 3) {
    return null;
  }
  const x = Number(arr[0]);
  const y = Number(arr[1]);
  const z = Number(arr[2]);
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
    return null;
  }
  return vec(x, y, z);
}

function saveHistory() {
  try {
    const packed = state.history.slice(0, MAX_HISTORY).map((run) => serializeRun(run));
    localStorage.setItem(STORAGE_KEYS.history, JSON.stringify(packed));
  } catch {
    setStatus("Could not save run history in local storage.", "warn");
  }
}

function loadHistory() {
  const raw = localStorage.getItem(STORAGE_KEYS.history);
  if (!raw) {
    return;
  }
  const parsed = safeJsonParse(raw);
  if (!Array.isArray(parsed)) {
    return;
  }
  const runs = parsed.map((entry) => deserializeRun(entry)).filter(Boolean);
  state.history = runs.slice(0, MAX_HISTORY);
  if (state.history.length > 0) {
    state.selectedRunId = state.history[0].id;
  }
}

function saveCalibration() {
  if (!state.calibration) {
    return;
  }
  localStorage.setItem(STORAGE_KEYS.calibration, JSON.stringify(state.calibration));
}

function loadCalibration() {
  const raw = localStorage.getItem(STORAGE_KEYS.calibration);
  if (!raw) {
    return;
  }
  const parsed = safeJsonParse(raw);
  const gravity = parsed ? expandVec(parsed.gravity) : null;
  const vertical = parsed ? expandVec(parsed.vertical) : null;
  if (!gravity || !vertical) {
    localStorage.removeItem(STORAGE_KEYS.calibration);
    return;
  }
  state.calibration = {
    timestamp: Number(parsed.timestamp) || Date.now(),
    gravity,
    vertical,
  };
}

function saveSettings() {
  localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(state.settings));
}

function loadSettings() {
  const raw = localStorage.getItem(STORAGE_KEYS.settings);
  if (!raw) {
    return;
  }
  const parsed = safeJsonParse(raw);
  if (!parsed || typeof parsed !== "object") {
    return;
  }
  state.settings.audio = parsed.audio !== false;
  state.settings.haptics = parsed.haptics === true;
  state.settings.autoDisarmOnComplete = parsed.autoDisarmOnComplete !== false;
  state.settings.smoothing = ["off", "normal", "high"].includes(parsed.smoothing) ? parsed.smoothing : "normal";
  const v = Number(parsed.vehicleWeightLb);
  if (Number.isFinite(v) && v > 800) {
    state.settings.vehicleWeightLb = v;
  }
}

function applySettingsToUi() {
  el.audioToggle.checked = state.settings.audio;
  el.hapticToggle.checked = state.settings.haptics;
  el.autoDisarmToggle.checked = state.settings.autoDisarmOnComplete;
  el.smoothingSelect.value = state.settings.smoothing;
  el.vehicleWeight.value = String(state.settings.vehicleWeightLb);
}

function getSelectedRun() {
  return state.history.find((run) => run.id === state.selectedRunId) || null;
}

function modeLabel(mode) {
  return mode === "accel-brake" ? "Acceleration + Braking" : "Acceleration";
}

function formatResult(run) {
  if (!run) {
    return "No run";
  }
  const primary = primaryResultForRun(run);
  const suffix = run.completion === "timeout" ? " (timeout)" : "";
  if (primary.seconds > 0) {
    return `${modeLabel(run.testType)} · ${primary.label}: ${primary.seconds.toFixed(3)}s${suffix}`;
  }
  return `${modeLabel(run.testType)}${suffix}`;
}

function splitLabelsForRun(run) {
  return run.testType === "accel-brake"
    ? ["0-30", "0-45", "0-60", "0-100", "60-0", "100-0", "0-60-0", "0-100-0"]
    : ["0-30", "0-45", "0-60", "0-100"];
}

function renderRunSplits(run) {
  if (!run || !el.runSplits) {
    return;
  }
  const labels = splitLabelsForRun(run);
  const pieces = labels
    .filter((label) => Number.isFinite(run.splits?.[label]))
    .map((label) => `<span><strong>${label}</strong> ${run.splits[label].toFixed(3)}s</span>`);
  if (Number.isFinite(run.peakSpeedMph) && run.peakSpeedMph > 0) {
    pieces.push(`<span><strong>Peak</strong> ${run.peakSpeedMph.toFixed(1)} mph</span>`);
  }
  el.runSplits.innerHTML = pieces.length
    ? pieces.join("")
    : `<span><strong>${modeLabel(run.testType)}</strong> completed with no standard split reached.</span>`;
}

function renderHistory() {
  if (!state.history.length) {
    el.historyList.innerHTML = `<li class="history-item"><button type="button" disabled>No saved runs yet.</button></li>`;
    return;
  }
  el.historyList.innerHTML = state.history
    .map((run) => {
      const active = run.id === state.selectedRunId ? "active" : "";
      const date = new Date(run.timestamp).toLocaleString();
      return `<li class="history-item"><button class="${active}" type="button" data-run-id="${run.id}"><strong>${formatResult(run)}</strong><br>${date}</button></li>`;
    })
    .join("");
  el.historyList.querySelectorAll("button[data-run-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.selectedRunId = btn.dataset.runId;
      renderHistory();
      renderSelectedRun();
      scheduleUrlSync();
    });
  });
}

function estimateWheelHp(run) {
  const weightLb = Number(state.settings.vehicleWeightLb);
  if (!run || !Number.isFinite(weightLb) || weightLb <= 0 || run.samples.length < 3) {
    return null;
  }
  const massKg = weightLb * 0.45359237;
  let maxPowerW = 0;
  for (const sample of run.samples) {
    const accelMs2 = Math.max(0, sample.longG * G);
    const speedMps = mphToMps(Math.max(0, sample.speedMph));
    const powerW = massKg * accelMs2 * speedMps;
    if (powerW > maxPowerW) {
      maxPowerW = powerW;
    }
  }
  if (!Number.isFinite(maxPowerW) || maxPowerW <= 0) {
    return null;
  }
  return maxPowerW / 745.7;
}

function nextSplitTarget(run) {
  if (!run || !run.splits) {
    return 60;
  }
  for (const target of SPLIT_SPEEDS_MPH) {
    if (!Number.isFinite(run.splits[`0-${target}`])) {
      return target;
    }
  }
  return 100;
}

function renderSelectedRun() {
  const run = getSelectedRun();
  if (!run) {
    el.runResult.textContent = "No completed runs yet.";
    if (el.runSplits) {
      el.runSplits.innerHTML = "";
    }
    el.hpEstimate.textContent = "Estimated wheel horsepower appears when weight and run data are available.";
    drawRunCharts(null);
    return;
  }
  const date = new Date(run.timestamp).toLocaleString();
  el.runResult.textContent = `${formatResult(run)} - ${date}`;
  renderRunSplits(run);
  const hp = estimateWheelHp(run);
  if (hp) {
    el.hpEstimate.textContent = `Estimated wheel horsepower: ${Math.round(hp)} whp`;
  } else {
    el.hpEstimate.textContent = "Estimated wheel horsepower appears when weight and run data are available.";
  }
  drawRunCharts(run);
}

function speakCue(text) {
  if (!state.settings.audio || !("speechSynthesis" in window)) {
    return;
  }
  const utt = new SpeechSynthesisUtterance(text);
  utt.rate = 1;
  utt.pitch = 1;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utt);
}

function pulseHaptic(pattern = [40]) {
  if (!state.settings.haptics || !("vibrate" in navigator)) {
    return;
  }
  navigator.vibrate(pattern);
}

function updateSpeedColors(speedMph) {
  const target = nextSplitTarget(state.currentRun);
  if (speedMph >= target) {
    el.speedDisplay.style.color = "#38ffa0";
    return;
  }
  if (speedMph >= target * 0.75) {
    el.speedDisplay.style.color = "#ffc86d";
    return;
  }
  el.speedDisplay.style.color = "#dcf8ff";
}

function updateLiveUi() {
  const speedMph = mpsToMph(state.live.displaySpeedMps);
  el.speedDisplay.textContent = speedMph.toFixed(1);
  el.longG.textContent = `${state.live.longG.toFixed(3)} g`;
  el.latG.textContent = `${state.live.latG.toFixed(3)} g`;
  el.accelMs2.textContent = `${state.live.longMs2.toFixed(2)} m/s²`;
  updateSpeedColors(speedMph);
}

function resetFilterState() {
  state.filters.initialized = false;
  state.filters.longEmaMs2 = 0;
  state.filters.latEmaMs2 = 0;
  state.filters.biasMs2 = 0;
  state.filters.stationaryMs = 0;
}

function resetLiveCaptureState() {
  state.lastMotionTs = 0;
  resetRollingState();
  resetFilterState();
  state.live.longG = 0;
  state.live.latG = 0;
  state.live.longMs2 = 0;
  state.live.speedMps = 0;
  state.live.displaySpeedMps = 0;
  state.speedDisplayWindow = [];
  state.preCalStillMs = 0;
  state.preCalRetryBlockedUntilTs = 0;
  state.readyStillMs = 0;
  resetLaunchInference();
  state.isRunning = false;
  state.currentRun = null;
  state.lastUiDrawTs = 0;
  state.lastScoreSample = null;
  state.lastMotionSample = null;
  state.missingLinearAccelSamples = 0;
  updateLiveUi();
  drawRollingCharts();
}

function clearCalibrationCaptureTimers(capture) {
  if (!capture) {
    return;
  }
  if (capture.startTimerId) {
    clearTimeout(capture.startTimerId);
  }
  if (capture.finishTimerId) {
    clearTimeout(capture.finishTimerId);
  }
  if (capture.progressTimerId) {
    clearInterval(capture.progressTimerId);
  }
}

function cancelCalibrationCapture(statusMessage = "", tone = "neutral") {
  const capture = state.calibrationCapture;
  if (!capture) {
    return;
  }
  clearCalibrationCaptureTimers(capture);
  state.calibrationCapture = null;
  if (statusMessage) {
    setStatus(statusMessage, tone);
  }
}

function buildCalibrationFromSamples(samples) {
  if (samples.length < CALIBRATION_MIN_SAMPLES) {
    return {
      error: "not enough sensor samples for a reliable capture. Re-arm and try again.",
      errorCode: "sample-rate",
    };
  }

  const captureDurationMs = samples.length > 1
    ? samples[samples.length - 1].t - samples[0].t
    : 0;
  if (captureDurationMs < CALIBRATION_MIN_CAPTURE_MS) {
    return {
      error: "sensor sample rate was too low for calibration. Re-arm and try again.",
      errorCode: "sample-rate",
    };
  }

  let avg = vec(0, 0, 0);
  for (const sample of samples) {
    avg = add(avg, sample.raw);
  }
  avg = scale(avg, 1 / samples.length);

  let variance = 0;
  for (const sample of samples) {
    const diff = sub(sample.raw, avg);
    variance += dot(diff, diff);
  }
  const rms = Math.sqrt(variance / samples.length);
  if (rms > 0.45) {
    return {
      error: "phone moved during capture. Keep device still and retry.",
      errorCode: "motion",
    };
  }

  const vertical = normalize(avg);
  if (norm(vertical) < 0.1) {
    return {
      error: "could not resolve gravity direction. Hold still and retry.",
      errorCode: "gravity",
    };
  }

  return {
    gravity: avg,
    vertical,
  };
}

function finalizeCalibrationCapture() {
  const capture = state.calibrationCapture;
  if (!capture) {
    return;
  }

  clearCalibrationCaptureTimers(capture);
  state.calibrationCapture = null;

  const result = buildCalibrationFromSamples(capture.samples);
  if (result.error) {
    state.preCalStillMs = 0;
    if (result.errorCode === "sample-rate") {
      disarmSensors({
        preserveData: false,
        statusMessage: `Calibration failed: ${result.error}`,
        tone: "warn",
        signalMessage: "UNSUPPORTED",
        signalMode: "alert",
      });
      return;
    }
    state.preCalRetryBlockedUntilTs = nowPerf() + CALIBRATION_RETRY_BACKOFF_MS;
    setStatus(`Calibration failed: ${result.error}`, "warn");
    setRunSignal("HOLD STILL", "ready");
    return;
  }

  state.calibration = {
    timestamp: Date.now(),
    gravity: result.gravity,
    vertical: result.vertical,
  };
  saveCalibration();
  state.preCalStillMs = 0;
  state.readyStillMs = READY_STATIONARY_MS;
  setRunSignal("READY", "ready");
  setStatus("Calibration complete. Ready for a straight launch from a stop.", "ok");
  scheduleUrlSync();
}

function disarmSensors({
  preserveData = true,
  statusMessage = "Sensors disarmed.",
  tone = "neutral",
  signalMessage = "DISARMED",
  signalMode = "ready",
} = {}) {
  const hadActiveRun = state.isRunning;
  cancelCalibrationCapture();
  window.removeEventListener("devicemotion", onDeviceMotion);
  state.sensorEnabled = false;
  state.isRunning = false;
  state.currentRun = null;
  resetLaunchInference();
  state.lastMotionSample = null;
  if (!preserveData) {
    resetLiveCaptureState();
  }
  updateArmButton();
  setRunSignal(signalMessage, signalMode);
  if (hadActiveRun && preserveData) {
    setStatus(`${statusMessage} Active run cancelled.`, tone);
  } else {
    setStatus(statusMessage, tone);
  }
}
function createChartSvg({
  points,
  lineColor,
  yMin,
  yMax,
  unit = "",
}) {
  const width = 640;
  const height = 220;
  const pad = 18;
  const innerH = height - pad * 2;
  const yFor = (value) => {
    const ratio = (value - yMin) / (yMax - yMin || 1);
    return pad + (1 - ratio) * innerH;
  };
  const zeroY = yFor(0).toFixed(2);
  const line = points.length > 1
    ? `<polyline fill="none" stroke="${lineColor}" stroke-width="2.4" points="${points.join(" ")}"></polyline>`
    : "";
  return `<g>
    <line x1="${pad}" y1="${zeroY}" x2="${width - pad}" y2="${zeroY}" stroke="rgba(255,255,255,0.45)" stroke-width="1"></line>
    <text x="${pad + 2}" y="${pad + 12}" fill="rgba(226,240,249,0.85)" font-size="12">${yMax.toFixed(1)}${unit}</text>
    <text x="${pad + 2}" y="${height - 6}" fill="rgba(226,240,249,0.85)" font-size="12">${yMin.toFixed(1)}${unit}</text>
    ${line}
  </g>`;
}

function drawRollingChart(svg, series, color) {
  const width = 640;
  const height = 220;
  const maxAbs = series.values.reduce((acc, value, idx) => (
    series.valid[idx] ? Math.max(acc, Math.abs(value)) : acc
  ), 0);
  const absRange = clamp(Math.max(0.18, maxAbs * 1.1), 0.18, 3.2);
  const yMin = -absRange;
  const yMax = absRange;
  const points = rollingSeriesPoints(series, width, height, yMin, yMax);
  svg.innerHTML = createChartSvg({ points, lineColor: color, yMin, yMax, unit: "g" });
}

function drawRunSeriesChart(svg, run, valueKey, lineColor, yBounds, unit = "") {
  const width = 640;
  const height = 220;
  const pad = 18;
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;

  if (!run || run.samples.length < 2) {
    svg.innerHTML = createChartSvg({
      points: [],
      lineColor,
      yMin: yBounds?.min ?? -1,
      yMax: yBounds?.max ?? 1,
      unit,
    });
    return;
  }

  const samples = run.samples;
  const total = samples[samples.length - 1].t || 1;
  let yMin = yBounds?.min ?? Infinity;
  let yMax = yBounds?.max ?? -Infinity;
  if (!yBounds) {
    for (const sample of samples) {
      const value = sample[valueKey];
      yMin = Math.min(yMin, value);
      yMax = Math.max(yMax, value);
    }
    if (yMin === yMax) {
      yMin -= 1;
      yMax += 1;
    }
  }

  const points = samples.map((sample) => {
    const x = pad + (sample.t / total) * innerW;
    const y = pad + (1 - (sample[valueKey] - yMin) / (yMax - yMin || 1)) * innerH;
    return `${clamp(x, pad, width - pad).toFixed(2)} ${clamp(y, pad, height - pad).toFixed(2)}`;
  });

  svg.innerHTML = createChartSvg({ points, lineColor, yMin, yMax, unit });
}

function drawRunCharts(run) {
  const speedMax = run ? Math.max(10, ...run.samples.map((s) => s.speedMph)) * 1.1 : 10;
  const runMaxAbsG = run ? run.samples.reduce((acc, s) => Math.max(acc, Math.abs(s.longG)), 0) : 0;
  const accelAbsRange = clamp(Math.max(0.18, runMaxAbsG * 1.1), 0.18, 3.2);
  drawRunSeriesChart(el.speedChart, run, "speedMph", "#38ffa0", { min: 0, max: speedMax }, " mph");
  drawRunSeriesChart(el.accelChart, run, "longG", "#ffb74a", { min: -accelAbsRange, max: accelAbsRange }, "g");
}

function drawRollingCharts() {
  drawRollingChart(el.longChart, state.rolling.long, "#1ce5d8");
  drawRollingChart(el.latChart, state.rolling.lat, "#ff8f6e");
}

function updateStillnessCounter(currentMs, dtSec, magnitudeMs2, thresholdMs2, { hardReset = false } = {}) {
  if (magnitudeMs2 < thresholdMs2) {
    return currentMs + dtSec * 1000;
  }
  if (hardReset) {
    return 0;
  }
  return Math.max(0, currentMs - dtSec * 520);
}

function resetRunScoringState() {
  resetRollingState();
  resetFilterState();
  state.live.longG = 0;
  state.live.latG = 0;
  state.live.longMs2 = 0;
  state.live.speedMps = 0;
  state.live.displaySpeedMps = 0;
  state.speedDisplayWindow = [];
  state.lastScoreSample = null;
  state.readyStillMs = 0;
}

function startCalibrationCapture() {
  if (!state.sensorEnabled || state.calibration || state.calibrationCapture) {
    return;
  }

  state.preCalStillMs = 0;
  state.preCalRetryBlockedUntilTs = 0;
  setRunSignal("CALIBRATING", "ready");
  setStatus("Calibrating... keep the vehicle and phone still.", "neutral");

  const capture = {
    phase: "settling",
    samples: [],
    startPerfTs: 0,
    startTimerId: 0,
    finishTimerId: 0,
    progressTimerId: 0,
  };
  state.calibrationCapture = capture;

  capture.startTimerId = window.setTimeout(() => {
    if (state.calibrationCapture !== capture) {
      return;
    }
    capture.phase = "capturing";
    capture.startPerfTs = nowPerf();

    capture.progressTimerId = window.setInterval(() => {
      if (state.calibrationCapture !== capture) {
        return;
      }
      const elapsed = nowPerf() - capture.startPerfTs;
      const pct = clamp(Math.round((elapsed / CALIBRATION_CAPTURE_MS) * 100), 0, 100);
      setStatus(`Calibrating... ${pct}%`, "neutral");
    }, 120);

    capture.finishTimerId = window.setTimeout(() => {
      if (state.calibrationCapture !== capture) {
        return;
      }
      finalizeCalibrationCapture();
    }, CALIBRATION_CAPTURE_MS);
  }, CALIBRATION_TAP_SETTLE_MS);
}

function beginRun(startPerfTs, forward, lateral) {
  state.isRunning = true;
  state.currentRun = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: Date.now(),
    testType: normalizeRunMode(state.testType),
    resultSeconds: 0,
    resultLabel: "",
    completion: "complete",
    peakSpeedMph: 0,
    splits: {},
    downCrossings: {},
    lateralRejectMs: 0,
    forward,
    lateral,
    startPerfTs,
    samples: [],
  };
  setRunSignal("RUNNING", "running");
  setStatus("Run started. Keep focus on the road.", "ok");
}

function rejectRun(reason) {
  resetLaunchInference();
  disarmSensors({
    preserveData: false,
    statusMessage: reason,
    tone: "warn",
    signalMessage: "REJECTED",
    signalMode: "alert",
  });
}

function confidenceForInference(inference) {
  if (!inference || inference.totalImpulse <= 1e-6) {
    return 0;
  }
  return clamp(norm(inference.vectorImpulse) / inference.totalImpulse, 0, 1);
}

function beginRunFromInference() {
  const inference = state.launchInference;
  if (!inference || !state.calibration) {
    return false;
  }

  const confidence = confidenceForInference(inference);
  const forward = normalize(inference.vectorImpulse);
  const lateral = normalize(cross(state.calibration.vertical, forward));
  if (inference.totalImpulse < LAUNCH_DIRECTION_MIN_IMPULSE_MPS
    || confidence < LAUNCH_DIRECTION_CONFIDENCE_MIN
    || norm(forward) < 0.1
    || norm(lateral) < 0.1) {
    return false;
  }

  const replaySamples = inference.samples.filter(Boolean);
  if (!replaySamples.length) {
    return false;
  }
  resetRunScoringState();
  beginRun(inference.startPerfTs, forward, lateral);
  resetLaunchInference();

  for (const motionSample of replaySamples) {
    const scoredSample = processRunMotionSample(motionSample, forward, lateral);
    evaluateRun(scoredSample);
    state.lastScoreSample = scoredSample;
    if (!state.isRunning) {
      break;
    }
  }
  return true;
}

function completeRun(endPerfTs, completion = "complete") {
  if (!state.currentRun) {
    return;
  }
  const run = state.currentRun;
  run.completion = completion;
  run.elapsedSeconds = Math.max(0, (endPerfTs - run.startPerfTs) / 1000);
  const primary = primaryResultForRun(run);
  run.resultSeconds = primary.seconds;
  run.resultLabel = primary.label;
  delete run.downCrossings;
  delete run.forward;
  delete run.lateral;
  delete run.lateralRejectMs;
  delete run.startPerfTs;

  state.history.unshift(run);
  state.history = state.history.slice(0, MAX_HISTORY);
  state.selectedRunId = run.id;
  state.isRunning = false;
  state.currentRun = null;

  saveHistory();
  renderHistory();
  renderSelectedRun();
  scheduleUrlSync();

  if (completion === "timeout") {
    setRunSignal("TIMEOUT", "alert");
    setStatus(`Run timed out after ${run.elapsedSeconds.toFixed(2)}s.`, "warn");
    return;
  }

  state.live.longG = 0;
  state.live.latG = 0;
  state.live.longMs2 = 0;
  state.live.speedMps = 0;
  state.live.displaySpeedMps = 0;
  state.speedDisplayWindow = [];
  updateLiveUi();

  setRunSignal("COMPLETE", "alert");
  if (state.settings.autoDisarmOnComplete && state.sensorEnabled) {
    disarmSensors({
      preserveData: true,
      statusMessage: `Run complete: ${formatResult(run)}. Sensors auto-disarmed.`,
      tone: "ok",
      signalMessage: "COMPLETE",
      signalMode: "alert",
    });
  } else {
    setStatus(`Run complete: ${formatResult(run)}.`, "ok");
  }
}

function processRunMotionSample(motionSample, forward, lateral) {
  const longRawMs2 = dot(motionSample.dynamic, forward);
  const latRawMs2 = dot(motionSample.dynamic, lateral);

  applySmoothing(motionSample.dtSec, longRawMs2, latRawMs2);
  updateStationaryAndBias(motionSample.dtSec, state.filters.longEmaMs2, state.filters.latEmaMs2);

  const correctedLongMs2 = clamp(
    state.filters.longEmaMs2 - state.filters.biasMs2,
    -MAX_LONG_ACCEL_MS2,
    MAX_LONG_ACCEL_MS2,
  );
  const integratedLongMs2 = integrateSpeed(motionSample.dtSec, correctedLongMs2);
  updateDisplaySpeed(motionSample.perfTs);

  state.live.longMs2 = integratedLongMs2;
  state.live.longG = integratedLongMs2 / G;
  state.live.latG = state.filters.latEmaMs2 / G;

  ingestRollingSeries(state.rolling.long, state.live.longG, motionSample.perfTs);
  ingestRollingSeries(state.rolling.lat, state.live.latG, motionSample.perfTs);
  return createScoreSample(motionSample, state.live.longMs2, state.live.latG, state.live.speedMps);
}

function recordAccelerationSplits(run, previousSample, sample) {
  for (const target of SPLIT_SPEEDS_MPH) {
    const label = `0-${target}`;
    if (Number.isFinite(run.splits[label])) {
      continue;
    }
    const crossing = findScoreThresholdCrossing(previousSample, sample, "speedMph", target, "rising")
      || (!previousSample && sample.speedMph >= target ? sample : null);
    if (!crossing) {
      continue;
    }
    appendRunSample(run, crossing);
    run.splits[label] = Math.max(0, (crossing.perfTs - run.startPerfTs) / 1000);
    if (target === 60) {
      speakCue("60");
      pulseHaptic([40, 40, 40]);
    } else if (target === 100) {
      speakCue("100");
      pulseHaptic([60, 50, 60]);
    }
  }
}

function recordBrakingMarkers(run, previousSample, sample) {
  if (run.testType !== "accel-brake") {
    return;
  }
  for (const target of [100, 60]) {
    if (run.downCrossings[target]) {
      continue;
    }
    const crossing = findScoreThresholdCrossing(previousSample, sample, "speedMph", target, "falling");
    if (crossing) {
      appendRunSample(run, crossing);
      run.downCrossings[target] = crossing.perfTs;
    }
  }
}

function maybeCompleteRunAtStop(run, previousSample, sample) {
  const stopCrossing = findScoreThresholdCrossing(previousSample, sample, "speedMph", STOP_COMPLETE_MPH, "falling")
    || (!previousSample && sample.speedMph <= STOP_COMPLETE_MPH ? sample : null);
  if (!stopCrossing) {
    return false;
  }
  if (stopCrossing.perfTs - run.startPerfTs < RUN_MIN_COMPLETE_MS || run.peakSpeedMph < 12) {
    return false;
  }

  appendRunSample(run, stopCrossing);
  if (run.testType === "accel-brake") {
    if (run.downCrossings[60]) {
      run.splits["60-0"] = Math.max(0, (stopCrossing.perfTs - run.downCrossings[60]) / 1000);
    }
    if (run.downCrossings[100]) {
      run.splits["100-0"] = Math.max(0, (stopCrossing.perfTs - run.downCrossings[100]) / 1000);
    }
    if (Number.isFinite(run.splits["0-60"])) {
      run.splits["0-60-0"] = Math.max(0, (stopCrossing.perfTs - run.startPerfTs) / 1000);
    }
    if (Number.isFinite(run.splits["0-100"])) {
      run.splits["0-100-0"] = Math.max(0, (stopCrossing.perfTs - run.startPerfTs) / 1000);
    }
  }
  completeRun(stopCrossing.perfTs, "complete");
  return true;
}

function evaluateRun(sample) {
  if (!state.currentRun) {
    return;
  }
  const run = state.currentRun;
  const previousSample = state.lastScoreSample;

  run.peakSpeedMph = Math.max(run.peakSpeedMph, sample.speedMph);
  recordAccelerationSplits(run, previousSample, sample);
  recordBrakingMarkers(run, previousSample, sample);

  if (sample.speedMph > 10 && Math.abs(sample.latG) > RUN_REJECT_LATERAL_G) {
    run.lateralRejectMs += sample.dtSec * 1000;
  } else {
    run.lateralRejectMs = Math.max(0, run.lateralRejectMs - sample.dtSec * 700);
  }
  if (run.lateralRejectMs >= RUN_REJECT_LATERAL_MS) {
    rejectRun("Run rejected: too much lateral acceleration for a straight-line test.");
    return;
  }

  if (run.testType === "accel-brake" && sample.longG < -0.08 && sample.speedMph > 20) {
    setRunSignal("BRAKING", "alert");
  }

  if (maybeCompleteRunAtStop(run, previousSample, sample)) {
    return;
  }

  appendRunSample(run, sample);

  const elapsedMs = sample.perfTs - run.startPerfTs;
  if (elapsedMs > MAX_RUN_DURATION_MS) {
    completeRun(sample.perfTs, "timeout");
  }
}
function getSmoothingTauSec() {
  return SMOOTHING_TAU_SEC[state.settings.smoothing] ?? SMOOTHING_TAU_SEC.normal;
}

function applySmoothing(dtSec, rawLongMs2, rawLatMs2) {
  const alpha = alphaForTimeConstant(dtSec, getSmoothingTauSec());
  if (!state.filters.initialized) {
    state.filters.longEmaMs2 = rawLongMs2;
    state.filters.latEmaMs2 = rawLatMs2;
    state.filters.initialized = true;
    return;
  }
  state.filters.longEmaMs2 += alpha * (rawLongMs2 - state.filters.longEmaMs2);
  state.filters.latEmaMs2 += alpha * (rawLatMs2 - state.filters.latEmaMs2);
}

function updateStationaryAndBias(dtSec, longMs2, latMs2) {
  const speedMph = mpsToMph(state.live.speedMps);
  const likelyStationary = Math.abs(longMs2) < 0.18
    && Math.abs(latMs2) < 0.20
    && (!state.isRunning || speedMph < 2.5);
  const lowExcitation = Math.abs(longMs2) < 0.45 && Math.abs(latMs2) < 0.45;
  if (likelyStationary) {
    state.filters.stationaryMs += dtSec * 1000;
  } else {
    state.filters.stationaryMs = Math.max(0, state.filters.stationaryMs - dtSec * 420);
  }
  if (lowExcitation) {
    const biasTauSec = speedMph < 8 ? 2.8 : 12;
    const biasAlpha = alphaForTimeConstant(dtSec, biasTauSec);
    state.filters.biasMs2 += (longMs2 - state.filters.biasMs2) * biasAlpha;
  }
}

function integrateSpeed(dtSec, correctedLongMs2) {
  let longMs2 = correctedLongMs2;
  if (Math.abs(longMs2) < 0.12) {
    longMs2 = 0;
  }
  longMs2 = clamp(longMs2, -MAX_LONG_ACCEL_MS2, MAX_LONG_ACCEL_MS2);
  state.live.speedMps = clamp(state.live.speedMps + longMs2 * dtSec, 0, mphToMps(MAX_SPEED_MPH));

  if (!state.isRunning && state.filters.stationaryMs > 180) {
    const settle = 1 - clamp(dtSec * 2.4, 0, 0.22);
    state.live.speedMps *= settle;
  }
  if (state.filters.stationaryMs > 700 || (state.live.speedMps < 0.35 && state.filters.stationaryMs > 320)) {
    state.live.speedMps = 0;
  }
  if (Math.abs(longMs2) < 0.16 && state.live.speedMps < 1.2) {
    state.live.speedMps = Math.max(0, state.live.speedMps - 0.22 * dtSec);
  }
  return longMs2;
}

function updateDisplaySpeed(samplePerfTs) {
  state.speedDisplayWindow.push({ t: samplePerfTs, v: state.live.speedMps });
  const cutoff = samplePerfTs - SPEED_DISPLAY_WINDOW_MS;
  while (state.speedDisplayWindow.length > 0
    && (state.speedDisplayWindow[0].t < cutoff || state.speedDisplayWindow.length > SPEED_DISPLAY_BUFFER_MAX)) {
    state.speedDisplayWindow.shift();
  }

  if (!state.speedDisplayWindow.length) {
    state.live.displaySpeedMps = state.live.speedMps;
    return;
  }

  let weightedSpeed = 0;
  let weightSum = 0;
  for (const sample of state.speedDisplayWindow) {
    const ageMs = samplePerfTs - sample.t;
    const weight = clamp(1 - ageMs / SPEED_DISPLAY_WINDOW_MS, DISPLAY_SPEED_RECENCY_FLOOR, 1);
    weightedSpeed += sample.v * weight;
    weightSum += weight;
  }
  state.live.displaySpeedMps = weightSum > 0 ? weightedSpeed / weightSum : state.live.speedMps;
}

function onDeviceMotion(event) {
  if (!state.sensorEnabled) {
    return;
  }

  const accIncl = event.accelerationIncludingGravity;
  if (!accIncl || accIncl.x == null || accIncl.y == null || accIncl.z == null) {
    return;
  }

  const samplePerfTs = nowPerf();
  if (!state.lastMotionTs) {
    state.lastMotionTs = samplePerfTs;
  }
  const dt = clamp((samplePerfTs - state.lastMotionTs) / 1000, 0.004, 0.08);
  state.lastMotionTs = samplePerfTs;

  const raw = vec(accIncl.x, accIncl.y, accIncl.z);
  if (state.calibrationCapture && state.calibrationCapture.phase === "capturing") {
    state.calibrationCapture.samples.push({ t: samplePerfTs, raw });
  }

  const linearAccel = event.acceleration;
  const hasLinearAcceleration = linearAccel
    && linearAccel.x != null
    && linearAccel.y != null
    && linearAccel.z != null;
  if (!hasLinearAcceleration) {
    state.missingLinearAccelSamples += 1;
    if (state.missingLinearAccelSamples >= LINEAR_ACCEL_MISSING_LIMIT) {
      disarmSensors({
        preserveData: true,
        statusMessage: "Browser does not expose stable linear acceleration. Run timing is disabled on this device/browser.",
        tone: "warn",
        signalMessage: "UNSUPPORTED",
        signalMode: "alert",
      });
    }
    return;
  }
  state.missingLinearAccelSamples = 0;

  const dynamic = vec(linearAccel.x, linearAccel.y, linearAccel.z);
  if (!state.calibration) {
    if (samplePerfTs < state.preCalRetryBlockedUntilTs) {
      state.lastMotionSample = null;
      if (samplePerfTs - state.lastUiDrawTs > 48) {
        updateLiveUi();
        drawRollingCharts();
        state.lastUiDrawTs = samplePerfTs;
      }
      return;
    }
    state.preCalStillMs = updateStillnessCounter(
      state.preCalStillMs,
      dt,
      norm(dynamic),
      PRECAL_LINEAR_STILL_MS2,
      { hardReset: true },
    );
    if (!state.calibrationCapture && state.preCalStillMs >= PRECAL_STILL_MS) {
      startCalibrationCapture();
    }
    state.lastMotionSample = null;
    if (samplePerfTs - state.lastUiDrawTs > 48) {
      updateLiveUi();
      drawRollingCharts();
      state.lastUiDrawTs = samplePerfTs;
    }
    return;
  }

  const motionSample = createMotionSample(samplePerfTs, dt, dynamic, state.calibration.vertical);
  let runStartedThisSample = false;

  if (!state.isRunning) {
    const wasReady = state.readyStillMs >= READY_STATIONARY_MS;
    state.readyStillMs = updateStillnessCounter(
      state.readyStillMs,
      dt,
      motionSample.horizontalMagMs2,
      0.16,
      { hardReset: true },
    );
    const isReady = state.readyStillMs >= READY_STATIONARY_MS;

    if (!state.launchInference) {
      setRunSignal(isReady ? "READY" : "HOLD STILL", "ready");
      if (isReady && !wasReady) {
        setStatus("Ready. Launch straight from a stop.", "ok");
      } else if (!isReady && wasReady) {
        setStatus("Hold still at a stop until the app shows Ready.", "neutral");
      }
      if (isReady
        && motionSample.horizontalMagMs2 >= LAUNCH_HORIZONTAL_THRESHOLD_MS2) {
        const anchor = findMotionThresholdCrossing(
          state.lastMotionSample,
          motionSample,
          LAUNCH_HORIZONTAL_THRESHOLD_MS2,
        ) || motionSample;
        state.launchInference = createLaunchInference(anchor);
        captureLaunchInferenceSample(rebaseMotionSampleDt(motionSample, anchor.perfTs));
        setRunSignal("LOCKING", "running");
        setStatus("Launch detected. Locking the straight-line direction...", "neutral");
      }
    } else {
      captureLaunchInferenceSample(motionSample);
      const inferenceAgeMs = motionSample.perfTs - state.launchInference.startPerfTs;
      const confidence = confidenceForInference(state.launchInference);
      if (inferenceAgeMs >= LAUNCH_INFERENCE_MIN_MS
        && state.launchInference.totalImpulse >= LAUNCH_DIRECTION_MIN_IMPULSE_MPS
        && confidence >= LAUNCH_DIRECTION_CONFIDENCE_MIN) {
        runStartedThisSample = beginRunFromInference();
      } else if (inferenceAgeMs >= LAUNCH_INFERENCE_MAX_MS) {
        rejectRun("Run rejected: could not lock a clean straight launch direction.");
        return;
      }
    }
  }

  if (state.isRunning && state.currentRun && !runStartedThisSample) {
    const scoredSample = processRunMotionSample(
      motionSample,
      state.currentRun.forward,
      state.currentRun.lateral,
    );
    evaluateRun(scoredSample);
    state.lastScoreSample = scoredSample;
  }
  state.lastMotionSample = motionSample;

  if (samplePerfTs - state.lastUiDrawTs > 48) {
    updateLiveUi();
    drawRollingCharts();
    state.lastUiDrawTs = samplePerfTs;
  }
}

async function requestSensorPermission() {
  if (!("DeviceMotionEvent" in window)) {
    throw new Error("Device motion API is unavailable on this device/browser.");
  }
  if (typeof DeviceMotionEvent.requestPermission === "function") {
    const motion = await DeviceMotionEvent.requestPermission();
    if (motion !== "granted") {
      throw new Error("Motion permission denied.");
    }
  }
}

async function enableSensors() {
  if (state.sensorEnabled) {
    disarmSensors({
      preserveData: true,
      statusMessage: "Sensors disarmed. Sampling and calculations paused.",
      tone: "neutral",
    });
    return;
  }

  try {
    await requestSensorPermission();
  } catch (error) {
    setStatus(`Sensor access failed: ${error.message}`, "warn");
    return;
  }

  window.addEventListener("devicemotion", onDeviceMotion, { passive: true });
  state.sensorEnabled = true;
  resetLiveCaptureState();
  cancelCalibrationCapture();
  state.calibration = null;
  localStorage.removeItem(STORAGE_KEYS.calibration);
  updateArmButton();
  setRunSignal("HOLD STILL", "ready");
  setStatus("Sensors armed. Hold still at a stop so auto-calibration can complete.", "neutral");
  scheduleUrlSync();
}

function clearCharts() {
  drawRollingCharts();
  drawRunCharts(null);
}
function scheduleUrlSync() {
  if (state.urlSyncTimer) {
    clearTimeout(state.urlSyncTimer);
  }
  state.urlSyncTimer = window.setTimeout(() => {
    syncStateToUrl().catch(() => {});
  }, 160);
}

function buildUrlPayload(profile) {
  const selectedRunId = state.selectedRunId;
  const selectedRun = selectedRunId
    ? state.history.find((run) => run.id === selectedRunId) || null
    : null;
  let runsForPayload = state.history.slice(0, profile.maxRuns);
  if (selectedRun && profile.maxRuns > 0 && !runsForPayload.some((run) => run.id === selectedRun.id)) {
    runsForPayload = [...runsForPayload.slice(0, Math.max(0, profile.maxRuns - 1)), selectedRun];
  }
  const runs = runsForPayload.map((run) => serializeRun(run, {
    sampleCap: 2400,
    downsampleTarget: run.id === selectedRunId ? profile.selectedSamples : profile.otherSamples,
  }));

  const payload = {
    v: 2,
    testType: state.testType,
    selectedRunId: runs.some((run) => run.id === selectedRunId) ? selectedRunId : null,
    settings: {
      audio: state.settings.audio,
      haptics: state.settings.haptics,
      autoDisarmOnComplete: state.settings.autoDisarmOnComplete,
      smoothing: state.settings.smoothing,
      vehicleWeightLb: state.settings.vehicleWeightLb,
    },
    calibration: profile.includeCalibration !== false && state.calibration ? {
      timestamp: Number(state.calibration.timestamp) || Date.now(),
      gravity: compactVec(state.calibration.gravity),
      vertical: compactVec(state.calibration.vertical),
    } : null,
    history: runs,
  };
  return payload;
}

async function syncStateToUrl() {
  const profiles = [
    { selectedSamples: 420, otherSamples: 48, maxRuns: 20, includeCalibration: true },
    { selectedSamples: 280, otherSamples: 28, maxRuns: 20, includeCalibration: true },
    { selectedSamples: 220, otherSamples: 18, maxRuns: 14, includeCalibration: true },
    { selectedSamples: 160, otherSamples: 12, maxRuns: 10, includeCalibration: true },
    { selectedSamples: 120, otherSamples: 8, maxRuns: 6, includeCalibration: true },
    { selectedSamples: 96, otherSamples: 0, maxRuns: 1, includeCalibration: false },
    { selectedSamples: 48, otherSamples: 0, maxRuns: 1, includeCalibration: false },
    { selectedSamples: 0, otherSamples: 0, maxRuns: 0, includeCalibration: false },
  ];

  let encoded = null;
  for (const profile of profiles) {
    const payload = buildUrlPayload(profile);
    const next = await encodePayloadForUrl(payload);
    if (next.length <= URL_MAX_LENGTH) {
      encoded = next;
      break;
    }
  }
  if (encoded == null) {
    const url = new URL(window.location.href);
    url.searchParams.delete("s");
    window.history.replaceState(null, "", url);
    return;
  }

  const url = new URL(window.location.href);
  url.searchParams.set("s", encoded);
  window.history.replaceState(null, "", url);
}

function applySettingsFromPayload(payloadSettings) {
  if (!payloadSettings || typeof payloadSettings !== "object") {
    return;
  }
  state.settings.audio = payloadSettings.audio !== false;
  state.settings.haptics = payloadSettings.haptics === true;
  state.settings.autoDisarmOnComplete = payloadSettings.autoDisarmOnComplete !== false;
  state.settings.smoothing = ["off", "normal", "high"].includes(payloadSettings.smoothing)
    ? payloadSettings.smoothing
    : state.settings.smoothing;
  const weight = Number(payloadSettings.vehicleWeightLb);
  if (Number.isFinite(weight) && weight > 800) {
    state.settings.vehicleWeightLb = weight;
  }
}

function applyCalibrationFromPayload(payloadCalibration) {
  if (!payloadCalibration || typeof payloadCalibration !== "object") {
    return;
  }
  const gravity = expandVec(payloadCalibration.gravity);
  const vertical = expandVec(payloadCalibration.vertical);
  if (!gravity || !vertical) {
    return;
  }
  state.calibration = {
    timestamp: Number(payloadCalibration.timestamp) || Date.now(),
    gravity,
    vertical,
  };
}

function restoreV2State(payload) {
  if (payload.testType) {
    state.testType = normalizeRunMode(payload.testType);
  }

  applySettingsFromPayload(payload.settings);
  if (payload.calibration) {
    applyCalibrationFromPayload(payload.calibration);
  } else if (payload.calibration === null) {
    state.calibration = null;
    localStorage.removeItem(STORAGE_KEYS.calibration);
  }

  if (Array.isArray(payload.history)) {
    const runs = payload.history.map((entry) => deserializeRun(entry)).filter(Boolean);
    state.history = runs.slice(0, MAX_HISTORY);
  }

  if (payload.selectedRunId && state.history.some((run) => run.id === payload.selectedRunId)) {
    state.selectedRunId = payload.selectedRunId;
  } else if (state.history.length > 0) {
    state.selectedRunId = state.history[0].id;
  } else {
    state.selectedRunId = null;
  }

  saveSettings();
  if (state.calibration) {
    saveCalibration();
  } else {
    localStorage.removeItem(STORAGE_KEYS.calibration);
  }
  saveHistory();
}

function restoreLegacyV1State(payload) {
  if (payload.testType) {
    state.testType = normalizeRunMode(payload.testType);
  }
  const run = deserializeRun(payload.run);
  if (!run) {
    return;
  }
  const existingIndex = state.history.findIndex((entry) => entry.id === run.id);
  if (existingIndex >= 0) {
    state.history[existingIndex] = run;
  } else {
    state.history.unshift(run);
  }
  state.history = state.history.slice(0, MAX_HISTORY);
  state.selectedRunId = run.id;
  saveHistory();
}

async function restoreStateFromUrl() {
  const encoded = new URL(window.location.href).searchParams.get("s");
  if (!encoded) {
    return;
  }
  try {
    const payload = await decodePayloadFromUrl(encoded);
    if (!payload || typeof payload !== "object") {
      return;
    }
    if (payload.v === 2) {
      restoreV2State(payload);
      return;
    }
    if (payload.v === 1) {
      restoreLegacyV1State(payload);
    }
  } catch {
    setStatus("Could not decode URL state. Using local app state instead.", "warn");
  }
}
function bindEvents() {
  el.enableSensors.addEventListener("click", enableSensors);

  el.testType.addEventListener("change", () => {
    state.testType = el.testType.value;
    scheduleUrlSync();
  });

  el.audioToggle.addEventListener("change", () => {
    state.settings.audio = el.audioToggle.checked;
    saveSettings();
    scheduleUrlSync();
  });

  el.hapticToggle.addEventListener("change", () => {
    state.settings.haptics = el.hapticToggle.checked;
    saveSettings();
    scheduleUrlSync();
  });

  el.autoDisarmToggle.addEventListener("change", () => {
    state.settings.autoDisarmOnComplete = el.autoDisarmToggle.checked;
    saveSettings();
    scheduleUrlSync();
  });

  el.smoothingSelect.addEventListener("change", () => {
    state.settings.smoothing = el.smoothingSelect.value;
    saveSettings();
    scheduleUrlSync();
  });

  el.vehicleWeight.addEventListener("change", () => {
    const weight = Number(el.vehicleWeight.value);
    if (Number.isFinite(weight) && weight > 0) {
      state.settings.vehicleWeightLb = weight;
      saveSettings();
      renderSelectedRun();
      scheduleUrlSync();
    }
  });
}

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return;
  }
  try {
    const reg = await navigator.serviceWorker.register("./sw.js", {
      scope: "./",
      updateViaCache: "none",
    });
    setInterval(() => {
      reg.update().catch(() => {});
    }, 60000);
  } catch {
    setStatus("Service worker registration failed. App will run online only.", "warn");
  }
}

async function init() {
  loadSettings();
  loadCalibration();
  loadHistory();
  await restoreStateFromUrl();

  state.testType = normalizeRunMode(state.testType);
  el.testType.value = state.testType;
  applySettingsToUi();
  updateArmButton();
  bindEvents();

  setStatus("Sensors are disarmed. Arm at a stop to auto-calibrate.", "neutral");

  renderHistory();
  renderSelectedRun();
  clearCharts();
  updateLiveUi();
  setRunSignal("DISARMED", "ready");
  scheduleUrlSync();
  registerServiceWorker();
}

init();
