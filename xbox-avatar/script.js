(async function globalIIFE(){
  'use strict';
  
  var gamertag = document.querySelector('.gamertag').value;
  updateImages(gamertag);
  
  document.querySelector('.gamertag').addEventListener('keyup', throttle(update, 500), false);

  function update(e) {
    const gamertag = e.target.value;
    
    updateImages(gamertag);
    updateFavicon(gamertag);
  }
  
  function failedToLoadImage(e) {
    e.target.style.display = 'none';
  }
  
  function updateImages(gamertag) {  
    const imgs = [...document.querySelectorAll('img')];
    imgs.forEach((img) => img.src = avatar(img.className, gamertag));
  }
  
  function updateFavicon(gamertag) {
    console.log(`0: ${gamertag}`)
    document.querySelector('link[rel*=shortcut]').href = avatar('small', gamertag);
  }
  
  function avatar(avatarType, gamertag) {
    if (typeof avatarType !== 'string' || typeof gamertag !== 'string') return undefined;

    const base = `https://avatar-ssl.xboxlive.com/avatar/${gamertag}`;
    
    switch(avatarType) {
      case 'large':
        return `${base}/avatarpic-l.png`;
        break;
      case 'small':
        return `${base}/avatarpic-s.png`;
        break;
      case 'extra-large':
        return `${base}/avatarpic-xl.png`;
        break;
      case 'body':
      default:
        return `${base}/avatar-body.png`;
        break;
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