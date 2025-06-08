(function(){
  'use strict';
  
  var frame = 0;
  const startTime = performance.now();
  const $frameCount = document.querySelector('.frame-count');
  const $timestamp = document.querySelector('.timestamp');
  
  // New elements for stats
  const $fps = document.createElement('div');
  $fps.className = 'fps';
  const $delta = document.createElement('div');
  $delta.className = 'delta';
  // Individual FPS stats
  const $fpsMin = document.createElement('div');
  $fpsMin.className = 'fps-min';
  const $fpsMax = document.createElement('div');
  $fpsMax.className = 'fps-max';
  const $fpsMean = document.createElement('div');
  $fpsMean.className = 'fps-mean';
  const $fpsMedian = document.createElement('div');
  $fpsMedian.className = 'fps-median';
  const $elapsed = document.createElement('div');
  $elapsed.className = 'elapsed';
  
  // Insert new stats into container
  const $container = document.querySelector('.container');

  // --- SVG FPS History Graph ---
  // Set your desired aspect ratio here: [width, height]
  // Options: [3,2], [16,9], [9,16]
  const ASPECT_RATIO = [16, 9]; // Change to [3,2] or [9,16] as needed

  let SVG_WIDTH = 800;
  let SVG_HEIGHT = Math.round(SVG_WIDTH * ASPECT_RATIO[1] / ASPECT_RATIO[0]);
  const HISTORY_SECONDS = 30;
  const MAX_FPS = 90;

  const $svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  $svg.setAttribute('class', 'fps-graph');
  $svg.setAttribute('preserveAspectRatio', 'none');
  $svg.style.width = '100%';
  $svg.style.height = 'auto';
  $svg.style.display = 'block';
  $svg.style.margin = '0 0 2em 0';

  // Polyline for FPS
  const $polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
  $polyline.setAttribute('fill', 'none');
  $polyline.setAttribute('stroke', '#4af');
  $polyline.setAttribute('stroke-width', '2.5');

  // Helper to clear SVG children except polyline
  function clearSvgGridAndLabels() {
    while ($svg.firstChild) $svg.removeChild($svg.firstChild);
  }

  function drawSvgGridAndLabels() {
    // Background grid
    for (let i = 0; i <= 6; i++) {
      const y = (SVG_HEIGHT / 6) * i;
      const gridLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      gridLine.setAttribute('x1', 0);
      gridLine.setAttribute('x2', SVG_WIDTH);
      gridLine.setAttribute('y1', y);
      gridLine.setAttribute('y2', y);
      gridLine.setAttribute('stroke', '#333');
      gridLine.setAttribute('stroke-width', '1');
      $svg.appendChild(gridLine);
    }
    // Y-axis labels
    for (let i = 0; i <= 6; i++) {
      const y = (SVG_HEIGHT / 6) * i;
      const fpsLabel = Math.round(MAX_FPS - (MAX_FPS / 6) * i);
      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('x', 8);
      label.setAttribute('y', y + 14);
      label.setAttribute('fill', '#aaa');
      label.setAttribute('font-size', '14');
      label.textContent = fpsLabel;
      $svg.appendChild(label);
    }
    $svg.appendChild($polyline);
  }

  function resizeSvg() {
    // Use the container's width for SVG, and set height as a fraction of viewport height
    SVG_WIDTH = $container.clientWidth || window.innerWidth || 800;
    SVG_HEIGHT = Math.round(window.innerHeight * 0.28); // 28vh, matches CSS
    $svg.setAttribute('width', SVG_WIDTH);
    $svg.setAttribute('height', SVG_HEIGHT);
    $svg.setAttribute('viewBox', `0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`);
    clearSvgGridAndLabels();
    drawSvgGridAndLabels();
  }

  // Insert SVG at the top of the container
  $container.insertBefore($svg, $container.firstChild);

  // --- Stats layout ---
  // Create row for stats
  const $statsRow = document.createElement('div');
  $statsRow.className = 'stats-row';

  // Main stats (left)
  const $mainStats = document.createElement('div');
  $mainStats.className = 'stats-main';
  $mainStats.appendChild($frameCount);
  $mainStats.appendChild($timestamp);
  $mainStats.appendChild($fps);

  // Secondary stats (right)
  const $secondaryStats = document.createElement('div');
  $secondaryStats.className = 'stats-secondary';
  $secondaryStats.appendChild($delta);
  $secondaryStats.appendChild($fpsMin);
  $secondaryStats.appendChild($fpsMax);
  $secondaryStats.appendChild($fpsMean);
  $secondaryStats.appendChild($fpsMedian);
  $secondaryStats.appendChild($elapsed);

  $statsRow.appendChild($mainStats);
  $statsRow.appendChild($secondaryStats);

  // Add stats row to container
  $container.appendChild($statsRow);

  // --- FPS tracking ---
  let lastTimestamp = startTime;
  let firstFrame = true; // Add this flag
  let minFps = Infinity, maxFps = 0, sumFps = 0;
  let statsDelayPassed = false;
  let statsDelayTime = startTime + 100; // 100ms after page load

  // FPS history: array of {timestamp, fps}
  const fpsHistory = [];

  function median(arr) {
    if (!arr.length) return 0;
    const sorted = arr.slice().sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2) return sorted[mid];
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }

  function setStat(el, label, value) {
    el.innerHTML = `<span class="stat-label">${label}</span><span class="stat-value">${value}</span>`;
  }

  function step(timestamp) {
    if (firstFrame) {
      lastTimestamp = timestamp;
      firstFrame = false;
      window.requestAnimationFrame(step);
      return;
    }

    frame++;
    setStat($frameCount, "Frame:", frame);
    setStat($timestamp, "Timestamp:", Math.round(timestamp - startTime));
    const delta = timestamp - lastTimestamp;
    setStat($delta, "Delta (ms):", Math.round(delta));
    const fps = delta > 0 ? 1000 / delta : 0;
    setStat($fps, "FPS:", fps.toFixed(1));

    // --- FPS history update ---
    const now = timestamp / 1000;
    fpsHistory.push({ t: now, fps });
    // Remove old entries
    while (fpsHistory.length && fpsHistory[0].t < now - HISTORY_SECONDS) {
      fpsHistory.shift();
    }

    // Delay stats calculation for first 100ms
    if (!statsDelayPassed && timestamp >= statsDelayTime) {
      statsDelayPassed = true;
    }

    // FPS stats (min, max, mean, median)
    if (statsDelayPassed) {
      const validFps = fpsHistory.filter(p => (p.t * 1000) >= statsDelayTime).map(p => p.fps);
      if (validFps.length) {
        minFps = Math.min(...validFps);
        maxFps = Math.max(...validFps);
        sumFps = validFps.reduce((a, b) => a + b, 0);
        const meanFps = sumFps / validFps.length;
        const medianFps = median(validFps);

        setStat($fpsMin, "Min:", minFps.toFixed(1));
        setStat($fpsMax, "Max:", maxFps.toFixed(1));
        setStat($fpsMean, "Mean Avg:", meanFps.toFixed(1));
        setStat($fpsMedian, "Median:", medianFps.toFixed(1));
      } else {
        setStat($fpsMin, "Min:", "--");
        setStat($fpsMax, "Max:", "--");
        setStat($fpsMean, "Mean Avg:", "--");
        setStat($fpsMedian, "Median:", "--");
      }
    } else {
      setStat($fpsMin, "Min:", "--");
      setStat($fpsMax, "Max:", "--");
      setStat($fpsMean, "Mean Avg:", "--");
      setStat($fpsMedian, "Median:", "--");
    }

    const elapsed = (timestamp - startTime) / 1000;
    setStat($elapsed, "Elapsed (s):", elapsed.toFixed(2));

    // --- SVG polyline update ---
    // Responsive: recalculate SVG_WIDTH/HEIGHT if needed
    resizeSvg();

    // Map history to SVG coordinates
    const points = fpsHistory.map(point => {
      const x = ((point.t - (now - HISTORY_SECONDS)) / HISTORY_SECONDS) * SVG_WIDTH;
      const y = SVG_HEIGHT - Math.max(0, Math.min(point.fps, MAX_FPS)) / MAX_FPS * SVG_HEIGHT;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    $polyline.setAttribute('points', points.join(' '));

    lastTimestamp = timestamp;
    window.requestAnimationFrame(step);
  }
  
  // Redraw SVG on window resize
  window.addEventListener('resize', resizeSvg);

  // Add double-click fullscreen toggle
  document.addEventListener('dblclick', () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  });

  step(performance.now());
})();