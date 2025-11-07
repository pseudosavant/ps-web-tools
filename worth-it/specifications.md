# Worth-the-Time Table – Specifications

Goal: a tiny, framework-free web app that recreates the XKCD #1205 table but with a configurable payoff window. Default horizon is 5 years, but users can pick 1–10 years or set a custom value. The app computes the break-even **maximum time worth investing** to automate or improve a task.

## 1. Core formula

```
max_invest_time = time_saved_per_run * runs_per_year * horizon_years
```

* `time_saved_per_run` – from the Y axis list
* `runs_per_year` – from the X axis list
* `horizon_years` – user-selected payoff window

Use **workdays** by default (5 days/week × 50 weeks/year = 250 workdays). Calendar mode is available as a toggle.

In calendar mode:

* daily = 365/yr
* weekly = 52/yr
* monthly = 12/yr
* yearly = 1/yr
* N/day = N * 365/yr (or N * 250/yr in workdays mode)

Optional toggle: **Workdays** (assume 5 days/week, 50 weeks/year = 250 workdays).

## 2. Ranges and presets

Y axis – “How much time you shave off” presets:

* 1s, 5s, 30s, 1m, 5m, 30m, 1h, 6h, 1d
* Allow custom values (seconds to days). Clamp 0 < value ≤ 7 days.

X axis – “How often you do the task” presets:

* 50/day, 5/day, daily, weekly, monthly, yearly
* Allow custom cadence:

  * Per-day: integer 1–200
  * Per-week: integer 1–100
  * Per-month: integer 1–100
  * Per-year: integer 1–10,000
* For custom: compute `runs_per_year` from unit.

Horizon

* Slider 1–10 years, default 5
* Numeric input for decimals (e.g., 2.5)

## 3. Table output

Each cell shows the **max time worth investing** for that combination, rendered as a human string.

### Units and formatting

* Base unit is seconds. Convert upward using:

  * 60 s = 1 minute
  * 60 m = 1 hour
  * 24 h = 1 day
  * 7 d = 1 week
  * 30 d = 1 month
  * 365 d = 1 year
* Short labels: `s, min, h, d, wk, mo, yr`
* Never show 0. Use `< 1 s` if result rounds to 0.

### Rounding behavior

Conservative rounded display (always on) floors to “nice” steps to avoid over‑promising:

   * < 1 min → floor to 1 s
   * 1–60 min → floor to nearest 1 min
   * 1–4 h → floor to nearest 5 min
   * 4–24 h → floor to nearest 15 min
   * 1–14 d → floor to nearest 1 h
   * 2–8 wk → floor to nearest 1 d
   * 2–24 mo → floor to nearest 1 wk
   * ≥ 2 yr → floor to nearest 1 mo

Tooltips show the exact value with up to 2 significant units, e.g., `21 h 43 min`.

### Empty and capped cells

* If result ≥ 10 years, gray the cell and show `> 10 yr` with tooltip including the exact value.
* If result < 1 second, show `< 1 s`.

### Tooltips

Hover shows:

* formula with inputs
* exact seconds
* runs/year value after applying the frequency mode

## 4. UI layout

* Header: title, short one-line description.
* Controls panel (top or left on wide screens, collapsible on small screens):

  * Horizon slider + numeric input
  * Frequency mode radio: Calendar vs Workdays
  * Preset pickers for X and Y lists
  * “Add custom row/column” buttons
  * Reset to defaults
* Table area:

  * Sticky row and column headers
  * Responsive grid that scrolls if needed
  * Zebra striping and soft borders
* Footer:

  * Link to XKCD #1205 and a short explanation of the math
  * License notice

## 5. Interactions

* Adding a custom row/column opens a compact inline form:

  * Row: label + duration input (supports `1.5m`, `90s`, `2h`, `1d`)
  * Column: label + cadence input with unit selector (`per day`, `per week`, etc.)
