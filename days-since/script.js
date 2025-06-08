// Set custom dates in the URL like this: /?name=Christmas&date=2019-12-24&primaryColor=FF0000&secondaryColor=00FF00&headerFontColor=00FF00&bodyFontColor=FFFFFF

function daysLeft(day){
  const today = resetTime(new Date()).getTime();
  const target = resetTime(day).getTime();
  
  const dayInMs = 1000 * 60 * 60 * 24;
  const daysLeft = Math.round((target - today) / dayInMs);

  return daysLeft;
}

function daysSince(day) {
  const today = resetTime(new Date()).getTime();
  const target = resetTime(day).getTime();
  
  const dayInMs = 1000 * 60 * 60 * 24;
  const daysSince = Math.round((today - target) / dayInMs);

  return daysSince;
}

function isAfterToday(day) {
  return day.getTime() > Date.now(); 
}

function changeYear(day, year) {
  const m = day.getMonth();
  const d = day.getDate();
  return new Date(year, m, d);
}

function resetTime(date) {
  date.setHours(0);
  date.setMinutes(0);
  date.setSeconds(0);
  
  return date;
}

function yyyymmddToDate(s) {
  const re = /(\d{4})-(\d{2})-(\d{2})/i;
  
  const results = re.exec(s);
  const y = results[1];
  const m = results[2];
  const d = results[3];
  
  return new Date(y, m - 1, d);
}

function getDayFromQuery(){
  const params = (new URL(document.location)).searchParams;
  
  if (params.get('name') && params.get('date')) {
    const name = params.get('name');
    const date = resetTime(yyyymmddToDate(params.get('date')));
    const headerFontColor = params.get('headerFontColor')
    const headerColor = params.get('headerColor');
    const bodyFontColor = params.get('bodyFontColor')
    const bodyColor = params.get('bodyColor');
    return { name, date, color: { headerFontColor, headerColor, bodyFontColor, bodyColor } };
  }
  
  return false;
}

function getDefaultColors() {
  const color = {
    headerFontColor: getColor('--headerFontColor'),
    headerColor:     getColor('--headerColor'),
    bodyFontColor:   getColor('--bodyFontColor'),
    bodyColor:       getColor('--bodyColor')
  };

  return color;
}

function setColors(colors) {
  const defaultColors = getDefaultColors();
  const definedColors = deleteEmptyKeys(colors);
  const combinedColors = {...defaultColors, ...definedColors};
  console.log(combinedColors);

  setColor('--headerFontColor', combinedColors.headerFontColor);
  setColor('--headerColor',     combinedColors.headerColor);
  setColor('--bodyFontColor',   combinedColors.bodyFontColor);
  setColor('--bodyColor',       combinedColors.bodyColor);
}

function setColor(prop, val) {
  if (prop && val) {
    const $html = document.querySelector('html');
    
    const key = prop.replace('--', '');
    document.querySelector(`#${key}`).value = val;
    
    return $html.style.setProperty(prop, val);
  }
}

function getColor(prop) {
  const color = getComputedStyle(document.body).getPropertyValue(prop).toString().trim();
  return color;
}

function hasOneOrMoreKeysSet(o) {
  const keys = Object.keys(o);
  
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    if (key) return true;
  }
  
  return false;
}

function setColorUpdate() {
  const inputs = [...document.querySelectorAll('input[type=color]')];
  inputs.forEach((input) => {
    input.oninput = updateLabel;
  });
}

//document.querySelector('input[type=color]').oninput = updateLabel;
//document.querySelector('input[type=color]').oninput = console.log;
function updateLabel(e) {
  const id = `--${e.target.id}`;
  const color = e.target.value;
  
  console.log({id, color});
  setColor(id, color);
}

function updateDateName(name, year) {
  document.querySelector('title').innerText   = document.querySelector('title').innerText.replace('{what}', name).replace('{when}', year);
  document.querySelector('.header').innerText = document.querySelector('.header').innerText.replace('{what}', name);  
}

function updateDaysLeft(daysLeft){
  document.querySelector('.days').innerHTML = daysLeft;
  document.querySelector('.days').style.setProperty('right', '0'); // Overrides `right` CSS and causes it to slide in to the left
}

function updateDaysSince(daysSince){
  document.querySelector('.days').innerHTML = daysSince;
  document.querySelector('.days').style.setProperty('right', '0'); // Overrides `right` CSS and causes it to slide in to the left
}

function update(day) {
  updateDateName(day.name, day.date.getFullYear());
  updateDaysSince(daysSince(day.date));

  populateDate(day.date);
  populateName(day.name);
  
  setColors(day.color);
}

function populateDate(date) {
  return document.querySelector('#date').value = dateFormat(date);
}

function populateName(name) {
  return document.querySelector('#name').value = name;
}

function dateFormat(date) {
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  
  return `${y}-${m}-${d}`;
}

function deleteEmptyKeys(o) {
  const oCopy = {...o};
  
  const keys = Object.keys(oCopy);
  keys.forEach(key => {
    if (!oCopy[key]) delete oCopy[key];
  });

  return oCopy;
}

function pad(s) {
  return s.toString().length === 1 ? '0' + s : s;
}

function main(){
  'use strict';
  
  setColorUpdate();
  const refreshInterval = 1000*60*5; // 5 minutes
  const queryDay = getDayFromQuery();
  const $container = document.querySelector('.container');
  
  const day = (queryDay ? queryDay : {
    name: $container.dataset.name,
    date: new Date($container.dataset.date)
  });
  
  setInterval(update.bind(null, day), refreshInterval);
  update(day);
}

main();