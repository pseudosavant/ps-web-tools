// Encoding / Opus SDP munging & preference handling
import { state } from './state.js';
import { logDebug } from './utils.js';

const LS_KEY = 'gp_encoding_prefs';
const listeners = new Set();
export function onEncodingChange(cb){ listeners.add(cb); }
export function removeEncodingListener(cb){ listeners.delete(cb); }

// Load persisted prefs if present
try {
  const saved = localStorage.getItem(LS_KEY);
  if (saved) Object.assign(state.encodingPrefs, JSON.parse(saved));
} catch(_) {}

function persist() {
  try { localStorage.setItem(LS_KEY, JSON.stringify(state.encodingPrefs)); } catch(_){}
}

export function tweakOpus(sdp) {
  const prefs = state.encodingPrefs;
  sdp = sdp.replace(/a=ptime:\d+/g, 'a=ptime:10');
  if (!/a=ptime:10/.test(sdp)) sdp = sdp.replace(/(m=audio .*\r?\n)/, '$1a=ptime:10\r\n');
  sdp = sdp.replace(/a=maxptime:\d+/g, 'a=maxptime:10');
  if (!/a=maxptime:10/.test(sdp)) sdp = sdp.replace(/(m=audio .*\r?\n)/, '$1a=maxptime:10\r\n');
  sdp = sdp.replace(/a=fmtp:(\d+) ([^\r\n]+)/, (line, pt, params) => {
    const map = {};
    params.split(';').map(p=>p.trim()).filter(Boolean).forEach(p => { const [k,v] = p.split('='); map[k] = v ?? ''; });
    if (!('maxplaybackrate' in map)) map.maxplaybackrate = '48000';
    if (!('minptime' in map)) map.minptime = '10';
    map.stereo = prefs.stereo ? '1' : '0';
    map.maxaveragebitrate = String(prefs.bitrateKbps * 1000);
    map.useinbandfec = prefs.fec ? '1' : '0';
    map.usedtx = prefs.dtx ? '1' : '0';
    map.minptime = '10';
    const rebuilt = Object.entries(map).map(([k,v]) => v ? `${k}=${v}` : k).join(';');
    return `a=fmtp:${pt} ${rebuilt}`;
  });
  return sdp;
}

export function applyEncodingPreferences(connections) {
  const prefs = state.encodingPrefs;
  connections.filter(Boolean).forEach(conn => {
    conn.getSenders().forEach(sender => {
      if (sender.track?.kind === 'audio') {
        const params = sender.getParameters();
        if (!params.encodings?.length) params.encodings = [{}];
        params.encodings[0].maxBitrate = prefs.bitrateKbps * 1000;
        sender.setParameters(params).catch(()=>{});
      }
    });
  });
  persist();
  listeners.forEach(cb => cb(prefs));
  logDebug('Applied encoding prefs', prefs);
}

export function updateBitrate(kbps, connections){
  state.encodingPrefs.bitrateKbps = kbps;
  applyEncodingPreferences(connections);
}

export function updateOption(key, value){
  state.encodingPrefs[key] = value;
  persist();
  listeners.forEach(cb => cb(state.encodingPrefs));
}

// Note: forceMono handled in media graph (see media.js) rather than SDP fmtp (Opus is still encoded mono when only one channel present).
