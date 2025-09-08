I want a single file vanilla HTML/JS/CSS app that is focused on one thing, making it easy to take any image file your browser can open, and converting that to a high quality jpeg or png. Either to make the file smaller (PNG to JPEG) or much more compatible (verus HEIC/WebP).

It should have a toggle between PNG and JPEG that is a checkbox. When JPEG is selected there should be a quality slider, that has a default that results in high quality (if larger files) by default. The preview image and download link are always updated as soon as the PNG/JPG checkbox is toggled or the JPEG quality changes.

The checkbox should be styled with CSS so that it is hidden, and a `<label>` element that is directly after the checkbox is styled (using CSS + pseudo/real elements) to look like an pill shaped iOS toggle slider with animated transition, different background color for checked/unchecked state, etc.

I want to only use the built in browser image open/conversion capabilities (no WASM, at least yet). All processing must be local obviously.

I want to be able to drag and drop images anywhere on the entire app, or click on a button, to open an image (filtered to `image/*`).

There should be a "preview" image of the final converted output, but don't show the source one. The preview image should have basic metadata displayed below it (filesize, mimetype, dimensions). There should be a download link for the final output image - users can still right-click->save as on the image, but the download link will have the download attribute set so that it will be clicker to just single click the link if you just want to download to your downloads folder.

There should be clear, but minimal, instructions on the page to either drop an image anywhere on the page, or to click the button to open, to open an image.

Add a PWA manifest so that this can be installed. Don't bother with a serviceworker for now though.

Record and track any notes/work/etc in the llm.md file.

Any questions?

---

I only want the conversion done once for each time the file, type, or quality setting changes. The preview, download links, anywhere, should all use that one converted output. I don't want repeat encoding if the file size doesn't get smaller. If the input is PNG and the output is PNG, just use the input PNG without converting it. For JPEGs, use the source JPEG if it is smaller than the converted output.

I want it to indicate when the image the user tries to load isn't compatible or can't be opened. I don't want it hard coded for what inputs it accepts, I want it to try to open it and report if it fails. That way we can support the maximum amount of input file formats even if some are not supported all the time (BMP, TIFF, HEIC, etc).