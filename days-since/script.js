;(function () {
  'use strict';

  const DAY_IN_MS = 24 * 60 * 60 * 1000;
  const DEFAULT_HUE = 200;
  const refreshInterval = 1000 * 60 * 5;

  const toggle = document.querySelector('.config-toggle');
  const panel = document.querySelector('.config-panel');
  const nameInput = document.getElementById('name');
  const dateInput = document.getElementById('date');
  const themeInput = document.getElementById('themeHue');
  const resetButton = document.getElementById('reset-options');
  const daysElement = document.querySelector('.days');
  const whatElement = document.querySelector('.countdown-what');
  const whenElement = document.querySelector('.countdown-when');
  const extraElement = document.querySelector('.extra');

  function resetTime(date) {
    const target = new Date(date);
    target.setHours(0, 0, 0, 0);
    return target;
  }

  function today() {
    return resetTime(new Date());
  }

  function parseDate(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '');
    if (!match) return null;

    const year = Number(match[1]);
    const month = Number(match[2]) - 1;
    const day = Number(match[3]);
    const date = new Date(year, month, day);

    return date.getFullYear() === year && date.getMonth() === month && date.getDate() === day
      ? resetTime(date)
      : null;
  }

  function formatInputDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function formatLongDate(date) {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const dayNumber = date.getDate();
    const ordinal = dayNumber > 3 && dayNumber < 21
      ? 'th'
      : ({ 1: 'st', 2: 'nd', 3: 'rd' }[dayNumber % 10] || 'th');

    return `${days[date.getDay()]}, ${months[date.getMonth()]} ${dayNumber}${ordinal}, ${date.getFullYear()}`;
  }

  function utcDayNumber(date) {
    return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_IN_MS;
  }

  function daysBetween(firstDate, secondDate) {
    return Math.round(utcDayNumber(secondDate) - utcDayNumber(firstDate));
  }

  function weekdaysBetween(firstDate, secondDate) {
    const totalDays = daysBetween(firstDate, secondDate);
    const fullWeeks = Math.floor(totalDays / 7);
    let weekdays = fullWeeks * 5;

    for (let offset = fullWeeks * 7; offset < totalDays; offset += 1) {
      const day = new Date(
        firstDate.getFullYear(),
        firstDate.getMonth(),
        firstDate.getDate() + offset
      ).getDay();
      if (day !== 0 && day !== 6) weekdays += 1;
    }

    return weekdays;
  }

  function infoBetweenDates(firstDate, secondDate) {
    const days = daysBetween(firstDate, secondDate);
    return {
      weekdays: weekdaysBetween(firstDate, secondDate),
      weeks: (days / 7).toFixed(0),
      months: (days / (365 / 12)).toFixed(0),
      years: (days / 365).toFixed(1)
    };
  }

  function normalizedHue(value) {
    if (value === null || value === '') return DEFAULT_HUE;
    const hue = Number(value);
    return Number.isFinite(hue) && hue >= 0 && hue <= 360 ? hue : DEFAULT_HUE;
  }

  function defaultCountdown() {
    const current = today();
    const date = new Date(current);
    date.setFullYear(date.getFullYear() - 1);
    return { name: 'Important Day', date, themeHue: DEFAULT_HUE };
  }

  function countdownFromURL() {
    const params = new URL(window.location.href).searchParams;
    const name = params.get('name')?.trim();
    let date = parseDate(params.get('date'));
    const themeHue = normalizedHue(params.get('themeHue'));

    if (!name || !date) return defaultCountdown();

    const current = today();
    if (date > current) {
      date = new Date(current.getFullYear(), date.getMonth(), date.getDate());
      if (date > current) date.setFullYear(date.getFullYear() - 1);
    }

    return { name, date: resetTime(date), themeHue };
  }

  function setThemeHue(value) {
    const hue = normalizedHue(value);
    document.documentElement.style.setProperty('--theme-hue', hue);
    themeInput.value = hue;
  }

  function render(countdown) {
    const current = today();
    const daysSince = Math.max(0, daysBetween(countdown.date, current));
    const info = infoBetweenDates(countdown.date, current);

    document.title = `Days since ${countdown.name} ${formatLongDate(countdown.date)}`;
    daysElement.textContent = `${daysSince} days since`;
    daysElement.style.setProperty('right', '0');
    whatElement.textContent = countdown.name;
    whenElement.textContent = formatLongDate(countdown.date);
    extraElement.textContent = Object.entries(info)
      .map(([key, value]) => `${key}: ${value}`)
      .join(' | ');

    nameInput.value = countdown.name;
    dateInput.value = formatInputDate(countdown.date);
    dateInput.max = formatInputDate(current);
    setThemeHue(countdown.themeHue);
  }

  function setPanelOpen(open) {
    panel.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Hide options' : 'Show options');
    toggle.title = open ? 'Hide options' : 'Show options';
  }

  toggle.addEventListener('click', () => {
    setPanelOpen(!panel.classList.contains('open'));
  });

  themeInput.addEventListener('input', () => {
    countdown.themeHue = normalizedHue(themeInput.value);
    setThemeHue(countdown.themeHue);
  });

  resetButton.addEventListener('click', () => {
    const current = today();
    countdown = {
      name: 'New Years',
      date: new Date(current.getFullYear(), 0, 1),
      themeHue: 0
    };
    render(countdown);
    nameInput.focus();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && panel.classList.contains('open')) {
      setPanelOpen(false);
      toggle.focus();
    }
  });

  let countdown = countdownFromURL();
  render(countdown);
  window.setInterval(() => render(countdown), refreshInterval);
})();
