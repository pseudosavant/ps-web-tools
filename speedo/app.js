
const G = 9.80665;
const MPH_PER_MPS = 2.2369362921;
const MAX_HISTORY = 20;
const ROLLING_WINDOW_MS = 30000;
const ROLLING_NODE_COUNT = 240;
const ROLLING_BUCKET_MS = ROLLING_WINDOW_MS / (ROLLING_NODE_COUNT - 1);
const SPEED_DISPLAY_WINDOW_MS = 1000;
const SPEED_DISPLAY_SAMPLE_COUNT = 5;
const CALIBRATION_TAP_SETTLE_MS = 120;
const CALIBRATION_CAPTURE_MS = 1500;
const URL_MAX_LENGTH = 7000;

const STORAGE_KEYS = {
  calibration: "accellab:calibration:v1",
  history: "accellab:history:v1",
  settings: "accellab:settings:v1",
};

const SMOOTHING_ALPHA = {
  off: 1.0,
  normal: 0.22,
  high: 0.12,
};

const el = {
  testType: document.getElementById("testType"),
  enableSensors: document.getElementById("enableSensors"),
  calibrate: document.getElementById("calibrate"),
  recalibrate: document.getElementById("recalibrate"),
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
  hpEstimate: document.getElementById("hpEstimate"),
};

const state = {
  testType: "0-60",
  sensorEnabled: false,
  lastMotionTs: 0,
  gravityEstimate: null,
  orientation: null,
  calibration: null,
  settings: {
    audio: true,
    haptics: false,
    autoDisarmOnComplete: true,
    smoothing: "normal",
    vehicleWeightLb: 3600,
  },
  motionBuffer: [],
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
  startGateMs: 0,
  isRunning: false,
  currentRun: null,
  history: [],
  selectedRunId: null,
  urlSyncTimer: 0,
  lastUiDrawTs: 0,
};

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

