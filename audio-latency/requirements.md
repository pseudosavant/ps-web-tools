# Bluetooth Earbuds Latency Measurement Tool

## Objective

Build a browser-based tool to measure the latency of Bluetooth earbuds by comparing the time it takes for an audio signal to be played and then captured by a microphone. This tool will help users evaluate the performance of Bluetooth audio devices in real-world conditions.

## Functional Requirements

### Audio Playback

- Use the Web Audio API to generate and play a distinct, easily detectable signal (e.g. 1kHz tone or chirp).
- Sound should be brief and isolated to allow for accurate detection.
- Optionally support frequency sweeps or pink/white noise to analyze codec-induced audio shaping.

### Audio Capture

- Use `navigator.mediaDevices.getUserMedia` to record microphone input.
- Prioritize non-Bluetooth input sources (e.g. built-in laptop mic or USB mic).
- Record audio with high enough precision to detect sound onset for timing.
- Enable real-time audio analysis using `AnalyserNode` or `ScriptProcessorNode`.
- Locate microphone location (on laptops) with a real-time VU meter of the microphone input, and a test tone on the bluetooth output.

### Latency Measurement

- Measure time difference between when the sound is played (`t_play`) and when it is detected in the microphone input (`t_detect`).
- Use high-resolution timestamps from the audio context clock (`AudioContext.currentTime`) for consistent timing.
- Calculate:

```
latency_ms = t_detect - t_play
```

- Display latency in milliseconds with an optional breakdown (raw vs. baseline-corrected).

### Baseline Calibration

- Provide an option to perform a baseline latency measurement using built-in speakers and mic.
- Use this value to estimate and subtract out system audio/mic delays for Bluetooth-specific latency results.

### Device Selection

- Auto-select appropriate playback (Bluetooth) and input (non-Bluetooth mic) devices when possible.
- Allow manual override of selected devices through UI.
- Clearly label selected devices and whether they are Bluetooth or wired.

### Accessibility and UI

- Ensure controls and visuals meet WCAG 2.1 AA guidelines.
- Show:
  - Current selected devices.
  - Measured latency (raw and adjusted).
  - Option to re-run test or export results.
- Use simple color-coded feedback: e.g. green (<40ms), yellow (40–100ms), red (>100ms).

## Optional Features

- Display a real-time waveform or frequency spectrum of mic input during test.
- Visualize the frequency response of the Bluetooth codec using frequency sweep analysis.
- Export measurements to CSV or JSON for comparison/logging.
- Support batch testing (multiple runs with average and standard deviation).
- Allow saving "profiles" for different headphones/devices.

## Performance Requirements

- Measurement resolution: within ±10 milliseconds.
- All processing must be done client-side, in the browser.
- Latency result should be shown within 500ms of test completion.
- Should work reliably on Chrome, Edge, and Firefox.

## Technical Stack

- HTML + Vanilla JavaScript
- Web Audio API (`AudioContext`, `OscillatorNode`, `AnalyserNode`, etc.)
- getUserMedia API
- Optional: WebAssembly for higher-performance DSP (e.g. FFT, autocorrelation)
- Optional: IndexedDB or `localStorage` for storing device profiles

## Known Constraints

- Bluetooth codec latency is variable and depends on system-level drivers (e.g. SBC, AAC, aptX).
- Microphone position and background noise may interfere with detection.
- Precise audio synchronization across output and input devices is not guaranteed across all platforms or browsers.
- Browsers may restrict or prompt for mic access on each use.

## Future Enhancements

- Detect and report Bluetooth codec in use, if available via browser APIs.
- Add support for loopback testing with USB audio interfaces.
- Include reference files for external speaker testing or cross-device validation.
- Add mobile device support with on-screen instructions and larger UI.
- Build a native wrapper (e.g. Electron or Tauri) for more precise audio device control.

## Summary

This tool aims to provide users with a simple, accurate way to test Bluetooth earbud latency using only a browser. By using native browser APIs and optional calibration, the tool offers insight into the real-world performance of wireless audio hardware, especially in latency-sensitive contexts like video calls or music creation.