// Worth-the-Time Table (XKCD #1205 inspired)
// 100% client-side, vanilla JS, no dependencies.

(() => {
  'use strict';

  // ---- Constants ----
  const SEC = 1;
  const MIN = 60 * SEC;
  const HOUR = 60 * MIN;
  const DAY = 24 * HOUR;
  const WEEK = 7 * DAY;
  const MONTH = 30 * DAY;
  const YEAR = 365 * DAY;

  const CAP_SECONDS = 10 * YEAR; // >= 10 years gets capped in UI
  const MAX_ROW_SECONDS = 7 * DAY; // clamp custom row duration to <= 7 days

  const PRESET_COL_LABELS = ["50/day", "5/day", "daily", "weekly", "monthly", "yearly"];

  // Defaults (per spec)
  const DEFAULT_ROWS = [
    { label: '1 s', seconds: 1 },
    { label: '5 s', seconds: 5 },
    { label: '30 s', seconds: 30 },
    { label: '1 min', seconds: 60 },
    { label: '5 min', seconds: 300 },
    { label: '30 min', seconds: 1800 },
    { label: '1 h', seconds: 3600 },
    { label: '6 h', seconds: 21600 },
    { label: '1 d', seconds: 86400 },
  ];

  function columnsForMode(freqMode) {
    return [
      { label: '50/day', perYear: (freqMode === 'workdays' ? 250 : 365) * 50, source: { type: 'preset', presetLabel: '50/day' } },
      { label: '5/day', perYear: (freqMode === 'workdays' ? 250 : 365) * 5, source: { type: 'preset', presetLabel: '5/day' } },
      { label: 'daily', perYear: (freqMode === 'workdays' ? 250 : 365), source: { type: 'preset', presetLabel: 'daily' } },
      { label: 'weekly', perYear: (freqMode === 'workdays' ? 50 : 52), source: { type: 'preset', presetLabel: 'weekly' } },
      { label: 'monthly', perYear: 12, source: { type: 'preset', presetLabel: 'monthly' } },
      { label: 'yearly', perYear: 1, source: { type: 'preset', presetLabel: 'yearly' } },
    ];
  }

  // ---- State ----
  const state = {
    rows: structuredClone(DEFAULT_ROWS), // [{label, seconds}]
    cols: columnsForMode('workdays'), // [{label, perYear, source}]
    settings: {
      horizonYears: 5,
      freqMode: 'workdays', // 'calendar' | 'workdays'
      // rounding mode removed (always using rounded display; exact shown only in tooltip)
    },
  };

  // ---- Elements ----
  const el = {
    horizonYears: document.getElementById('horizonYears'),
    horizonSlider: document.getElementById('horizonSlider'),
  freqMode: () => document.querySelector('input[name="freqMode"]:checked'),
    addRowBtn: document.getElementById('addRowBtn'),
    addColBtn: document.getElementById('addColBtn'),
    copyLinkBtn: document.getElementById('copyLinkBtn'),
  // contrastBtn removed
    resetBtn: document.getElementById('resetBtn'),
    addRowForm: document.getElementById('addRowForm'),
    rowLabel: document.getElementById('rowLabel'),
    rowDuration: document.getElementById('rowDuration'),
    rowError: document.getElementById('rowError'),
    rowAddConfirm: document.getElementById('rowAddConfirm'),
    rowAddCancel: document.getElementById('rowAddCancel'),
    addColForm: document.getElementById('addColForm'),
    colLabel: document.getElementById('colLabel'),
    colN: document.getElementById('colN'),
    colUnit: document.getElementById('colUnit'),
    colError: document.getElementById('colError'),
    colAddConfirm: document.getElementById('colAddConfirm'),
    colAddCancel: document.getElementById('colAddCancel'),
    tableHead: document.getElementById('tableHead'),
    tableBody: document.getElementById('tableBody'),
    tooltip: document.getElementById('tooltip'),
  };

  // ---- Utilities ----
  function clamp(num, min, max) { return Math.min(Math.max(num, min), max); }

  function toBase64Url(str) {
    return btoa(unescape(encodeURIComponent(str)))
      .replaceAll('+', '-')
      .replaceAll('/', '_')
      .replace(/=+$/, '');
  }
  function fromBase64Url(b64url) {
    const pad = b64url.length % 4 === 0 ? '' : '='.repeat(4 - (b64url.length % 4));
    const b64 = b64url.replaceAll('-', '+').replaceAll('_', '/') + pad;
    return decodeURIComponent(escape(atob(b64)));
  }

  // Duration parser: accepts 90s, 1.5m, 2h, 1d (case-insensitive). Allows "wk" as 7d.
  function parseDuration(input) {
    if (!input) return null;
    const s = String(input).trim().toLowerCase();
    const m = s.match(/^([0-9]*\.?[0-9]+)\s*(s|sec|secs|m|min|mins|h|hr|hrs|d|day|days|w|wk|wks)?$/i);
    if (!m) return null;
    const val = parseFloat(m[1]);
    const unit = (m[2] || 's').toLowerCase();
    let seconds = val * SEC;
    if (['m','min','mins'].includes(unit)) seconds = val * MIN;
    else if (['h','hr','hrs'].includes(unit)) seconds = val * HOUR;
    else if (['d','day','days'].includes(unit)) seconds = val * DAY;
    else if (['w','wk','wks'].includes(unit)) seconds = val * WEEK;
    // clamp
    if (seconds <= 0) return null;
    if (seconds > MAX_ROW_SECONDS) seconds = MAX_ROW_SECONDS;
    return seconds;
  }

  // Cadence parser (custom column form): N per {day|week|month|year}
  function parseCadence(n, unit, freqMode) {
    const N = parseInt(String(n), 10);
    if (!Number.isFinite(N) || N <= 0) return null;
    switch (unit) {
      case 'day': return N * (freqMode === 'workdays' ? 250 : 365);
      case 'week': return N * (freqMode === 'workdays' ? 50 : 52);
      case 'month': return N * 12;
      case 'year': return N;
      default: return null;
    }
  }

  function runsPerYearFromPreset(label, freqMode) {
    const s = String(label).toLowerCase().trim();
    if (s.endsWith('/day')) {
      const n = parseFloat(s.split('/')[0]);
      if (Number.isFinite(n)) return n * (freqMode === 'workdays' ? 250 : 365);
    }
    if (s === 'daily') return (freqMode === 'workdays' ? 250 : 365);
    if (s === 'weekly') return (freqMode === 'workdays' ? 50 : 52);
    if (s === 'monthly') return 12;
    if (s === 'yearly') return 1;
    return null;
  }

  function computeMaxInvest(secondsSaved, runsPerYear, horizonYears) {
    return secondsSaved * runsPerYear * horizonYears;
  }

  function formatRounded(seconds) {
    if (seconds < 1) return { text: '< 1 s', primary: '< 1', unit: 's' };
    let step;
    if (seconds < MIN) step = 1 * SEC; // < 1 min → 1 s
    else if (seconds < 60 * MIN) step = 1 * MIN; // 1–60 min → 1 min
    else if (seconds < 4 * HOUR) step = 5 * MIN; // 1–4 h → 5 min
    else if (seconds < 24 * HOUR) step = 15 * MIN; // 4–24 h → 15 min
    else if (seconds < 14 * DAY) step = 1 * HOUR; // 1–14 d → 1 h
    else if (seconds < 8 * WEEK) step = 1 * DAY; // 2–8 wk → 1 d
    else if (seconds < 24 * MONTH) step = 1 * WEEK; // 2–24 mo → 1 wk
    else step = 1 * MONTH; // ≥ 2 yr → 1 mo
    const floored = Math.floor(seconds / step) * step;
    if (floored < 1) return { text: '< 1 s', primary: '< 1', unit: 's' };
    return formatLargestUnit(floored);
  }

  function formatLargestUnit(seconds) {
    if (seconds >= YEAR) return { text: `${Math.floor(seconds / YEAR)} yr`, primary: `${Math.floor(seconds / YEAR)}`, unit: 'yr' };
    if (seconds >= MONTH) return { text: `${Math.floor(seconds / MONTH)} mo`, primary: `${Math.floor(seconds / MONTH)}`, unit: 'mo' };
    if (seconds >= WEEK) return { text: `${Math.floor(seconds / WEEK)} wk`, primary: `${Math.floor(seconds / WEEK)}`, unit: 'wk' };
    if (seconds >= DAY) return { text: `${Math.floor(seconds / DAY)} d`, primary: `${Math.floor(seconds / DAY)}`, unit: 'd' };
    if (seconds >= HOUR) return { text: `${Math.floor(seconds / HOUR)} h`, primary: `${Math.floor(seconds / HOUR)}`, unit: 'h' };
    if (seconds >= MIN) return { text: `${Math.floor(seconds / MIN)} min`, primary: `${Math.floor(seconds / MIN)}`, unit: 'min' };
    return { text: `${Math.floor(seconds)} s`, primary: `${Math.floor(seconds)}`, unit: 's' };
  }

  function formatExact(seconds) {
    if (seconds < 1) return { text: '< 1 s', primary: '< 1', unit: 's' };
    const parts = [];
    const units = [
      ['yr', YEAR], ['mo', MONTH], ['wk', WEEK], ['d', DAY], ['h', HOUR], ['min', MIN], ['s', SEC],
    ];
    let rem = seconds;
    for (const [name, size] of units) {
      if (rem >= size) {
        const n = Math.floor(rem / size);
        parts.push([n, name]);
        rem -= n * size;
      }
      if (parts.length === 2) break;
    }
    // if we didn't fill two parts and nothing yet, show seconds
    if (!parts.length) parts.push([Math.max(1, Math.floor(seconds)), 's']);
    const text = parts.map(([n, u]) => `${n} ${u}`).join(' ');
    const [p, u] = parts[0];
    return { text, primary: String(p), unit: u };
  }

  // formatDuration removed; UI always uses rounded display; formatExact reserved for tooltips.

  function encodeStateToHash() {
    const simple = {
      h: state.settings.horizonYears,
      m: state.settings.freqMode,
      // r removed (rounding now implicit)
      y: state.rows.map(r => ({ label: r.label, seconds: r.seconds })),
      x: state.cols.map(c => ({ label: c.label, perYear: c.perYear })),
    };
    const json = JSON.stringify(simple);
    const b64u = toBase64Url(json);
    return `#${b64u}`;
  }

  function decodeStateFromHash(hash) {
    if (!hash || hash.length < 2) return null;
    try {
      const json = fromBase64Url(hash.replace(/^#/, ''));
      const data = JSON.parse(json);
      if (!data || typeof data !== 'object') return null;
      const settings = {
        horizonYears: typeof data.h === 'number' ? clamp(data.h, 0.1, 100) : 5,
        // Default to workdays if unspecified
        freqMode: data.m === 'calendar' ? 'calendar' : 'workdays',
        // rounding mode ignored if present in legacy links
      };
      const rows = Array.isArray(data.y) ? data.y.filter(v => Number.isFinite(v.seconds) && v.seconds > 0).map(v => ({ label: String(v.label || ''), seconds: clamp(v.seconds, 1e-6, MAX_ROW_SECONDS) })) : structuredClone(DEFAULT_ROWS);
      const cols = Array.isArray(data.x) ? data.x.filter(v => Number.isFinite(v.perYear) && v.perYear > 0).map(v => ({ label: String(v.label || ''), perYear: v.perYear, source: { type: 'state' } })) : columnsForMode(settings.freqMode);
      return { rows, cols, settings };
    } catch { return null; }
  }

  // ---- Rendering ----
  function renderAll() {
    // Sync settings from current controls to be robust even if events don't fire
    const fm = document.querySelector('input[name="freqMode"]:checked');
    if (fm && (fm.value === 'calendar' || fm.value === 'workdays')) {
      state.settings.freqMode = fm.value;
    }
    // roundingMode removed
    el.horizonYears.value = String(state.settings.horizonYears);
    el.horizonSlider.value = String(clamp(Math.round(state.settings.horizonYears), 1, 10));

    // Recompute preset columns (and custom day/week) when freqMode changes
    for (const col of state.cols) {
      if (col.source?.type === 'preset') {
        const newPerYear = runsPerYearFromPreset(col.source.presetLabel, state.settings.freqMode);
        if (newPerYear) col.perYear = newPerYear;
      } else if (col.source?.type === 'custom') {
        if (col.source.unit === 'day' || col.source.unit === 'week') {
          const rpY = parseCadence(col.source.n, col.source.unit, state.settings.freqMode);
          if (rpY) col.perYear = rpY;
        }
      }
    }
    // Sort rows (least→most seconds) and cols (most→least perYear)
    sortState();

    renderTable();
    updateHashSilently();
  }

  function sortState() {
    state.rows.sort((a, b) => a.seconds - b.seconds);
    state.cols.sort((a, b) => b.perYear - a.perYear);
  }

  function renderTable() {
    // Build a two-row header where the first row has:
    //  - left sticky cell labeling the Y axis (row headers)
    //  - a spanner cell over all X columns labeling the frequency
  const topRow = document.createElement('tr');
  const blankCorner = document.createElement('th');
  blankCorner.className = 'sticky-col no-top-sticky';
  blankCorner.scope = 'col';
  blankCorner.innerHTML = '&nbsp;';
  topRow.appendChild(blankCorner);

    const xSpanner = document.createElement('th');
    xSpanner.colSpan = state.cols.length;
  xSpanner.className = 'x-spanner no-sticky';
    xSpanner.scope = 'col';
    xSpanner.textContent = 'How often you do it';
    topRow.appendChild(xSpanner);

    const secondRow = document.createElement('tr');
    const yAxis = document.createElement('th');
    yAxis.className = 'sticky-col y-header';
    yAxis.scope = 'col';
    yAxis.textContent = 'How much time you shave off';
    secondRow.appendChild(yAxis);
    state.cols.forEach((c, ci) => {
      const th = document.createElement('th');
      th.scope = 'col';
      th.innerHTML = `${escapeHtml(c.label)}<br><small>${formatRunsPerYear(c.perYear)}</small>`;
      secondRow.appendChild(th);
    });
    el.tableHead.innerHTML = '';
    el.tableHead.appendChild(topRow);
    el.tableHead.appendChild(secondRow);

    // Body
    el.tableBody.innerHTML = '';
    state.rows.forEach((r, ri) => {
      const tr = document.createElement('tr');
      const rh = document.createElement('th');
      rh.className = 'sticky-col';
      rh.scope = 'row';
      rh.textContent = r.label;
      tr.appendChild(rh);

      state.cols.forEach((c, ci) => {
        const cellSeconds = computeMaxInvest(r.seconds, c.perYear, state.settings.horizonYears);
        const td = document.createElement('td');
        td.className = 'cell';
        td.tabIndex = 0; // keyboard focus
        td.dataset.ri = String(ri);
        td.dataset.ci = String(ci);
        td.setAttribute('role', 'gridcell');

        let display;
        let capped = false;
        if (cellSeconds >= CAP_SECONDS) {
          capped = true;
          display = { text: '> 10 yr', primary: '>', unit: '10 yr' };
        } else {
          display = formatRounded(cellSeconds); // always rounded display
        }
        if (capped) td.classList.add('capped');
        const unitHtml = display.unit ? `<span class="unit">${escapeHtml(display.unit)}</span>` : '';
        td.innerHTML = `<span class="primary">${escapeHtml(display.primary)}</span> ${unitHtml}`;

  const tip = tooltipContent(r, c, cellSeconds);
        td.setAttribute('aria-label', stripHtml(tip));
        td.addEventListener('mouseenter', (e) => showTooltip(e, tip));
        td.addEventListener('mouseleave', hideTooltip);
        td.addEventListener('focus', (e) => showTooltip(e, tip));
        td.addEventListener('blur', hideTooltip);

        tr.appendChild(td);
      });
      el.tableBody.appendChild(tr);
    });

    // Keyboard navigation
    el.tableBody.addEventListener('keydown', onTableKeyNav);
  }

  function formatRunsPerYear(rpy) {
    if (rpy >= 1000) return `${rpy.toLocaleString()} / yr`;
    return `${rpy} / yr`;
  }

  function stripHtml(html) { const div = document.createElement('div'); div.innerHTML = html; return div.textContent || ''; }
  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c])); }

  function formatSecondsShort(sec) {
    if (sec < 60) return `${sec} s`;
    if (sec < 3600) return `${Math.round(sec/60)} min`;
    if (sec < 86400) return `${Math.round(sec/3600)} h`;
    return `${Math.round(sec/86400)} d`;
  }

  function tooltipContent(row, col, seconds) {
    const exact = formatExact(seconds).text;
    const saved = row.label;
    const runs = formatRunsPerYear(col.perYear);
    const horizon = `${state.settings.horizonYears} yr`;
    return `
      <div class="tip-inner">
        <div><strong>Formula</strong></div>
        <div>time_saved_per_run × runs_per_year × horizon_years</div>
        <div>= ${escapeHtml(saved)} × ${escapeHtml(runs)} × ${escapeHtml(horizon)}</div>
        <hr />
        <div><strong>Exact:</strong> ${escapeHtml(exact)}</div>
        <div><strong>Seconds:</strong> ${Math.round(seconds).toLocaleString()}</div>
        <div><strong>Runs/year:</strong> ${escapeHtml(runs)} (${state.settings.freqMode})</div>
      </div>
    `;
  }

  // ---- Tooltip positioning ----
  function showTooltip(evt, html) {
    const t = el.tooltip;
    t.innerHTML = html;
    t.hidden = false;
    const rect = (evt.currentTarget || evt.target).getBoundingClientRect();
    const pad = 8;
    let x = rect.right + pad;
    let y = rect.top;
    const vw = window.innerWidth; const vh = window.innerHeight;
    t.style.left = `${Math.min(x, vw - t.offsetWidth - pad)}px`;
    t.style.top = `${Math.min(y, vh - t.offsetHeight - pad)}px`;
  }
  function hideTooltip() { el.tooltip.hidden = true; }

  // ---- Drag & drop reorder ----
  function attachRowDragHandlers(th) {
    th.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', `row:${th.dataset.rowIndex}`);
      th.setAttribute('aria-grabbed', 'true');
    });
    th.addEventListener('dragend', () => th.setAttribute('aria-grabbed', 'false'));
    th.addEventListener('dragover', (e) => e.preventDefault());
    th.addEventListener('drop', (e) => {
      e.preventDefault();
      const data = e.dataTransfer.getData('text/plain');
      const m = data.match(/^row:(\d+)$/);
      if (!m) return;
      const from = parseInt(m[1], 10);
      const to = parseInt(th.dataset.rowIndex || '0', 10);
      if (from === to) return;
      const [moved] = state.rows.splice(from, 1);
      state.rows.splice(to, 0, moved);
      renderAll();
    });
  }
  function attachColDragHandlers(th) {
    th.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', `col:${th.dataset.colIndex}`);
      th.setAttribute('aria-grabbed', 'true');
    });
    th.addEventListener('dragend', () => th.setAttribute('aria-grabbed', 'false'));
    th.addEventListener('dragover', (e) => e.preventDefault());
    th.addEventListener('drop', (e) => {
      e.preventDefault();
      const data = e.dataTransfer.getData('text/plain');
      const m = data.match(/^col:(\d+)$/);
      if (!m) return;
      const from = parseInt(m[1], 10);
      const to = parseInt(th.dataset.colIndex || '0', 10);
      if (from === to) return;
      const [moved] = state.cols.splice(from, 1);
      state.cols.splice(to, 0, moved);
      renderAll();
    });
  }

  // ---- Keyboard navigation ----
  function onTableKeyNav(e) {
    const key = e.key;
    if (!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(key)) return;
    const td = e.target.closest('td.cell');
    if (!td) return;
    const ri = parseInt(td.dataset.ri, 10);
    const ci = parseInt(td.dataset.ci, 10);
    let nri = ri, nci = ci;
    if (key === 'ArrowUp') nri = Math.max(0, ri - 1);
    if (key === 'ArrowDown') nri = Math.min(state.rows.length - 1, ri + 1);
    if (key === 'ArrowLeft') nci = Math.max(0, ci - 1);
    if (key === 'ArrowRight') nci = Math.min(state.cols.length - 1, ci + 1);
    if (nri !== ri || nci !== ci) {
      const next = el.tableBody.querySelector(`td.cell[data-ri="${nri}"][data-ci="${nci}"]`);
      if (next) next.focus();
      e.preventDefault();
    }
  }

  // ---- Hash state management ----
  let suppressHashUpdate = false;
  function updateHashSilently() {
    suppressHashUpdate = true;
    location.replace(encodeStateToHash());
    setTimeout(() => { suppressHashUpdate = false; }, 0);
  }
  window.addEventListener('hashchange', () => {
    if (suppressHashUpdate) return;
    const decoded = decodeStateFromHash(location.hash);
    if (decoded) {
      state.rows = decoded.rows;
      state.cols = decoded.cols;
      state.settings.horizonYears = decoded.settings.horizonYears;
      state.settings.freqMode = decoded.settings.freqMode;
  // roundingMode removed
      renderAll();
    }
  });

  // ---- Events ----
  el.horizonSlider.addEventListener('input', () => {
    state.settings.horizonYears = parseFloat(el.horizonSlider.value) || 5;
    el.horizonYears.value = String(state.settings.horizonYears);
    renderAll();
  });
  el.horizonYears.addEventListener('input', () => {
    const v = clamp(parseFloat(el.horizonYears.value) || 5, 0.1, 100);
    state.settings.horizonYears = v;
    el.horizonSlider.value = String(clamp(Math.round(v), 1, 10));
    renderAll();
  });

  document.querySelectorAll('input[name="freqMode"]').forEach(r => r.addEventListener('change', () => {
    state.settings.freqMode = el.freqMode().value;
    renderAll();
  }));
  // roundingMode listeners removed

  el.addRowBtn.addEventListener('click', () => { el.addRowForm.hidden = false; el.rowError.textContent = ''; el.rowDuration.focus(); });
  el.rowAddCancel.addEventListener('click', () => { el.addRowForm.hidden = true; });
  el.rowAddConfirm.addEventListener('click', () => {
    const label = el.rowLabel.value.trim();
    const seconds = parseDuration(el.rowDuration.value);
    if (!seconds) { el.rowError.textContent = 'Enter a valid duration like 90s, 1.5m, 2h, 1d (max 7d).'; return; }
    const finalLabel = label || humanizeSeconds(seconds);
    state.rows.push({ label: finalLabel, seconds });
    sortState();
    el.addRowForm.hidden = true; el.rowLabel.value = ''; el.rowDuration.value = ''; renderAll();
  });

  el.addColBtn.addEventListener('click', () => { el.addColForm.hidden = false; el.colError.textContent = ''; el.colN.focus(); });
  el.colAddCancel.addEventListener('click', () => { el.addColForm.hidden = true; });
  el.colAddConfirm.addEventListener('click', () => {
    const label = el.colLabel.value.trim() || 'Custom';
    const n = el.colN.value;
    const unit = el.colUnit.value;
    const perYear = parseCadence(n, unit, state.settings.freqMode);
    if (!perYear) { el.colError.textContent = 'Enter a valid positive integer cadence.'; return; }
    state.cols.push({ label, perYear, source: { type: 'custom', n: parseInt(n, 10), unit } });
    sortState();
    el.addColForm.hidden = true; el.colLabel.value = ''; el.colN.value = ''; el.colUnit.value = 'day'; renderAll();
  });

  el.resetBtn.addEventListener('click', () => {
    state.rows = structuredClone(DEFAULT_ROWS);
    state.cols = columnsForMode('workdays');
    state.settings.horizonYears = 5;
    state.settings.freqMode = 'workdays';
  // roundingMode reset removed
    renderAll();
  });

  el.copyLinkBtn.addEventListener('click', async () => {
    try {
      const url = location.origin + location.pathname + encodeStateToHash();
      await navigator.clipboard.writeText(url);
      el.copyLinkBtn.textContent = 'Copied!';
      setTimeout(() => { el.copyLinkBtn.textContent = 'Copy link'; }, 1200);
    } catch {
      // fallback
      prompt('Copy this URL:', location.origin + location.pathname + encodeStateToHash());
    }
  });

  // High contrast button removed

  // ---- Helpers ----
  function humanizeSeconds(seconds) {
    if (seconds < MIN) return `${Math.round(seconds)} s`;
    if (seconds < HOUR) return `${Math.round(seconds / MIN)} min`;
    if (seconds < DAY) return `${Math.round(seconds / HOUR)} h`;
    return `${Math.round(seconds / DAY)} d`;
  }

  // ---- Initialize ----
  function initFromHashOrDefaults() {
    const decoded = decodeStateFromHash(location.hash);
    if (decoded) {
      state.rows = decoded.rows;
      state.cols = decoded.cols;
      state.settings = { ...state.settings, ...decoded.settings };
    }
  }

  initFromHashOrDefaults();
  renderAll();
})();
