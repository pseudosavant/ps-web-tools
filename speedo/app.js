
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
const CALIBRATION_MIN_SAMPLES = 24;
const CALIBRATION_MIN_HZ = 18;
const CALIBRATION_MAX_GAP_MS = 140;
const CALIBRATION_GRAVITY_MIN_MS2 = 8.7;
const CALIBRATION_GRAVITY_MAX_MS2 = 10.9;
const CALIBRATION_LINEAR_RMS_MAX_MS2 = 0.24;
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
const SENSOR_QUALITY_WARMUP_SAMPLES = 18;
const SENSOR_MIN_EFFECTIVE_HZ = 15;
const SENSOR_MAX_SAMPLE_GAP_MS = 160;
const SENSOR_BAD_TIMING_LIMIT = 3;
const SENSOR_RAW_MAG_MIN_MS2 = 4;
const SENSOR_RAW_MAG_MAX_MS2 = 25;
const SENSOR_LINEAR_MAG_MAX_MS2 = 35;
const SENSOR_PLAUSIBILITY_LIMIT = 5;
const SENSOR_ZERO_WHILE_RAW_MOVING_LIMIT_MS = 700;
const MAX_LONG_ACCEL_MS2 = 14;
const MAX_SPEED_MPH = 130;
const STOP_STILL_COMPLETE_MS = 700;
const STOP_QUIET_LONG_MS2 = 0.24;
const STOP_QUIET_LAT_MS2 = 0.28;
const STOP_MAX_SPEED_MPH = 6;
const STOP_BRAKE_MAX_SPEED_MPH = 12;
const PRELAUNCH_RAW_TRACE_MS = 1200;
const RAW_TRACE_MAX_SAMPLES = 6000;
const RAW_BUFFER_MAX_SAMPLES = 500;
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
  exportTrace: document.getElementById("exportTrace"),
  importTrace: document.getElementById("importTrace"),
  importTraceFile: document.getElementById("importTraceFile"),
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
  preLaunchSamples: [],
  isRunning: false,
  currentRun: null,
  history: [],
  selectedRunId: null,
  urlSyncTimer: 0,
  lastUiDrawTs: 0,
  lastScoreSample: null,
  lastMotionSample: null,
  missingLinearAccelSamples: 0,
  sensorQuality: createSensorQualityState(),
  rawSampleBuffer: [],
  lastCalibrationTrace: null,
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

function isFiniteVec(v) {
  return v
    && Number.isFinite(v.x)
    && Number.isFinite(v.y)
    && Number.isFinite(v.z);
}

function cloneVec(v) {
  return vec(Number(v?.x) || 0, Number(v?.y) || 0, Number(v?.z) || 0);
}

function sortedNumbers(values) {
  return values
    .filter((value) => Number.isFinite(value))
    .slice()
    .sort((a, b) => a - b);
}

