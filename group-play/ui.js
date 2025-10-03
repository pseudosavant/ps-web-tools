// UI helpers for Group Play (channel rows, stats & meters)
// Extracted from legacy app.js and mesh.js to centralize presentation logic.

import { logDebug } from './utils.js';

let sharedAudioCtx = null;

function ensureAudioContext() {
  if (!sharedAudioCtx) {
    try { sharedAudioCtx = new AudioContext(); } catch (_) { /* ignore */ }
  }
  return sharedAudioCtx;
}

let audioOutputDevicesCache = null;
async function listAudioOutputs(){
  if(audioOutputDevicesCache) return audioOutputDevicesCache;
  try {
    const devs = await navigator.mediaDevices.enumerateDevices();
    audioOutputDevicesCache = devs.filter(d=>d.kind === 'audiooutput');
  } catch(_) { audioOutputDevicesCache = []; }
  return audioOutputDevicesCache;
}

export function createChannelUI(peerId, displayName) {
  const list = document.getElementById('channelsList');
  const remoteSec = document.getElementById('remoteAudioSec');
  if (remoteSec) {
    // Support both legacy inline style hiding and new `.hidden` class based hiding
    if (remoteSec.classList.contains('hidden')) {
      remoteSec.classList.remove('hidden');
    } else if (remoteSec.style.display === 'none') {
      remoteSec.style.display = 'block';
    }
  }
  let row = document.querySelector(`[data-channel="${peerId}"]`);
  if (row) return { row, audioEl: row.querySelector('audio') };

  row = document.createElement('div');
  row.className = 'channel';
  row.dataset.channel = peerId;

  const name = document.createElement('div');
  name.className = 'name';
  name.textContent = displayName || peerId;
  name.title = 'Click to edit your display name (only for self)';

  const muteBtn = document.createElement('button');
  muteBtn.className = 'icon';
  muteBtn.innerHTML = '<i class="fa-solid fa-volume-high"></i>';

  const vol = document.createElement('input');
  vol.type = 'range'; vol.min = '0'; vol.max = '1'; vol.step = '0.01'; vol.value = '1';

  const pan = document.createElement('input');
  pan.type='range'; pan.min='-1'; pan.max='1'; pan.step='0.01'; pan.value='0';
  pan.title='Pan (Left ↔ Right)'; pan.style.width='90px';

  const sinkSelect = document.createElement('select');
  sinkSelect.style.display='none'; // revealed once populated & supported
  sinkSelect.title='Output Device';

  const meter = document.createElement('div');
  meter.className = 'meter';
  const meterFill = document.createElement('span');
  meter.appendChild(meterFill);

  const quality = document.createElement('div');
  quality.className = 'quality q-bad';
  quality.title = 'Latency: n/a';
  for (let i = 0; i < 4; i++) { const b = document.createElement('div'); b.className = 'bar'; quality.appendChild(b); }

  const audioEl = document.createElement('audio');
  audioEl.autoplay = true; audioEl.playsInline = true; audioEl.hidden = true; // custom UI replaces native controls

  // Order: name, quality immediately after name, then controls & meters
  [name, quality, muteBtn, vol, pan, sinkSelect, meter, audioEl].forEach(el => row.appendChild(el));
  list && list.appendChild(row);

  // Mute button behaviour (gain-based when graph active)
  let muted = false;
  muteBtn.addEventListener('click', () => {
    muted = !muted;
    if (row._gainNode) {
      if (muted) {
        row._prevGain = row._gainNode.gain.value;
        row._gainNode.gain.value = 0;
      } else {
        row._gainNode.gain.value = row._prevGain != null ? row._prevGain : 1;
      }
    } else {
      audioEl.muted = muted; // fallback when no audio graph
    }
    muteBtn.classList.toggle('muted', muted);
    muteBtn.innerHTML = muted ? '<i class="fa-solid fa-volume-xmark"></i>' : '<i class="fa-solid fa-volume-high"></i>';
  });

  // Will be overridden to gain node if context available; fallback to element volume
  vol.addEventListener('input', () => {
    const v = parseFloat(vol.value);
    if(row._gainNode){ row._gainNode.gain.value = v; }
    else { audioEl.volume = v; }
  });
  pan.addEventListener('input', () => {
    if(row._panner){ try { row._panner.pan.value = parseFloat(pan.value); } catch(_){} }
  });

  // Populate output device selector if supported
  if (typeof audioEl.setSinkId === 'function') {
    listAudioOutputs().then(devs => {
      if(devs.length){
        sinkSelect.innerHTML = '';
        for(const d of devs){
          const opt = document.createElement('option');
          opt.value = d.deviceId; opt.textContent = d.label || 'Output';
          sinkSelect.appendChild(opt);
        }
        sinkSelect.style.display='inline-block';
        sinkSelect.addEventListener('change', async () => {
          try { await audioEl.setSinkId(sinkSelect.value); } catch(e){ logDebug('setSinkId failed', e.message); }
        });
      }
    });
  }

  // Simple RMS level meter using AnalyserNode
  const ctx = ensureAudioContext();
  if (ctx) {
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    const dataArr = new Uint8Array(analyser.frequencyBinCount);
    // Attempt to auto-resume AudioContext on first user gesture if suspended
    if (ctx.state === 'suspended') {
      const tryResume = () => { ctx.resume().catch(()=>{}); document.removeEventListener('click', tryResume); document.removeEventListener('keydown', tryResume); };
      document.addEventListener('click', tryResume);
      document.addEventListener('keydown', tryResume);
    }
    const updateMeter = () => {
      if (audioEl.readyState >= 2 && !audioEl.paused) {
        try {
          analyser.getByteTimeDomainData(dataArr);
          let sum = 0; for (let i = 0; i < dataArr.length; i++) { const v = (dataArr[i] - 128) / 128; sum += v * v; }
          const rms = Math.sqrt(sum / dataArr.length);
          meterFill.style.width = (Math.min(1, rms * 3) * 100).toFixed(1) + '%';
        } catch (_) { /* ignore */ }
      }
      requestAnimationFrame(updateMeter);
    };
    requestAnimationFrame(updateMeter);
    audioEl.addEventListener('play', () => {
      if (!row._srcNode) {
        try {
          const srcNode = ctx.createMediaElementSource(audioEl);
          const gainNode = ctx.createGain();
          const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
          gainNode.gain.value = parseFloat(vol.value);
          // chain: src -> gain -> (panner?) -> analyser -> destination
          if(panner){
            try { panner.pan.value = parseFloat(pan.value); } catch(_){}
            srcNode.connect(gainNode).connect(panner).connect(analyser).connect(ctx.destination);
          } else {
            srcNode.connect(gainNode).connect(analyser).connect(ctx.destination);
            pan.style.display='none'; // hide pan control if unsupported
          }
          row._srcNode = srcNode; row._gainNode = gainNode; row._panner = panner;
          // Do NOT mute or zero volume; MediaElementAudioSourceNode respects element volume/mute
          // Keeping element hidden but audible so graph receives audio.
        } catch (e) { /* already connected */ }
      }
    });
  } else {
    logDebug('AudioContext unavailable; meter disabled');
  }

  return { row, audioEl };
}

