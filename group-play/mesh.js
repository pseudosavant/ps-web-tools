// Full mesh connection management & trickle ICE
import { state } from './state.js';
import { logDebug, logError, fetchJSON, computeNextBackoff } from './utils.js';
import { tweakOpus } from './encoding.js';
import { armInputAuto } from './media.js';
import { createChannelUI, attachStatsMonitor } from './ui.js';

const API_BASE = localStorage.getItem('gp_api') || 'http://localhost:8000';

// Redundant STUN servers for resilience (no TURN). Order kept stable; browsers may probe in parallel.
const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
  { urls: 'stun:global.stun.twilio.com:3478' }
  // Intentionally no TURN (user preference: direct only)
];

// UI helpers now imported from ui.js

// Candidate posting/polling
async function postPairCandidate(fromId, toId, candidate, end=false){
  if(!state.feature.trickleICE || !state.sessionCode) return;
  try {
    await fetchJSON(`${API_BASE}/session/${state.sessionCode}/pair/candidate`, { method:'POST', body: JSON.stringify({
      from_id: fromId, to_id: toId,
      candidate: candidate ? candidate.candidate : null,
      sdpMid: candidate ? candidate.sdpMid : null,
      sdpMLineIndex: candidate ? candidate.sdpMLineIndex : null,
      end_of_candidates: end
    })});
  } catch(e){ if(Math.random()<0.05) logDebug('postPairCandidate error', e.message); }
}

async function pollRemoteCandidates(){
  if(!state.feature.trickleICE || !state.participantId || !state.sessionCode) return;
  for(const [peerId, conn] of state.fullMeshConnections.entries()){
    if(!conn.currentRemoteDescription) continue;
    try {
      const list = await fetchJSON(`${API_BASE}/session/${state.sessionCode}/pair/candidates/${peerId}/${state.participantId}`);
      conn._remoteCandApplied = conn._remoteCandApplied || 0;
      for(let i=conn._remoteCandApplied;i<list.length;i++){
        const c = list[i];
        if(c.end_of_candidates){ try { await conn.addIceCandidate(null);} catch(_){} }
        else if(c.candidate){ try { await conn.addIceCandidate({ candidate:c.candidate, sdpMid:c.sdpMid, sdpMLineIndex:c.sdpMLineIndex }); } catch(err){ if(!/InvalidStateError/i.test(err.name)) logDebug('addIceCandidate error', err.message); } }
      }
      conn._remoteCandApplied = list.length;
    } catch(_){}
  }
}

export function startCandidatePolling(){
  if(state.feature.trickleICE) setInterval(pollRemoteCandidates, 1200);
}

export async function renegotiateOffers(){
  if(!state.participantId) return;
  for(const [peerId, conn] of state.fullMeshConnections.entries()){
    if(state.participantId < peerId){
      try {
        const offer = await conn.createOffer(); offer.sdp = tweakOpus(offer.sdp); await conn.setLocalDescription(offer);
        if(!state.feature.trickleICE){ await waitForIceCompleteConnection(conn); }
        await fetchJSON(`${API_BASE}/session/${state.sessionCode}/pair/offer`, { method:'POST', body: JSON.stringify({ from_id: state.participantId, to_id: peerId, type:'offer', sdp: conn.localDescription.sdp, replace:true }) });
        conn._offerPosted = true; conn._awaitingRenegotiatedAnswer = true;
        state.backoff.answerFetchAttempts.delete(peerId); state.backoff.answerNextAllowed.delete(peerId);
      } catch(e){ logError('Renegotiation offer failed', e); }
    }
  }
}

async function waitForIceCompleteConnection(conn){
  if(conn.iceGatheringState === 'complete') return;
  await Promise.race([
    new Promise(resolve=>{ const fn=()=>{ if(conn.iceGatheringState==='complete'){ conn.removeEventListener('icegatheringstatechange', fn); resolve(); } }; conn.addEventListener('icegatheringstatechange', fn); }),
    new Promise(r=>setTimeout(r, state.iceTimeoutMs))
  ]);
}

