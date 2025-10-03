// Orchestrator module tying together refactored pieces
import { state } from './state.js';
import { logStatus, logError, generateDisplayName } from './utils.js';
import { createSession, joinSession, clearSessionState, setupInviteLink } from './signaling.js';
import { enumerateDevices } from './media.js';
import { ensureFullMesh, startMeshInterval, startCandidatePolling, renegotiateOffers } from './mesh.js';
import { applyEncodingPreferences, updateBitrate, updateOption } from './encoding.js';

// Temporary: keep legacy handlers in app.js until fully migrated

function bindEvents(){
  const createBtn = document.getElementById('createSessionBtn');
  const joinBtn = document.getElementById('joinBtn');
  const leaveBtn = document.getElementById('leaveSessionBtn');
  if (createBtn) createBtn.addEventListener('click', createSession);
  if (joinBtn) joinBtn.addEventListener('click', joinSession);
  if (leaveBtn) leaveBtn.addEventListener('click', () => { clearSessionState(); });
  const sessionCodeEl = document.getElementById('sessionCode');
  if (sessionCodeEl) sessionCodeEl.addEventListener('click', async () => {
    if (!state.sessionCode) return; try { await navigator.clipboard.writeText(state.sessionCode); logStatus('Code copied', 'info'); } catch(e){ logError('Clipboard write failed', e); }
  });
}

async function init(){
  // Initialize display name (persisted or generated)
  if(!state.myDisplayName){
    const saved = localStorage.getItem('gp_display_name');
    state.myDisplayName = saved || generateDisplayName();
    if(!saved) localStorage.setItem('gp_display_name', state.myDisplayName);
  }
  bindEvents();
  hydrateQueryParams();
  initializeUnifiedLobby();
  try { await navigator.mediaDevices.getUserMedia({ audio:true, video:false }); } catch(_) { logStatus('Microphone permission pending/denied', 'warn'); }
  await enumerateDevices();
  // Attempt auto-restore of last chosen device & auto-arm if permission granted
  try {
    const lastDev = localStorage.getItem('gp_last_input_device');
    const select = document.getElementById('inputSelect');
    if(lastDev && select && [...select.options].some(o=>o.value === lastDev)){
      select.value = lastDev;
      // If user previously armed (infer by presence of a saved device), auto-arm
      if(!state.localStream){
        // Import on demand to avoid circular import at top (or rely on existing named import)
        const { armInput } = await import('./media.js');
        await armInput();
      }
    }
  } catch(e){ /* ignore auto-restore failures */ }
  navigator.mediaDevices.addEventListener('devicechange', enumerateDevices);
  // No inline header editing: display name managed solely via #displayNameInput
  startMeshInterval();
  startCandidatePolling();
  // Initial encoding application (in case of restored prefs)
  applyEncodingPreferences([state.pc, ...state.fullMeshConnections.values()].filter(Boolean));
  // Wire encoding UI -> event-driven updates
  wireEncodingControls();
  startBitrateSampler();
  // Kick first mesh check early
  ensureFullMesh();
}

init().catch(err => logError('Init failed', err));

