/* ZIP-code helper + demo (signature-prefixed logging) */
;(function () {
  'use strict';

  const ZIP_CODES_URL =
    'https://cdn.statically.io/gh/pseudosavant/USPSZIPCodes/main/dist/ZIPCodes.json';

  let zipCodes = null;      // parsed JSON
  let zipCodesReq = null;   // Promise in flight

  async function ZIPLookup(code) {
    const wasCached = !!zipCodes;

    if (!zipCodesReq) zipCodesReq = fetch(ZIP_CODES_URL);

    if (!zipCodes) {
      const res = await zipCodesReq;
      if (!res.ok) throw new Error(`ZIP fetch failed: ${res.status}`);
      zipCodes = await res.json();
    }

    const entry = zipCodes[code];
    if (!entry) {
      console.warn(`ZIP ${code} not found`);
      return null;
    }
    return { ...entry, ZIPCode: code, cached: wasCached };
  }

  globalThis.ZIPLookup = ZIPLookup;

  /* -------------------------------------------------- */

  async function main() {
    log('Uncached lookups:');
    const uncached = await time(doChecks);
    log(`Uncached duration: ${uncached.toFixed(0)} ms`);

    await wait(2000);

    log('Cached lookups:');
    const cached = await time(doChecks);
    log(`Cached duration: ${cached.toFixed(0)} ms`);
  }

  async function doChecks() {
    await logResult('00501');
    await logResult('90210');
    await logResult('92121');
  }

  async function logResult(code) {
    const res = await ZIPLookup(code);
    log(`ZIPLookup(${code}): ${JSON.stringify(res)}`);
  }

  const wait  = ms => new Promise(r => setTimeout(r, ms));
  const time  = async fn => { const t0 = performance.now(); await fn(); return performance.now() - t0; };

  function log(msg) {
    const out = typeof msg === 'string' ? msg : JSON.stringify(msg);
    const el  = document.querySelector('.console');
    if (el) {
      const li = document.createElement('li');
      li.textContent = out;
      el.appendChild(li);
    } else {
      console.log(out);
    }
  }

  main().catch(console.error);
})();
