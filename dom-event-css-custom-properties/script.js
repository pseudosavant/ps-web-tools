/* Demo code */
function $(q) {
  return document.querySelector(q);
}

const $box = $('.box');

domEventToCSSVariable($box, 'offsetX');
domEventToCSSVariable($box, 'offsetY');
domEventToCSSVariable($box, 'offsetX', { event: 'click', cssVarName: 'last-click-x'});
domEventToCSSVariable($box, 'offsetY', { event: 'click', cssVarName: 'last-click-y'});

/*
Listen for `input` events on <input> and set a custom named
variable on `.box` with the <input> value
*/

domEventToCSSVariable($('.color-h'), 'value', {
  target: $box,
  event: 'input',
  cssVarName: 'color-h'
});

domEventToCSSVariable($('.color-s'), 'value', {
  target: $box,
  event: 'input',
  cssVarName: 'color-s'
});

domEventToCSSVariable($('.color-l'), 'value', {
  target: $box,
  event: 'input',
  cssVarName: 'color-l'
});

domEventToCSSVariable($('.blur'), 'value', {
  target: $box,
  event: 'input',
  cssVarName: 'blur'
});

/* Double-click element value examples */
domEventToCSSVariable($box, 'nodeName', {
  event: 'dblclick',
  once: true, // The value won't change so it only needs to be fired once
  transform: (val, el, e) => `<${val.toLowerCase()}>`, // `el` and `e` aren't used in this example. They are there to show the transform function signature.
  cssVarName: 'element'
});

domEventToCSSVariable($box, 'nodeType', {
  event: 'dblclick',
  once: true // The value won't change so it only needs to be fired once
});

domEventToCSSVariable($box, 'nodeType', {
  event: 'dblclick',
  once: true, // The value won't change so it only needs to be fired once
  stringify: true,
  cssVarName: 'nodeTypeString'
});

/* Crossfade example */
domEventToCSSVariable($('.amount'), 'value', {
  event: 'input',
  cssVarName: 'level',
  target: $('.crossfade')
});

domEventToCSSVariable($box, 'value', {
  event: 'contextmenu',
  preventDefault: true,
  transform: (val, el, e) => {
    el.addEventListener('click', () => el.style.setProperty('--contextmenu', ""), { once: true});
    
    return 1;
  },
  cssVarName: 'contextmenu'
});