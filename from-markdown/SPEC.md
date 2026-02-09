# from-markdown SPEC

## 1. Product Intent
Build a companion tool to `to-markdown` named `from-markdown`.

- `to-markdown`: rich text/HTML -> Markdown
- `from-markdown`: Markdown -> rendered HTML

The two tools must feel like a matched pair in naming, layout, controls, keyboard shortcuts, visual style, and overall interaction model.

## 2. Scope
Create a static single-page web app (no backend) with the same file structure style as `to-markdown`:

- `index.html`
- `script.js`
- `styles.css`
- `manifest.json`
- `icon.svg`

Primary behavior:
- User pastes or types Markdown into the input pane.
- App auto-converts to HTML.
- Output pane shows rendered HTML preview (not escaped text).
- User can copy generated HTML source to clipboard.

## 3. UX and Layout Requirements
Mirror the existing `to-markdown` interface as closely as possible.

### 3.1 Page Structure
- Same top-level centered container and two-pane workspace.
- Same control bar placement above panes.
- Same responsive behavior:
  - Mobile: stacked panes.
  - Desktop/wide: side-by-side panes.

### 3.2 Headline and Labels
Use parallel naming:

- Title: `Markdown to HTML Converter`
- Input pane title: `Input Markdown`
- Output pane title: `Output HTML`

### 3.3 Controls (button order should match current tool)
1. Primary action button (green):
   - Label: `Convert to HTML`
   - Behavior: paste from clipboard -> convert -> copy HTML source
2. Secondary button:
   - Label: `Paste`
   - Behavior: paste clipboard content into Markdown input
3. Secondary button:
   - Label: `Copy HTML`
   - Behavior: copy generated HTML source (string) to clipboard
4. Danger button:
   - Label: `Clear`
   - Behavior: clear input and output
5. Toggle switch (right side, same visual style):
   - Label: `Sanitized` (default ON)
   - Behavior:
     - ON: sanitize generated HTML before rendering/copying
     - OFF: render raw parser output (still block obvious script execution in preview container via safe rendering strategy)

### 3.4 Feedback UI
- Keep same success and error message pattern and placement:
  - Success toast area: `Copied to clipboard!` (or `HTML copied to clipboard!`)
  - Error area for clipboard access failure with keyboard fallback hint.

### 3.5 Pairing Consistency Rules
The following should stay visually/functionally aligned with `to-markdown`:
- Color system and button classes (`success`, `secondary`, `danger`)
- Icon usage pattern (Font Awesome)
- Typography and spacing scale
- Tooltip behavior
- Shortcut model
- Debounced auto-conversion model

## 4. Functional Requirements

### 4.1 Markdown Input
- Input surface should support plain text editing cleanly (prefer `<textarea>` for Markdown fidelity; contenteditable allowed only if newline behavior is handled reliably).
- Placeholder text equivalent to current app messaging, e.g.:
  - `Paste your markdown here... Auto-converts as you type!`
- On manual input, auto-convert after debounce (~300ms).

### 4.2 Clipboard Paste
- Paste button should attempt async clipboard read.
- Preferred read order:
  1. `text/plain`
  2. `text/html` fallback converted to plain text when needed
- If async clipboard read unavailable/fails, show same error UX instructing `Ctrl/Cmd+V`.
- Intercept direct paste into input and normalize to plain text.

### 4.3 Conversion Pipeline
- Parse Markdown into HTML using a Markdown parser library (recommended: `marked` via CDN, pinned version + integrity).
- When `Sanitized` ON:
  - Sanitize output HTML (recommended: `DOMPurify` via CDN, pinned version + integrity).
- Render resulting HTML into output pane.
- Keep an internal `currentHtml` string that exactly matches what is rendered (or sanitized rendered output when toggle ON).

### 4.4 Output Behavior
- Output pane displays rendered HTML preview.
- Output pane should handle overflow and large content like current app.
- Keep output readable in light/dark color scheme.

### 4.5 Copy Behavior
- `Copy HTML` copies `currentHtml` source string, not rendered text.
- Use same resilient copy strategy:
  - Clipboard API first
  - `execCommand('copy')` fallback
- Show success/error messages with same timings as current tool.

### 4.6 Primary Button Behavior
`Convert to HTML` should:
1. Paste from clipboard
2. Convert Markdown to HTML
3. Copy resulting HTML source to clipboard

Same as current app’s “one-click pipeline,” but reversed domain.

### 4.7 Clear Behavior
- Clears input, rendered output, and transient success state.

## 5. Keyboard Shortcuts (mirror existing)
- `Ctrl/Cmd + V`: paste from clipboard
- `Ctrl/Cmd + Shift + V`: paste, convert, copy HTML
- `Ctrl/Cmd + Shift + C`: copy HTML
- `Ctrl/Cmd + Shift + X`: clear all

Notes:
- Preserve editable-element guard logic so native paste remains usable where expected.
- Keep shortcut help text in tooltips aligned with behavior.

## 6. Security Requirements
- Never execute script content from converted Markdown.
- Sanitize HTML by default (`Sanitized` ON).
- Remove/neutralize:
  - `<script>`, `<iframe>`, `<object>`, `<embed>`, inline event handlers (`on*`), and dangerous URLs (`javascript:`).
- If `Sanitized` OFF, still ensure preview insertion method does not permit script execution side effects beyond standard inert rendering expectations.

## 7. Accessibility and Usability
- Maintain keyboard operability for all controls.
- Keep visible focus style on input and controls.
- Preserve readable contrast in both light and dark system themes.
- Ensure mobile layout remains fully functional without hover tooltips.

## 8. PWA/Metadata Requirements
- `manifest.json` should mirror `to-markdown` structure with renamed app metadata:
  - Name: `Markdown to HTML Converter`
  - Short name aligned with pair naming
  - Updated description for reverse conversion
- Reuse icon strategy (`icon.svg`) and theme color parity.

## 9. Suggested Implementation Notes
- Reuse as much structural CSS as possible from `to-markdown`.
- Keep JS organized similarly:
  - element references
  - conversion helpers
  - clipboard helpers
  - shortcut bindings
  - initialization/tooltips
- Use pinned CDN dependencies with SRI hashes.

## 10. Acceptance Criteria
1. App looks and behaves like `to-markdown` with reversed conversion purpose.
2. Markdown input auto-renders to HTML preview.
3. `Copy HTML` reliably copies HTML source output.
4. `Convert to HTML` performs paste -> convert -> copy in one action.
5. Keyboard shortcuts match the current tool’s pattern.
6. Sanitization is ON by default and can be toggled.
7. Layout and controls feel like a deliberate sibling product.
8. Works on current desktop Chromium, Firefox, and Safari, plus mobile Chromium/Safari.

## 11. Non-Goals
- No server-side rendering.
- No file import/export in v1.
- No Markdown WYSIWYG editing in v1.
- No custom plugin ecosystem in v1.

