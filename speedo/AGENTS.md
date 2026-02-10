# Agent Instructions for `speedo`

## Purpose
This repo contains **AccelLab**, a client-only PWA for vehicle acceleration testing.  
Use this file as the authoritative agent handoff/instruction file for future work.

## First Read
1. Read `SPEC.md` first, especially:  
   `Implementation Status & Agent Handoff (Updated 2026-02-10)`.
2. Then inspect:
   - `app.js` (runtime logic)
   - `sw.js` (cache/update behavior)
   - `index.html` (UI controls)

## Current Behavior Constraints (Do Not Regress)
- Arm/disarm is explicit:
  - Disarm stops sensor sampling/calculation.
  - Re-arm resets live capture state for a fresh session.
- Calibration is post-tap capture:
  - ~120ms settle delay after tap.
  - ~1500ms capture window.
  - Reject if movement/noise exceeds threshold.
- Speed behavior:
  - Internal speed is integrated from longitudinal acceleration with drift controls.
  - Displayed speed is short-window responsive (recent samples), not long-window averaged.
- Auto-disarm on complete is toggleable and expected to work for all supported tests.
- URL state restore/share is expected to preserve app state (v2 payload) and keep v1 decode compatibility.

## Offline/PWA Rules
- Prefer local assets; do not introduce required CDN dependencies for core UX.
- If runtime assets change in a way that clients must refresh, bump:
  - `CACHE_VERSION` in `sw.js`.

## Editing Priorities
- Keep `SPEC.md` status section aligned with implementation when behavior changes.
- Preserve safety-oriented UX wording.
- Favor small, reversible edits and validate with:
  - `node --check app.js`
  - `node --check sw.js`

## Next Roadmap (High Level)
- v2: GPS-assisted distance runs and long-run correction.
- v3: vehicle database, enhanced horsepower model, export/share formats.
