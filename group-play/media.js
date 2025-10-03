// Media (device enumeration & capture)
import { state } from './state.js';
import { logDebug, logStatus } from './utils.js';

let downmixCtx = null;
let downmixSource = null;
let downmixDest = null;
let downmixTrack = null;
let originalStream = null;

function buildMonoDownmix(originalStream){
  try {
    if(!downmixCtx) downmixCtx = new AudioContext();
    const ctx = downmixCtx;
    const src = ctx.createMediaStreamSource(originalStream);
    const splitter = ctx.createChannelSplitter(2);
    const merger = ctx.createChannelMerger(1);
    // Average L & R manually into one channel via GainNodes
    const gainL = ctx.createGain();
    const gainR = ctx.createGain();
    gainL.gain.value = 0.5; gainR.gain.value = 0.5;
    src.connect(splitter);
    splitter.connect(gainL, 0);
    splitter.connect(gainR, 1);
    gainL.connect(merger, 0, 0);
    gainR.connect(merger, 0, 0);
    const dest = ctx.createMediaStreamDestination();
    merger.connect(dest);
    return { ctx, destStream: dest.stream, nodes: { src, splitter, merger, gainL, gainR, dest } };
  } catch(e){
    logDebug('Downmix build failed', e.message);
    return null;
  }
}

function applyForceMonoIfNeeded(){
  if(!state.encodingPrefs.forceMono){
    if(downmixTrack){
      // Remove downmix track from all connections
      for(const pc of [state.pc, ...state.fullMeshConnections.values()]){
        if(pc){
          pc.getSenders().forEach(s => { if(s.track === downmixTrack) { try { pc.removeTrack(s); } catch(_){} } });
        }
      }
      try { downmixTrack.stop(); } catch(_){ }
      downmixTrack = null; downmixSource = null; downmixDest = null; originalStream = null;
    }
    return;
  }
  if(!state.localStream) return;
  // If already applied and still valid, nothing to do
  if(downmixTrack && originalStream === state.localStream) return;
  // (Re)build graph
  const graph = buildMonoDownmix(state.localStream);
  if(!graph) return;
  originalStream = state.localStream;
  downmixDest = graph.nodes.dest;
  downmixTrack = graph.destStream.getAudioTracks()[0];
  try { downmixTrack.contentHint = 'music'; } catch(_){ }
  // Replace outgoing tracks in each connection
  for(const pc of [state.pc, ...state.fullMeshConnections.values()]){
    if(!pc) continue;
    const audioSenders = pc.getSenders().filter(s => s.track && s.track.kind==='audio');
    audioSenders.forEach(sender => {
      try { sender.replaceTrack(downmixTrack); } catch(_){ }
    });
  }
  logDebug('Applied mono downmix track');
}

export async function enumerateDevices() {
  const devices = await navigator.mediaDevices.enumerateDevices();
  const inputs = devices.filter(d => d.kind === 'audioinput');
  const select = document.getElementById('inputSelect');
  if (!select) return;
  select.innerHTML = '';
  for (const d of inputs) {
    const opt = document.createElement('option');
    opt.value = d.deviceId;
    opt.textContent = d.label || `Input ${select.length + 1}`;
    select.appendChild(opt);
  }
  // Restore last chosen device if still present
  try {
    const lastDev = localStorage.getItem('gp_last_input_device');
    if (lastDev && [...select.options].some(o=>o.value === lastDev)) {
      select.value = lastDev;
    }
  } catch(_){}
  // Arm button removed; automatic arming handled by session flows.
}

export async function armInput() {
  const select = document.getElementById('inputSelect');
  const deviceId = select ? select.value : undefined;
  const constraints = {
    audio: {
      deviceId: deviceId ? { exact: deviceId } : undefined,
      channelCount: 2,
      sampleRate: 48000,
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
      voiceIsolation: false,
      googEchoCancellation: false,
      googAutoGainControl: false,
      googNoiseSuppression: false,
      googHighpassFilter: false
    },
    video: false
  };
  if (state.localStream) state.localStream.getTracks().forEach(t => t.stop());
  state.localStream = await navigator.mediaDevices.getUserMedia(constraints);
  // Persist chosen device
  if(deviceId){ try { localStorage.setItem('gp_last_input_device', deviceId); } catch(_){} }
  state.localStream.getAudioTracks().forEach(t => { try { t.contentHint = 'music'; } catch(_){} });
  const armedStatus = document.getElementById('armedStatus');
  if (armedStatus) armedStatus.textContent = 'Input armed';
  // Enable stereo toggle once armed if present
  const stereoToggle = document.getElementById('stereoToggle');
  if (stereoToggle){ stereoToggle.disabled = false; stereoToggle.title=''; }
  logStatus('Local input armed', 'info');
  logDebug('Armed input with tracks', state.localStream.getAudioTracks().map(t=>t.label));
  // Apply mono downmix if preference enabled
  applyForceMonoIfNeeded();
}

export async function armInputAuto() {
  if (state.armingInProgress || state.localStream) return;
  state.armingInProgress = true; state.autoArmAttempted = true;
  try { await armInput(); } finally { state.armingInProgress = false; }
}

// Public function to toggle force mono behavior (invoked from main wiring)
export function updateForceMono(){
  applyForceMonoIfNeeded();
}
