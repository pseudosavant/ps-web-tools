# ps-to-mp3

Convert audio files to MP3 100% on-device.

This project provides a simple, lightweight, and privacy-focused web application to convert audio files to MP3 format. All operations happen locally on your device, ensuring no data is uploaded to external servers.

## Features

- **On-Device Processing:** Your audio files are processed entirely in your browser using WebAssembly-powered FFmpeg.
- **MP3 Conversion:** Supports converting audio files of various formats (e.g., WAV, AAC, FLAC) to MP3.
- **Simple Interface:** Drag and drop or use the file picker to select files for conversion.
- **Metadata Display:** View basic metadata such as duration and bitrate for input and output files.
- **Privacy-First:** No file uploads – all processing happens in your browser.

## Usage

### Demo

Try the live version of the app here: [ps-to-mp3.glitch.me](https://ps-to-mp3.glitch.me/)

You can also run the web app locally by cloning this repository and serving it through a local web server.

### Steps

1. **Drag and Drop** an audio file into the web app or use the **File Picker** to select a file.
2. The app converts the file to MP3 format using the highest quality settings (`-q:a 0`).
3. Download the converted MP3 file when processing is complete.

### Supported Formats

- Input: WAV, AAC, FLAC, and other common audio formats.
- Output: MP3 (high quality).

## Technical Details

- **FFmpeg WebAssembly**: The app uses FFmpeg compiled to WebAssembly for audio processing.
- **No Server-Side Processing**: All operations occur in the browser, ensuring privacy and speed.
- **PWA-Ready**: Can be installed as a Progressive Web App (PWA) for easier access.

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/ps-to-mp3.git
   cd ps-to-mp3
   ```
2. Serve the files locally using a web server. For example:
   ```bash
   npx serve .
   ```
3. Open the app in your browser:
   ```
   http://localhost:5000
   ```

## Development

### Prerequisites

- Node.js (for serving the app locally, optional).

### Running Locally

1. Install dependencies (optional, if any build tools are added in the future):
   ```bash
   npm install
   ```
2. Start the app:
   ```bash
   npx serve .
   ```

## Future Enhancements

- Add support for batch file conversion.
- Improve error handling for unsupported or corrupted files.
- Add customizable MP3 settings (e.g., bitrate, channels).
- Full offline support using a service worker.

## Contributing

Contributions are welcome! If you’d like to contribute, please fork the repository and submit a pull request.

## License

This project is licensed under the [MIT License](LICENSE).

## Acknowledgements

- [FFmpeg WebAssembly](https://github.com/ffmpegwasm) for powering the audio processing.
- The open-source community for inspiration and support.
