# Project: Low-Latency WebRTC Audio Jam

## Overview
A simple PWA (vanilla JS, HTML, CSS) for peer-to-peer low-latency audio streaming between musicians within ~500 miles. Uses WebRTC with an open STUN server for initial handshake and direct audio media exchange.

## Features
1. **Audio Device Selection**  
   - List and select any available local audio input device.  
   - “Arm” the device to start sharing.

2. **Peer Discovery & Connection**  
   - Generate a unique session code (e.g., 6–8 alphanumeric chars).
   - Share code with peers; peers enter the code to connect.  
   - Use open STUN server(s) for ICE negotiation.  

3. **WebRTC Audio Streaming**  
   - Fully peer-to-peer, no central media server.  
   - Support mono or stereo streams (1 or 2 channels).  
   - DTLS-SRTP encryption (default WebRTC security).  

4. **Mixer UI**  
   - Display each peer’s audio stream as a channel.  
   - Per-channel volume slider (0–100%).  
   - Mute/unmute toggle for each channel.  

5. **Connection Management**  
   - Show connection status (connected, disconnected, connecting).  
   - Reconnect logic for transient network issues.

## Technical Constraints
- **Vanilla JS, HTML, CSS only.** No frameworks.  
- Progressive Web App: installable, service worker for offline shell.  
- Use at least one public STUN server (e.g., `stun:stun.l.google.com:19302`).  
- No TURN servers.

### Signaling Backend (New Requirement)

Because short session codes and automated negotiation are desired (without manual copy/paste of SDP), a **minimal signaling backend** is required. This backend:

#### Implementation & Runtime

- Language: Python, runnable with Astral `uv` using PEP 723 inline dependency metadata.
- Single file (e.g., `signaling_server.py`) or small module; start via `uv run signaling_server.py`.
- In-memory storage only; no external database.
- Designed for development / prototype use; *not hardened* for production scale.

#### Responsibilities

- Issue short session codes (6–8 alphanumeric / base32 or hex chars).
- Store and serve one offer and one answer SDP per session (1:1 initially; expand to multi-peer star topology later).
- (Milestone upgrade) Relay ICE candidates when Trickle ICE is enabled (WebSocket channel or REST endpoints).
- Provide simple health endpoint (`/health`).
- Enforce TTL-based expiration & cleanup of inactive sessions (default 10 minutes after last modification).
- Support CORS for the static PWA origin.

#### Initial REST Endpoints (Milestone 1–2)

- `POST /session` -> `{ code }`
- `POST /session/{code}/offer` -> body `{ type: 'offer', sdp: '...' }`
- `GET /session/{code}/offer`
- `POST /session/{code}/answer` -> body `{ type: 'answer', sdp: '...' }`
- `GET /session/{code}/answer`
- `GET /health` -> `{ status: 'ok' }`

#### Extended Endpoints / WebSocket (Later Milestones)

- `POST /session/{code}/candidate` (role-qualified) OR WebSocket messages `{type:'candidate', role, candidate}`
- WebSocket path `/ws?code=XXXX&role=offer|peer` to broadcast offer/answer/candidates.

#### Data Model (In-Memory)

```text
sessions = {
   CODE123: {
      created_at: 1730480000000,
      offer: { type: 'offer', sdp: '...' } | None,
      answer: { type: 'answer', sdp: '...' } | None,
      candidates: {
         offer: [ { candidate, sdpMid, sdpMLineIndex } ],
         answer: [ { candidate, sdpMid, sdpMLineIndex } ]
      }
   }
}
```

#### PEP 723 Script Header Example

```python
#!/usr/bin/env python
# /// script
# dependencies = ["fastapi", "uvicorn[standard]", "python-dotenv"]
# ///
```

#### Non-Goals

- Media relay (no TURN, no SFU).
- Long-term persistence.
- Authentication/authorization (beyond optional future session tokens).

#### Scalability Path (Concept)

- Milestone 1–2: 1:1 sessions only.
- Milestone 2–3: Star topology (host acts as hub; each new peer negotiates only with host); backend tracks participant IDs.
- Milestone 6: Support up to 8 connected peers; evaluate CPU load & renegotiation strategy.

#### Security Considerations

- SDP exchange reveals IP candidates; document this to users.
- Rate limiting (basic: per-IP session create cap/hour) recommended in later milestone.
- All media remains peer-to-peer (assuming no TURN fallback).

#### Latency Considerations

- Backend adds negligible latency; ensure quick response (<50 ms typical) to not delay negotiation.
- Optional: Introduce Trickle ICE via WebSocket to reduce time-to-first-audio.

#### Success Criteria

- Two browsers can connect and exchange audio by entering a short code (no manual SDP paste).
- Session automatically expires after TTL.
- Upgrading to Trickle ICE requires no architectural rewrite (just enabling WebSocket + candidate forwarding).


## Non-functional Requirements

- **Latency:** target <20 ms for peers within 500 miles.  
- **Audio Quality:** sample rate 48 kHz, bit depth 16-bit PCM.  
- **Browser Support:** latest Chrome, Firefox, Edge.  

## User Experience

- Minimalist UI with clear labels.  
- Responsive layout for desktop and tablet.  
- Visual feedback on audio levels (VU meter optional).

## Security & Privacy

- No user data stored on servers.  
- All media flows directly between peers.  

## Future Enhancements

- Latency Improvements
  - Packetization interval: set a=ptime:10 and a=maxptime:10 in your SDP to drop frame size to 10 ms. (Consider 5ms).
  - Opus low-delay mode: add minptime=10;maxplaybackrate=48000 (and optionally sprop-stereo=0) on your a=fmtp line.
  - Disable DTX: replace usedtx=1 with usedtx=0 to avoid jitter when voice restarts.
  - Disable in-band FEC: swap useinbandfec=1 for useinbandfec=0 to cut extra encode/decode work.
  - Allow users to choose to force mono for their audio: change stereo=1 to stereo=0 to halve data and processing.
  - Allow users to select their bitrate (32kbps to max)
  - Cap bitrate: via RTCRtpSender.setParameters({ encodings:[{ maxBitrate:64_000 }] }) to keep packets lean. Try 32kbps per channel.
- Session recording/download.
- Group-level master volume control.
- Durable/reusable IDs (so you don't have to put in your bandmates codes every time)
- Share functionality (to easily message your code/link to bandmates)

## Implementation Milestones (High-Level Reference)

See `TODO.md` for detailed, ordered task list spanning: 1) two-client connect, 2) three-client star topology, 3) outbound audio controls, 4) inbound audio controls (volume/pan/output sink), 5) latency & connection metrics, 6) scaling to 8 peers, 7) multiple local input sources.
