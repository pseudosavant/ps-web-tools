(() => {
  /* --- colour overrides from URL params --- */
  const params = new URLSearchParams(window.location.search);
  const root   = document.documentElement;

  const logoColor = params.get('logo-color');
  if (logoColor) root.style.setProperty('--logo-color', logoColor);

  const bgColor = params.get('background-color');
  if (bgColor) root.style.setProperty('--background-color', bgColor);

  /* --- fullscreen on (left) click --- */
  root.addEventListener('click', () =>
    !document.fullscreenElement ? root.requestFullscreen()
                                : document.exitFullscreen()
  );

  /* --- colour-scheme cycler on right-click --- */
  const schemes = [
    ['white', 'black'],
    ['black', 'white'],
    ['#ff69b4', 'black'],
    ['yellow', '#0033cc'],
    ['#39ff14', 'purple'],
    ['red', 'white'],
    ['cyan', 'navy'],
    ['orange', '#222'],
  ];
  let idx = 0;

  function applyScheme([logo, bg]) {
    root.style.setProperty('--logo-color', logo);
    root.style.setProperty('--background-color', bg);
  }

  document.addEventListener('contextmenu', e => {
    e.preventDefault();
    idx = (idx + 1) % schemes.length;
    applyScheme(schemes[idx]);
  });

  /* --- pause animations while tab is hidden --- */
  document.addEventListener('visibilitychange', () =>
    root.classList.toggle('paused', document.hidden)
  );
})();
