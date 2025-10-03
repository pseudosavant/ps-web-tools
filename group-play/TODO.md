# TODO / Roadmap

---
## Remaining

Backend:
- [ ] Simple logging (session create / offer / answer / cleanup). (Not yet added.)

Client (PWA shell):
- [ ] Volume slider per peer.
- [x] Mute toggle per peer.
- [ ] Pan control.
- [x] Output device selection.
- [ ] Working VU meter
- [ ] Reset audio settings action

## Milestone: Multiple Local Input Sources

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


## Tooling / Dev Notes

- Run backend: `uv run signaling_server.py`.
- Serve PWA locally (e.g., simple static server) or open via file:// (service worker needs proper origin; use localhost).
- Consider a tiny Python static server or separate `npm serve` if needed.
