# speedo Raw Trace Fixtures

Place exported `speedo-raw-trace` JSON files in this folder when collecting
real runs for regression work.

Suggested fixture naming:

- `YYYY-MM-DD-device-mode-brief-note.json`

Keep traces as exported by the app when possible. The importer replays raw
`devicemotion` samples through the current analyzer, so these files are useful
for checking whether calibration, launch detection, bias handling, stop
completion, and split timing improve or regress over time.
