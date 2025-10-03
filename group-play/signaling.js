// Session creation / joining & legacy 1:1 offer-answer helpers
import { state } from './state.js';
import { logStatus, logError, logDebug, fetchJSON } from './utils.js';
import { armInputAuto, armInput } from './media.js';
import { tweakOpus } from './encoding.js';

const API_BASE = localStorage.getItem('gp_api') || 'http://localhost:8000';

export async function createSession() {
  const data = await fetchJSON(`${API_BASE}/session`, { method:'POST' });
  state.sessionCode = data.code;
  const codeEl = document.getElementById('sessionCode');
  const wrap = document.getElementById('sessionCodeWrap');
  if (codeEl) codeEl.textContent = state.sessionCode;
  if (wrap) wrap.style.display = 'block';
  setupInviteLink();
  toggleSessionUI(true);
  state.role = 'offerer';
  state.isHost = true;
  logStatus(`Session created (${state.sessionCode})`, 'info');
  logDebug('Created session', state.sessionCode);
  try { await navigator.clipboard.writeText(state.sessionCode); logStatus('Session code copied', 'info'); } catch(e){ logError('Failed to copy session code automatically', e); }
  // Auto-join host as participant for mesh
  try {
    if (!state.localStream) { try { await armInputAuto(); } catch(e){ logDebug('Auto-arm (host) failed', e.message); } }
    const joinResp = await fetchJSON(`${API_BASE}/session/${state.sessionCode}/join`, { method:'POST', body: JSON.stringify({ display_name: state.myDisplayName }) });
    state.participantId = joinResp.participant_id;
    if (joinResp.display_name) state.myDisplayName = joinResp.display_name;
    const dnInput = document.getElementById('displayNameInput'); if(dnInput) dnInput.value = state.myDisplayName;
    logStatus(`Host joined as participant ${state.participantId}`, 'info');
  } catch(err){ logError('Host self-join failed (mesh)', err); }
}

export async function joinSession() {
  const input = document.getElementById('joinCode');
  let code = input ? input.value.trim().toUpperCase() : '';
  if (!code) {
    try { const clip = await navigator.clipboard.readText(); const cand = clip.trim().toUpperCase(); if (/^[A-Z0-9]{6,8}$/.test(cand)) { code = cand; if (input) input.value = cand; logStatus('Used clipboard code', 'info'); } } catch(e){ logError('Clipboard read failed (join)', e);} }
  if (!code) { logStatus('No code provided', 'state-failed'); return; }
  state.sessionCode = code; state.role = 'answerer'; state.isHost = false;
  try {
    if (!state.localStream && !state.autoArmAttempted) { try { await armInputAuto(); } catch(e){ logDebug('Auto-arm (join) failed', e.message); } }
    const joinResp = await fetchJSON(`${API_BASE}/session/${state.sessionCode}/join`, { method:'POST', body: JSON.stringify({ display_name: state.myDisplayName }) });
    state.participantId = joinResp.participant_id;
    if (joinResp.display_name) state.myDisplayName = joinResp.display_name;
  const dnInput = document.getElementById('displayNameInput'); if(dnInput) dnInput.value = state.myDisplayName;
    logStatus(`Joined session as ${state.participantId}`, 'info');
    // Display session code + invite link for joiners too
    const codeEl = document.getElementById('sessionCode');
    const wrap = document.getElementById('sessionCodeWrap');
    if (codeEl) codeEl.textContent = state.sessionCode;
    if (wrap) wrap.style.display = 'block';
    setupInviteLink();
    toggleSessionUI(true);
  } catch(e){ logError('Join session (multi-peer) failed; fallback legacy potential', e); }
}

export function setupInviteLink(){
  const inviteWrap = document.getElementById('inviteWrap');
  const btn = document.getElementById('copyInviteBtn');
  if(!state.sessionCode || !btn || !inviteWrap) return;
  const url = new URL(window.location.href);
  url.searchParams.set('code', state.sessionCode);
  const link = url.toString();
  inviteWrap.style.display = 'block';
  if(btn._bound) return;
  btn._bound = true;
  btn.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(link); logStatus('Invite link copied', 'info'); const hint=document.getElementById('inviteHint'); if(hint){ hint.textContent='Copied!'; setTimeout(()=>hint.textContent='Share this link', 2500); } } catch(e){ logError('Copy invite failed', e); }
  });
}