export function attachStatsMonitor(peerId, pc, row) {
  if (!pc || row._statsAttached) return; row._statsAttached = true;
  const qualityEl = row.querySelector('.quality');
  const bars = qualityEl ? Array.from(qualityEl.querySelectorAll('.bar')) : [];
  let lastRtt = null, lastJitter = null;
  async function poll() {
    if (pc.connectionState === 'closed') return;
    try {
      const stats = await pc.getStats();
      let rttMs = null, jitterMs = null, packetsLost = null, packetsRecv = null;
      stats.forEach(r => {
        if (r.type === 'remote-inbound-rtp' && r.kind === 'audio') {
          if (typeof r.roundTripTime === 'number') rttMs = r.roundTripTime * 1000;
          if (typeof r.jitter === 'number') jitterMs = r.jitter * 1000;
          packetsLost = r.packetsLost;
        }
        if (r.type === 'inbound-rtp' && r.kind === 'audio') {
          if (typeof r.jitter === 'number' && jitterMs == null) jitterMs = r.jitter * 1000;
          if (typeof r.packetsReceived === 'number') packetsRecv = r.packetsReceived;
        }
      });
      if (rttMs == null) rttMs = lastRtt; else lastRtt = rttMs;
      if (jitterMs == null) jitterMs = lastJitter; else lastJitter = jitterMs;
      let cls = 'q-bad'; let active = 1;
      if (rttMs != null) {
        if (rttMs < 70 && (jitterMs == null || jitterMs < 15)) { cls = 'q-good'; active = 4; }
        else if (rttMs < 140 && (jitterMs == null || jitterMs < 30)) { cls = 'q-ok'; active = 3; }
      }
      if (qualityEl) {
        qualityEl.classList.remove('q-good', 'q-ok', 'q-bad');
        qualityEl.classList.add(cls);
        bars.forEach((b, i) => b.classList.toggle('active', i < active));
        const parts = [];
        if (rttMs != null) parts.push(`RTT: ${rttMs.toFixed(1)}ms`);
        if (jitterMs != null) parts.push(`Jitter: ${jitterMs.toFixed(1)}ms`);
        if (packetsLost != null && packetsRecv != null) {
          const plr = packetsRecv + packetsLost > 0 ? (packetsLost / (packetsRecv + packetsLost)) * 100 : 0;
          parts.push(`Loss: ${plr.toFixed(2)}%`);
        }
        qualityEl.title = parts.length ? parts.join(' | ') : 'Latency: n/a';
      }
    } catch (_) { /* ignore stats errors */ }
    setTimeout(poll, 1500);
  }
  poll();
}
