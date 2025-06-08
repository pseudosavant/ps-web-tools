(() => {
  const $el = document.documentElement;
  $el.addEventListener('click', () => (!document.fullscreenElement ? $el.requestFullscreen() : document.exitFullscreen()), false);
})();
