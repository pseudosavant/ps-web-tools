/* ZIP-code helper + demo
   — single network fetch, shared by concurrent calls
   — never mutates cached data
   — proper “cached” flag
   — robust logging & perf-timing                     */
;(function () {
  'use strict';

  const ZIP_CODES_URL =
    'https://cdn.statically.io/gh/pseudosavant/USPSZIPCodes/main/dist/ZIPCodes.json';

  let zipCodes = null;       // parsed JSON, once ready
  let zipCodesReq = null;    // Promise for the fetch in flight

  /**
   * Look up city/state for a ZIP code.
   * @param {string} code
   * @returns {Promise<{city:string, state:string, ZIPCode:string, cached:boolean}|null>}
   */
  async function ZIPLookup(code) {
    const wasCached = !!zipCodes;          // true after first successful load

    // Kick off the fetch lazily and only once
    if (!zipCodesReq) zipCodesReq = fetch(ZIP_CODES_URL);

    // Wait for JSON only the first time
    if (!zipCodes) {
      const res = await zipCodesReq;
      if (!res.ok) {
        throw new Error(`ZIP data fetch failed: ${res.status} ${res.statusText}`);
      }
      zipCodes = await res.json();
    }

    const entry = zipCodes[code];
    if (!entry) {
      console.warn(`ZIP ${code} not found`);
      return null;
    }

    // Clone so we don’t pollute the cache object
    return { ...entry, ZIPCode: code, cached: wasCached };
  }

  // Global export that works in browsers, Workers, Node, ESM, etc.
  globalThis.ZIPLookup = ZIPLookup;

  /* ------------------------------------------------------------------ */
  /* Demo / timing helpers                                              */

  async function main() {
    log('Uncached lookups:');
    performance.mark('uncached-start');
    await doChecks();
    performance.mark('uncached-end');
    performance.measure('uncached-duration', 'uncached-start', 'uncached-end');
    const uncached = lastMeasure('uncached-duration');
    log(`Uncached duration: ${uncached.toFixed(0)} ms`);

    await wait(2000);

    log('Cached lookups:');
    performance.mark('cached-start');
    await doChecks();
    performance.mark('cached-end');
    performance.measure('cached-duration', 'cached-start', 'cached-end');
    const cached = lastMeasure('cached-duration');
    log(`Cached duration: ${cached.toFixed(0)} ms`);
  }

  async function doChecks() {
    log(await ZIPLookup('00501'));  // Holtsville NY
    log(await ZIPLookup('90210'));  // Beverly Hills CA
    log(await ZIPLookup('92121'));  // San Diego CA
  }

  const wait = ms => new Promise(res => setTimeout(res, ms));

  function log(msg) {
    const target = document.querySelector('.console');
    const out    = typeof msg === 'string' ? msg : JSON.stringify(msg);
    if (target) {
      const li = document.createElement('li');
      li.textContent = out;
      target.appendChild(li);
    } else {
      console.log(out);
    }
  }

  function lastMeasure(name) {
    const entries = performance.getEntriesByName(name);
    return entries[entries.length - 1].duration;
  }

  main().catch(err => console.error(err));
})();
