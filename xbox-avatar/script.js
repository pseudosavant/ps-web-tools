(async function globalIIFE(){
  'use strict';
  
  // Remove any filtering/toggling logic, just show all images
  var gamertag = document.querySelector('.gamertag').value;
  updateImages(gamertag);

  document.querySelector('.gamertag').addEventListener('keyup', throttle(update, 500), false);

  // Add error handler for all images
  document.querySelectorAll('img').forEach(img => {
    img.addEventListener('error', failedToLoadImage, false);
  });

  function update(e) {
    const gamertag = e.target.value;
    updateImages(gamertag);
    updateFavicon(gamertag);
  }
  
  function failedToLoadImage(e) {
    e.target.classList.add('failed-to-load');
    // Also add to parent figure to hide label if desired
    if (e.target.parentElement && e.target.parentElement.parentElement && e.target.parentElement.parentElement.tagName === 'FIGURE') {
      e.target.parentElement.parentElement.classList.add('failed-to-load');
    }
  }

  function updateImages(gamertag) {  
    const types = ['small', 'large', 'extra-large', 'body', 'head', 'default'];
    types.forEach(type => {
      const img = document.querySelector(`img.${type}`);
      // Find the parent figure (img > a > figure)
      const figure = img && img.parentElement && img.parentElement.parentElement && img.parentElement.parentElement.tagName === 'FIGURE'
        ? img.parentElement.parentElement
        : null;
      if (img) {
        img.classList.remove('failed-to-load');
        if (figure) {
          figure.classList.remove('failed-to-load');
        }
        img.style.display = '';
        const url = avatar(type, gamertag);
        img.src = url;
        if (img.parentElement && img.parentElement.tagName === 'A') {
          img.parentElement.href = url;
        }
      }
    });
  }
  
  function updateFavicon(gamertag) {
    document.querySelector('link[rel*=shortcut]').href = avatar('small', gamertag);
  }
  
  function avatar(avatarType, gamertag) {
    if (typeof avatarType !== 'string' || typeof gamertag !== 'string') return undefined;

    const base = `https://avatar-ssl.xboxlive.com/avatar/${gamertag}`;
    switch(avatarType) {
      case 'large':
        return `${base}/avatarpic-l.png`;
      case 'small':
        return `${base}/avatarpic-s.png`;
      case 'extra-large':
        return `${base}/avatarpic-xl.png`;
      case 'body':
        return `${base}/avatar-body.png`;
      case 'head':
        return `${base}/avatar-head.png`;
      case 'default':
        return `${base}/avatarpic.png`;
      default:
        return `${base}/avatar-body.png`;
    }
  }
  
  function throttle(fn, duration) {
    var t;
    return function(...args) {
      clearTimeout(t);
      t = setTimeout(fn.bind(null, ...args), duration);
    }
  };
})();