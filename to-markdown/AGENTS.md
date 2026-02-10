# Repository Guidelines

## Project Structure & Module Organization
This repository is a small static web app for converting rich text to Markdown.

- `index.html`: App shell and UI layout.
- `script.js`: Main behavior (paste, sanitize, Turndown conversion, clipboard actions, shortcuts).
- `styles.css`: Responsive layout and theme styles.
- `manifest.json`: PWA metadata.
- `icon.svg`: App icon.

Keep feature logic in `script.js` grouped by purpose (sanitization, conversion rules, UI handlers). Keep markup changes in `index.html` minimal and pair UI changes with corresponding CSS updates.

## Build, Test, and Development Commands
No build step is required.

- `python -m http.server 8000`: Run locally at `http://localhost:8000`.
- `npx serve .`: Alternative static server if Node tooling is preferred.
- `node --check script.js`: Quick JavaScript syntax validation.

## Coding Style & Naming Conventions
- Use 4-space indentation in HTML, CSS, and JavaScript.
- Prefer `const`/`let`, semicolons, and single quotes in JavaScript.
- Use `camelCase` for JS identifiers (`pasteFromClipboard`, `simpleModeToggle`).
- Use descriptive IDs/classes in markup and styles (`#copySuccess`, `.button-group`).
- Keep CSS selectors specific to this app; avoid broad global overrides.

## Testing Guidelines
There is no automated test suite yet. Validate changes manually in Chromium and Firefox:

1. Paste rich text and confirm Markdown output updates.
2. Toggle Simplified mode and confirm formatting differences.
3. Verify copy/paste buttons and keyboard shortcuts (`Ctrl/Cmd+V`, `Ctrl/Cmd+Shift+V`).
4. Refresh and confirm PWA assets (`manifest.json`, `icon.svg`) still load.

When adding complex conversion rules, include reproducible sample input/output in the PR description.

## Commit & Pull Request Guidelines
Follow the existing commit style: concise, imperative summaries (for example, `Fix fresh PWA file-launch render`).

- Keep commits focused on one change.
- Reference impacted files/behaviors in the body when needed.
- PRs should include: purpose, user-visible changes, manual test steps, and screenshots for UI edits.
- Link related issues/tasks when available.
