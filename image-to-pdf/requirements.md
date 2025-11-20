## Project Summary

Build a browser-based "Image to PDF" web tool that lets users load multiple PNG and JPEG images, visually arrange them, optionally optimize them, and download a single multi-page PDF. The tool must run entirely in the browser using vanilla HTML/CSS/JS and be packaged as a basic PWA (no offline behavior required).

## Functional Requirements

### 1. Image Import
- **Supported formats:** Accept `.png`, `.jpg`, `.jpeg` image files.
- **Input methods:**
	- File input control that supports selecting multiple files at once.
	- Drag-and-drop area where users can drop one or more image files.
- **Client-side only:** All file reading and processing must be done in the browser. No images or data may be sent to any server.
- **Order of initial import:** When multiple images are loaded at once, their initial order in the grid must match the order provided by the browser (typically selection order).

### 2. Image Grid & Preview
- **Grid display:**
	- Show a responsive grid of thumbnail previews for all added images.
	- Thumbnails must be displayed in the current page order from first page (top-left) to last page (bottom-right).
- **Preview details:** For each image tile, show at minimum:
	- Thumbnail.
	- Page number (1-based index reflecting current order).
	- Original filename (truncated if necessary for layout).
- **Empty state:** When no images are loaded, show a helpful empty-state message and clear call-to-action for adding images.

### 3. Reordering Images (Drag & Drop)
- **Drag-and-drop reordering:**
	- Users must be able to drag image thumbnails in the grid to change their order.
	- Dropping a thumbnail must update the page order immediately and update page numbers.
- **Accessibility:** Reordering should also be possible via non-drag means if feasible (e.g., Up/Down buttons) but is not strictly required. Drag-and-drop is mandatory.
- **Visual feedback:** While dragging, provide clear visual feedback (e.g., highlight target position, drag ghost image).

### 4. Optimization Control
- **Optimization slider:**
	- Provide a slider UI control labeled clearly (e.g., "Optimize quality" or "JPEG quality").
	- Slider range: `0.0` to `1.0` with step `0.01` (or similarly fine granularity).
	- Default value: `0.95`.
- **Optimization behavior:**
	- When optimization is enabled (quality value < 1.0), PNG images may be re-encoded as JPEG at the selected quality to reduce file size.
	- JPEG inputs may be recompressed to the selected quality.
	- Ensure recompression happens only client-side using Canvas or similar browser APIs.
- **Passthrough behavior:**
	- By default, when quality is at the default 0.95 value, the app should still allow a "passthrough" mode where original files are embedded as-is without recompression if the user prefers maximal quality.
	- Provide a clear toggle or checkbox (e.g., "Use original images (no recompression)") that, when on, bypasses re-encoding for all images, regardless of slider value.
	- Document and implement logic such that passthrough provides the highest file size but best quality.

### 5. PDF Generation
- **PDF content:**
	- Create a single multi-page PDF where each page contains exactly one of the selected images.
	- Page order must match the current grid order at the time of export.
- **Page size & orientation:**
	- Define a reasonable default page size (e.g., A4 or US Letter) and orientation (portrait), documented in the code.
	- Scale images to fit within the page while preserving aspect ratio.
- **Download behavior:**
	- Provide a prominent button (e.g., "Download PDF") that triggers PDF generation and downloads a file (e.g., `images.pdf`).
	- Show a basic loading state or disabled button state while PDF is being generated.
- **Client-only:**
	- PDF creation must use only client-side JavaScript libraries or browser APIs (no network calls to third-party services).

### 6. Reset Functionality
- **Reset button:**
	- Provide a clearly labeled control (e.g., "Reset" or "Start Over").
	- On click, the app must:
		- Remove all loaded images and clear the grid.
		- Reset the optimization slider to its default value (0.95).
		- Reset any passthrough/optimization toggles to their default states.
		- Clear any internal state related to PDF generation.
- **Confirmation:** If needed, a simple confirmation (to avoid accidental wipes) is acceptable but not required.

### 7. PWA Setup (No Offline Logic)
- **PWA structure:**
	- Provide a `manifest.json` describing the app name, icons, start URL, and display mode (e.g., `standalone`).
	- Ensure `index.html` links to the manifest and includes required meta tags for PWA installation.
- **Service worker:**
	- Include minimal service worker registration in the JS or HTML if required by the browser for PWA installability.
	- The service worker file may be a simple placeholder that does not implement offline caching or advanced behavior.
- **Installability:**
	- The app should be installable as a PWA on modern browsers (Chrome/Edge) when served over HTTPS or `localhost`.

### 8. Technology Constraints
- **Vanilla stack only:**
	- Use plain HTML, CSS, and JavaScript. No frameworks (React, Vue, etc.) or build tools are allowed.
	- All logic must be written in standard ES modules or plain JS files that run in modern browsers.
- **External dependencies:**
	- For icons, use Font Awesome 6.7 via CDN. No additional UI libraries.
	- If a client-side PDF library is needed, favor a single self-contained JS library that can be included via `<script>` tag or ES module import. Avoid node-only packages.

### 9. User Experience & UI Requirements
- **Layout:**
	- Provide a clean, responsive layout that works on desktop and tablet. Mobile support is desirable but not required to be pixel-perfect.
	- Use clear sections for: image input, grid preview, optimization settings, actions (Download, Reset).
- **Controls:**
	- Buttons and sliders must be clearly labeled.
	- Provide tooltips or small helper text for complex options (e.g., optimization and passthrough).
- **Feedback:**
	- Show user-friendly error messages for unsupported files or failed loads (do not show raw exception messages).
	- Indicate when no images are present and when the PDF has been successfully generated/downloaded.
- **Accessibility basics:**
	- Use semantic HTML elements where reasonable.
	- Ensure buttons are keyboard-focusable and labeled with readable text or `aria-label` when using only icons.

## Non-Functional Requirements

- **Performance:**
	- The app should handle at least 20 medium-resolution images (e.g., 1920×1080) without freezing the UI for extended periods. Some processing delay is acceptable during PDF generation.
- **Security & privacy:**
	- Do not upload images or PDFs to any remote server.
	- Avoid using analytics or tracking scripts.
- **Browser support:**
	- Target latest versions of Chromium-based browsers (Chrome, Edge). If other modern browsers work as well, that is a bonus.

## Files to Implement

- `index.html` – Base HTML structure, PWA hooks, layout containers.
- `script.js` – All client-side logic: file handling, drag-and-drop, grid state, optimization, PDF generation, reset, and basic service worker registration.
- `styles.css` – Layout, grid styling, buttons, slider styling, responsive behavior.
- `manifest.json` – PWA metadata.
- `sw.js` – Optional minimal/no-op service worker file used only for PWA installability (no offline caching required).

These requirements should be treated as the source of truth while implementing the `image-to-pdf` tool.
