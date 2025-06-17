(function(){
  'use strict';
  
  var frame = 0;
  const startTime = performance.now();
  const $frameCount = document.querySelector('.frame-count');
  const $timestamp = document.querySelector('.timestamp');
  
  // Main FPS display element
  const $fps = document.createElement('div');
  $fps.className = 'fps';
  
  // Frame time oriented stats elements
  const $delta = document.createElement('div'); // Current frame time
  $delta.className = 'delta';
  const $frameTimeMin = document.createElement('div');
  $frameTimeMin.className = 'frame-time-min'; // Best frame time
  const $frameTimeMax = document.createElement('div');
  $frameTimeMax.className = 'frame-time-max'; // Worst frame time
  const $frameTimeMean = document.createElement('div');
  $frameTimeMean.className = 'frame-time-mean';
  const $frameTimeMedian = document.createElement('div');
  $frameTimeMedian.className = 'frame-time-median';
  const $frameTimeP1 = document.createElement('div'); // 1st percentile frame time (worst 1%)
  $frameTimeP1.className = 'frame-time-p1';
  const $frameTimeP99 = document.createElement('div'); // 99th percentile frame time (best 99%)
  $frameTimeP99.className = 'frame-time-p99';
  
  // REMOVE: const $elapsed = document.createElement('div');
  // REMOVE: $elapsed.className = 'elapsed';
  
  // Insert new stats into container
  const $container = document.querySelector('.container');

  // --- SVG Frame Time History Graph ---
  // Set your desired aspect ratio here: [width, height]
  // Options: [3,2], [16,9], [9,16]
  const ASPECT_RATIO = [16, 9]; // Change to [3,2] or [9,16] as needed

  let SVG_WIDTH = 800;
  let SVG_HEIGHT = Math.round(SVG_WIDTH * ASPECT_RATIO[1] / ASPECT_RATIO[0]);
  const HISTORY_SECONDS = 30;
  
  // Dynamic Y-axis settings
  const Y_AXIS_UPDATE_INTERVAL = 1000; // ms
  const MIN_DYNAMIC_Y_AXIS = 10; // ms, minimum scale for Y-axis
  let MAX_FRAME_TIME_Y_AXIS = MIN_DYNAMIC_Y_AXIS; // Initial Y-axis max, will be dynamic
  let lastYAxisUpdateTime = startTime;

  const $svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  $svg.setAttribute('class', 'fps-graph'); // Keep class name for CSS, though it's now a frame time graph
  $svg.setAttribute('preserveAspectRatio', 'none');
  $svg.style.width = '100%';
  $svg.style.height = 'auto';
  $svg.style.display = 'block';
  $svg.style.margin = '0 0 2em 0';

  // Polyline for FPS
  const $polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
  $polyline.setAttribute('fill', 'none');
  $polyline.setAttribute('stroke-width', '2.5');

  // Helper to clear SVG children except polyline
  function clearSvgGridAndLabels() {
    while ($svg.firstChild) $svg.removeChild($svg.firstChild);
  }

  function drawSvgGridAndLabels() {
    // REMOVE: const computedRootStyle = getComputedStyle(document.documentElement);
    // REMOVE: const gridStrokeColor = computedRootStyle.getPropertyValue('--color-svg-grid').trim() || '#333';
    // REMOVE: const labelFillColor = computedRootStyle.getPropertyValue('--color-text-secondary').trim() || '#aaa';

    // Background grid
    for (let i = 0; i <= 6; i++) {
      const y = (SVG_HEIGHT / 6) * i;
      const gridLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      gridLine.setAttribute('x1', 0);
      gridLine.setAttribute('x2', SVG_WIDTH);
      gridLine.setAttribute('y1', y);
      gridLine.setAttribute('y2', y);
      // REMOVE: gridLine.setAttribute('stroke', gridStrokeColor); 
      gridLine.setAttribute('stroke-width', '1');
      $svg.appendChild(gridLine);
    }
    // Y-axis labels for Frame Times (ms)
    // Lower frame times (better) are at the bottom of the graph.
    for (let i = 0; i <= 6; i++) {
      const y = SVG_HEIGHT - (SVG_HEIGHT / 6) * i; // Y position for label
      const frameTimeLabelVal = Math.round((MAX_FRAME_TIME_Y_AXIS / 6) * i);
      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('x', 8);
      label.setAttribute('y', y - 4); // Adjust label position slightly
      if (i === 0) label.setAttribute('y', y - 8); // Bottom-most label
      if (i === 6) label.setAttribute('y', y + 14); // Top-most label
      // REMOVE: label.setAttribute('fill', labelFillColor); 
      label.setAttribute('font-size', '14');
      label.textContent = frameTimeLabelVal + "ms";
      $svg.appendChild(label);
    }
    $svg.appendChild($polyline);
  }

  function resizeSvg() {
    const newSvgWidth = $container.clientWidth || window.innerWidth || 800;
    const newSvgHeight = Math.round(window.innerHeight * 0.28); // 28vh, matches CSS

    // Only redraw grid and labels if dimensions have actually changed
    if (newSvgWidth !== SVG_WIDTH || newSvgHeight !== SVG_HEIGHT) {
      SVG_WIDTH = newSvgWidth;
      SVG_HEIGHT = newSvgHeight;
      $svg.setAttribute('width', SVG_WIDTH);
      $svg.setAttribute('height', SVG_HEIGHT);
      $svg.setAttribute('viewBox', `0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`);
      clearSvgGridAndLabels(); // Clears everything including old polyline
      drawSvgGridAndLabels();  // Redraws grid, labels, and re-adds polyline
    }
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

  // Secondary stats (right) - Now frame time oriented
  const $secondaryStats = document.createElement('div');
  $secondaryStats.className = 'stats-secondary';
  $secondaryStats.appendChild($delta);
  $secondaryStats.appendChild($frameTimeMin);
  $secondaryStats.appendChild($frameTimeMax);
  $secondaryStats.appendChild($frameTimeMean);
  $secondaryStats.appendChild($frameTimeMedian);
  $secondaryStats.appendChild($frameTimeP1); 
  $secondaryStats.appendChild($frameTimeP99);
  // REMOVE: $secondaryStats.appendChild($elapsed);

  $statsRow.appendChild($mainStats);
  $statsRow.appendChild($secondaryStats);

  // Add stats row to container
  $container.appendChild($statsRow);

  // --- Frame Time tracking ---
  let lastTimestamp = startTime;
  let firstFrame = true; 
  // Variables for frame time statistics
  let minFrameTime = Infinity, maxFrameTime = 0, sumFrameTimes = 0;
  let statsDelayPassed = false;
  let statsDelayTime = startTime + 100; // 100ms after page load

  let animationFrameId; // To store the requestAnimationFrame ID


  // Frame Time history: array of {timestamp, value: frameTime}
  const frameTimeHistory = [];

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
      lastTimestamp = timestamp; // Initialize lastTimestamp on the first frame or after resuming
      firstFrame = false;
      // No calculations or DOM updates on this very first frame after resuming
      animationFrameId = window.requestAnimationFrame(step);
      return;
    }

    frame++;
    setStat($frameCount, "Frame:", frame);
    setStat($timestamp, "Timestamp:", Math.round(timestamp - startTime));
    
    const delta = timestamp - lastTimestamp; // This is current frame time
    setStat($delta, "Delta (ms):", Math.round(delta));
    
    const fps = delta > 0 ? 1000 / delta : 0; // Still calculate current FPS for main display
    setStat($fps, "FPS:", fps.toFixed(1));

    // --- Frame Time history update (every frame) ---
    const now = timestamp / 1000;
    frameTimeHistory.push({ t: now, value: delta }); // Store delta (frame time)
    // Remove old entries
    while (frameTimeHistory.length && frameTimeHistory[0].t < now - HISTORY_SECONDS) {
      frameTimeHistory.shift();
    }

    // Delay stats calculation for first 100ms
    if (!statsDelayPassed && timestamp >= statsDelayTime) {
      statsDelayPassed = true;
    }

    // --- Dynamic Y-axis update for SVG graph ---
    if (timestamp - lastYAxisUpdateTime > Y_AXIS_UPDATE_INTERVAL) {
      lastYAxisUpdateTime = timestamp;
      
      let maxObservedFrameTimeInHistory = 0;
      if (frameTimeHistory.length > 0) {
        maxObservedFrameTimeInHistory = frameTimeHistory.reduce((max, p) => Math.max(max, p.value), 0);
      }

      let newTargetMaxY = Math.ceil(maxObservedFrameTimeInHistory / 5) * 5;
      newTargetMaxY = Math.max(newTargetMaxY, MIN_DYNAMIC_Y_AXIS); // Ensure minimum scale

      if (MAX_FRAME_TIME_Y_AXIS !== newTargetMaxY) {
        MAX_FRAME_TIME_Y_AXIS = newTargetMaxY;
        // SVG dimensions might not have changed, but scale has, so redraw grid & labels
        clearSvgGridAndLabels(); 
        drawSvgGridAndLabels();
      }
    }

    // Frame Time stats (min, max, mean, median, P1, P99) - Now updated every frame
    if (statsDelayPassed) {
      const validFrameTimes = frameTimeHistory.filter(p => (p.t * 1000) >= statsDelayTime).map(p => p.value);
      if (validFrameTimes.length) {
        const sortedFrameTimes = [...validFrameTimes].sort((a, b) => a - b);
        
        minFrameTime = sortedFrameTimes[0];
        maxFrameTime = sortedFrameTimes[sortedFrameTimes.length - 1];
        sumFrameTimes = validFrameTimes.reduce((a, b) => a + b, 0);
        const meanFrameTime = sumFrameTimes / validFrameTimes.length;
        const medianFrameTime = median(validFrameTimes); // median sorts its own copy

        // P1 Frame Time (worst 1% of frame times)
        const p1Idx = Math.floor(0.01 * (sortedFrameTimes.length - 1));
        const p1FrameTimeValue = sortedFrameTimes[p1Idx < 0 ? 0 : p1Idx]; 

        // P99 Frame Time (best 99% of frame times - i.e., 99% of frames are AT OR BELOW this time)
        const p99Idx = Math.ceil(0.99 * (sortedFrameTimes.length - 1));
        const p99FrameTimeValue = sortedFrameTimes[p99Idx < 0 ? 0 : p99Idx];


        setStat($frameTimeMin, "Min FT (ms):", minFrameTime.toFixed(1));
        setStat($frameTimeMax, "Max FT (ms):", maxFrameTime.toFixed(1));
        setStat($frameTimeMean, "Mean FT (ms):", meanFrameTime.toFixed(1));
        setStat($frameTimeMedian, "Median FT (ms):", medianFrameTime.toFixed(1));
        setStat($frameTimeP1, "P1 FT (ms):", p1FrameTimeValue.toFixed(1)); // Worst 1%
        setStat($frameTimeP99, "P99 FT (ms):", p99FrameTimeValue.toFixed(1)); // Best 99%
      } else {
        setStat($frameTimeMin, "Min FT (ms):", "--");
        setStat($frameTimeMax, "Max FT (ms):", "--");
        setStat($frameTimeMean, "Mean FT (ms):", "--");
        setStat($frameTimeMedian, "Median FT (ms):", "--");
        setStat($frameTimeP1, "P1 FT (ms):", "--");
        setStat($frameTimeP99, "P99 FT (ms):", "--");
      }
    } else {
      setStat($frameTimeMin, "Min FT (ms):", "--");
      setStat($frameTimeMax, "Max FT (ms):", "--");
      setStat($frameTimeMean, "Mean FT (ms):", "--");
      setStat($frameTimeMedian, "Median FT (ms):", "--");
      setStat($frameTimeP1, "P1 FT (ms):", "--");
      setStat($frameTimeP99, "P99 FT (ms):", "--");
    }

    // REMOVE: const elapsed = (timestamp - startTime) / 1000;
    // REMOVE: setStat($elapsed, "Elapsed (s):", elapsed.toFixed(2));

    // --- SVG polyline update (every frame) ---
    // Responsive: check if SVG dimensions need update (now optimized)
    resizeSvg();

    // Map history to SVG coordinates for Frame Times
    // Lower frame times are better, so they should be lower on the graph.
    const points = frameTimeHistory.map(point => {
      const x = ((point.t - (now - HISTORY_SECONDS)) / HISTORY_SECONDS) * SVG_WIDTH;
      const y = SVG_HEIGHT - (Math.max(0, Math.min(point.value, MAX_FRAME_TIME_Y_AXIS)) / MAX_FRAME_TIME_Y_AXIS * SVG_HEIGHT);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    $polyline.setAttribute('points', points.join(' '));

    lastTimestamp = timestamp;
    animationFrameId = window.requestAnimationFrame(step); // Store the ID
  }
  
  // Redraw SVG on window resize
  window.addEventListener('resize', resizeSvg);

  // Add click/tap fullscreen toggle
  function toggleFullScreen() {
    const docEl = document.documentElement;
    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
      if (docEl.requestFullscreen) {
        docEl.requestFullscreen();
      } else if (docEl.webkitRequestFullscreen) { // Safari
        docEl.webkitRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.webkitExitFullscreen) { // Safari
        docEl.webkitExitFullscreen();
      }
    }
  }

  document.addEventListener('click', toggleFullScreen);
  document.addEventListener('touchend', toggleFullScreen); // Added for touch devices

  // Handle Page Visibility
  function handleVisibilityChange() {
    if (document.hidden) {
      // Page is hidden, cancel the animation frame
      window.cancelAnimationFrame(animationFrameId);
      console.log('Frame counter paused (tab hidden)'); // Added log
    } else {
      // Page is visible, set firstFrame to true to reset lastTimestamp
      // and restart the animation.
      firstFrame = true; 
      animationFrameId = window.requestAnimationFrame(step);
      console.log('Frame counter resumed (tab visible)'); // Added log
    }
  }

  document.addEventListener('visibilitychange', handleVisibilityChange);

  // Initial call to start the loop
  animationFrameId = window.requestAnimationFrame(step);
})();