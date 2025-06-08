(function(){
  'use strict';
  
  var frame = 0;
  const startTime = performance.now();
  const $frameCount = document.querySelector('.frame-count');
  const $timestamp = document.querySelector('.timestamp');
  
  const incrementFrame = () => $frameCount.innerHTML = frame++;
  
  function step(timestamp) {
    incrementFrame();
    $timestamp.innerHTML = Math.round(timestamp - startTime);
    window.requestAnimationFrame(step);
  }
  
  step(performance.now());
})();