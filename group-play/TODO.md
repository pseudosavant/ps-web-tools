# TODO / Roadmap

Incremental milestone-based plan to deliver the low-latency WebRTC audio jam PWA plus minimal Python (Astral `uv`) signaling backend.

---
## Milestone 1: Two Clients Connect (1:1, Non-Trickle)

Goal: Prove end-to-end audio between two browsers using session code + minimal REST signaling.

Backend:

- [x] Create `signaling_server.py` (PEP 723 header) with FastAPI.
- [x] Endpoint: `POST /session` (generate 6–8 char code, store empty session).
- [x] Endpoint: `POST /session/{code}/offer` & `GET /session/{code}/offer`.
- [x] Endpoint: `POST /session/{code}/answer` & `GET /session/{code}/answer`.
- [x] Endpoint: `GET /health`.
- [x] TTL cleanup loop (30 min default) – periodic background task every 60s removes expired sessions.
- [x] CORS enable for local dev origin.
- [ ] Simple logging (session create / offer / answer / cleanup). (Not yet added.)

Client (PWA shell):

- [x] `index.html` skeleton with create/join UI, code display/input fields.
- [x] Modularized client (`main.js` + modules) handles device enumeration & capture.
- [x] Create RTCPeerConnection with STUN.
- [x] Offer/answer flow (non-trickle baseline; trickle ICE support added later).
- [x] SDP munging (ptime/maxptime + Opus fmtp via `tweakOpus`).
- [x] Remote audio playback (now per-peer channel rows, improved over single element).
- [x] Basic status indicators (#status pills).
- [x] Service worker + manifest present.

Validation:

- [ ] Manual test: two tabs create/join documented. (Manual testing done ad-hoc; needs formal note.)
- [ ] Log measured time from create -> connected. (Instrumentation not added.)

Exit Criteria:

- [x] Two peers can hear each other with single local input each.


---
 
## Milestone 2: Three Clients (Star Topology via Host)

Goal: Introduce a third participant; host maintains separate peer connections.

Backend:

- [x] Extend session model: add `participants[]`.
- [x] Endpoint: `POST /session/{code}/join` -> returns participant ID.
- [x] Track per-participant offers/answers (implemented & later extended with pairwise full-mesh endpoints).
- [x] Data model supports concurrent negotiations (pair offers/answers + candidates).

Client:

- [x] Create RTCPeerConnection per discovered participant (symmetrical full mesh, id-based offerer logic).
- [x] Per-peer remote audio UI (channel rows with meters & quality bars).

Validation:

- [X] Three tabs connected, all hear each other (full mesh via host relays? Actually star: peers hear each other through separate peer connections with host's mixed output or each sends directly to host only). For now: each peer hears host and host hears each peer (not yet peer-to-peer between non-host peers).

Exit Criteria:

- [x] Stable multi-participant connectivity (full mesh surpasses star requirement).


---
 
## Milestone 3: Outbound Audio Control (My Stream Settings)

Goal: Allow each user to control what and how they send.

Features:

- [x] UI to select input device (enumeration + auto-restore last device).
- [x] Mono/stereo toggle (SDP renegotiation; no downmix graph yet).
- [x] Bitrate selector (range + setParameters).
- [x] Live re-negotiation on stereo/FEC/DTX changes.
- [x] Force mono via Web Audio downmix (implemented: AudioContext graph with channel splitter/merger & sender.replaceTrack).

Validation:

- [x] Changing bitrate reflects in `getParameters()` (verified via outbound bitrate sampler logic).

Exit Criteria:

- [x] Users can adjust channel count (stereo toggle) & bitrate mid-session.


---
 
## Milestone 4: Inbound Audio Control (Mixer Basics)

Goal: Per-peer volume, mute, pan, and output sink selection.

Features:

- [x] Volume slider per peer.
- [x] Mute toggle per peer.
- [x] Pan control.
- [x] Output device selection.
- [x] Basic VU meter

Validation:

- [ ] Adjusting sliders changes perceived loudness.
- [ ] Pan audible with headphones.
- [ ] Selecting alternate output device routes audio (where supported).

Exit Criteria:

- [ ] Functional mini-mixer (partial: volume/mute/meter only).


---
 
## Milestone 5: Connection & Latency Metadata

Goal: Surface real-time metrics to aid performance tuning.

Features:

- [x] Periodic `getStats()` polling per connection.
- [x] Display RTT, jitter, loss (tooltip + quality bars). (Per-connection bitrate not shown; global outbound displayed separately.)
- [x] Visual indicator (quality bars with color coding).

Validation:

- [x] Metrics visible & updating (RTT/jitter/loss bars & tooltip).
- [ ] Network throttling scenario documented (pending manual test capture).

Exit Criteria:

- [ ] Real-time metrics & latency indicator (partial: RTT/jitter shown; one-way latency not exposed).


---
 
## Milestone 6: Scale to 8 Clients (Star Topology)

Goal: Support up to 8 concurrent participants with manageable CPU/network load.

Backend:

- [ ] Enforce max participants (reject 9th join attempt).
- [ ] Provide list of active participant IDs to newcomers.
- [ ] (Optional) Simplify renegotiation by informing peers of departures.

Client:

- [ ] Dynamic layout/grid for up to 8 channels.
- [ ] Efficient resource handling: detach and stop tracks on disconnect.
- [ ] Option to locally mute (stop sending) without closing connection.
- [ ] Evaluate CPU: degrade (force mono / lower bitrate) automatically if load high (stretch goal).

Validation:

- [ ] Simulated 8 tab session connects (may require multiple machines or throttled if laptop limited).
- [ ] No unbounded memory growth.

Exit Criteria:

- Stable function with 8 participants in star layout.


---
 
## Milestone 7: Multiple Local Input Sources

Goal: Let a user send more than one local audio input (e.g., mic + instrument interface) as separate channels.

Features:

- [ ] UI to add additional input device (list of unused devices).
- [ ] Create separate MediaStreamTracks per device; add to each RTCPeerConnection.
- [ ] Control per-local-track: enable/disable, gain.
- [ ] Indicate to remote peers when new track added (handled automatically by track events; may need renegotiation trigger).

Backend:

- [ ] No change (WebRTC handles extra tracks after renegotiation).

Validation:

- [ ] Remote side sees additional tracks and they appear as separate mixer channels (or grouped if desired).
- [ ] Removing a track stops its transmission.

Exit Criteria:

- Multiple local devices streaming concurrently.

---

## Milestone 8: Connectivity Diagnostics & STUN Resilience (Planned)

Goal: Improve visibility into connection health and increase success probability (still TURN-free) while providing tooling to debug failed ICE handshakes.

Features / Tasks:

- Multi-STUN server list:
  - [x] Ordered array of STUN URIs configured (`ICE_SERVERS`).
  - [ ] Randomization / shuffle.
  - [ ] Per-server latency measurement.
- Candidate diagnostics panel:
  - [ ] Dedicated panel listing candidate pairs.
  - [x] Color badge (local candidate type) per peer.
  - [ ] Export JSON for candidate transitions.
- Relay guard:
  - [x] Console warning on relay candidate detection.
- ICE restart controls:
  - [ ] Manual ICE restart.
  - [ ] Automatic stalled-connection detector.
- Enhanced stats sampling:
  - [ ] Central sampler / event bus.
  - [ ] Rolling window mini sparklines.
- Logging improvements:
  - [ ] Structured event log.
  - [ ] Download log button.
- UX polish:
  - [ ] Stuck connection explanatory tooltips.

Validation:

- Multiple STUN servers configured and at least two produce srflx candidates (verify in diagnostics panel).
- Diagnostics panel reflects selected candidate pair within <1s after `connected`.
- Manual ICE restart recovers an induced network stall.
- No relay candidates observed.

Exit Criteria:

- Developers can inspect candidate path types, export logs, and recover from transient issues without TURN.

---
 
## UI / UX Polish Backlog (Original High-Level Items Status)

- [x] Per-peer candidate type badge
- [x] Actual outbound bitrate display
- [x] Inline display name edit & persistence
- [x] Persist last chosen input device & auto-restore
- [x] Invite link generator with prefilled `?code=` join (basic copy button implemented)
- [ ] Session lobby (pre-join meter & name/device selection) (basic version implemented; further polish pending)
- [x] Leave Session button (graceful teardown & UI reset)
  [x] Rework Session, Lobby, and Audio Input into just Lobby (unified lobby section implemented)
- [ ] Accessibility: aria-labels for icon buttons, improved focus styles
- [ ] Reset audio settings action
- [ ] Bitrate tooltip: projected payload size / sec

## UI Layout / Refinement Plan (Detailed Spec)

This section records the requested UI changes plus related cohesive enhancements.

### Requested Changes (User Priority)

1. Move Remote Audio section to appear immediately after the Session section.
2. Fix alignment in the Session section (buttons + text currently misaligned / cluttered).
3. Relocate & collapse Audio Encoding options inside the Audio Input block (after device selector) – collapsed by default.
4. Move Connection controls into the Session section as a collapsed (default) advanced subsection.
5. Remove Debug section (console logging only going forward).
6. Allow an armed input to be Disarmed (toggle state instead of one-way arm).
7. Add icons & color treatments making the armed state visually obvious.

### Detailed Specifications

#### 1. Section Reordering

- Final DOM order (top → down): Session → Remote Audio (Peers) → Audio Input (with encoding) → (future) Mixer / Diagnostics.
- Remote Audio placeholder text when empty: "No remote peers yet" (muted style).
- Auto-expands if a collapsible pattern is used once first peer arrives.

#### 2. Session Layout & Alignment Cleanup

- Grid/Flex two-column layout: (Create controls + code) | (Join controls).
- Session code display: pill/button with copy icon (single element) rather than raw text w/ extra spacing.
- Consistent 8px spacing scale; remove stray <br> usage.
- Proper labels for inputs; baseline alignment across differing button heights.
- Responsive: collapses to vertical stack under ~480px width without overlap.

#### 3. Collapsed Audio Encoding Options

- Wrap existing bitrate / mono-stereo (and future FEC/DTX) into `<details id="encodingOptions">`.
- `<summary>`: "Encoding & Opus Options".
- Closed summary shows dynamic inline summary string: e.g., `64 kbps • Mono • FEC Off`.
- Update summary instantly (<500ms) after any setting change.
- Prevent large layout jumps: reserve minimal vertical space or animate height.

#### 4. Connection Controls Integration

- Move standalone connection/offer-answer diagnostic UI under `<details id="advancedConnection">` inside Session.
- Summary label: "Advanced Signaling" (or similar, TBD).
- Default collapsed; no metrics or raw SDP blocks in default view.

#### 5. Debug Section Removal

- Remove debug panel markup entirely.
- Optional developer activation (future): URL hash `#debug` or localStorage flag reinstates minimal diagnostics.
- All former debug outputs migrate to `console.debug/info` with `[gp]` prefix.

#### 6. Arm ↔ Disarm Toggle

- Replace "Arm & Share" with stateful button:
  - Disarmed: primary style, label: "Arm & Share" + mic icon.
  - Armed: success/outline style, label: "Disarm" + mic-off icon.
- Disarming:
  - Stops and removes local outgoing track(s) from all peer connections.
  - Clears localStream reference; disables encoding controls until rearmed.
  - Retains last chosen device id for fast re-arm.
- Ensure idempotency if user clicks rapidly (debounce / disable while transitioning).

#### 7. Armed State Visual Indicators

- Add badge: `<span class="armed-badge" role="status">ARMED</span>` near the toggle when active.
- Badge style: small caps, green/teal background, white text, subtle pulse (CSS animation every ~6s) for discoverability.
- Provide aria-live="polite" region announcing transitions: "Input armed" / "Input disarmed" (no duplicates).
- Color contrast ≥ 4.5:1; fallback solid fill if prefers-reduced-motion.

### Supporting Enhancements

- Inline SVG sprite for icons (mic, mic-off, copy, caret, settings) to remove external dependencies.
- CSS custom properties: `--gp-color-accent`, `--gp-color-success`, `--gp-color-danger`, `--gp-spacing-1` (4px), `--gp-radius-sm`.
- Channel row layout: flex with fixed min-width name column, consistent alignment for mute/volume/stats; avoid wrapping jitter.
- Name change highlight: brief background fade transition on update.
- Status area: replace verbose log with single-line rotating status or toast component; verbose events remain in console.

### Accessibility Requirements

- All interactive elements focus-visible; no outline suppression.
- `aria-pressed` for toggle buttons (mute, arm/disarm).
- `<details>` elements have descriptive `<summary>` text (avoid "More").
- Armed/disarmed announcements use one aria-live region to prevent multi-announcement.

### Acceptance Criteria (Aggregate)

- Lighthouse Accessibility score ≥ 90 post-refactor.
- Disarm action removes outbound sender (verified via `getSenders()` or stats) without leaving zombie tracks.
- No layout shift > 0.1 CLS when expanding encoding options.
- Remote Audio section appears immediately after Session in DOM order.

### Implementation Checklist

- [ ] Reorder DOM sections (Session → Remote Audio → Audio Input ...)
- [ ] Session layout refactor (grid/flex + code pill copy)
- [ ] Advanced signaling moved & collapsible
- [ ] Remove debug panel (console fallback)
- [ ] Wrap encoding options in `<details>` + dynamic summary
- [ ] Implement Arm/Disarm toggle logic
- [ ] Armed badge + aria-live announcements
- [ ] Inline SVG icon sprite & replace existing icons
- [ ] Channel row alignment + responsive adjustments
- [ ] Status/toast refactor
- [ ] CSS variable introduction
- [ ] Name change highlight effect

### Suggested Execution Order

1. Structural reorder & debug removal
2. Session alignment + advanced signaling collapse
3. Encoding collapse + summary logic
4. Arm/Disarm state machine & badge
5. Icons + CSS variables
6. Channel row & status refactor
7. Highlight & accessibility polish

### Risks / Mitigations

- Rapid arm/disarm flicker -> add temporary disabled state during teardown.
- Summary string desync -> central event emitter for encoding changes.
- Layout regressions in small viewports -> add test checklist at 320px / 768px / 1280px.

### Future (Optional / Deferred)

- Pre-join lobby (meter preview + name + device before entering session)
- Dark mode theme toggle
- Persisted user layout preferences (expanded/collapsed states in localStorage)

---
 
## Cross-Cutting Tasks (Ongoing)
 
- Session recording (mix-down or multi-track via MediaRecorder).
- Share link generator (prefill code via URL param).
- Persist lightweight identity in localStorage (display names).
- Opus advanced tuning UI (FEC, DTX, complexity, packet loss concealment hints).


---
 
## Definition of Done Per Milestone

- Functionality implemented & manually verified.
- Basic code comments and inline docs for complex sections.
- README updated (features & usage for that milestone).
- No obvious console errors in normal flow.


---
 
## Risks & Mitigations

- Symmetric NAT failures (no TURN): Provide user guidance & retry option.
- CPU load with many peers: Encourage mono + lower bitrate when >4 peers.
- Latency variance: Show metrics to set expectations.


---
 
## Tooling / Dev Notes

- Run backend: `uv run signaling_server.py`.
- Serve PWA locally (e.g., simple static server) or open via file:// (service worker needs proper origin; use localhost).
- Consider a tiny Python static server or separate `npm serve` if needed.

