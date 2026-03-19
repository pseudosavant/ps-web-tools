# AccelLab – Progressive Web App Spec

## Implementation Status & Agent Handoff (Updated 2026-03-19)

This section is the quick handoff for future agents. Treat it as operational truth for the current repo.

### Current Repo State

- App is implemented as a static client-only PWA in:
  - `index.html`
  - `styles.css`
  - `app.js`
  - `sw.js`
  - `manifest.webmanifest`
- Git repo has been initialized in this folder and work is tracked locally.

### v1 Status Matrix

- `[x]` Sensor permission flow (iOS + Android browser paths)
- `[x]` Arm/Disarm capture model
  - Disarm stops sampling/calculation
  - Re-arm resets live capture state
- `[x]` Auto-calibration after arm while stationary
  - User arms while stopped
  - App waits for stillness before beginning calibration
  - Capture still includes ~120ms settle delay and ~1.5s stationary sample window
  - Calibration rejects excessive movement/noise
  - Calibration solves vertical/gravity only
  - Recoverable calibration failures back off briefly before auto-retrying
  - Unreliable calibration sample rates hard-stop and require re-arming
- `[x]` Auto-detected straight-line stop-to-stop runs
  - Forward axis is inferred from the first sustained launch impulse after calibration
  - Run is rejected if launch direction confidence is too low
  - Run is rejected if sustained lateral acceleration exceeds the straight-line threshold
- `[x]` Two run modes
  - `Acceleration`
  - `Acceleration + Braking`
- `[x]` Split reporting
  - Acceleration splits: `0-30`, `0-45`, `0-60`, `0-100`
  - Braking-mode splits: `60-0`, `100-0`, `0-60-0`, `0-100-0`
- `[x]` Auto-disarm on run completion (toggleable)
- `[x]` Live speed/G readouts
  - Display speed uses a short responsive weighted window (last ~1s)
  - Internal scoring speed integrates longitudinal acceleration with drift controls
  - Run timing uses interpolated threshold crossings from internal speed, not display speed
- `[x]` Rolling 30s G charts
  - Fixed-node ring buffer implementation
  - Dynamic symmetric axis scaling around 0
- `[x]` Run detail charts (speed and accel)
  - Dynamic axis scaling (accel symmetric around 0)
- `[x]` Local run history (last 10–20, currently capped at 20)
- `[x]` URL-based state restore/share
  - v2 payload includes test type, selected run, settings, and compact history
  - Encoder progressively reduces sample density/history and may omit calibration metadata to stay within URL length limits
  - URL payload prefers browser-native compressed encoding when supported, with fallback to plain URL-safe JSON encoding
  - Restore accepts both compressed and uncompressed URL payloads
  - If no profile fits, stale URL state is cleared instead of leaving an outdated share payload behind
  - Backward-compat decode for legacy v1 payload
- `[x]` Offline PWA support
  - Local app shell assets cached
  - Versioned service worker cache and update checks
- `[x]` Optional cues
  - Speech on thresholds
  - Haptics (default OFF)
- `[x]` Optional wheel horsepower estimate
- `[x]` Strict linear-acceleration requirement for run timing
  - No synthetic gravity-subtraction fallback when `event.acceleration` is unavailable

### Known Gaps / Upcoming Work

- `[ ]` GPS-assisted distance runs (quarter mile, long-run correction) (v2)
- `[ ]` Vehicle database lookup (v3)
- `[ ]` Enhanced horsepower modeling beyond simple acceleration-power estimate (v3)
- `[ ]` Export/share formats beyond URL state (v3)
- `[ ]` Cross-device real-world tuning pass
  - Start/stop thresholds and bias adaptation per phone model
  - Validation against trusted speed references
  - Confirm browser/device support for stable `DeviceMotionEvent.acceleration`
- `[ ]` Optional UX refinements
  - Explicit calibration countdown/progress UI treatment improvements
  - Optional “raw vs corrected speed” debug overlay for field tuning
  - More explicit low-confidence / lateral-reject diagnostics for failed runs

### Operational Notes For Future Agents