function base64UrlEncodeString(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const b of bytes) {
    binary += String.fromCharCode(b);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecodeString(encoded) {
  const pad = "=".repeat((4 - (encoded.length % 4)) % 4);
  const b64 = encoded.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
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
  return {
    id: run.id,
    timestamp: run.timestamp,
    testType: run.testType,
    resultSeconds: run.resultSeconds,
    completion: run.completion,
    reached60: Boolean(run.reached60),
    reached100: Boolean(run.reached100),
    samples: packSamples(finalSamples),
  };
}

function deserializeRun(payload) {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  return {
    id: String(payload.id || `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`),
    timestamp: Number(payload.timestamp) || Date.now(),
    testType: String(payload.testType || "0-60"),
    resultSeconds: Number(payload.resultSeconds) || 0,
    completion: String(payload.completion || "complete"),
    reached60: Boolean(payload.reached60),
    reached100: Boolean(payload.reached100),
    samples: unpackSamples(payload.samples),
  };
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
  if (!parsed) {
    return;
  }
  state.calibration = parsed;
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

function formatResult(run) {
  if (!run) {
    return "No run";
  }
  const suffix = run.completion === "timeout" ? " (timeout)" : "";
  return `${run.testType}: ${run.resultSeconds.toFixed(3)}s${suffix}`;
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

function renderSelectedRun() {
  const run = getSelectedRun();
  if (!run) {
    el.runResult.textContent = "No completed runs yet.";
    el.hpEstimate.textContent = "Estimated wheel horsepower appears when weight and run data are available.";
    drawRunCharts(null);
    return;
  }
  const date = new Date(run.timestamp).toLocaleString();
  el.runResult.textContent = `${formatResult(run)} - ${date}`;
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

function targetMphForMode(mode) {
  return mode === "0-100" ? 100 : 60;
}

function updateSpeedColors(speedMph) {
  const target = targetMphForMode(state.testType);
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
  state.gravityEstimate = null;
  state.motionBuffer = [];
  resetRollingState();
  resetFilterState();
  state.live.longG = 0;
  state.live.latG = 0;
  state.live.longMs2 = 0;
  state.live.speedMps = 0;
  state.live.displaySpeedMps = 0;
  state.speedDisplayWindow = [];
  state.startGateMs = 0;
  state.isRunning = false;
  state.currentRun = null;
  state.lastUiDrawTs = 0;
  updateLiveUi();
  drawRollingCharts();
}

function setCalibrateButtonBusy(isBusy) {
  el.calibrate.disabled = isBusy;
  el.calibrate.textContent = isBusy ? "Calibrating..." : "Calibrate";
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
  setCalibrateButtonBusy(false);
  if (statusMessage) {
    setStatus(statusMessage, tone);
  }
}

function buildCalibrationFromSamples(samples) {
  if (samples.length < 35) {
    return { error: "not enough sensor samples. Hold still and retry." };
  }

  let avg = vec(0, 0, 0);
  for (const raw of samples) {
    avg = add(avg, raw);
  }
  avg = scale(avg, 1 / samples.length);

  let variance = 0;
  for (const raw of samples) {
    const diff = sub(raw, avg);
    variance += dot(diff, diff);
  }
  const rms = Math.sqrt(variance / samples.length);
  if (rms > 0.45) {
    return { error: "phone moved during capture. Keep device still and retry." };
  }

  const vertical = normalize(avg);
  let forward = normalize(projectOntoPlane(vec(0, 1, 0), vertical));
  if (norm(forward) < 0.15) {
    forward = normalize(projectOntoPlane(vec(1, 0, 0), vertical));
  }
  const lateral = normalize(cross(vertical, forward));

  if (norm(forward) < 0.1 || norm(lateral) < 0.1) {
    return { error: "unstable orientation. Keep the phone fixed and retry." };
  }

  return {
    gravity: avg,
    forward,
    lateral,
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
  setCalibrateButtonBusy(false);

  const result = buildCalibrationFromSamples(capture.samples);
  if (result.error) {
    setStatus(`Calibration failed: ${result.error}`, "warn");
    return;
  }

  state.calibration = {
    timestamp: Date.now(),
    gravity: result.gravity,
    orientation: state.orientation,
    forward: result.forward,
    lateral: result.lateral,
    vertical: result.vertical,
  };
  saveCalibration();
  setStatus("Calibration complete. Automatic run detection is active.", "ok");
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
  window.removeEventListener("deviceorientation", onDeviceOrientation);
  state.sensorEnabled = false;
  state.isRunning = false;
  state.currentRun = null;
  state.startGateMs = 0;
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

function beginRun(startPerfTs) {
  state.isRunning = true;
  state.currentRun = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: Date.now(),
    testType: state.testType,
    resultSeconds: 0,
    completion: "complete",
    reached60: false,
    reached100: false,
    phase60Done: false,
    startPerfTs,
    samples: [],
  };
  setRunSignal("RUNNING", "running");
  setStatus("Run started. Keep focus on the road.", "ok");
}

function completeRun(endPerfTs, completion = "complete") {
  if (!state.currentRun) {
    return;
  }
  const run = state.currentRun;
  const elapsed = Math.max(0, (endPerfTs - run.startPerfTs) / 1000);
  run.resultSeconds = elapsed;
  run.completion = completion;
  delete run.phase60Done;
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
    setStatus(`Run timed out at ${elapsed.toFixed(2)}s.`, "warn");
    return;
  }

  setRunSignal("COMPLETE", "alert");
  if (state.settings.autoDisarmOnComplete && state.sensorEnabled) {
    disarmSensors({
      preserveData: true,
      statusMessage: `Run complete: ${elapsed.toFixed(3)}s. Sensors auto-disarmed.`,
      tone: "ok",
      signalMessage: "COMPLETE",
      signalMode: "alert",
    });
  } else {
    setStatus(`Run complete: ${elapsed.toFixed(3)}s`, "ok");
  }
}

function evaluateRun(samplePerfTs, longG, latG, speedMph) {
  if (!state.calibration) {
    return;
  }
  if (!state.isRunning) {
    const atRest = speedMph < 1 && Math.abs(longG) < 0.06;
    if (atRest && state.live.longMs2 > 1.15) {
      state.startGateMs += 16;
    } else {
      state.startGateMs = 0;
    }
    if (state.startGateMs > 260) {
      state.startGateMs = 0;
      beginRun(samplePerfTs);
    }
    return;
  }

  const run = state.currentRun;
  const elapsedMs = samplePerfTs - run.startPerfTs;
  run.samples.push({ t: elapsedMs, longG, latG, speedMph });
  if (run.samples.length > 3000) {
    run.samples.shift();
  }

  if (speedMph >= 60 && !run.reached60) {
    run.reached60 = true;
    speakCue("60");
    pulseHaptic([40, 40, 40]);
  }
  if (speedMph >= 100 && !run.reached100) {
    run.reached100 = true;
    speakCue("100");
    pulseHaptic([60, 50, 60]);
  }

  if (run.testType === "0-60" && speedMph >= 60) {
    completeRun(samplePerfTs, "complete");
    return;
  }
  if (run.testType === "0-100" && speedMph >= 100) {
    completeRun(samplePerfTs, "complete");
    return;
  }
  if (run.testType === "0-60-0") {
    if (!run.phase60Done && speedMph >= 60) {
      run.phase60Done = true;
      setRunSignal("BRAKE", "alert");
      speakCue("Brake");
      pulseHaptic([120]);
    }
    if (run.phase60Done && speedMph <= 1.0 && elapsedMs > 1500) {
      completeRun(samplePerfTs, "complete");
      return;
    }
  }
  if (elapsedMs > 22000) {
    completeRun(samplePerfTs, "timeout");
  }
}
function onDeviceOrientation(event) {
  state.orientation = {
    alpha: event.alpha,
    beta: event.beta,
    gamma: event.gamma,
  };
}

function getSmoothingAlpha() {
  return SMOOTHING_ALPHA[state.settings.smoothing] ?? SMOOTHING_ALPHA.normal;
}

function applySmoothing(rawLongMs2, rawLatMs2) {
  const alpha = getSmoothingAlpha();
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
    const biasAlpha = speedMph < 8
      ? clamp(dtSec * 0.35, 0, 0.035)
      : clamp(dtSec * 0.08, 0, 0.01);
    state.filters.biasMs2 += (longMs2 - state.filters.biasMs2) * biasAlpha;
  }
}

function integrateSpeed(dtSec, correctedLongMs2) {
  let longMs2 = correctedLongMs2;
  if (Math.abs(longMs2) < 0.12) {
    longMs2 = 0;
  }
  longMs2 = clamp(longMs2, -8.5, 5.9);
  state.live.speedMps = clamp(state.live.speedMps + longMs2 * dtSec, 0, mphToMps(130));

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
    && (state.speedDisplayWindow[0].t < cutoff || state.speedDisplayWindow.length > SPEED_DISPLAY_SAMPLE_COUNT)) {
    state.speedDisplayWindow.shift();
  }

  if (!state.speedDisplayWindow.length) {
    state.live.displaySpeedMps = state.live.speedMps;
    return;
  }

  let weightedSpeed = 0;
  let weightSum = 0;
  for (let i = 0; i < state.speedDisplayWindow.length; i += 1) {
    const weight = i + 1;
    weightedSpeed += state.speedDisplayWindow[i].v * weight;
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
  state.motionBuffer.push({ t: samplePerfTs, raw });
  if (state.motionBuffer.length > 260) {
    state.motionBuffer.shift();
  }
  if (state.calibrationCapture && state.calibrationCapture.phase === "capturing") {
    state.calibrationCapture.samples.push(raw);
  }

  if (!state.gravityEstimate) {
    state.gravityEstimate = raw;
  } else {
    const gravityAlpha = clamp(dt * 1.7, 0.02, 0.18);
    state.gravityEstimate = add(scale(state.gravityEstimate, 1 - gravityAlpha), scale(raw, gravityAlpha));
  }

  let dynamic = vec(0, 0, 0);
  if (event.acceleration && event.acceleration.x != null) {
    dynamic = vec(event.acceleration.x, event.acceleration.y, event.acceleration.z);
  } else {
    dynamic = sub(raw, state.gravityEstimate);
  }

  let longRawMs2 = dynamic.y;
  let latRawMs2 = dynamic.x;
  if (state.calibration) {
    const f = vec(state.calibration.forward.x, state.calibration.forward.y, state.calibration.forward.z);
    const l = vec(state.calibration.lateral.x, state.calibration.lateral.y, state.calibration.lateral.z);
    longRawMs2 = dot(dynamic, f);
    latRawMs2 = dot(dynamic, l);
  }

  applySmoothing(longRawMs2, latRawMs2);
  updateStationaryAndBias(dt, state.filters.longEmaMs2, state.filters.latEmaMs2);

  const correctedLongMs2 = clamp(state.filters.longEmaMs2 - state.filters.biasMs2, -9, 9);
  const integratedLongMs2 = integrateSpeed(dt, correctedLongMs2);
  updateDisplaySpeed(samplePerfTs);

  state.live.longMs2 = integratedLongMs2;
  state.live.longG = integratedLongMs2 / G;
  state.live.latG = state.filters.latEmaMs2 / G;

  ingestRollingSeries(state.rolling.long, state.live.longG, samplePerfTs);
  ingestRollingSeries(state.rolling.lat, state.live.latG, samplePerfTs);
  evaluateRun(samplePerfTs, state.live.longG, state.live.latG, mpsToMph(state.live.displaySpeedMps));

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
  if ("DeviceOrientationEvent" in window && typeof DeviceOrientationEvent.requestPermission === "function") {
    const orientation = await DeviceOrientationEvent.requestPermission();
    if (orientation !== "granted") {
      throw new Error("Orientation permission denied.");
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
  window.addEventListener("deviceorientation", onDeviceOrientation, { passive: true });
  state.sensorEnabled = true;
  resetLiveCaptureState();
  updateArmButton();
  setRunSignal("ARMED", "ready");
  if (state.calibration) {
    setStatus("Sensors armed. Calibration found. Launch detection is active.", "ok");
  } else {
    setStatus("Sensors armed. Keep the vehicle stationary, then calibrate.", "ok");
  }
}

function clearCalibration() {
  cancelCalibrationCapture();
  state.calibration = null;
  localStorage.removeItem(STORAGE_KEYS.calibration);
  setStatus("Calibration removed. Recalibrate before starting tests.", "warn");
  scheduleUrlSync();
}

function calibrateFromBuffer() {
  if (!state.sensorEnabled) {
    setStatus("Arm sensors first.", "warn");
    return;
  }
  if (state.calibrationCapture) {
    setStatus("Calibration already in progress. Hold still.", "neutral");
    return;
  }

  setCalibrateButtonBusy(true);
  setStatus("Hold still. Starting calibration...", "neutral");

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
    setStatus("Calibrating... keep the device still.", "neutral");

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

function clearCharts() {
  drawRollingCharts();
  drawRunCharts(null);
}
function scheduleUrlSync() {
  if (state.urlSyncTimer) {
    clearTimeout(state.urlSyncTimer);
  }
  state.urlSyncTimer = window.setTimeout(syncStateToUrl, 160);
}

function buildUrlPayload(profile) {
  const selectedRunId = state.selectedRunId;
  const runs = state.history.slice(0, profile.maxRuns).map((run) => serializeRun(run, {
    sampleCap: 2400,
    downsampleTarget: run.id === selectedRunId ? profile.selectedSamples : profile.otherSamples,
  }));

  const payload = {
    v: 2,
    testType: state.testType,
    selectedRunId,
    settings: {
      audio: state.settings.audio,
      haptics: state.settings.haptics,
      autoDisarmOnComplete: state.settings.autoDisarmOnComplete,
      smoothing: state.settings.smoothing,
      vehicleWeightLb: state.settings.vehicleWeightLb,
    },
    calibration: state.calibration ? {
      timestamp: Number(state.calibration.timestamp) || Date.now(),
      gravity: compactVec(state.calibration.gravity),
      forward: compactVec(state.calibration.forward),
      lateral: compactVec(state.calibration.lateral),
      vertical: compactVec(state.calibration.vertical),
      orientation: state.calibration.orientation ?? null,
    } : null,
    history: runs,
  };
  return payload;
}

function syncStateToUrl() {
  const profiles = [
    { selectedSamples: 420, otherSamples: 48, maxRuns: 20 },
    { selectedSamples: 280, otherSamples: 28, maxRuns: 20 },
    { selectedSamples: 220, otherSamples: 18, maxRuns: 14 },
    { selectedSamples: 160, otherSamples: 12, maxRuns: 10 },
    { selectedSamples: 120, otherSamples: 8, maxRuns: 6 },
  ];

  let encoded = "";
  for (const profile of profiles) {
    const payload = buildUrlPayload(profile);
    const next = base64UrlEncodeString(JSON.stringify(payload));
    if (next.length <= URL_MAX_LENGTH) {
      encoded = next;
      break;
    }
    encoded = next;
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
  const forward = expandVec(payloadCalibration.forward);
  const lateral = expandVec(payloadCalibration.lateral);
  const vertical = expandVec(payloadCalibration.vertical);
  if (!gravity || !forward || !lateral || !vertical) {
    return;
  }
  state.calibration = {
    timestamp: Number(payloadCalibration.timestamp) || Date.now(),
    gravity,
    forward,
    lateral,
    vertical,
    orientation: payloadCalibration.orientation ?? null,
  };
}

function restoreV2State(payload) {
  if (payload.testType && ["0-60", "0-100", "0-60-0"].includes(payload.testType)) {
    state.testType = payload.testType;
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
  if (payload.testType && ["0-60", "0-100", "0-60-0"].includes(payload.testType)) {
    state.testType = payload.testType;
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

function restoreStateFromUrl() {
  const encoded = new URL(window.location.href).searchParams.get("s");
  if (!encoded) {
    return;
  }
  try {
    const payload = safeJsonParse(base64UrlDecodeString(encoded));
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
  el.calibrate.addEventListener("click", calibrateFromBuffer);
  el.recalibrate.addEventListener("click", clearCalibration);

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

function init() {
  loadSettings();
  loadCalibration();
  loadHistory();
  restoreStateFromUrl();

  state.testType = ["0-60", "0-100", "0-60-0"].includes(state.testType) ? state.testType : "0-60";
  el.testType.value = state.testType;
  applySettingsToUi();
  updateArmButton();
  bindEvents();

  if (state.calibration) {
    setStatus("Calibration restored. Arm sensors to start sampling.", "neutral");
  } else {
    setStatus("Sensors are disarmed. Arm to begin sampling.", "neutral");
  }

  renderHistory();
  renderSelectedRun();
  clearCharts();
  updateLiveUi();
  setRunSignal("DISARMED", "ready");
  scheduleUrlSync();
  registerServiceWorker();
}

init();