function wireEncodingControls(){
  const bitrateSlider = document.getElementById('bitrateSlider');
  const bitrateValue = document.getElementById('bitrateValue');
  const stereoToggle = document.getElementById('stereoToggle');
  const fecToggle = document.getElementById('fecToggle');
  const dtxToggle = document.getElementById('dtxToggle');
  const forceMonoToggle = document.getElementById('forceMonoToggle');
  const connections = () => [state.pc, ...state.fullMeshConnections.values()].filter(Boolean);

  if (bitrateSlider && !bitrateSlider._bound) {
    bitrateSlider._bound = true;
    bitrateSlider.value = state.encodingPrefs.bitrateKbps;
    if (bitrateValue) bitrateValue.textContent = state.encodingPrefs.bitrateKbps + ' kbps';
    bitrateSlider.addEventListener('input', () => {
      const kbps = parseInt(bitrateSlider.value, 10);
      if (bitrateValue) bitrateValue.textContent = kbps + ' kbps';
      updateBitrate(kbps, connections()); // setParameters path (no renegotiation)
    });
  }

  function toggleHandler(el, key){
    if (!el || el._bound) return;
    el._bound = true;
    el.checked = !!state.encodingPrefs[key];
    el.addEventListener('change', async () => {
      const prev = state.encodingPrefs[key];
      const next = !!el.checked;
      if (prev === next) return;
      updateOption(key, next);
      // Stereo change often requires new transceivers SDP -> renegotiate
      // FEC / DTX changes: attempt setParameters (covered by updateOption listeners indirectly via applyEncoding on new senders); still do renegotiation for compatibility.
      // Apply immediate setParameters for bitrate already handled above; here we just renegotiate for codec fmtp updates.
      try { await renegotiateOffers(); } catch (e) { logError('Renegotiation failed', e); }
    });
  }
  if (stereoToggle) {
    stereoToggle.disabled = !state.localStream; // disabled until armed
    if (!state.localStream) stereoToggle.title = 'Arm input first';
    toggleHandler(stereoToggle, 'stereo');
  }
  toggleHandler(fecToggle, 'fec');
  toggleHandler(dtxToggle, 'dtx');
  if(forceMonoToggle && !forceMonoToggle._bound){
    forceMonoToggle._bound = true;
    forceMonoToggle.checked = !!state.encodingPrefs.forceMono;
    forceMonoToggle.addEventListener('change', async () => {
      const prev = state.encodingPrefs.forceMono;
      const next = !!forceMonoToggle.checked;
      if(prev === next) return;
      updateOption('forceMono', next);
      // Dynamically swap outgoing track(s) via media graph without full renegotiation
      const { updateForceMono } = await import('./media.js');
      updateForceMono();
    });
  }
}

// Periodically sample outbound bitrate from first available connection sender
function startBitrateSampler(){
  const labelEl = document.getElementById('bitrateValue');
  if (!labelEl) return;
  let lastBytes = 0; let lastTs = 0;
  async function sample(){
    const conns = [state.pc, ...state.fullMeshConnections.values()].filter(Boolean);
    if (!conns.length){ setTimeout(sample, 2000); return; }
    const pc = conns[0];
    try {
      const stats = await pc.getStats();
      stats.forEach(r => {
        if (r.type === 'outbound-rtp' && r.kind === 'audio' && !r.isRemote){
          if (lastTs){
            const dt = (r.timestamp - lastTs) / 1000; // ms -> s
            const db = r.bytesSent - lastBytes;
            if (dt > 0 && db >= 0){
              const kbps = (db * 8 / 1000) / dt; // kilo bits per second
              const baseText = labelEl.textContent.replace(/\s*\(Actual.*$/,'');
              labelEl.textContent = `${baseText} (Actual ~ ${kbps.toFixed(1)} kbps)`;
            }
          }
          lastBytes = r.bytesSent; lastTs = r.timestamp;
        }
      });
    } catch(_){ /* ignore */ }
    setTimeout(sample, 2000);
  }
  sample();
}

// Inline edit function removed; name changes flow through #displayNameInput only

function hydrateQueryParams(){
  const url = new URL(window.location.href);
  const code = url.searchParams.get('code');
  if(code && /^[A-Z0-9]{6,12}$/i.test(code)){
    const joinInput = document.getElementById('joinCode');
    if(joinInput){ joinInput.value = code.toUpperCase(); }
  }
}

function initializeUnifiedLobby(){
  const nameInput = document.getElementById('displayNameInput');
  if(nameInput){
    nameInput.value = state.myDisplayName || '';
    // Input validation still updates display name on change; no arm button now.
    nameInput.addEventListener('change', async ()=>{
      let val = nameInput.value.trim();
      if(!val) { val = generateDisplayName(); nameInput.value = val; }
      val = val.replace(/[^A-Za-z0-9 _\-.]/g,'').replace(/\s+/g,' ').slice(0,24);
      state.myDisplayName = val;
      localStorage.setItem('gp_display_name', val);
      // Propagate to server if in session so others see updated name
      try {
        if(state.sessionCode && state.participantId){
          await fetch(`${localStorage.getItem('gp_api') || 'http://localhost:8000'}/session/${state.sessionCode}/participant/${state.participantId}/name`, {
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body: JSON.stringify({ display_name: val })
          });
        }
      } catch(e){ logError('Name update failed', e); }
    });
  }
  // Make leave button appear on active session
  const observer = new MutationObserver(()=>{
    if(state.sessionCode){
      const leaveBtn = document.getElementById('leaveSessionBtn'); if(leaveBtn) leaveBtn.style.display='inline-block';
      setupInviteLink();
    }
  });
  observer.observe(document.getElementById('lobby')||document.body, { childList:true, subtree:true });
}
