// Set custom dates in the URL like this: /?name=Christmas&date=2019-12-24&primaryColor=FF0000&secondaryColor=00FF00&headerFontColor=00FF00&bodyFontColor=FFFFFF
const infoBetweenDates = (date1, date2) => {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    
    const days = daysLeft(d1, d2);
    const weekdays = weekdaysLeft(d1, d2);
    
    const sundays = dayOfWeekLeft(d1, d2, 0);
    const mondays = dayOfWeekLeft(d1, d2, 1);
    const tuesdays = dayOfWeekLeft(d1, d2, 2);
    const wednesdays = dayOfWeekLeft(d1, d2, 3);
    const thursdays = dayOfWeekLeft(d1, d2, 4);
    const fridays = dayOfWeekLeft(d1, d2, 5);
    const saturdays = dayOfWeekLeft(d1, d2, 6);
    const daysOfWeek = { sundays, mondays, tuesdays, wednesdays, thursdays, fridays, saturdays };
  
    const weeks = weeksLeft(d1, d2);
    const months = monthsLeft(d1, d2);
    const years = yearsLeft(d1, d2);
    
    const data = {
      weekdays,
      weeks: weeks.toFixed(0),
      months: months.toFixed(0),
      years: years.toFixed(1)
    };
    return data;
  }
  
  const daysLeft = (firstDate, secondDate) => {
    const d1 = new Date(Math.min(firstDate, secondDate));
    const d2 = new Date(secondDate ? Math.max(firstDate, secondDate) : new Date());
    
    const d1InMs = resetTime(d1).getTime();
    const d2InMs = resetTime(d2).getTime();
    
    const dayInMs = 1000 * 60 * 60 * 24;
    const days = Math.round((d2InMs - d1InMs) / dayInMs);
  
    return days;
  }
  
  const weeksLeft = (firstDate, secondDate) => {
    const d1 = new Date(firstDate);
    const d2 = new Date(secondDate);
    const days = daysLeft(d1, d2);
    return days / 7;
  }
  
  const monthsLeft = (firstDate, secondDate) => {
    const d1 = new Date(firstDate);
    const d2 = new Date(secondDate);
    const days = daysLeft(d1, d2);
    const monthInDays = 365 / 12;
    return days / monthInDays;
  }
  
  const yearsLeft = (firstDate, secondDate) => {
    const d1 = new Date(firstDate);
    const d2 = new Date(secondDate);
    const days = daysLeft(d1, d2);
    return days / 365;
  }
  
  const weekdaysLeft = (firstDate, secondDate) => xdaysLeft(firstDate, secondDate, [0,1,1,1,1,1,0]);
  
  const dayOfWeekLeft = (firstDate, secondDate, dayOfWeek) => {
    const days = [0,0,0,0,0,0,0];
    days[dayOfWeek] = 1;
    return xdaysLeft(firstDate, secondDate, days)
  }
  
  const xdaysLeft = (firstDate, secondDate, days = [0,0,0,0,0,0,0]) => {
    const d1 = new Date(Math.min(firstDate, secondDate));
    const d2 = new Date(secondDate ? Math.max(firstDate, secondDate) : new Date());
    
    const daysRemaining = daysLeft(d1, d2);
    const mod = daysRemaining % 7;
    const weeks = (daysRemaining - mod) / 7;
    const daysInWeek = days.reduce((pv, cv) => pv + cv, 0);
    const weeksWeekdays = weeks * daysInWeek;
  
    let remainingDaysOfWeek = 0;
    for (let i = 0; i < mod; i++) {
      const dayOfWeek = futureDayOfWeek(d1, i);
      remainingDaysOfWeek += days[dayOfWeek];
    }
  
    return weeksWeekdays + remainingDaysOfWeek; 
  }
  
  const futureDayOfWeek = (day, days) => {
    const d = new Date(day);
    const dayInMs = 24 * 60 * 60 * 1000;
    const futureDateMs = d.valueOf() + (dayInMs * days);
    const futureDate = new Date(futureDateMs);
    return futureDate.getDay();
  }
  
  const isAfterToday = (day) => day.getTime() > Date.now();
  
  const changeYear = (day, year) => {
    const d = new Date(day);
    const month = d.getMonth();
    const dayOfMonth = d.getDate();
    return new Date(year, month, dayOfMonth);
  }
  
  const resetTime = (date) => {
    const target = new Date(date);
    target.setHours(0);
    target.setMinutes(0);
    target.setSeconds(0);
    
    return target;
  }
  
  const yyyymmddToDate = (s) => {
    const re = /(\d{4})-(\d{2})-(\d{2})/i;
    
    const results = re.exec(s);
    const y = results[1];
    const m = results[2];
    const d = results[3];
    
    return new Date(y, m - 1, d);
  }

  const getDayFromQuery = () => {
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
  
  const getDayFromHTML = () => {
  // Updated for new layout: find .header-text and .days for info
  const nameElem = document.querySelector('.header-text');
  const dateInput = document.querySelector('#date');
  let name = nameElem ? nameElem.textContent.replace(/^Days Until\s*/i, '') : '';
  let date = dateInput ? resetTime(new Date(dateInput.value)) : null;

  // Fallback: try to get from .days data attribute if you add one
  if (!name && document.title.includes('{what}')) {
    name = 'Important Day';
  }
  if (!date || isNaN(date.getTime())) {
    // fallback to today
    date = resetTime(new Date());
  }
  return { name, date };
}
  
  const getDefaultColors = () => {
    const color = {
      headerFontColor: getColor('--headerFontColor'),
      headerColor:     getColor('--headerColor'),
      bodyFontColor:   getColor('--bodyFontColor'),
      bodyColor:       getColor('--bodyColor')
    };
  
    return color;
  }
  
  const setColors = (colors) => {
    const defaultColors = getDefaultColors();
    const definedColors = deleteEmptyKeys(colors);
    const combinedColors = {...defaultColors, ...definedColors};
  
    setColor('--headerFontColor', combinedColors.headerFontColor);
    setColor('--headerColor',     combinedColors.headerColor);
    setColor('--bodyFontColor',   combinedColors.bodyFontColor);
    setColor('--bodyColor',       combinedColors.bodyColor);
  }
  
  const setColor = (prop, val) => {
    if (prop && val) {
      const $html = document.querySelector('html');
      
      const key = prop.replace('--', '');
      document.querySelector(`#${key}`).value = val;
      
      return $html.style.setProperty(prop, val);
    }
  }
  
  const getColor = (prop) => getComputedStyle(document.body).getPropertyValue(prop).toString().trim();
  
  const hasOneOrMoreKeysSet = (o) => {
    const keys = Object.keys(o);
    
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      if (key) return true;
    }
    
    return false;
  }
  
  const setColorUpdate = () => {
    const inputs = [...document.querySelectorAll('input[type=color]')];
    inputs.forEach((input) => {
      input.oninput = updateLabel;
    });
  }
  
  const updateLabel = (e) => {
    const id = `--${e.target.id}`;
    const color = e.target.value;
    setColor(id, color);
  }
  
  const updateDateName = (name, date) => {
    document.querySelector('title').innerText = `Days until ${name} ${formatLongDate(date)}`;
    const whatElem = document.querySelector('.countdown-what');
    const whenElem = document.querySelector('.countdown-when');
    if (whatElem) whatElem.innerText = name;
    if (whenElem) whenElem.innerText = formatLongDate(date);
  }
  
  function formatLongDate(date) {
    // e.g. Monday, October 31st, 2026
    const d = new Date(date);
    const days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
    const months = [
      "January","February","March","April","May","June",
      "July","August","September","October","November","December"
    ];
    const dayName = days[d.getDay()];
    const monthName = months[d.getMonth()];
    const dayNum = d.getDate();
    const year = d.getFullYear();
    const ordinal = (n) => {
      if (n > 3 && n < 21) return 'th';
      switch (n % 10) {
        case 1: return 'st';
        case 2: return 'nd';
        case 3: return 'rd';
        default: return 'th';
      }
    };
    return `${dayName}, ${monthName} ${dayNum}${ordinal(dayNum)}, ${year}`;
  }
  
  const updateDaysLeft = (daysLeft) => {
    document.querySelector('.days').innerHTML = `${daysLeft} days until`;
    document.querySelector('.days').style.setProperty('right', '0'); // Overrides `right` CSS and causes it to slide in to the left
  }
  
  const updateExtras  = (startDate, endDate) => {
    const info = infoBetweenDates(startDate, endDate);
    const entries = Object.entries(info);
    
    const html = entries
      .map(([key, value]) => `${key}: ${value}`)
      .join(' | ');

    document.querySelector('.extra').innerHTML = html;
  };
  
  const update = (day) => {
    const start = day.date;
    const end = new Date();
    updateDateName(day.name, start);
    updateDaysLeft(daysLeft(start, end));
    updateExtras(start, end);
    populateDate(start);
    populateName(day.name);

    const info = infoBetweenDates(day.date, new Date());
    console.log(info);
    
    setColors(day.color);
  }
  
  const populateDate = (date) => document.querySelector('#date').value = dateFormat(date);
  const populateName = (name) => document.querySelector('#name').value = name;
  
  const dateFormat = (date) => {
    const y = date.getFullYear();
    const m = pad(date.getMonth() + 1);
    const d = pad(date.getDate());
    
    return `${y}-${m}-${d}`;
  }
  
  const deleteEmptyKeys = (o) => {
    const oCopy = {...o};
    
    const keys = Object.keys(oCopy);
    keys.forEach(key => {
      if (!oCopy[key]) delete oCopy[key];
    });
  
    return oCopy;
  }
  
  const pad = (s) => s.toString().length === 1 ? '0' + s : s;
  
  const main = () => {
    'use strict';
    
    setColorUpdate();
    const refreshInterval = 1000*60*5; // 5 minutes
    const queryDay = getDayFromQuery();
    const $container = document.querySelector('.container');
    
    const day = (queryDay ? queryDay : getDayFromHTML());
    
    day.date = (isAfterToday(day.date) ? day.date : changeYear(day.date, new Date().getFullYear() + 1));

    setInterval(update.bind(null, day), refreshInterval);
    update(day);
  }
  
  main();