export async function ensureFullMesh(){
  if(!state.fullMeshConnections || !state.participantId || !state.sessionCode) return;
  // Always fetch participant list so UI (names) stays fresh even if user hasn't armed audio yet
  let list = [];
  try {
    list = await fetchJSON(`${API_BASE}/session/${state.sessionCode}/participants`);
  } catch(err){ logError('participants fetch failed', err); return; }

  // Update / propagate display names safely
  list.forEach(p => {
    const current = state.remoteNames.get(p.id);
    const newName = p.display_name || p.id;
    if(!current){
      state.remoteNames.set(p.id, { name: newName });
    } else if(current.name !== newName){
      current.name = newName;
      const row = document.querySelector(`[data-channel="${p.id}"]`);
      if(row){
        const nameEl = row.querySelector('.name');
        if(nameEl){
          const badge = nameEl.querySelector('.cand-badge');
          nameEl.textContent = newName; // XSS safe
          if(badge) nameEl.appendChild(badge);
        }
      }
    }
  });

  if(list.length <= 1) return; // only self present

  // If we don't yet have local media, attempt auto-arm (once) then skip connection creation this cycle
  if(!state.localStream && !state.autoArmAttempted){ try { await armInputAuto(); } catch(_){} }
  if(!state.localStream) return; // cannot form offers yet, but names already updated
  try {
    for(const p of list){
      if(p.id === state.participantId) continue;
      const iAmOfferer = state.participantId < p.id;
      if(!state.fullMeshConnections.has(p.id)){
  const conn = new RTCPeerConnection({ iceServers: ICE_SERVERS });
  conn._gpPeerId = p.id;
        state.fullMeshConnections.set(p.id, conn);
        if(!state.backoff.peerDiscoveryTime.has(p.id)) state.backoff.peerDiscoveryTime.set(p.id, Date.now());
        state.localStream.getTracks().forEach(t => conn.addTrack(t, state.localStream));
        conn.ontrack = (ev) => {
          const { row, audioEl } = createChannelUI(p.id, state.remoteNames.get(p.id)?.name || p.id);
          audioEl.srcObject = ev.streams[0];
          attachStatsMonitor(p.id, conn, row);
        };
        conn.onicecandidate = (e) => {
          if(!state.feature.trickleICE){
            if(!e.candidate && iAmOfferer && !conn._offerPosted){
              const desc = conn.localDescription; if(!desc) return;
              fetchJSON(`${API_BASE}/session/${state.sessionCode}/pair/offer`, { method:'POST', body: JSON.stringify({ from_id: state.participantId, to_id: p.id, type:'offer', sdp: desc.sdp }) }).then(()=>{ conn._offerPosted = true; }).catch(err=>logError('Pair offer post failed', err));
            } else if(!e.candidate && !iAmOfferer && conn._answerPending && !conn._answerPosted){
              const desc = conn.localDescription; if(!desc) return;
              fetchJSON(`${API_BASE}/session/${state.sessionCode}/pair/answer`, { method:'POST', body: JSON.stringify({ from_id: state.participantId, to_id: p.id, type:'answer', sdp: desc.sdp }) }).then(()=>{ conn._answerPosted = true; }).catch(err=>logError('Pair answer post failed', err));
            }
            return;
          }
          if(e.candidate) postPairCandidate(state.participantId, p.id, e.candidate); else postPairCandidate(state.participantId, p.id, null, true);
        };
        conn.oniceconnectionstatechange = () => {
          if (conn.iceConnectionState === 'connected' || conn.iceConnectionState === 'completed') {
            annotateCandidateTypes(conn).catch(()=>{});
          }
        };
        if(iAmOfferer){
          const offer = await conn.createOffer(); offer.sdp = tweakOpus(offer.sdp); await conn.setLocalDescription(offer);
          if(state.feature.trickleICE){
            fetchJSON(`${API_BASE}/session/${state.sessionCode}/pair/offer`, { method:'POST', body: JSON.stringify({ from_id: state.participantId, to_id: p.id, type:'offer', sdp: conn.localDescription.sdp }) })
              .then(()=>{ conn._offerPosted = true; logDebug('Posted early offer (trickle) to', p.id); })
              .catch(err=>logError('Early offer post (trickle) failed', err));
          } else {
            setTimeout(()=>{ if(conn._offerPosted) return; const desc = conn.localDescription; if(!desc) return; fetchJSON(`${API_BASE}/session/${state.sessionCode}/pair/offer`, { method:'POST', body: JSON.stringify({ from_id: state.participantId, to_id: p.id, type:'offer', sdp: desc.sdp }) }).then(()=>{ conn._offerPosted = true; logDebug('Posted early (pre-complete ICE) offer to', p.id); }).catch(()=>{}); }, 1000);
          }
        }
      }
      if(!iAmOfferer){
        const conn = state.fullMeshConnections.get(p.id);
        if(conn){
          const firstSeen = state.backoff.peerDiscoveryTime.get(p.id) || Date.now();
            if(Date.now() - firstSeen < 1200) continue;
            const nextAllowed = state.backoff.meshOfferNextAllowed.get(p.id) || 0;
            if(Date.now() < nextAllowed) continue;
            try {
              const remoteOffer = await fetchJSON(`${API_BASE}/session/${state.sessionCode}/pair/offer/${p.id}/${state.participantId}`);
              if(remoteOffer._empty){
                const attempts = (state.backoff.meshOfferFetchAttempts.get(p.id)||0)+1;
                state.backoff.meshOfferFetchAttempts.set(p.id, attempts);
                const backoff = computeNextBackoff(attempts);
                state.backoff.meshOfferNextAllowed.set(p.id, Date.now()+backoff);
                continue;
              }
              if(conn._lastOfferSdp === remoteOffer.sdp && conn.currentRemoteDescription){
                const attempts = (state.backoff.meshOfferFetchAttempts.get(p.id)||0)+1;
                state.backoff.meshOfferFetchAttempts.set(p.id, attempts);
                const backoff = computeNextBackoff(attempts);
                state.backoff.meshOfferNextAllowed.set(p.id, Date.now()+backoff);
                continue;
              }
              await conn.setRemoteDescription(remoteOffer); conn._lastOfferSdp = remoteOffer.sdp;
              const answer = await conn.createAnswer(); answer.sdp = tweakOpus(answer.sdp); await conn.setLocalDescription(answer);
              state.backoff.meshOfferFetchAttempts.delete(p.id); state.backoff.meshOfferNextAllowed.delete(p.id);
              if(state.feature.trickleICE){
                fetchJSON(`${API_BASE}/session/${state.sessionCode}/pair/answer`, { method:'POST', body: JSON.stringify({ from_id: state.participantId, to_id: p.id, type:'answer', sdp: conn.localDescription.sdp }) })
                  .then(()=>{ conn._answerPosted = true; })
                  .catch(err=>logError('Early answer post (trickle) failed', err));
              } else {
                conn._answerPending = true; conn._answerPosted = false;
                setTimeout(()=>{ if(conn._answerPending && !conn._answerPosted){ const desc = conn.localDescription; if(!desc) return; fetchJSON(`${API_BASE}/session/${state.sessionCode}/pair/answer`, { method:'POST', body: JSON.stringify({ from_id: state.participantId, to_id: p.id, type:'answer', sdp: desc.sdp }) }).then(()=>{ conn._answerPosted = true; }).catch(()=>{}); } }, 1300);
              }
            } catch(err){
              if(/404/.test(err.message)){
                const attempts = (state.backoff.meshOfferFetchAttempts.get(p.id)||0)+1;
                state.backoff.meshOfferFetchAttempts.set(p.id, attempts);
                const backoff = computeNextBackoff(attempts);
                state.backoff.meshOfferNextAllowed.set(p.id, Date.now()+backoff);
              } else { logError('Fetch pair offer failed', err); }
            }
        }
      } else { // I am offerer: poll for answer
        const conn = state.fullMeshConnections.get(p.id);
        if(conn && conn._offerPosted && (conn.currentRemoteDescription == null || conn.signalingState === 'have-local-offer' || conn._awaitingRenegotiatedAnswer)){
          const firstSeen = state.backoff.peerDiscoveryTime.get(p.id) || Date.now();
          if(Date.now() - firstSeen < 1500) { /* grace period */ } else {
            const nextAllowedAns = state.backoff.answerNextAllowed.get(p.id) || 0;
            if(Date.now() >= nextAllowedAns){
              try {
                const remoteAnswer = await fetchJSON(`${API_BASE}/session/${state.sessionCode}/pair/answer/${p.id}/${state.participantId}`);
                if(remoteAnswer._empty){
                  const attempts = (state.backoff.answerFetchAttempts.get(p.id)||0)+1;
                  state.backoff.answerFetchAttempts.set(p.id, attempts);
                  const backoff = computeNextBackoff(attempts);
                  state.backoff.answerNextAllowed.set(p.id, Date.now()+backoff);
                } else {
                  await conn.setRemoteDescription(remoteAnswer);
                  conn._awaitingRenegotiatedAnswer = false;
                  state.backoff.answerFetchAttempts.delete(p.id); state.backoff.answerNextAllowed.delete(p.id);
                }
              } catch(err){
                if(/404/.test(err.message)){
                  const attempts = (state.backoff.answerFetchAttempts.get(p.id)||0)+1;
                  state.backoff.answerFetchAttempts.set(p.id, attempts);
                  const backoff = computeNextBackoff(attempts);
                  state.backoff.answerNextAllowed.set(p.id, Date.now()+backoff);
                } else { logError('Fetch pair answer failed', err); }
              }
            }
          }
        }
      }
    }
  } catch(err){ logError('ensureFullMesh error', err); }
}