- Arm starts a stillness-qualified auto-calibration flow; the app should not show `READY` until calibration is complete and the vehicle is settled at a stop.
- Stationary calibration only solves gravity / vertical. Forward direction is inferred from the first clean launch after calibration.
- If calibration fails due to motion/noise, the app should wait briefly before retrying. If calibration sample rate is too low for a reliable capture, the app should hard-stop and require a fresh arm.
- If sensors are disarmed, calculations must remain paused.
- Run timing requires browser-provided linear acceleration (`DeviceMotionEvent.acceleration`). If unavailable, the app should warn and stop timing rather than estimate it from a drifting gravity model.
- Run scoring must use internal speed with interpolated crossings; display speed remains a short-window UI value only.
- The product assumption is strict: mounted phone, straight-line run, start from stop, finish at stop.
- The app should reject runs rather than salvage them when the launch direction is ambiguous or lateral acceleration indicates turning.
- When changing runtime behavior, bump `CACHE_VERSION` in `sw.js` so mobile PWA clients pull updates.
- Keep URL payload backward compatible where possible (`v1` decode still supported).

## Overview

AccelLab is a **client-side-only Progressive Web App (PWA)** that measures straight-line vehicle acceleration, braking, and G-forces using mobile device sensors.  
It focuses on **stop-to-stop acceleration testing** with automatic launch-direction inference, rich real-time visualization, and zero backend dependencies.

Primary goals:
- Simple arm-and-go experience
- Accurate short-burst acceleration and braking metrics
- Rich visual feedback and charts
- Shareable state via URL
- Fully offline-capable after install

---

## Platform & Constraints

- **Platform:** Web (PWA)
- **Target devices:** iOS Safari / Chrome, Android Chrome
- **No backend**
- **All state is client-side**
- **Offline-capable**
- **Mounted device required (not pocket use)**

---

## Sensor APIs Used

### Required (v1)
- `DeviceMotionEvent`
  - `acceleration` (linear acceleration, required for run timing)
  - `accelerationIncludingGravity` (used for calibration)
- `Performance.now()` for timing

### Optional / Best-Effort Metadata
- `DeviceOrientationEvent`
  - Alpha, beta, gamma orientation snapshot when the browser exposes it
  - Orientation permission/data must not block arming or run timing
  - Current runtime no longer depends on or persists orientation metadata for scoring/share state

### Optional / Future
- Geolocation API (high-accuracy mode) for long-distance runs (quarter mile)

---

## Calibration (Required)

### Purpose
Establish a **stable vertical reference frame** for:
- Gravity compensation
- Horizontal-plane extraction
- Later launch-direction inference

### Flow
1. User mounts phone securely
2. User arms while the vehicle is stopped
3. App waits until the phone/vehicle is still enough to begin calibration
4. App waits briefly (~120ms) before capture
5. App captures stationary samples for ~1.5s
6. App estimates and stores:
   - Gravity vector
   - Vertical unit vector
   - Optional orientation snapshot for reference/debug
7. After calibration, app waits for a settled stop state before showing `READY`
8. At launch, app infers the forward horizontal axis from the first sustained straight-line impulse
9. Subsequent sensor data is transformed into:
   - Longitudinal axis (signed acceleration/braking)
   - Lateral axis (used for straight-line rejection)
   - Vertical axis (not used for scoring once gravity is removed)

### Notes
- Calibration is required before any run
- Calibration persists in localStorage and may be included in URL payload when size allows
- Knowing only “down” is not enough to score a run, but it is enough to begin. The app resolves forward automatically from post-launch data instead of asking the user to specify phone yaw.

---

## Core Measurements (v1)

### Automatically Detected Runs
No manual start/stop during the run itself.

#### Start detection
- Vehicle is calibrated
- Vehicle is settled at a stop
- Horizontal launch exceeds threshold
- Forward direction can be inferred with sufficient confidence

#### End detection
- Run completes only when the vehicle returns to a stop
- Timeout protection still applies for overlong runs

### Supported Modes
- `Acceleration`
  - Reports `0-30`, `0-45`, `0-60`, `0-100` when reached
- `Acceleration + Braking`
  - Reports the same acceleration splits
  - Also reports `60-0`, `100-0`, `0-60-0`, `0-100-0` when reached
