# Worth‑the‑Time Table

A tiny, framework‑free web app that recreates the XKCD #1205 table, but with a configurable payoff window (horizon). It computes the break‑even maximum time worth investing to automate or improve a task.

Live locally: open `worth-it/index.html` in your browser.

## Formula

max_invest_time = time_saved_per_run × runs_per_year × horizon_years

- time_saved_per_run (Y axis)
- runs_per_year (X axis)
- horizon_years (controls: default 5, adjustable)

Calendar vs Workdays modes:
- Calendar: daily=365, weekly=52
- Workdays: daily=250 (5d×50wk), weekly=50
- Monthly=12, Yearly=1 in both modes; N/day scales by 365 or 250; N/week by 52 or 50.

## Features
- Presets plus custom rows/columns
- Rounded display in cells; exact values shown in tooltips
- Tooltips with formula, seconds, and runs/year
- Automatic sorting (rows ascending by time saved; columns descending by frequency)
- Shareable state in the URL hash (base64‑url JSON)
- Accessible semantic table, keyboard navigation
- Print‑friendly output

## State encoding
The hash encodes a compact JSON:

```
{
  h: number,        // horizon years
  m: "calendar"|"workdays",
  y: [{label, seconds}],
  x: [{label, perYear}]
}
```

Notes:
- Rounding mode is fixed to rounded in the UI; exact values are available in the tooltip. Legacy links with an `r` field are still accepted and ignored.
- When loading from a saved link, columns reconstructed from state use the fixed perYear values. Preset and custom per‑day/week columns added within the app will respond to mode changes.

## Development
- No build step or deps. Vanilla JS/CSS/HTML.
- Open `index.html` directly or serve statically.

## License and attribution
- Code: MIT License.
- Inspired by XKCD #1205: https://xkcd.com/1205/ (independent, educational recreation).