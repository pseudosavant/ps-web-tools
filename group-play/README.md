# Group Play (Milestone 2/3 Prototype)

Progressed from a single-file Milestone 1 (1:1, non-trickle) into a modular full-mesh audio prototype with trickle ICE, adaptive backoff polling, runtime encoding controls, and event-driven renegotiation.

## Client Modules (ESM)

| Module | Responsibility |
|--------|----------------|
| `state.js` | Central mutable runtime state & feature flags |
| `utils.js` | Logging, status badges, fetch helper, backoff calculation |
| `encoding.js` | Opus SDP munging, persisted prefs (bitrate/stereo/FEC/DTX), setParameters application |
| `media.js` | Device enumeration & hardened audio capture (DSP disabled) |
| `signaling.js` | Session create/join (REST), legacy 1:1 helpers (mostly deprecated) |
| `mesh.js` | Full-mesh offer/answer orchestration, trickle ICE candidate posting & polling, renegotiation |
| `ui.js` | Peer channel UI rows, meters, quality classification & stats polling |
| `main.js` | Orchestrator: binds UI events, primes permissions, starts mesh & candidate intervals |

`app.js` has been removed; any prior imports should target the modules above.

## Running the Signaling Backend

Requires Astral `uv` (<https://docs.astral.sh/uv/>).

```bash
uv run group-play/signaling_server.py
```

Server starts on `http://0.0.0.0:8000`.

## Running / Serving

Serve the repo root (so `group-play/` paths resolve) with any static server:

```bash
python -m http.server -d . 8080
# or
npx serve .
```

Then open: `http://localhost:8080/group-play/`

### Current Full Mesh Flow

1. User A creates session (host automatically joins as participant). Code auto-copied.
2. Other users join with the code; each participant arms audio (auto prompt attempts first).
3. Mesh forms via lexical participant ID ordering (smaller ID is offerer) with trickle ICE.
4. UI rows appear per-peer with volume, mute, level meter, and latency/jitter classification.
5. Encoding changes (bitrate slider) apply immediately via `RTCRtpSender.setParameters`.
6. Stereo / FEC / DTX toggles trigger a targeted renegotiation (only offerers initiate).

## Features Implemented

- Multi-peer full mesh (pairwise connections) with adaptive polling & backoff.
- Trickle ICE (REST-based candidate exchange) with end-of-candidates markers.
- Runtime encoding controls: bitrate (setParameters), stereo, in-band FEC (enabled by default), DTX.
- Event-driven renegotiation (stereo/FEC/DTX changes) instead of periodic timers.
- Opus SDP munging: ptime/maxptime=10ms, bitrate, stereo, FEC, DTX, maxplaybackrate.
- Per-peer UI: mute, volume, RMS meter, quality classification (RTT & jitter thresholds) & packet loss tooltip.
- Persisted encoding preferences (localStorage).

## Limitations / Pending

- No TURN/STUN beyond a single public STUN server (no relay fallback yet).
- No server-side participant pruning or persistence (in-memory only).
- Reconnection / transient network recovery limited to polling cycle.
- No master mix / gain or recording pipeline yet.
- Security: no auth on signaling endpoints.

## Next Steps

- Add TURN integration for stricter NATs.
- Introduce master gain and optional recording/mix-down.
- Replace REST polling with WebSocket signaling (reduce latency & load).
- Fine-grained renegotiation triggers (only if fmtp delta necessitates new offer).
- Automatic device hot-swap without full renegotiation where possible.

## License

See root project license.