- Rolling acceleration remains future work

---

## Speed & Distance Estimation

### v1
- Speed inferred by integrating longitudinal acceleration
- Longitudinal axis is inferred from launch direction after stationary vertical calibration
- Optimized for **short stop-to-stop durations**
- Drift acceptable beyond ~10–15 seconds
- Displayed speed is intentionally responsive (short recent sample window)
- Run completion uses interpolated internal speed crossings rather than display speed thresholds
- Speed chart remains non-negative; acceleration/G remains signed

### v2+
- GPS layered for:
  - Distance-based tests (quarter mile)
  - Speed correction over long runs

---

## Visualization

### Real-Time Views

#### Rolling Charts (30-second window)
- **Longitudinal G**
  - Above zero: acceleration
  - Below zero: braking
- **Lateral G**
  - Above zero: left
  - Below zero: right

### Run Charts
- Speed vs time
  - Non-negative speed trace
- Acceleration vs time
  - Signed longitudinal G trace
- Sample resolution based on sensor frequency (smoothed)

### Implementation
- SVG-based charts
- Fixed node count
- Sliding window behavior via ring buffers
- Dynamic y-axis scaling so plots fill vertical space while keeping 0 centered

---

## UI Feedback & Cues

### Visual
- Large real-time speed readout
- Split summary chips for completed runs
- Clear run state signals:
  - Hold still
  - Calibrating
  - Ready
  - Running
  - Braking
  - Complete / Rejected / Timeout

### Audio
- Spoken cues (Web Speech API):
  - “60”
  - “100”
- Optional toggle

### Haptics (where supported)
- Subtle vibration at threshold hit

---

## Data Storage

### Local Storage
- Stores last **10–20 runs**
- Each run includes:
  - Timestamp
  - Mode
  - Split results
  - Peak speed
  - Sampled data (compressed)

### No cloud sync

---

## URL-Based State Sharing

### Requirements
- App state is **fully encoded in URL**
- No explicit “Share” required (but optional UI allowed)

### URL includes:
- Selected run
- Compact chart/run data (compressed / encoded)
- Test metadata
- Runtime settings
- Calibration payload

### Behavior
- URL updates automatically on:
  - New run
  - Run selection
  - Relevant settings/calibration changes
- Compression format is encoded into compressed URL payloads so shared URLs restore across browsers that support the same browser-native stream format
- Opening URL restores identical app state

---

## Horsepower Estimation (Optional Mode)

### Inputs
- Vehicle weight (user-provided)
- Measured acceleration curve

### Output
- Estimated wheel horsepower
- Clear disclaimer:
  - Approximation
  - Ignores drivetrain losses, wind, grade

### Rationale
- Weight is more stable than published horsepower
- Reflects real-world vehicle condition

---

## PWA Requirements

### Installable
- Manifest
- Icons
- Fullscreen support

### Offline Support
- Service worker
- Cache strategy:
  - App shell cached
  - Versioned assets
  - Aggressive update checks
- Avoid stale app issues

---

## Icons & UI Assets

- No external icon/font dependency is required for core operation.
- UI is currently local-asset only for stronger offline behavior.
- If icon packs/fonts are reintroduced later, prefer local-bundled assets over CDN for offline reliability.

---

## Safety & UX Notes

- App assumes:
  - Closed road or safe environment
  - User responsibility
- UI avoids requiring interaction during runs
- Large, readable UI elements

---

## Version Roadmap

### v1
- Calibration
- Auto-calibration after arm while stopped
- Automatic launch-axis inference
- Acceleration / Acceleration + Braking modes
- Split reporting: 0-30 / 0-45 / 0-60 / 0-100 / 60-0 / 100-0 / 0-60-0 / 0-100-0
- Charts
- Local history
- URL state
- Offline PWA

### v2
- GPS-assisted distance runs
- Quarter mile
- Improved drift correction

### v3
- Vehicle database lookup
- Enhanced horsepower modeling
- Export/share formats

---

## Non-Goals

- No accounts
- No backend
- No social network
- No real-time competition

---

## Guiding Principles

- Physics over marketing
- Transparency over false precision
- Simple UI, deep data
- Install once, works anywhere
