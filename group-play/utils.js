// Utility functions extracted from original app.js for refactor phase 1

export function logDebug(...args) {
  console.debug('[GP]', ...args);
}

export function logError(...args) {
  console.error('[GP]', ...args);
}

export function logStatus(msg, cls) {
  const statusEl = document.getElementById('status');
  if (!statusEl) return;
  const span = document.createElement('span');
  span.textContent = msg;
  if (cls) span.className = cls;
  statusEl.appendChild(span);
  statusEl.appendChild(document.createTextNode(' '));
  if (statusEl.childNodes.length > 40) {
    while (statusEl.childNodes.length > 40) {
      statusEl.removeChild(statusEl.firstChild);
    }
  }
}

export async function fetchJSON(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
  });
  if (res.status === 204) return { _empty: true };
  if (!res.ok) throw new Error(`${options.method || 'GET'} ${url} -> ${res.status}`);
  return res.json();
}

export function generateDisplayName() {
  const animals = ['Fox','Hawk','Wolf','Lynx','Bear','Otter','Crow','Finch','Kite','Mink'];
  const colors = ['Red','Blue','Green','Silver','Crimson','Golden','Indigo','Amber','Ivory','Teal'];
  const a = animals[Math.floor(Math.random()*animals.length)];
  const c = colors[Math.floor(Math.random()*colors.length)];
  return c + a + Math.floor(Math.random()*1000).toString().padStart(3,'0');
}

export function computeNextBackoff(attempt, base = 1500, cap = 12000) {
  const ms = base * Math.pow(1.8, attempt - 1);
  return Math.min(cap, Math.round(ms));
}