export function startMeshInterval(){ setInterval(ensureFullMesh, 2500); }

async function annotateCandidateTypes(pc){
  try {
    const stats = await pc.getStats();
    let pair; let locals = {}; let remotes = {};
    stats.forEach(r => {
      if (r.type === 'candidate-pair' && r.state === 'succeeded' && r.nominated) pair = r;
      if (r.type === 'local-candidate') locals[r.id] = r; else if (r.type === 'remote-candidate') remotes[r.id] = r;
    });
    if (!pair) return;
    const local = locals[pair.localCandidateId];
    const remote = remotes[pair.remoteCandidateId];
    if (!local || !remote) return;
    const pid = pc._gpPeerId || 'peer';
    logDebug('Candidate pair selected', pid, local.candidateType, '→', remote.candidateType, local.protocol);
    // Add small badge to channel row
    const row = document.querySelector(`[data-channel="${pid}"]`);
    if (row && !row.querySelector('.cand-badge')) {
      const badge = document.createElement('span');
      badge.className = 'cand-badge';
      badge.style.fontSize = '0.55rem';
      badge.style.padding = '2px 4px';
      badge.style.borderRadius = '4px';
      badge.style.background = local.candidateType === 'host' ? '#2e7d32' : (local.candidateType === 'srflx' ? '#1565c0' : '#b71c1c');
      badge.style.opacity = '0.85';
      badge.style.letterSpacing = '.05em';
      badge.style.textTransform = 'uppercase';
      badge.style.marginLeft = '4px';
      badge.title = `Local: ${local.candidateType}\nRemote: ${remote.candidateType}\nProtocol: ${local.protocol}`;
      badge.textContent = local.candidateType;
      const nameEl = row.querySelector('.name');
      if (nameEl) nameEl.appendChild(badge);
      if (local.candidateType === 'relay' || remote.candidateType === 'relay') {
        console.warn('[GP] Relay candidate detected (unexpected).');
      }
    }
  } catch(_){ /* ignore */ }
}
