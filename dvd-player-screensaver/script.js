(() => {
  'use strict';

  const LOGO_ASPECT_RATIO = 107 / 210;
  const CORNER_WINDOW_MS = 80;
  const CONTROLS_HIDE_DELAY_MS = 4500;
  const DEFAULT_SPEED = 120;
  const DEFAULT_SIZE = 25;
  const DEFAULT_SCHEME = 0;

  const schemes = [
    { logo: '#ffffff', background: '#000000' },
    { logo: '#10263f', background: '#f3faff' },
    { logo: '#ff6392', background: '#081521' },
    { logo: '#ffe45e', background: '#145a8a' },
    { logo: '#39ff14', background: '#3b0764' },
    { logo: '#b42318', background: '#fff7ed' },
    { logo: '#67e8f9', background: '#172554' },
    { logo: '#fb923c', background: '#1c1917' }
  ];

  const root = document.documentElement;
  const xMover = document.querySelector('.x');
  const yMover = document.querySelector('.y');
  const fullscreenButton = document.getElementById('fullscreenButton');
  const colorButton = document.getElementById('colorButton');
  const pauseButton = document.getElementById('pauseButton');
  const resetButton = document.getElementById('resetButton');
  const speedInput = document.getElementById('speedInput');
  const speedValue = document.getElementById('speedValue');
  const sizeInput = document.getElementById('sizeInput');
  const sizeValue = document.getElementById('sizeValue');
  const cornerCount = document.getElementById('cornerCount');
  const status = document.getElementById('status');
  const themeColor = document.getElementById('themeColor');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const params = new URL(window.location.href).searchParams;

  let speed = numberParam('speed', DEFAULT_SPEED, 40, 300);
  let size = numberParam('size', DEFAULT_SIZE, 10, 45);
  let schemeIndex = integerParam('scheme', DEFAULT_SCHEME, 0, schemes.length - 1);
  let usingCustomColors = false;
  let userPaused = false;
  let corners = 0;
  let motionInitialized = false;
  let controlsHideTimer = 0;
  let motionMetricsFrame = 0;
  let suppressCollisionsUntil = 0;
  let lastPointerActivity = -Infinity;
  let lastCornerHit = -Infinity;
  const lastCollision = { x: -Infinity, y: -Infinity };

  function numberParam(name, fallback, min, max) {
    const rawValue = params.get(name);
    if (rawValue === null || rawValue === '') return fallback;
    const value = Number(rawValue);
    return Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
  }

  function integerParam(name, fallback, min, max) {
    const rawValue = params.get(name);
    if (rawValue === null || rawValue === '') return fallback;
    const value = Number(rawValue);
    return Number.isInteger(value) ? Math.max(min, Math.min(max, value)) : fallback;
  }

  function validColor(value) {
    return value && CSS.supports('color', value) ? value : null;
  }

  function announce(message) {
    status.textContent = '';
    requestAnimationFrame(() => {
      status.textContent = message;
    });
  }

  function applyColors(logo, background) {
    root.style.setProperty('--logo-color', logo);
    root.style.setProperty('--background-color', background);
    themeColor.content = background;
  }

  function applyInitialColors() {
    const customLogo = validColor(params.get('logo-color'));
    const customBackground = validColor(params.get('background-color'));
    const selectedScheme = schemes[schemeIndex];
    usingCustomColors = Boolean(customLogo || customBackground);
    applyColors(
      customLogo || selectedScheme.logo,
      customBackground || selectedScheme.background
    );
  }

  function advanceScheme({ announceChange = false, updateURL = false } = {}) {
    schemeIndex = (schemeIndex + 1) % schemes.length;
    usingCustomColors = false;
    const scheme = schemes[schemeIndex];
    applyColors(scheme.logo, scheme.background);
    if (updateURL) updateConfigurationURL();
    if (announceChange) announce(`Color scheme ${schemeIndex + 1} of ${schemes.length}.`);
  }

  function updateConfigurationURL() {
    const url = new URL(window.location.href);
    url.searchParams.set('speed', String(speed));
    url.searchParams.set('size', String(size));

    if (usingCustomColors) {
      url.searchParams.delete('scheme');
    } else {
      url.searchParams.set('scheme', String(schemeIndex));
      url.searchParams.delete('logo-color');
      url.searchParams.delete('background-color');
    }

    window.history.replaceState({}, '', url);
  }

  function updateControlValues() {
    speedInput.value = String(speed);
    speedValue.textContent = `${speed} px/s`;
    sizeInput.value = String(size);
    sizeValue.textContent = `${size}%`;
  }

  function updateMotionMetrics() {
    suppressCollisionsUntil = performance.now() + 250;
    const viewportWidth = Math.max(1, document.documentElement.clientWidth);
    const viewportHeight = Math.max(1, document.documentElement.clientHeight);
    const desiredWidth = (size / 100) * Math.max(viewportWidth, viewportHeight);
    const logoWidth = Math.min(
      Math.max(64, desiredWidth),
      viewportWidth * 0.7,
      (viewportHeight * 0.7) / LOGO_ASPECT_RATIO
    );
    const logoHeight = logoWidth * LOGO_ASPECT_RATIO;
    const componentSpeed = speed / Math.SQRT2;
    const xDuration = Math.max(0.25, (viewportWidth - logoWidth) / componentSpeed);
    const yDuration = Math.max(0.25, (viewportHeight - logoHeight) / componentSpeed);

    root.style.setProperty('--logo-width', `${logoWidth}px`);
    root.style.setProperty('--x-duration', `${xDuration}s`);
    root.style.setProperty('--y-duration', `${yDuration}s`);

    if (!motionInitialized) {
      root.style.setProperty('--x-delay', `${-(Math.random() * xDuration * 2)}s`);
      root.style.setProperty('--y-delay', `${-(Math.random() * yDuration * 2)}s`);
      motionInitialized = true;
    }
  }

  function scheduleMotionMetricsUpdate() {
    if (motionMetricsFrame) return;
    motionMetricsFrame = requestAnimationFrame(() => {
      motionMetricsFrame = 0;
      updateMotionMetrics();
    });
  }

  function handleCollision(axis, event) {
    const expectedTarget = axis === 'x' ? xMover : yMover;
    if (event.target !== expectedTarget) return;

    const now = performance.now();
    if (now < suppressCollisionsUntil) return;
    const otherAxis = axis === 'x' ? 'y' : 'x';
    lastCollision[axis] = now;

    if (
      Math.abs(now - lastCollision[otherAxis]) <= CORNER_WINDOW_MS
      && now - lastCornerHit > 500
    ) {
      corners += 1;
      lastCornerHit = now;
      cornerCount.textContent = `Corner hits: ${corners}`;
      announce(`Perfect corner hit. Total corner hits: ${corners}.`);
    }
  }

  function syncPauseState() {
    const motionDisabled = reducedMotion.matches;
    root.classList.toggle('animation-paused', userPaused || document.hidden || motionDisabled);
    pauseButton.disabled = motionDisabled;
    pauseButton.textContent = motionDisabled ? 'Motion Reduced' : userPaused ? 'Resume' : 'Pause';
    pauseButton.setAttribute('aria-pressed', String(userPaused || motionDisabled));

    if (userPaused || motionDisabled) showControls({ keepVisible: true });
    else scheduleControlsHide();
  }

  function togglePause() {
    if (reducedMotion.matches) return;
    userPaused = !userPaused;
    syncPauseState();
    announce(userPaused ? 'Animation paused.' : 'Animation resumed.');
  }

  function resetConfiguration() {
    speed = DEFAULT_SPEED;
    size = DEFAULT_SIZE;
    schemeIndex = DEFAULT_SCHEME;
    usingCustomColors = false;
    userPaused = false;
    corners = 0;
    lastCollision.x = -Infinity;
    lastCollision.y = -Infinity;
    lastCornerHit = -Infinity;
    motionInitialized = false;

    const scheme = schemes[DEFAULT_SCHEME];
    applyColors(scheme.logo, scheme.background);
    updateControlValues();
    cornerCount.textContent = 'Corner hits: 0';
    syncPauseState();
    scheduleMotionMetricsUpdate();

    const url = new URL(window.location.href);
    url.search = '';
    window.history.replaceState({}, '', url);
    announce('Screensaver settings reset to their defaults.');
  }

  function fullscreenSupported() {
    return Boolean(document.fullscreenEnabled && root.requestFullscreen);
  }

  function syncFullscreenState() {
    const isFullscreen = document.fullscreenElement === root;
    fullscreenButton.textContent = isFullscreen ? 'Exit Full Screen' : 'Full Screen';
    fullscreenButton.setAttribute('aria-pressed', String(isFullscreen));
  }

  async function toggleFullscreen() {
    if (!fullscreenSupported()) {
      announce('Full-screen mode is not supported by this browser.');
      return;
    }

    try {
      if (document.fullscreenElement === root) await document.exitFullscreen();
      else await root.requestFullscreen();
    } catch (error) {
      announce(`Unable to change full-screen mode: ${error.message}`);
    }
  }

  function scheduleControlsHide() {
    window.clearTimeout(controlsHideTimer);
    if (userPaused || reducedMotion.matches) {
      root.classList.remove('controls-hidden');
      return;
    }

    controlsHideTimer = window.setTimeout(() => {
      root.classList.add('controls-hidden');
    }, CONTROLS_HIDE_DELAY_MS);
  }

  function showControls({ keepVisible = false } = {}) {
    root.classList.remove('controls-hidden');
    window.clearTimeout(controlsHideTimer);
    if (!keepVisible) scheduleControlsHide();
  }

  function isInteractiveTarget(target) {
    return target instanceof Element
      && Boolean(target.closest('button, input, select, textarea, a, [contenteditable="true"]'));
  }

  function handlePointerMove() {
    const now = performance.now();
    if (now - lastPointerActivity < 250) return;
    lastPointerActivity = now;
    showControls();
  }

  fullscreenButton.disabled = !fullscreenSupported();
  if (fullscreenButton.disabled) {
    fullscreenButton.title = 'Full-screen mode is not supported by this browser.';
  }

  fullscreenButton.addEventListener('click', () => {
    void toggleFullscreen();
  });

  colorButton.addEventListener('click', () => {
    advanceScheme({ announceChange: true, updateURL: true });
  });

  pauseButton.addEventListener('click', togglePause);
  resetButton.addEventListener('click', resetConfiguration);

  speedInput.addEventListener('input', event => {
    speed = Number(event.target.value);
    updateControlValues();
    scheduleMotionMetricsUpdate();
  });

  speedInput.addEventListener('change', () => {
    updateConfigurationURL();
    announce(`Movement speed set to ${speed} pixels per second.`);
  });

  sizeInput.addEventListener('input', event => {
    size = Number(event.target.value);
    updateControlValues();
    scheduleMotionMetricsUpdate();
  });

  sizeInput.addEventListener('change', () => {
    updateConfigurationURL();
    announce(`Logo size set to ${size} percent.`);
  });

  xMover.addEventListener('animationiteration', event => handleCollision('x', event));
  yMover.addEventListener('animationiteration', event => handleCollision('y', event));

  document.addEventListener('keydown', event => {
    showControls();
    if (event.repeat || isInteractiveTarget(event.target)) return;

    const key = event.key.toLowerCase();
    if (key === 'f') {
      event.preventDefault();
      void toggleFullscreen();
    } else if (key === 'c') {
      event.preventDefault();
      advanceScheme({ announceChange: true, updateURL: true });
    } else if (event.key === ' ') {
      event.preventDefault();
      togglePause();
    } else if (key === 'r') {
      event.preventDefault();
      resetConfiguration();
    }
  });

  document.addEventListener('pointermove', handlePointerMove, { passive: true });
  document.addEventListener('pointerdown', () => showControls(), { passive: true });
  document.addEventListener('visibilitychange', syncPauseState);
  document.addEventListener('fullscreenchange', () => {
    syncFullscreenState();
    scheduleMotionMetricsUpdate();
    announce(document.fullscreenElement === root
      ? 'Full-screen mode enabled.'
      : 'Full-screen mode exited.');
  });
  document.addEventListener('fullscreenerror', () => {
    announce('The browser could not change full-screen mode.');
  });

  reducedMotion.addEventListener?.('change', () => {
    syncPauseState();
    announce(reducedMotion.matches
      ? 'Animation disabled by the reduced-motion preference.'
      : 'Reduced-motion preference disabled. Animation resumed.');
  });

  window.addEventListener('resize', () => {
    scheduleMotionMetricsUpdate();
    syncFullscreenState();
  });

  applyInitialColors();
  updateControlValues();
  updateMotionMetrics();
  syncFullscreenState();
  syncPauseState();
  showControls();
})();
