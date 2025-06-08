(function (global) {
  "use strict";

  const zipCodesJsonURL = "https://cdn.statically.io/gh/pseudosavant/USPSZIPCodes/main/dist/ZIPCodes.json";
  var ZIPCodes;

  async function ZIPLookup(ZIPCode) {
    // If no `ZIPCodes` object exists download it and call the callback async
    if (!ZIPCodes) {
      const req = await fetch(zipCodesJsonURL);
      ZIPCodes = await req.json();
    }

    const cityState = ZIPCodes[ZIPCode];
    cityState.cached = true;
    cityState.ZIPCode = ZIPCode;
    return cityState;
  }

  global.ZIPLookup = ZIPLookup;

  async function main() {
    // This should be uncached
    log("Uncached lookups:");
    performance.mark('uncached-check-start');
    await check();
    performance.mark('uncached-check-finish');
    
    const uncachedDuration = performance.measure('uncached-duration', 'uncached-check-start', 'uncached-check-finish').duration; 
    log(`Uncached duration: ${uncachedDuration.toFixed(0)}ms`);
    
    // This should be cached
    await wait(2000);
    log("Cached lookups:");
    performance.mark('cached-check-start');
    await check();
    performance.mark('cached-check-finish');
    
    const cachedDuration = performance.measure('cached-duration', 'cached-check-start', 'cached-check-finish').duration; 
    log(`Cached duration: ${cachedDuration.toFixed(0)}ms`);
  }

  async function check() {
    log(await ZIPLookup("00501"));
    log(await ZIPLookup("90210"));
    log(await ZIPLookup("92121"));
  }

  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function log(m) {
    document.querySelector(".console").innerHTML += `<li>${JSON.stringify(
      m
    )}</li>`;
  }

  main();
})(this);
