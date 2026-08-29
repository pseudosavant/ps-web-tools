;(function () {
  'use strict';

  const DAY_IN_MS = 24 * 60 * 60 * 1000;
  const toggle = document.getElementById('config-toggle');
  const panel = document.getElementById('config-panel');
  const nameInput = document.getElementById('name');
  const dateInput = document.getElementById('date');
  const resetButton = document.getElementById('reset-options');
  const countElement = document.getElementById('day-count');
  const nameElement = document.getElementById('event-name');
  const dateElement = document.getElementById('event-date');
  const extraElement = document.getElementById('extra');
  const statusElement = document.getElementById('page-status');

  const longDate = new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  function startOfToday() {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), today.getDate());
  }

  function defaultSelection() {
    const today = startOfToday();
    return {
      name: "New Year's Day",
      date: new Date(today.getFullYear(), 0, 1)
    };
  }

  function parseDate(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '');
    if (!match) return null;

    const year = Number(match[1]);
    const month = Number(match[2]) - 1;
    const day = Number(match[3]);
    const date = new Date(year, month, day);

    if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) {
      return null;
    }

    return date;
  }

  function formatInputDate(date) {
    const year = String(date.getFullYear()).padStart(4, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function utcDayNumber(date) {
    return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_IN_MS;
  }

  function daysBetween(start, end) {
    return Math.round(utcDayNumber(end) - utcDayNumber(start));
  }

  function weekdaysBetween(start, totalDays) {
    let weekdays = Math.floor(totalDays / 7) * 5;
    const fullWeekDays = Math.floor(totalDays / 7) * 7;

    for (let offset = fullWeekDays; offset < totalDays; offset += 1) {
      const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + offset);
      if (date.getDay() !== 0 && date.getDay() !== 6) weekdays += 1;
    }

    return weekdays;
  }

  function plural(value, singular) {
    return `${value} ${singular}${value === 1 ? '' : 's'}`;
  }

  function render(selection, message = '') {
    const today = startOfToday();
    const elapsedDays = daysBetween(selection.date, today);
    const weekdays = weekdaysBetween(selection.date, elapsedDays);

    countElement.textContent = plural(elapsedDays, 'day');
    nameElement.textContent = selection.name;
    dateElement.textContent = longDate.format(selection.date);
    dateElement.dateTime = formatInputDate(selection.date);
    extraElement.textContent = [
      plural(weekdays, 'weekday'),
      `${(elapsedDays / 7).toFixed(1)} weeks`,
      `${(elapsedDays / (365.2425 / 12)).toFixed(1)} months`,
      `${(elapsedDays / 365.2425).toFixed(2)} years`
    ].join(' · ');
    statusElement.textContent = message;
    document.title = `Days since ${selection.name} — ${longDate.format(selection.date)}`;

    nameInput.value = selection.name;
    dateInput.value = formatInputDate(selection.date);
    dateInput.max = formatInputDate(today);
  }

  function selectionFromURL() {
    const defaults = defaultSelection();
    const params = new URL(window.location.href).searchParams;
    const requestedName = params.get('name')?.trim();
    const requestedDateValue = params.get('date');
    const requestedDate = parseDate(requestedDateValue);

    if (!requestedName && !requestedDateValue) return { selection: defaults, message: '' };

    if (!requestedName || !requestedDate) {
      return {
        selection: defaults,
        message: 'The saved countdown was incomplete, so the default is shown.'
      };
    }

    if (requestedDate > startOfToday()) {
      return {
        selection: defaults,
        message: 'Days Since needs a date that is today or earlier.'
      };
    }

    return {
      selection: { name: requestedName.slice(0, 80), date: requestedDate },
      message: ''
    };
  }

  function setPanel(open) {
    panel.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Hide options' : 'Show options');
    if (open) nameInput.focus();
  }

  toggle.addEventListener('click', () => {
    setPanel(toggle.getAttribute('aria-expanded') !== 'true');
  });

  resetButton.addEventListener('click', () => {
    const defaults = defaultSelection();
    window.history.replaceState({}, '', window.location.pathname);
    render(defaults, 'Countdown reset to the start of this year.');
    nameInput.focus();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !panel.hidden) {
      setPanel(false);
      toggle.focus();
    }
  });

  const initial = selectionFromURL();
  render(initial.selection, initial.message);

  window.setInterval(() => {
    const currentDate = parseDate(dateInput.value);
    if (currentDate && currentDate <= startOfToday()) {
      render({ name: nameInput.value.trim() || 'An important day', date: currentDate });
    }
  }, 60 * 1000);
})();