* Rows/columns automatically sort (rows ascending by seconds saved; columns descending by runs/year).
* Shareable state via URL hash (see section 8).
* Print and PDF friendly layout.

## 6. Accessibility

* Semantic HTML for table (`<table>`, `<thead>`, `<th scope="col|row">`, `<caption>`).
* Keyboard navigation across cells.
* Maintain high contrast through color choices; no separate high‑contrast toggle.
* ARIA labels for controls and tooltips.
* Do not convey meaning by color only. Use icons or text as well.

## 7. Performance and footprint

* Vanilla JS, no build step required.
* Single page ≤ 50 KB gzipped for HTML+CSS+JS combined.
* No external fonts by default.
* Instant recalculation on input with O(rows × cols) per update.

## 8. State and share links

* All state encoded in `location.hash` as a compact JSON string base64-url:

  * `h` horizon (float years)
  * `m` mode (`"calendar"` or `"workdays"`)
  * `y` array of row items: `{label, seconds}`
  * `x` array of col items: `{label, perYear}`
* On load, parse hash if present. Otherwise, use defaults.
* Copy link button writes the current URL to clipboard.

## 9. Validation rules

* Duration parser accepts forms like `90s`, `1.5m`, `2h`, `1d`, case-insensitive.
* Cadence forms:

  * `N/day`, `N/week`, `N/month`, `N/year`
* Clamp unreasonable inputs and show inline error text.

## 10. Default data

Rows (seconds):

* 1s, 5s, 30s, 60s, 300s, 1800s, 3600s, 21600s, 86400s

Columns (runs/year, calendar mode):

* 50/day → 18250
* 5/day → 1825
* daily → 365
* weekly → 52
* monthly → 12
* yearly → 1

Horizon

* 5 years

Mode

* Rounded (implicit), Workdays

## 11. Visual design

* Clean, neutral, high-legibility system font stack.
* Table cells show a large primary value, with a tiny sublabel for units if needed.
* Cells that exceed cap use muted background with `>` marker.
* Tooltips use a simple positioned `<div>` with focus trapping for keyboard users.

## 12. File structure

```
/index.html
/styles.css
/app.js
/README.md
/specifications.md  (this file)
```

No bundlers or frameworks.

## 13. Implementation outline

`app.js`

* Parse defaults and URL state.
* Data model: `rows[]`, `cols[]`, `settings{horizonYears, freqMode}`.
* Utility functions:

  * `parseDuration(str) -> seconds`
  * `parseCadence(value, unit) -> runsPerYear`
  * `runsPerYearFromPreset(label, freqMode) -> number`
  * `computeMaxInvest(secondsSaved, runsPerYear, horizonYears) -> seconds`
  * `formatRounded(seconds) -> parts`, `formatExact(seconds) -> parts`
  * `encodeState(state) -> hash`
  * `decodeState(hash) -> state`
* Render functions:

  * `renderControls()`, `renderTable()`, `renderTooltips()`
* Event handlers update state, recompute table, update hash.

`styles.css`

* CSS variables for spacing and colors.
* Responsive rules: controls collapse above the table on narrow screens.
* Print styles: white background, 1px borders, page breaks avoided.

## 14. Tests and spot checks

Manual checks in the browser console:

* 1s saved, daily, 5 yr → 1 * 365 * 5 = 1825 s ≈ 30 min
* 5 min saved, weekly, 5 yr → 300 * 52 * 5 = 78,000 s ≈ 21.6 h
* 30 s saved, 50/day, 2 yr → 30 * (50 * 365) * 2 = 1,095,000 s ≈ 12.6 d
* Toggle Workdays for daily 1/day → 250/yr

Verify that rounded output floors to a “nice” value and the tooltip shows two units for the exact value.

## 15. Privacy and network

* 100 percent client side. No network calls. No analytics.

## 16. License and attribution

* MIT License for the code.
* Include a footer note crediting XKCD #1205 and linking to the original comic. Make clear this app is an independent, educational recreation.
