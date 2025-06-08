(() => {
  // Set logo color and background color from URL parameters if present
  const params = new URLSearchParams(window.location.search);
  const logoColor = params.get('logo-color');
  if (logoColor) {
    document.documentElement.style.setProperty('--logo-color', logoColor);
  }
  const backgroundColor = params.get('background-color');
  if (backgroundColor) {
    document.documentElement.style.setProperty('--background-color', backgroundColor);
  }

  const $el = document.documentElement;
  $el.addEventListener('click', () => (!document.fullscreenElement ? $el.requestFullscreen() : document.exitFullscreen()), false);

  // Color scheme options: [logoColor, backgroundColor]
  const colorSchemes = [
    ['white', 'black'],      // White on black
    ['black', 'white'],      // Black on white
    ['#ff69b4', 'black'],    // Neon pink on black (vaporwave)
    ['yellow', '#0033cc'],   // Yellow on blue (classic DVD)
    ['#39ff14', 'purple'],   // Lime green on purple (quirky)
    ['red', 'white'],        // Red on white (bold)
    ['cyan', 'navy'],        // Cyan on navy (modern)
    ['orange', '#222'],      // Orange on dark gray (warm)
  ];
  let colorIndex = 0;

  function applyColorScheme(index) {
    const [logo, bg] = colorSchemes[index];

    document.querySelectorAll('.logo svg').forEach(svg => {
      svg.style.fill = '';
      svg.style.background = '';
      svg.style['-webkit-background-clip'] = '';
      svg.style['-webkit-text-fill-color'] = '';
      svg.style.filter = '';
      svg.style.animation = '';
    });
    document.documentElement.style.setProperty('--logo-color', logo);
    document.documentElement.style.setProperty('--background-color', bg);
  }

  // Right-click cycles color schemes
  document.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    colorIndex = (colorIndex + 1) % colorSchemes.length;
    applyColorScheme(colorIndex);
  });
})();
