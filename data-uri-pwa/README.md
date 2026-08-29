# Data URI Generator

A dependency-free, installable web app that converts content into a
[`data:` URL](https://developer.mozilla.org/docs/Web/URI/Reference/Schemes/data).
It supports:

- a local file selected from the device;
- a file dropped onto the app;
- an image, file, or plain text read from the clipboard;
- a CORS-enabled remote URL; and
- text typed or pasted into the editor.

The generated Data URI can be copied with the prominent **Copy Data URI**
button. Once a result exists, pressing <kbd>Ctrl</kbd>+<kbd>C</kbd> (or
<kbd>Cmd</kbd>+<kbd>C</kbd>) anywhere in the app also copies the Data URI. This
global shortcut is intentional.

## Privacy

Local files, dropped files, clipboard content, and text are processed entirely
inside the browser. They are never uploaded to a server.

Remote URLs are fetched only after the user chooses **Convert URL** or presses
Enter in the URL field. That request goes directly from the browser to the
remote server, so the remote server receives the normal request metadata (such
as the user's IP address and browser user agent). Remote requests omit cookies
and the referrer, and the remote server must permit the request through CORS.

The app contains no analytics, tracking code, advertisements, or third-party
runtime assets. The interface, icons, manifest, and service worker are all
served from this folder.

## Safe previews

The complete Data URI is created regardless of whether a preview is available.
Preview behavior is deliberately narrower:

- Broadly supported web images are shown in an `<img>` element: PNG/APNG,
  JPEG, GIF, and WebP. AVIF, BMP, and icon formats are not previewed.
- Common audio and video formats are loaded from temporary object URLs into
  native media controls.
- Plain text, HTML, CSS, JavaScript, JSON, XML, CSV, and SVG are displayed as
  escaped source text. Markup and scripts are never executed.
- PDFs, office documents, archives, fonts, executables, and unknown binary
  formats are not previewed.

Text previews are limited to 512 KB so a large document cannot overwhelm the
page. This does not truncate the generated Data URI.

## Large files

Data URIs are base64-encoded and are therefore roughly one third larger than
the original binary content. Conversion also requires the browser to hold the
source, encoded output, and some temporary buffers in memory at the same time.
The app warns before converting sources of 5 MB or more.

Binary previews use temporary object URLs instead of decoding the generated
base64 string a second time. The Data URI itself still has to exist in memory,
so very large files can take noticeable time and memory to convert or copy.

## Offline installation

The app registers `sw.js`, precaches its local application shell, and can be
installed when the browser exposes its PWA installation prompt. After the first
successful online load, the converter and its local-file features work offline.
Remote URL conversion naturally still requires a network connection.

The service worker uses a versioned cache, removes older app caches during
activation, updates cached assets in the background, and falls back to the
cached app shell for offline navigation.

## Run locally

The service worker and clipboard APIs require a secure context. Browsers treat
`localhost` and `127.0.0.1` as secure for local development, so serve the folder
instead of opening `index.html` directly:

```powershell
python -m http.server 4173
```

Then open:

```text
http://127.0.0.1:4173/data-uri-pwa/
```

## Testing

The unit suite uses **Vitest** and covers the pure logic shared by the production
app: UTF-8 and base64 conversion, MIME normalization, preview classification,
byte formatting, and source-revision invalidation.

Install the development dependency and run the suite from this folder:

```powershell
npm install
npm test
```

For watch mode during development:

```powershell
npm run test:watch
```

Vitest is a development-only dependency. The production PWA remains
dependency-free and does not ship any package from `node_modules`.

## License

MIT
