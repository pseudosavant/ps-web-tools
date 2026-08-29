/* ZIP-code lookup backed by the open-source pseudosavant/usps-zip-codes dataset. */
;(function () {
  'use strict';

  const ZIP_CODES_URLS = [
    'https://raw.githubusercontent.com/pseudosavant/usps-zip-codes/main/dist/ZIPCodes.json',
    'https://cdn.jsdelivr.net/gh/pseudosavant/usps-zip-codes@main/dist/ZIPCodes.json',
    'https://cdn.statically.io/gh/pseudosavant/usps-zip-codes/main/dist/ZIPCodes.json'
  ];

  const form = document.getElementById('zip-form');
  const input = document.getElementById('zip-input');
  const status = document.getElementById('lookup-status');
  const result = document.getElementById('lookup-result');
  const resultTitle = document.getElementById('result-title');
  const resultDetails = document.getElementById('result-details');

  let zipCodes = null;
  let zipCodesRequest = null;
  let activeSource = null;

  function normalizeZIP(value) {
    const digits = String(value ?? '').replace(/\D/g, '');
    return digits.length >= 5 ? digits.slice(0, 5) : null;
  }

  async function loadZIPCodes() {
    if (zipCodes) return zipCodes;

    if (!zipCodesRequest) {
      zipCodesRequest = (async () => {
        const errors = [];

        for (const url of ZIP_CODES_URLS) {
          try {
            const response = await fetch(url, { cache: 'force-cache' });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const data = await response.json();
            if (!data || typeof data !== 'object' || Array.isArray(data)) {
              throw new Error('Unexpected data format');
            }

            activeSource = new URL(url).hostname;
            return data;
          } catch (error) {
            errors.push(`${new URL(url).hostname}: ${error.message}`);
          }
        }

        throw new Error(`ZIP data could not be loaded (${errors.join('; ')})`);
      })().catch((error) => {
        zipCodesRequest = null;
        throw error;
      });
    }

    zipCodes = await zipCodesRequest;
    return zipCodes;
  }

  async function ZIPLookup(value) {
    const ZIPCode = normalizeZIP(value);
    if (!ZIPCode) throw new TypeError('Enter a valid five-digit ZIP code.');

    const cached = Boolean(zipCodes);
    const data = await loadZIPCodes();
    const entry = data[ZIPCode];
    if (!entry) return null;

    return { ...entry, ZIPCode, cached, source: activeSource };
  }

  function preferredValue(entry, names) {
    for (const name of names) {
      if (entry[name] != null && entry[name] !== '') return entry[name];
    }
    return '';
  }

  function humanizeKey(key) {
    return key
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/[_-]+/g, ' ')
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  function renderResult(entry) {
    const city = preferredValue(entry, ['City', 'city', 'PrimaryCity', 'primary_city']);
    const state = preferredValue(entry, ['State', 'state', 'StateAbbreviation', 'state_abbreviation']);
    const heading = city && state ? `${city}, ${state}` : `ZIP ${entry.ZIPCode}`;

    resultTitle.textContent = heading;
    resultDetails.textContent = '';

    const orderedEntries = [
      ['ZIP code', entry.ZIPCode],
      ...Object.entries(entry)
        .filter(([key, value]) => !['ZIPCode', 'cached', 'source'].includes(key) && value != null && value !== '')
        .map(([key, value]) => [humanizeKey(key), value])
    ];

    for (const [label, value] of orderedEntries) {
      const term = document.createElement('dt');
      const description = document.createElement('dd');
      term.textContent = label;
      description.textContent = Array.isArray(value) ? value.join(', ') : String(value);
      resultDetails.append(term, description);
    }

    result.hidden = false;
    status.classList.remove('error');
    status.textContent = entry.cached
      ? `Found ${entry.ZIPCode} using the in-memory dataset.`
      : `Found ${entry.ZIPCode}. ZIP data loaded from ${entry.source}.`;
  }

  async function performLookup(value) {
    const ZIPCode = normalizeZIP(value);
    result.hidden = true;
    status.classList.remove('error');

    if (!ZIPCode) {
      status.classList.add('error');
      status.textContent = 'Enter a valid five-digit ZIP code.';
      input.setAttribute('aria-invalid', 'true');
      return;
    }

    input.removeAttribute('aria-invalid');
    input.value = ZIPCode;
    status.textContent = zipCodes ? `Looking up ${ZIPCode}…` : 'Loading ZIP code data…';

    try {
      const entry = await ZIPLookup(ZIPCode);
      if (!entry) {
        status.classList.add('error');
        status.textContent = `ZIP ${ZIPCode} was not found in the dataset.`;
        return;
      }
      renderResult(entry);
    } catch (error) {
      status.classList.add('error');
      status.textContent = `${error.message} Check your connection and try again.`;
    }
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    performLookup(input.value);
  });

  document.querySelectorAll('.example').forEach((button) => {
    button.addEventListener('click', () => {
      input.value = button.dataset.zip;
      performLookup(button.dataset.zip);
    });
  });

  globalThis.ZIPLookup = ZIPLookup;
  performLookup(input.value);
})();
