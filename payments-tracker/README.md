# Payments Tracker

Lightweight, zero‑build, vanilla HTML/CSS/JS tool for tracking one or more recurring fixed monthly payment series (loans, support, tuition, subscriptions, installment plans, etc.).

You can:

* Define payment series via URL parameters for quick sharing / bookmarking.
* Add / edit / delete payment series in the UI (URL auto‑updates without reload).
* See per‑series remaining payments & remaining amount.
* Optionally track progress already made (payments made & amount paid) by supplying a start date.
* View aggregate totals and an overall progress bar (if any series have a start date).

No persistence beyond the URL is used (deliberately simple & portable). Works offline once loaded (no network dependencies besides Font Awesome CDN for icons; you can inline or vendor it if desired).

---

## URL Format

Repeating query parameter: `?payments=`

Each value is a pipe‑delimited list of `key:value` pairs:

Keys (all lowercase):

| Key    | Required | Description |
|--------|----------|-------------|
| amount | Yes      | Dollar amount per payment (fixed). Parsed as float. Rounded to whole dollars for totals. |
| day    | Yes      | Day of month (1–28 only; >28 clamps to 28). |
| end    | Yes      | Inclusive end date (YYYY-MM-DD). Final scheduled payment is the occurrence on/before this date. |
| start  | No       | Inclusive start date (YYYY-MM-DD). If provided, progress (payments made / amount paid) is calculated. |
| name   | No       | Display label. If omitted, an automatic “Payment” / “Payment N” label is generated. |

Example (two series):

```text
?payments=amount:500|day:15|end:2026-06-15|start:2024-01-10|name:Car%20Loan&payments=amount:250|day:1|end:2025-12-01|name:Support
```

Encoding notes:

* Values after `name:` should be `encodeURIComponent` encoded (spaces → `%20`).
* `amount`, `day` must parse as positive numbers; invalid entries skip the series.
* Maximum series supported: 6 (additional are ignored with a footnote).

---

## UI Overview

Sections:

1. **Aggregate Summary** – Totals and (conditional) overall progress bar.
2. **Payment Cards** – One per series: dates, payments made (when applicable), paid amount, payments remaining, remaining amount, per‑series progress bar if computable.
3. **Add / Edit Form** – Hidden until toggled. Works for both creating and updating. Cancel reverts edit state.
4. **Footnotes** – Data quality and normalization notes (clamps, skips, ignored starts, limit truncation).

Buttons use icon + accessible label, with text condensed on very small screens. Form fields have autocomplete disabled intentionally.

---

## Adding / Editing via UI

1. Click “Add Payment”.
2. Enter Amount, Day, End Date (required). Optionally Name & Start Date.
3. Submit – card appears; URL updates with a new `payments=` param value.
4. Edit – click the pencil icon; form switches to edit mode (Save / Cancel). Deleting removes the corresponding param.

Because the URL is the single source of truth, manual edits to the address bar followed by Enter will re-render state instantly.

---

## Limits & Constraints

| Constraint | Reason |
|-----------|--------|
| Day ≤ 28  | Simplifies month alignment (no variable end-of-month handling). |
| Max 6 series | Prevents unwieldy URLs / layout overflow. |
| Monthly only | MVP scope (future: other frequencies). |
| No persistence | Shareable stateless design. |

---

## Example Bookmark

```text
payments-tracker/index.html?payments=amount:600|day:10|end:2026-09-10|start:2024-01-01|name:Tuition&payments=amount:120|day:5|end:2025-12-05|name:Subscription
```

Open the URL to restore both series instantly.

---

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| A series missing | Invalid or incomplete keys | Check amount/day/end validity. |
| Paid metrics absent | No start date | Add `start:` or edit & save. |
| Unexpected day shift | Day > 28 got clamped | Pick ≤ 28. |

Footnotes at bottom will usually explain anomalies.

---

## License

See repository root `LICENSE` (this subtool inherits the repo license).

---
