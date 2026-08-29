# PS Spectrum Analyzer

A dependency-free, client-side microphone spectrum analyzer built with the Web Audio API and Canvas.

## Privacy

Microphone audio is processed entirely in the browser. Audio is not recorded, uploaded, stored, or sent to a server, and the tool includes no third-party tracking.

The page must be served over HTTPS or from `localhost` for browser microphone access.

## Features

- Selectable microphone input
- Full 20 Hz–20 kHz and focused 20 Hz–500 Hz ranges
- Logarithmic frequency axis
- Reference dB lines and optional musical-note overlay
- Auto-gain with the applied display gain reported in tooltips and the accessible summary
- Time-based peak hold with a manual reset
- Freeze and resume controls
- Full-screen spectrum display with an in-view exit control
- Mouse, touch, and keyboard spectrum inspection
- Responsive axis labels and high-DPI canvas rendering
- Throttled screen-reader summary of the strongest detected frequency

## Usage

1. Serve the repository locally or open the deployed HTTPS site.
2. Choose a microphone.
3. Select **Start Microphone** and allow browser access.
4. Adjust the frequency range and display options as needed.
5. Select **Full Screen** on the spectrum display for an expanded view; select **Exit Full Screen** or press Escape to return.
6. Select **Stop** when finished to release the microphone.

When the canvas has keyboard focus, use Left/Right Arrow to inspect nearby frequencies, Shift+Arrow for larger steps, and Home/End to jump to the range boundaries.

## Development

This tool has no build step or package dependencies. From the repository root:

~~~powershell
python -m http.server 4173 --bind 127.0.0.1
~~~

Then open `http://127.0.0.1:4173/ps-spectrum-analyzer/`.

## File structure

- `index.html` — semantic controls and spectrum display
- `audioAnalyzer.js` — microphone, AudioContext, device, and lifecycle management
- `visualization.js` — FFT aggregation, canvas rendering, peak hold, auto-gain, and inspection
- `ui.js` — controls and responsive axes
- `utils.js` — frequency/note conversion helpers
- `constants.js` — frequency labels and reference-line data
- `styles.css` — responsive light/dark presentation

## Browser support

A current Chromium, Firefox, or Safari release with `navigator.mediaDevices`, `getUserMedia`, the Web Audio API, the Fullscreen API, Canvas, and ES modules is recommended. Exact device labels may remain hidden until microphone permission is granted.