function median(values) {
  const sorted = sortedNumbers(values);
  if (!sorted.length) {
    return 0;
  }
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

function medianAbsoluteDeviation(values, center = median(values)) {
  return median(values.map((value) => Math.abs(value - center)));
}

function rmsVecDeviation(samples, key, center) {
  if (!samples.length) {
    return 0;
  }
  let variance = 0;
  for (const sample of samples) {
    const diff = sub(sample[key], center);
    variance += dot(diff, diff);
  }
  return Math.sqrt(variance / samples.length);
}

function eventPerfTimestamp(event) {
  const fallback = nowPerf();
  const rawTs = Number(event?.timeStamp);
  if (!Number.isFinite(rawTs) || rawTs <= 0) {
    return fallback;
  }
  if (Math.abs(rawTs - fallback) < 5000) {
    return rawTs;
  }
  if (Number.isFinite(performance.timeOrigin)) {
    const converted = rawTs - performance.timeOrigin;
    if (converted > 0 && Math.abs(converted - fallback) < 5000) {
      return converted;
    }
  }
  return fallback;
}

function createSensorQualityState() {
  return {
    firstTs: 0,
    lastTs: 0,
    sampleCount: 0,
    intervalCount: 0,
    totalIntervalMs: 0,
    maxGapMs: 0,
    badTimingCount: 0,
    nonMonotonicCount: 0,
    plausibilityFailures: 0,
    zeroWhileRawMovingMs: 0,
    lastRaw: null,
    lastDynamic: null,
    lastIssue: "",
  };
}

function resetSensorQualityState() {
  state.sensorQuality = createSensorQualityState();
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

function observeSampleTiming(samplePerfTs) {
  const quality = state.sensorQuality;
  if (!quality.firstTs) {
    quality.firstTs = samplePerfTs;
    quality.lastTs = samplePerfTs;
    quality.sampleCount = 1;
    return { ok: true, dtSec: 1 / 60 };
  }

  const dtMs = samplePerfTs - quality.lastTs;
  if (!Number.isFinite(dtMs) || dtMs <= 0) {
    quality.nonMonotonicCount += 1;
    quality.lastIssue = "motion timestamps were not monotonic";
    return {
      ok: quality.nonMonotonicCount < SENSOR_BAD_TIMING_LIMIT,
      dtSec: 1 / 60,
      issue: "Motion timestamps are not stable enough for timing.",
    };
  }

  quality.lastTs = samplePerfTs;
  quality.sampleCount += 1;
  quality.intervalCount += 1;
  quality.totalIntervalMs += dtMs;
  quality.maxGapMs = Math.max(quality.maxGapMs, dtMs);

  if (dtMs > SENSOR_MAX_SAMPLE_GAP_MS) {
    quality.badTimingCount += 1;
    quality.lastIssue = `motion sample gap ${Math.round(dtMs)}ms`;
  }

  if (quality.sampleCount >= SENSOR_QUALITY_WARMUP_SAMPLES && quality.totalIntervalMs > 0) {
    const effectiveHz = (quality.intervalCount * 1000) / quality.totalIntervalMs;
    if (effectiveHz < SENSOR_MIN_EFFECTIVE_HZ) {
      quality.lastIssue = `motion sample rate ${effectiveHz.toFixed(1)} Hz`;
      return {
        ok: false,
        dtSec: dtMs / 1000,
        issue: "Motion sample rate is too low for reliable speed timing.",
      };
    }
  }

  if (quality.badTimingCount >= SENSOR_BAD_TIMING_LIMIT) {
    return {
      ok: false,
      dtSec: dtMs / 1000,
      issue: "Motion sample timing is too irregular for reliable speed timing.",
    };
  }

  return { ok: true, dtSec: dtMs / 1000 };
}

function observeSensorPlausibility(raw, dynamic, dtSec) {
  const quality = state.sensorQuality;
  const rawMag = norm(raw);
  const dynamicMag = norm(dynamic);
  let failed = false;

  if (rawMag < SENSOR_RAW_MAG_MIN_MS2
    || rawMag > SENSOR_RAW_MAG_MAX_MS2
    || dynamicMag > SENSOR_LINEAR_MAG_MAX_MS2) {
    failed = true;
  }

  if (quality.lastRaw && dynamicMag < 0.003) {
    const rawDelta = norm(sub(raw, quality.lastRaw));
    if (rawDelta > 0.12) {
      quality.zeroWhileRawMovingMs += dtSec * 1000;
    } else {
      quality.zeroWhileRawMovingMs = Math.max(0, quality.zeroWhileRawMovingMs - dtSec * 700);
    }
  }

  if (quality.zeroWhileRawMovingMs >= SENSOR_ZERO_WHILE_RAW_MOVING_LIMIT_MS) {
    failed = true;
    quality.lastIssue = "linear acceleration stayed zero while raw acceleration moved";
  }

  if (failed) {
    quality.plausibilityFailures += 1;
  } else {
    quality.plausibilityFailures = Math.max(0, quality.plausibilityFailures - 1);
  }

  quality.lastRaw = cloneVec(raw);
  quality.lastDynamic = cloneVec(dynamic);

  if (quality.plausibilityFailures >= SENSOR_PLAUSIBILITY_LIMIT) {
    return {
      ok: false,
      issue: quality.lastIssue || "Motion sensor values are outside plausible bounds.",
    };
  }

  return { ok: true };
}

function sensorQualitySummary() {
  const quality = state.sensorQuality;
  const effectiveHz = quality.totalIntervalMs > 0
    ? (quality.intervalCount * 1000) / quality.totalIntervalMs
    : 0;
  return {
    sampleCount: quality.sampleCount,
    effectiveHz: Math.round(effectiveHz * 10) / 10,
    maxGapMs: Math.round(quality.maxGapMs),
    badTimingCount: quality.badTimingCount,
    plausibilityFailures: quality.plausibilityFailures,
    lastIssue: quality.lastIssue,
  };
}

function createRawSensorRecord(samplePerfTs, dtSec, raw, dynamic, eventTs = null) {
  return {
    perfTs: samplePerfTs,
    dtSec,
    eventTs: Number.isFinite(eventTs) ? eventTs : null,
    raw: cloneVec(raw),
    dynamic: cloneVec(dynamic),
  };
}

function compactRawSensorRecord(record, startPerfTs) {
  return {
    t: Math.round((record.perfTs - startPerfTs) * 1000) / 1000,
    dt: Math.round(record.dtSec * 1000000) / 1000000,
    acceleration: compactVec(record.dynamic),
    accelerationIncludingGravity: compactVec(record.raw),
  };
}

function appendRawSampleBuffer(record) {
  state.rawSampleBuffer.push(record);
  while (state.rawSampleBuffer.length > RAW_BUFFER_MAX_SAMPLES) {
    state.rawSampleBuffer.shift();
  }
}

function appendRunRawSample(run, record) {
  if (!run || !record) {
    return;
  }
  if (!Array.isArray(run.rawSamples)) {
    run.rawSamples = [];
  }
  const startPerfTs = Number.isFinite(run.rawStartPerfTs) ? run.rawStartPerfTs : run.startPerfTs;
  const entry = compactRawSensorRecord(record, startPerfTs);
  const last = run.rawSamples[run.rawSamples.length - 1];
  if (last && Math.abs(last.t - entry.t) < 0.05) {
    run.rawSamples[run.rawSamples.length - 1] = entry;
  } else {
    run.rawSamples.push(entry);
  }
  if (run.rawSamples.length > RAW_TRACE_MAX_SAMPLES) {
    run.rawSamples.shift();
  }
}

function seedRunRawSamples(run) {
  if (!run) {
    return;
  }
  const cutoff = run.startPerfTs - PRELAUNCH_RAW_TRACE_MS;
  const samples = state.rawSampleBuffer.filter((record) => record.perfTs >= cutoff);
  run.rawSamples = [];
  run.rawStartPerfTs = run.startPerfTs;
  for (const record of samples) {
    appendRunRawSample(run, record);
  }
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

function resetPreLaunchSamples() {
  state.preLaunchSamples = [];
}

function recordPreLaunchSample(sample) {
  if (!sample || sample.horizontalMagMs2 > 0.28) {
    return;
  }
  state.preLaunchSamples.push(sample);
  while (state.preLaunchSamples.length > 80) {
    state.preLaunchSamples.shift();
  }
}

function estimatePreLaunchBias(forward) {
  const usable = state.preLaunchSamples.filter((sample) => sample && isFiniteVec(sample.dynamic));
  if (!usable.length || !isFiniteVec(forward)) {
    return 0;
  }
  const projected = usable.map((sample) => dot(sample.dynamic, forward));
  const center = median(projected);
  const mad = medianAbsoluteDeviation(projected, center);
  const stable = projected.filter((value) => Math.abs(value - center) <= Math.max(0.08, mad * 3));
  if (!stable.length) {
    return 0;
  }
  const avg = stable.reduce((acc, value) => acc + value, 0) / stable.length;
  return clamp(avg, -0.35, 0.35);
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
    sensorQuality: run.sensorQuality || null,
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
    sensorQuality: payload.sensorQuality && typeof payload.sensorQuality === "object" ? payload.sensorQuality : null,
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
  el.runSplits.replaceChildren();
  let rendered = 0;
  for (const label of labels) {
    if (!Number.isFinite(run.splits?.[label])) {
      continue;
    }
    const item = document.createElement("span");
    const title = document.createElement("strong");
    title.textContent = label;
    item.append(title, ` ${run.splits[label].toFixed(3)}s`);
    el.runSplits.append(item);
    rendered += 1;
  }
  if (Number.isFinite(run.peakSpeedMph) && run.peakSpeedMph > 0) {
    const item = document.createElement("span");
    const title = document.createElement("strong");
    title.textContent = "Peak";
    item.append(title, ` ${run.peakSpeedMph.toFixed(1)} mph`);
    el.runSplits.append(item);
    rendered += 1;
  }
  if (!rendered) {
    const item = document.createElement("span");
    const title = document.createElement("strong");
    title.textContent = modeLabel(run.testType);
    item.append(title, " completed with no standard split reached.");
    el.runSplits.append(item);
  }
}

function renderHistory() {
  el.historyList.replaceChildren();
  if (!state.history.length) {
    const emptyItem = document.createElement("li");
    emptyItem.className = "history-item";
    const emptyButton = document.createElement("button");
    emptyButton.type = "button";
    emptyButton.disabled = true;
    emptyButton.textContent = "No saved runs yet.";
    emptyItem.append(emptyButton);
    el.historyList.append(emptyItem);
    return;
  }

  for (const run of state.history) {
    const item = document.createElement("li");
    item.className = "history-item";

    const button = document.createElement("button");
    button.type = "button";
    if (run.id === state.selectedRunId) {
      button.className = "active";
    }

    const result = document.createElement("strong");
    result.textContent = formatResult(run);
    const date = document.createTextNode(new Date(run.timestamp).toLocaleString());
    button.append(result, document.createElement("br"), date);

    button.addEventListener("click", () => {
      state.selectedRunId = run.id;
      renderHistory();
      renderSelectedRun();
      scheduleUrlSync();
    });

    item.append(button);
    el.historyList.append(item);
  }
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
      el.runSplits.replaceChildren();
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

function safeTraceFileName(run) {
  const stamp = new Date(Number(run?.timestamp) || Date.now())
    .toISOString()
    .replace(/[:.]/g, "-");
  const label = String(run?.resultLabel || "run").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `accellab-${stamp}-${label || "run"}.json`;
}

function buildRawTracePayload(run) {
  if (!run || !Array.isArray(run.rawSamples) || run.rawSamples.length < 3) {
    return null;
  }
  const calibration = run.calibration || state.calibration;
  return {
    format: "accellab-raw-trace",
    version: 1,
    exportedAt: new Date().toISOString(),
    app: {
      name: "AccelLab",
      userAgent: navigator.userAgent,
    },
    testType: normalizeRunMode(run.testType),
    settings: {
      smoothing: state.settings.smoothing,
      vehicleWeightLb: state.settings.vehicleWeightLb,
    },
    calibration: calibration ? {
      timestamp: Number(calibration.timestamp) || Date.now(),
      gravity: compactVec(calibration.gravity),
      vertical: compactVec(calibration.vertical),
      quality: calibration.quality || null,
    } : null,
    calibrationCapture: run.calibrationCapture || state.lastCalibrationTrace,
    result: serializeRun(run, { sampleCap: 3000 }),
    sensorQuality: run.sensorQuality || null,
    rawSamples: run.rawSamples,
  };
}

function downloadJsonFile(payload, filename) {
  const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function exportSelectedTrace() {
  const run = getSelectedRun();
  const payload = buildRawTracePayload(run);
  if (!payload) {
    setStatus("Selected run does not have raw trace data in this session.", "warn");
    return;
  }
  downloadJsonFile(payload, safeTraceFileName(run));
  setStatus("Raw run trace exported.", "ok");
}

function normalizeRawTraceSample(entry) {
  if (!entry || typeof entry !== "object") {
    return null;
  }
  const t = Number(entry.t);
  const dt = Number(entry.dt);
  const dynamic = expandVec(entry.acceleration || entry.dynamic || entry.accel);
  const raw = expandVec(entry.accelerationIncludingGravity || entry.raw || entry.accelG);
  if (!Number.isFinite(t) || !isFiniteVec(dynamic) || !isFiniteVec(raw)) {
    return null;
  }
  return {
    t,
    dtSec: Number.isFinite(dt) && dt > 0 ? dt : 0,
    dynamic,
    raw,
  };
}

function normalizeCalibrationTraceSample(entry) {
  if (!entry || typeof entry !== "object") {
    return null;
  }
  const t = Number(entry.t);
  const raw = expandVec(entry.raw || entry.accelerationIncludingGravity);
  const dynamic = expandVec(entry.dynamic || entry.acceleration);
  if (!Number.isFinite(t) || !isFiniteVec(raw)) {
    return null;
  }
  return { t, raw, dynamic };
}

function calibrationFromTracePayload(payload) {
  const captureSamples = Array.isArray(payload.calibrationCapture?.samples)
    ? payload.calibrationCapture.samples.map((entry) => normalizeCalibrationTraceSample(entry)).filter(Boolean)
    : [];
  if (captureSamples.length) {
    const result = buildCalibrationFromSamples(captureSamples);
    if (result.error) {
      throw new Error(`Calibration replay failed: ${result.error}`);
    }
    return {
      timestamp: Number(payload.calibrationCapture?.timestamp) || Date.now(),
      gravity: result.gravity,
      vertical: result.vertical,
      quality: result.quality,
    };
  }

  const gravity = expandVec(payload.calibration?.gravity);
  const vertical = expandVec(payload.calibration?.vertical);
  if (!gravity || !vertical) {
    throw new Error("Trace does not include usable calibration data.");
  }
  return {
    timestamp: Number(payload.calibration?.timestamp) || Date.now(),
    gravity,
    vertical: normalize(vertical),
    quality: payload.calibration?.quality || null,
  };
}

function restoreSettingsForTrace(payload) {
  if (payload.testType) {
    state.testType = normalizeRunMode(payload.testType);
    el.testType.value = state.testType;
  }
  if (payload.settings && typeof payload.settings === "object") {
    state.settings.smoothing = ["off", "normal", "high"].includes(payload.settings.smoothing)
      ? payload.settings.smoothing
      : state.settings.smoothing;
    const weight = Number(payload.settings.vehicleWeightLb);
    if (Number.isFinite(weight) && weight > 800) {
      state.settings.vehicleWeightLb = weight;
    }
    applySettingsToUi();
    saveSettings();
  }
}

function replayRawTrace(payload) {
  if (!payload || payload.format !== "accellab-raw-trace") {
    throw new Error("Unsupported trace file format.");
  }
  const rawSamples = Array.isArray(payload.rawSamples)
    ? payload.rawSamples.map((entry) => normalizeRawTraceSample(entry)).filter(Boolean)
    : [];
  if (rawSamples.length < SENSOR_QUALITY_WARMUP_SAMPLES) {
    throw new Error("Trace does not contain enough raw samples to replay.");
  }

  if (state.sensorEnabled) {
    disarmSensors({ preserveData: true, statusMessage: "Sensors disarmed before trace import.", tone: "neutral" });
  }

  restoreSettingsForTrace(payload);
  resetLiveCaptureState();
  state.calibration = calibrationFromTracePayload(payload);
  state.lastCalibrationTrace = payload.calibrationCapture || null;
  state.readyStillMs = READY_STATIONARY_MS;
  setRunSignal("REPLAY", "running");
  setStatus("Replaying raw trace with current analyzer...", "neutral");

  const sortedSamples = rawSamples.slice().sort((a, b) => a.t - b.t);
  const minT = sortedSamples[0].t;
  const replayOrigin = nowPerf() + 1000 - Math.min(0, minT);
  const existingRunIds = new Set(state.history.map((run) => run.id));

  try {
    for (const sample of sortedSamples) {
      const samplePerfTs = replayOrigin + sample.t;
      const timing = observeSampleTiming(samplePerfTs);
      if (!timing.ok) {
        throw new Error(timing.issue || "Trace timing is not stable enough for replay.");
      }
      const dtSec = sample.dtSec > 0 ? sample.dtSec : timing.dtSec;
      const plausibility = observeSensorPlausibility(sample.raw, sample.dynamic, dtSec);
      if (!plausibility.ok) {
        throw new Error(plausibility.issue || "Trace sensor values are not plausible enough for replay.");
      }
      const rawRecord = createRawSensorRecord(samplePerfTs, dtSec, sample.raw, sample.dynamic);
      appendRawSampleBuffer(rawRecord);
      processAcceptedSensorSample({
        samplePerfTs,
        dtSec,
        raw: sample.raw,
        dynamic: sample.dynamic,
        rawRecord,
      });
    }

    if (state.isRunning && state.currentRun) {
      completeRun(replayOrigin + sortedSamples[sortedSamples.length - 1].t, "timeout");
    }
    const imported = state.history.find((run) => !existingRunIds.has(run.id)) || null;
    if (!imported) {
      throw new Error("Trace replay completed without detecting a valid run.");
    }
    state.selectedRunId = imported.id;
    setRunSignal("IMPORTED", "ready");
    setStatus(`Trace imported and re-analyzed: ${formatResult(imported)}.`, "ok");
  } finally {
    state.sensorEnabled = false;
    state.isRunning = false;
    state.currentRun = null;
    updateArmButton();
    scheduleUrlSync();
  }
}

async function importTraceFile(file) {
  if (!file) {
    return;
  }
  try {
    const payload = JSON.parse(await file.text());
    replayRawTrace(payload);
    renderHistory();
    renderSelectedRun();
  } catch (error) {
    setRunSignal("IMPORT FAILED", "alert");
    setStatus(`Trace import failed: ${error.message}`, "warn");
  } finally {
    if (el.importTraceFile) {
      el.importTraceFile.value = "";
    }
  }
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
  resetPreLaunchSamples();
  state.isRunning = false;
  state.currentRun = null;
  state.lastUiDrawTs = 0;
  state.lastScoreSample = null;
  state.lastMotionSample = null;
  state.missingLinearAccelSamples = 0;
  resetSensorQualityState();
  state.rawSampleBuffer = [];
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
  const validSamples = Array.isArray(samples)
    ? samples.filter((sample) => Number.isFinite(sample.t) && isFiniteVec(sample.raw))
    : [];
  if (validSamples.length < CALIBRATION_MIN_SAMPLES) {
    return {
      error: "not enough sensor samples for a reliable capture. Re-arm and try again.",
      errorCode: "sample-rate",
    };
  }

  const captureDurationMs = validSamples.length > 1
    ? validSamples[validSamples.length - 1].t - validSamples[0].t
    : 0;
  if (captureDurationMs < CALIBRATION_MIN_CAPTURE_MS) {
    return {
      error: "sensor sample rate was too low for calibration. Re-arm and try again.",
      errorCode: "sample-rate",
    };
  }

  const gaps = [];
  for (let i = 1; i < validSamples.length; i += 1) {
    const gap = validSamples[i].t - validSamples[i - 1].t;
    if (Number.isFinite(gap) && gap >= 0) {
      gaps.push(gap);
    }
  }
  const maxGapMs = gaps.length ? Math.max(...gaps) : 0;
  const effectiveHz = captureDurationMs > 0
    ? ((validSamples.length - 1) * 1000) / captureDurationMs
    : 0;
  if (effectiveHz < CALIBRATION_MIN_HZ || maxGapMs > CALIBRATION_MAX_GAP_MS) {
    return {
      error: "sensor sample timing was too sparse or irregular for calibration. Re-arm and try again.",
      errorCode: "sample-rate",
    };
  }

  let avg = vec(0, 0, 0);
  for (const sample of validSamples) {
    avg = add(avg, sample.raw);
  }
  avg = scale(avg, 1 / validSamples.length);

  const gravityMag = norm(avg);
  if (gravityMag < CALIBRATION_GRAVITY_MIN_MS2 || gravityMag > CALIBRATION_GRAVITY_MAX_MS2) {
    return {
      error: "gravity magnitude was not physically plausible. Re-arm and try again.",
      errorCode: "gravity",
    };
  }

  const rms = rmsVecDeviation(validSamples, "raw", avg);
  const rawMags = validSamples.map((sample) => norm(sample.raw));
  const rawMagMad = medianAbsoluteDeviation(rawMags);
  if (rms > 0.45 || rawMagMad > 0.12) {
    return {
      error: "phone moved during capture. Keep device still and retry.",
      errorCode: "motion",
    };
  }

  const dynamicSamples = validSamples.filter((sample) => isFiniteVec(sample.dynamic));
  if (dynamicSamples.length >= CALIBRATION_MIN_SAMPLES) {
    const dynamicAvg = dynamicSamples.reduce((acc, sample) => add(acc, sample.dynamic), vec(0, 0, 0));
    const dynamicCenter = scale(dynamicAvg, 1 / dynamicSamples.length);
    const dynamicRms = rmsVecDeviation(dynamicSamples, "dynamic", dynamicCenter);
    if (dynamicRms > CALIBRATION_LINEAR_RMS_MAX_MS2) {
      return {
        error: "linear acceleration was too noisy while still. Keep device still and retry.",
        errorCode: "motion",
      };
    }
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
    quality: {
      sampleCount: validSamples.length,
      effectiveHz: Math.round(effectiveHz * 10) / 10,
      maxGapMs: Math.round(maxGapMs),
      rawRmsMs2: Math.round(rms * 1000) / 1000,
      rawMagMadMs2: Math.round(rawMagMad * 1000) / 1000,
      gravityMagMs2: Math.round(gravityMag * 1000) / 1000,
    },
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
    quality: result.quality,
  };
  state.lastCalibrationTrace = {
    timestamp: state.calibration.timestamp,
    samples: capture.samples.map((sample) => ({
      t: Math.round((sample.t - capture.startPerfTs) * 1000) / 1000,
      raw: compactVec(sample.raw),
      dynamic: compactVec(sample.dynamic),
    })),
    quality: result.quality,
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
    stopCandidateMs: 0,
    brakingSeen: false,
    forward,
    lateral,
    startPerfTs,
    rawStartPerfTs: startPerfTs,
    rawSamples: [],
    calibration: state.calibration ? {
      timestamp: Number(state.calibration.timestamp) || Date.now(),
      gravity: cloneVec(state.calibration.gravity),
      vertical: cloneVec(state.calibration.vertical),
      quality: state.calibration.quality || null,
    } : null,
    calibrationCapture: state.lastCalibrationTrace,
    sensorQuality: null,
    samples: [],
  };
  seedRunRawSamples(state.currentRun);
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
  const preLaunchBiasMs2 = estimatePreLaunchBias(forward);
  resetRunScoringState();
  beginRun(inference.startPerfTs, forward, lateral);
  state.filters.biasMs2 = preLaunchBiasMs2;
  resetPreLaunchSamples();
  resetLaunchInference();

  let previousPerfTs = inference.startPerfTs;
  for (const replaySample of replaySamples) {
    const motionSample = {
      ...replaySample,
      dtSec: Math.max(0, (replaySample.perfTs - previousPerfTs) / 1000),
    };
    previousPerfTs = replaySample.perfTs;
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
  run.sensorQuality = sensorQualitySummary();
  delete run.downCrossings;
  delete run.forward;
  delete run.lateral;
  delete run.lateralRejectMs;
  delete run.stopCandidateMs;
  delete run.brakingSeen;
  delete run.startPerfTs;
  delete run.rawStartPerfTs;

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

function completeRunAtStopSample(run, stopSample) {
  if (stopSample.perfTs - run.startPerfTs < RUN_MIN_COMPLETE_MS || run.peakSpeedMph < 12) {
    return false;
  }

  appendRunSample(run, stopSample);
  if (run.testType === "accel-brake") {
    if (run.downCrossings[60]) {
      run.splits["60-0"] = Math.max(0, (stopSample.perfTs - run.downCrossings[60]) / 1000);
    }
    if (run.downCrossings[100]) {
      run.splits["100-0"] = Math.max(0, (stopSample.perfTs - run.downCrossings[100]) / 1000);
    }
    if (Number.isFinite(run.splits["0-60"])) {
      run.splits["0-60-0"] = Math.max(0, (stopSample.perfTs - run.startPerfTs) / 1000);
    }
    if (Number.isFinite(run.splits["0-100"])) {
      run.splits["0-100-0"] = Math.max(0, (stopSample.perfTs - run.startPerfTs) / 1000);
    }
  }
  completeRun(stopSample.perfTs, "complete");
  return true;
}

function zeroVelocityScoreSample(sample) {
  return {
    ...sample,
    speedMps: 0,
    speedMph: 0,
  };
}

function updateStopCandidate(run, sample) {
  const quiet = Math.abs(sample.longMs2) < STOP_QUIET_LONG_MS2
    && Math.abs(sample.latG * G) < STOP_QUIET_LAT_MS2;
  const maxSpeed = run.brakingSeen ? STOP_BRAKE_MAX_SPEED_MPH : STOP_MAX_SPEED_MPH;
  const eligible = quiet
    && run.peakSpeedMph >= 12
    && sample.perfTs - run.startPerfTs >= RUN_MIN_COMPLETE_MS
    && sample.speedMph <= maxSpeed;
  if (eligible) {
    run.stopCandidateMs += sample.dtSec * 1000;
  } else {
    run.stopCandidateMs = Math.max(0, run.stopCandidateMs - sample.dtSec * 700);
  }
  return run.stopCandidateMs >= STOP_STILL_COMPLETE_MS;
}

function maybeCompleteRunAtStop(run, previousSample, sample) {
  const stopCrossing = findScoreThresholdCrossing(previousSample, sample, "speedMph", STOP_COMPLETE_MPH, "falling")
    || (!previousSample && sample.speedMph <= STOP_COMPLETE_MPH ? sample : null);
  if (stopCrossing && completeRunAtStopSample(run, stopCrossing)) {
    return true;
  }

  if (!updateStopCandidate(run, sample)) {
    return false;
  }

  state.live.speedMps = 0;
  state.live.displaySpeedMps = 0;
  const stoppedSample = zeroVelocityScoreSample(sample);
  return completeRunAtStopSample(run, stoppedSample);
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

  if (sample.longG < -0.08 && sample.speedMph > 20) {
    run.brakingSeen = true;
    if (run.testType === "accel-brake") {
      setRunSignal("BRAKING", "alert");
    }
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
  const motionQuiet = Math.abs(longMs2) < 0.18 && Math.abs(latMs2) < 0.20;
  const likelyStationary = motionQuiet && (!state.isRunning || speedMph < 2.5);
  const lowExcitation = Math.abs(longMs2) < 0.45 && Math.abs(latMs2) < 0.45;
  if (likelyStationary) {
    state.filters.stationaryMs += dtSec * 1000;
  } else {
    state.filters.stationaryMs = Math.max(0, state.filters.stationaryMs - dtSec * 420);
  }
  if (lowExcitation && !state.isRunning) {
    const biasTauSec = speedMph < 8 ? 2.8 : 8;
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
  if (!state.isRunning
    && (state.filters.stationaryMs > 700 || (state.live.speedMps < 0.35 && state.filters.stationaryMs > 320))) {
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

function stopForSensorQuality(issue) {
  disarmSensors({
    preserveData: true,
    statusMessage: `${issue} Re-arm and try again.`,
    tone: "warn",
    signalMessage: "UNSUPPORTED",
    signalMode: "alert",
  });
}

function processAcceptedSensorSample({ samplePerfTs, dtSec, raw, dynamic, rawRecord = null }) {
  if (state.calibrationCapture && state.calibrationCapture.phase === "capturing") {
    state.calibrationCapture.samples.push({ t: samplePerfTs, raw, dynamic });
  }

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
      dtSec,
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

  const motionSample = createMotionSample(samplePerfTs, dtSec, dynamic, state.calibration.vertical);
  let runStartedThisSample = false;
  if (state.currentRun && rawRecord) {
    appendRunRawSample(state.currentRun, rawRecord);
  }

  if (!state.isRunning) {
    const wasReady = state.readyStillMs >= READY_STATIONARY_MS;
    state.readyStillMs = updateStillnessCounter(
      state.readyStillMs,
      dtSec,
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
      if (isReady) {
        recordPreLaunchSample(motionSample);
      }
      if ((wasReady || isReady)
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

function onDeviceMotion(event) {
  if (!state.sensorEnabled) {
    return;
  }

  const accIncl = event.accelerationIncludingGravity;
  if (!accIncl || accIncl.x == null || accIncl.y == null || accIncl.z == null) {
    return;
  }

  const samplePerfTs = eventPerfTimestamp(event);
  const timing = observeSampleTiming(samplePerfTs);
  if (!timing.ok) {
    stopForSensorQuality(timing.issue || "Motion sample timing is not stable enough for timing.");
    return;
  }

  const raw = vec(Number(accIncl.x), Number(accIncl.y), Number(accIncl.z));
  if (!isFiniteVec(raw)) {
    stopForSensorQuality("Motion sensor returned non-finite gravity-inclusive acceleration.");
    return;
  }

  const linearAccel = event.acceleration;
  const hasLinearAcceleration = linearAccel
    && linearAccel.x != null
    && linearAccel.y != null
    && linearAccel.z != null;
  if (!hasLinearAcceleration) {
    state.missingLinearAccelSamples += 1;
    if (state.missingLinearAccelSamples >= LINEAR_ACCEL_MISSING_LIMIT) {
      stopForSensorQuality("Browser does not expose stable linear acceleration. Run timing is disabled on this device/browser.");
    }
    return;
  }
  state.missingLinearAccelSamples = 0;

  const dynamic = vec(Number(linearAccel.x), Number(linearAccel.y), Number(linearAccel.z));
  if (!isFiniteVec(dynamic)) {
    stopForSensorQuality("Motion sensor returned non-finite linear acceleration.");
    return;
  }

  const plausibility = observeSensorPlausibility(raw, dynamic, timing.dtSec);
  if (!plausibility.ok) {
    stopForSensorQuality(plausibility.issue || "Motion sensor values are not plausible enough for timing.");
    return;
  }

  const rawRecord = createRawSensorRecord(samplePerfTs, timing.dtSec, raw, dynamic, Number(event.timeStamp));
  appendRawSampleBuffer(rawRecord);
  processAcceptedSensorSample({
    samplePerfTs,
    dtSec: timing.dtSec,
    raw,
    dynamic,
    rawRecord,
  });
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
  state.lastCalibrationTrace = null;
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

  if (el.exportTrace) {
    el.exportTrace.addEventListener("click", exportSelectedTrace);
  }
  if (el.importTrace && el.importTraceFile) {
    el.importTrace.addEventListener("click", () => el.importTraceFile.click());
    el.importTraceFile.addEventListener("change", () => {
      importTraceFile(el.importTraceFile.files?.[0]);
    });
  }
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
