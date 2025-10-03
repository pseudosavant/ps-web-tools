// Central shared state for Group Play refactor phase 1

export const state = {
  pc: null,
  localStream: null,
  armingInProgress: false,
  autoArmAttempted: false,
  role: null,
  sessionCode: null,
  participantId: null,
  isHost: false,
  myDisplayName: null, // will be initialized on load (persisted or generated)
  iceTimeoutMs: 7000,
  autoFlowEnabled: true,
  feature: { starLegacy: false, trickleICE: true },
  peerConnections: new Map(),          // legacy per-participant (star) connections
  fullMeshConnections: new Map(),      // mesh connections
  remoteNames: new Map(),
  encodingPrefs: { bitrateKbps: 64, stereo: false, fec: true, dtx: false, forceMono: false },
  backoff: {
    meshOfferFetchAttempts: new Map(),
    meshOfferNextAllowed: new Map(),
    answerFetchAttempts: new Map(),
    answerNextAllowed: new Map(),
    peerDiscoveryTime: new Map()
  },
  timers: {}
};
