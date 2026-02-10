# AccelLab – Progressive Web App Spec

## Implementation Status & Agent Handoff (Updated 2026-02-10)

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
- `[x]` Calibration with explicit post-tap capture
  - Tap settle delay: ~120ms
  - Capture window: ~1.5s
  - Movement rejection based on sample variance
- `[x]` Auto-detected runs
  - 0–60
  - 0–100
  - 0–60–0
- `[x]` Auto-disarm on run completion (toggleable)
- `[x]` Live speed/G readouts
  - Display speed uses short responsive window (last ~1s / 5 samples)
  - Internal speed integrates longitudinal acceleration with drift controls
- `[x]` Rolling 30s G charts
  - Fixed-node ring buffer implementation
  - Dynamic symmetric axis scaling around 0
- `[x]` Run detail charts (speed and accel)
  - Dynamic axis scaling (accel symmetric around 0)
- `[x]` Local run history (last 10–20, currently capped at 20)
- `[x]` URL-based state restore/share
  - Full v2 payload includes test type, selected run, settings, calibration, compact history
  - Backward-compat decode for legacy v1 payload
- `[x]` Offline PWA support
  - Local app shell assets cached
  - Versioned service worker cache and update checks
- `[x]` Optional cues
  - Speech on thresholds
  - Haptics (default OFF)
- `[x]` Optional wheel horsepower estimate

### Known Gaps / Upcoming Work

- `[ ]` GPS-assisted distance runs (quarter mile, long-run correction) (v2)
- `[ ]` Vehicle database lookup (v3)
- `[ ]` Enhanced horsepower modeling beyond simple acceleration-power estimate (v3)
- `[ ]` Export/share formats beyond URL state (v3)
- `[ ]` Cross-device real-world tuning pass
  - Start/stop thresholds and bias adaptation per phone model
  - Validation against trusted speed references
- `[ ]` Optional UX refinements
  - Explicit calibration countdown/progress UI treatment improvements
  - Optional “raw vs corrected speed” debug overlay for field tuning

### Operational Notes For Future Agents

- Calibration capture is active only after user taps calibrate (not from stale pre-tap buffer).
- If sensors are disarmed, calculations must remain paused.
- When changing runtime behavior, bump `CACHE_VERSION` in `sw.js` so mobile PWA clients pull updates.
- Keep URL payload backward compatible where possible (`v1` decode still supported).

## Overview

AccelLab is a **client-side-only Progressive Web App (PWA)** that measures vehicle acceleration, deceleration, and G-forces using mobile device sensors.  
It focuses on **0–60, 0–100, and 0–60–0 style tests**, with rich real-time visualization and zero backend dependencies.

Primary goals:
- Simple, mount-and-go experience
- Accurate short-burst acceleration metrics
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
  - Accelerometer (including gravity)
- `DeviceOrientationEvent`
  - Alpha, beta, gamma orientation
- `Performance.now()` for timing

### Optional / Future
- Geolocation API (high-accuracy mode) for long-distance runs (quarter mile)

---

## Calibration (Required)

### Purpose
Establish a **stable reference frame** for:
- Forward / backward acceleration
- Lateral G-forces
- Gravity compensation

### Flow
1. User mounts phone securely
2. App prompts: **“Vehicle stationary – press Calibrate”**
3. After tap, app waits briefly (~120ms) to avoid touch-induced motion
4. App captures stationary samples for ~1.5s
5. App samples:
   - Gravity vector
   - Orientation (pitch, roll, yaw)
6. Stores calibration transform
7. All subsequent sensor data is transformed into:
   - Longitudinal axis (forward/back)
   - Lateral axis (left/right)
   - Vertical axis (ignored after gravity removal)

### Notes
- Calibration required before any test
- Calibration persists in localStorage
- Re-calibration available at any time

---

## Core Measurements (v1)

### Automatically Detected Runs
No manual start/stop.

#### Start detection
- Vehicle at rest (near-zero velocity)
- Sustained forward acceleration above threshold

#### End detection
- Target speed reached (e.g. 60 mph)
- OR return to rest (for 0–60–0 tests)

### Supported Tests
- 0–60 mph
- 0–100 mph
- 0–60–0 mph
- Rolling acceleration (future toggle)

---

## Speed & Distance Estimation

### v1
- Speed inferred by integrating longitudinal acceleration
- Optimized for **short durations**
- Drift acceptable beyond ~10–15 seconds
- Displayed speed is intentionally responsive (short recent sample window)

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
- Acceleration vs time
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
- Threshold-based color changes:
  - Neutral → approaching
  - Highlight at target (e.g. 60 mph)
- Clear visual signal when test completes

### Audio
- Spoken cues (Web Speech API):
  - “60”
  - “100”
  - “Brake”
- Optional toggle

### Haptics (where supported)
- Subtle vibration at threshold hit

---

## Data Storage

### Local Storage
- Stores last **10–20 runs**
- Each run includes:
  - Timestamp
  - Test type
  - Time results
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
- 0–60 / 0–100 / 0–60–0
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