export function clearSessionState(){
  // Close all peer connections
  try {
    for(const pc of state.fullMeshConnections.values()) { try { pc.close(); } catch(_){} }
    state.fullMeshConnections.clear();
    if(state.pc){ try { state.pc.close(); } catch(_){} state.pc = null; }
  } catch(_){}
  // Stop local media
  if(state.localStream){
    state.localStream.getTracks().forEach(t=>{ try { t.stop(); } catch(_){} });
    state.localStream = null;
  }
  // Basic flags
  state.sessionCode = null;
  state.participantId = null;
  state.isHost = false;
  state.role = null;
  // Remove UI channel rows
  document.querySelectorAll('[data-channel]').forEach(el=>el.remove());
  // Re-hide remote audio section for next session
  const remoteSec = document.getElementById('remoteAudioSec');
  if(remoteSec){
    // Prefer class-based hiding (CSS .hidden)
    remoteSec.classList.add('hidden');
    // Clear any inline style that might conflict later
    remoteSec.style.removeProperty('display');
  }
  // Hide session code + invite UI
  const wrap = document.getElementById('sessionCodeWrap'); if(wrap) wrap.style.display='none';
  const inviteWrap = document.getElementById('inviteWrap'); if(inviteWrap) inviteWrap.style.display='none';
  const codeEl = document.getElementById('sessionCode'); if(codeEl) codeEl.textContent='';
  toggleSessionUI(false);
  const statusTxt = document.getElementById('sessionStatusText'); if(statusTxt) statusTxt.textContent='Left session';
  // Reset join input (keep name)
  const joinInput = document.getElementById('joinCode'); if(joinInput) joinInput.value='';
  // Show lobby again for re-entry
  const lobby = document.getElementById('lobby'); if(lobby) lobby.style.display='block';
  const mainMixer = document.getElementById('mixer'); if(mainMixer) mainMixer.style.opacity='0.3';
}

function toggleSessionUI(inSession){
  const actions = document.getElementById('sessionActions');
  const leaveBtn = document.getElementById('leaveSessionBtn');
  if(actions){ actions.classList.toggle('hidden', !!inSession); }
  if(leaveBtn){ leaveBtn.classList.toggle('hidden', !inSession); }
}

// Legacy 1:1 offer/answer kept minimal here (the active app path has moved to mesh)
export async function waitForIceComplete(pc) {
  if (!pc) return; if (pc.iceGatheringState === 'complete') return;
  await Promise.race([
    new Promise(resolve => { function check(){ if (pc.iceGatheringState === 'complete'){ pc.removeEventListener('icegatheringstatechange', check); resolve(); } } pc.addEventListener('icegatheringstatechange', check); }),
    new Promise(resolve => setTimeout(resolve, state.iceTimeoutMs))
  ]);
}

export async function createAndSendOffer(pc) {
  let offer = await pc.createOffer();
  offer.sdp = tweakOpus(offer.sdp);
  await pc.setLocalDescription(offer);
  if (!state.feature.trickleICE) await waitForIceComplete(pc);
  const finalLocal = pc.localDescription;
  const API = `${API_BASE}/session/${state.sessionCode}/offer`;
  await fetchJSON(API, { method:'POST', body: JSON.stringify(finalLocal) });
  logStatus('Offer posted', 'info');
  return finalLocal;
}

export async function createAndSendAnswer(pc) {
  let answer = await pc.createAnswer();
  answer.sdp = tweakOpus(answer.sdp);
  await pc.setLocalDescription(answer);
  if (!state.feature.trickleICE) await waitForIceComplete(pc);
  const finalLocal = pc.localDescription;
  const API = `${API_BASE}/session/${state.sessionCode}/answer`;
  await fetchJSON(API, { method:'POST', body: JSON.stringify(finalLocal) });
  logStatus('Answer posted', 'info');
  return finalLocal;
}
