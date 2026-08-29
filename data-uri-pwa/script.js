import {
  LARGE_FILE_WARNING_BYTES,
  TEXT_PREVIEW_LIMIT_BYTES,
  createRevisionTracker,
  formatBytes,
  getPreviewKind,
  normalizeMimeType,
  textToDataURI
} from "./core.js?v=5";

(async function() {
  const LARGE_PREVIEW_BYTES = 1024 * 1024;

  const $dataURI = document.querySelector(".data-uri");
  const $copyButton = document.querySelector(".copy");
  const $copyMessage = document.querySelector(".copy-message");
  const $outputMeta = document.querySelector(".output-meta");
  const $status = document.querySelector(".status-message");
  const $preview = document.querySelector(".preview");
  const $local = document.querySelector(".local");
  const $fileButton = document.querySelector(".btn-file");
  const $dropWidget = document.querySelector(".drop-widget");
  const $drop = document.querySelector(".drop");
  const $pasteButton = document.querySelector(".btn-paste");
  const $remote = document.querySelector(".remote");
  const $remoteButton = document.querySelector(".convert-remote");
  const $text = document.querySelector(".text");
  const $install = document.querySelector(".install");
  const $sourceItems = Array.from(document.querySelectorAll(".source-item"));
  const $pasteProxy = createPasteProxy();

  const sourceRevisions = createRevisionTracker();
  let activeReader = null;
  let remoteAbortController = null;
  let textDebounceId = null;
  let pendingTextRevision = null;
  let previewIdleId = null;
  let previewTimeoutId = null;
  let activePreviewObjectURL = null;
  let statusTimeoutId = null;
  let copyTimeoutId = null;
  let pasteFallbackPreviousFocus = null;
  let deferredPrompt = null;
  let lastDataURI = "";

  $local.addEventListener("change", () => {
    const file = $local.files && $local.files[0];
    if (file) {
      void convertBlobSource(file, "local", `Local file: ${file.name}`, { keepLocal: true });
    }
  });

  $fileButton.addEventListener("click", () => $local.click());
  $dropWidget.addEventListener("click", () => $local.click());

  $remote.addEventListener("input", handleRemoteInput);
  $remote.addEventListener("keydown", event => {
    if (event.key === "Enter" && !$remoteButton.disabled) {
      event.preventDefault();
      void convertRemote();
    }
  });
  $remoteButton.addEventListener("click", () => void convertRemote());

  $text.addEventListener("input", scheduleTextUpdate);
  $text.addEventListener("blur", flushTextUpdate);

  $drop.addEventListener("drop", event => void updateFileDrop(event));
  $drop.addEventListener("dragover", dragover);
  $drop.addEventListener("dragleave", () => $drop.classList.remove("dropover"));

  document.addEventListener("paste", event => void pasteFromClipboard(event, { showFeedback: false }));
  $pasteButton.addEventListener("click", event => {
    void pasteFromClipboard(event, { force: true, showFeedback: true, allowFallback: true });
  });

  // Intentional app behavior: once a Data URI exists, Ctrl+C anywhere copies it.
  document.addEventListener("copy", copyDataURI, false);
  $copyButton.addEventListener("click", () => void copyFromButton(), false);

  window.addEventListener("beforeunload", releasePreviewObjectURL);

  function beginSourceUpdate(source, options) {
    const opts = options || {};
    const revision = sourceRevisions.next();

    if (remoteAbortController) {
      remoteAbortController.abort();
      remoteAbortController = null;
    }

    if (activeReader) {
      const reader = activeReader;
      activeReader = null;
      if (reader.readyState === FileReader.LOADING) {
        reader.abort();
      }
    }

    clearTimeout(textDebounceId);
    textDebounceId = null;
    pendingTextRevision = null;
    cancelScheduledPreview();
    releasePreviewObjectURL();
    clearOtherSourceInputs(opts);
    setActiveSource(source);
    clearOutput("Preparing a new conversion…");
    clearStatus();

    return revision;
  }

  function clearOtherSourceInputs(options) {
    const opts = options || {};
    if (!opts.keepText) {
      $text.value = "";
    }
    if (!opts.keepRemote) {
      $remote.value = "";
    }
    if (!opts.keepLocal) {
      $local.value = "";
    }
    updateRemoteButtonState();
  }

  function setActiveSource(source) {
    $sourceItems.forEach(item => {
      item.classList.toggle("is-active", item.dataset.source === source);
    });
  }

  function handleRemoteInput() {
    const hasValue = Boolean($remote.value.trim());
    beginSourceUpdate("remote", { keepRemote: true });
    updateRemoteButtonState();

    if (hasValue) {
      showStatus("URL ready. Choose Convert URL or press Enter.", { type: "info", timeout: 3000 });
    } else {
      setActiveSource(null);
      clearOutput("No preview yet. Choose a source on the left.");
    }
  }

  function updateRemoteButtonState() {
    $remoteButton.disabled = !$remote.value.trim();
  }

  async function convertRemote() {
    const rawUrl = $remote.value.trim();
    const revision = beginSourceUpdate("remote", { keepRemote: true });
    updateRemoteButtonState();

    if (!rawUrl) {
      setActiveSource(null);
      clearOutput("No preview yet. Choose a source on the left.");
      return;
    }

    const parsedUrl = parseRemoteUrl(rawUrl);
    if (!parsedUrl) {
      showStatus("Enter a complete http:// or https:// URL.", { type: "error", timeout: 4000 });
      return;
    }

    const controller = new AbortController();
    remoteAbortController = controller;
    showStatus("Fetching the remote file…", { type: "info", loading: true, persist: true });

    try {
      const response = await fetch(parsedUrl.href, {
        signal: controller.signal,
        credentials: "omit",
        referrerPolicy: "no-referrer",
        cache: "no-store"
      });

      if (!response.ok) {
        throw new Error(`Request failed with HTTP ${response.status}`);
      }

      const blob = await response.blob();
      if (!sourceRevisions.isCurrent(revision)) return;

      const label = `Remote URL: ${parsedUrl.hostname}`;
      await convertBlob(blob, revision, label, response.headers.get("content-type"));
    } catch (error) {
      if (error.name !== "AbortError" && sourceRevisions.isCurrent(revision)) {
        showStatus(`Could not fetch the remote file. ${error.message}`, { type: "error", timeout: 5000 });
        showPreviewPlaceholder("The remote file could not be loaded.");
      }
    } finally {
      if (remoteAbortController === controller) {
        remoteAbortController = null;
      }
    }
  }

  function parseRemoteUrl(value) {
    try {
      const parsed = new URL(value);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return null;
      }
      return parsed;
    } catch (error) {
      return null;
    }
  }

  function scheduleTextUpdate() {
    const revision = beginSourceUpdate("text", { keepText: true });

    if ($text.value.length === 0) {
      setActiveSource(null);
      clearOutput("No preview yet. Choose a source on the left.");
      return;
    }

    pendingTextRevision = revision;
    textDebounceId = setTimeout(() => {
      textDebounceId = null;
      pendingTextRevision = null;
      updateText(revision, "Text");
    }, 250);
  }

  function flushTextUpdate() {
    if (textDebounceId === null || pendingTextRevision === null) return;
    const revision = pendingTextRevision;
    clearTimeout(textDebounceId);
    textDebounceId = null;
    pendingTextRevision = null;
    updateText(revision, "Text");
  }

  function updateText(revision, sourceLabel) {
    if (!sourceRevisions.isCurrent(revision)) return false;

    const value = $text.value;
    if (value.length === 0) {
      clearOutput("No preview yet. Choose a source on the left.");
      return false;
    }

    const type = "text/plain;charset=utf-8";
    const sourceBlob = new Blob([value], { type });
    const isLarge = warnLargeFile(sourceBlob.size);
    const result = textToDataURI(value, "text/plain");

    if (!sourceRevisions.isCurrent(revision)) return false;
    updateDataURI(result.uri, type, {
      size: result.size,
      sourceLabel,
      preview: { kind: "text", text: value, truncated: false },
      revision
    });
    showReadyStatus(isLarge);
    return true;
  }

  async function updateFileDrop(event) {
    event.preventDefault();
    $drop.classList.remove("dropover");

    const transfer = event.dataTransfer;
    const item = transfer.items
      ? Array.from(transfer.items).find(candidate => candidate.kind === "file")
      : null;
    const file = item ? item.getAsFile() : transfer.files && transfer.files[0];

    if (!file) {
      showStatus("No file was included in the drop.", { type: "error", timeout: 2500 });
      return;
    }

    await convertBlobSource(file, "drop", `Dropped file: ${file.name}`);
  }

  let dragTimeoutId = null;
  function dragover(event) {
    event.preventDefault();
    $drop.classList.add("dropover");
    clearTimeout(dragTimeoutId);
    dragTimeoutId = setTimeout(() => $drop.classList.remove("dropover"), 120);
  }

  async function convertBlobSource(blob, source, sourceLabel, beginOptions) {
    if (!blob) {
      showStatus("No file selected.", { type: "error", timeout: 2000 });
      return false;
    }

    const revision = beginSourceUpdate(source, beginOptions);
    return convertBlob(blob, revision, sourceLabel);
  }

  async function convertBlob(blob, revision, sourceLabel, fallbackType) {
    if (!sourceRevisions.isCurrent(revision)) return false;

    const type = normalizeMimeType(blob.type || fallbackType) || "application/octet-stream";
    const isLarge = warnLargeFile(blob.size);
    if (!isLarge) {
      showStatus("Converting in your browser…", { type: "info", loading: true, persist: true });
    }
    $preview.setAttribute("aria-busy", "true");
    showPreviewPlaceholder("Preparing a safe preview…", true);

    const [uri, preview] = await Promise.all([
      readBlobAsDataURL(blob, revision),
      prepareBlobPreview(blob, type)
    ]);

    if (!uri || !sourceRevisions.isCurrent(revision)) {
      disposePreparedPreview(preview);
      return false;
    }

    updateDataURI(uri, type, {
      size: blob.size,
      sourceLabel,
      preview,
      revision
    });
    showReadyStatus(isLarge);
    return true;
  }

  function readBlobAsDataURL(blob, revision) {
    return new Promise(resolve => {
      const reader = new FileReader();
      activeReader = reader;

      const finish = value => {
        if (activeReader === reader) {
          activeReader = null;
        }
        resolve(value);
      };

      reader.addEventListener("load", () => {
        const result = typeof reader.result === "string" ? reader.result : null;
        finish(sourceRevisions.isCurrent(revision) ? result : null);
      });
      reader.addEventListener("abort", () => finish(null));
      reader.addEventListener("error", () => {
        if (sourceRevisions.isCurrent(revision)) {
          showStatus("The file could not be read.", { type: "error", timeout: 4000 });
        }
        finish(null);
      });

      try {
        reader.readAsDataURL(blob);
      } catch (error) {
        showStatus("The file could not be read.", { type: "error", timeout: 4000 });
        finish(null);
      }
    });
  }

  async function prepareBlobPreview(blob, type) {
    const kind = getPreviewKind(type);

    if (kind === "image" || kind === "audio" || kind === "video") {
      return { kind, url: URL.createObjectURL(blob) };
    }

    if (kind === "text") {
      const truncated = blob.size > TEXT_PREVIEW_LIMIT_BYTES;
      const previewBlob = truncated ? blob.slice(0, TEXT_PREVIEW_LIMIT_BYTES) : blob;
      const text = await previewBlob.text();
      return { kind, text, truncated };
    }

    return { kind: "unsupported" };
  }

  function updateDataURI(uri, type, options) {
    if (!uri) return;
    const opts = options || {};
    if (!sourceRevisions.isCurrent(opts.revision)) {
      disposePreparedPreview(opts.preview);
      return;
    }

    cancelScheduledPreview();
    releasePreviewObjectURL();

    lastDataURI = uri;
    $dataURI.value = uri;
    $copyButton.disabled = false;
    $outputMeta.textContent = `${opts.sourceLabel || "Source"} • ${type || "Unknown type"} • ${formatBytes(opts.size || 0)}`;

    if (opts.preview && opts.preview.url) {
      activePreviewObjectURL = opts.preview.url;
    }
    schedulePreviewRender(opts.preview, type, opts.size || 0, opts.revision);
  }

  function schedulePreviewRender(preview, type, size, revision) {
    const render = () => renderPreview(preview, type, revision);
    if (size >= LARGE_PREVIEW_BYTES && "requestIdleCallback" in window) {
      previewIdleId = window.requestIdleCallback(render, { timeout: 700 });
    } else {
      previewTimeoutId = window.setTimeout(render, 0);
    }
  }

  function cancelScheduledPreview() {
    if (previewIdleId !== null && "cancelIdleCallback" in window) {
      window.cancelIdleCallback(previewIdleId);
    }
    if (previewTimeoutId !== null) {
      window.clearTimeout(previewTimeoutId);
    }
    previewIdleId = null;
    previewTimeoutId = null;
  }

  function renderPreview(preview, type, revision) {
    previewIdleId = null;
    previewTimeoutId = null;
    if (!sourceRevisions.isCurrent(revision) || !preview) return;

    $preview.replaceChildren();
    $preview.className = "preview";
    $preview.setAttribute("aria-busy", "false");

    if (preview.kind === "image") {
      $preview.classList.add("preview-media", "preview-image");
      const image = document.createElement("img");
      image.src = preview.url;
      image.alt = "Preview of the converted image";
      image.decoding = "async";
      $preview.appendChild(image);
      return;
    }

    if (preview.kind === "audio") {
      $preview.classList.add("preview-audio");
      const audio = document.createElement("audio");
      audio.src = preview.url;
      audio.controls = true;
      audio.preload = "metadata";
      audio.setAttribute("aria-label", "Audio preview");
      $preview.appendChild(audio);
      return;
    }

    if (preview.kind === "video") {
      $preview.classList.add("preview-media", "preview-video");
      const video = document.createElement("video");
      video.src = preview.url;
      video.controls = true;
      video.preload = "metadata";
      video.setAttribute("aria-label", "Video preview");
      $preview.appendChild(video);
      return;
    }

    if (preview.kind === "text") {
      $preview.classList.add("preview-text");
      const pre = document.createElement("pre");
      pre.textContent = preview.truncated
        ? `${preview.text}\n\n… Preview truncated at ${formatBytes(TEXT_PREVIEW_LIMIT_BYTES)}. The complete Data URI is still available.`
        : preview.text;
      $preview.appendChild(pre);
      return;
    }

    showPreviewPlaceholder(
      `Preview disabled for ${type || "this file type"}. You can still copy the complete Data URI.`
    );
  }

  function showPreviewPlaceholder(message, busy) {
    $preview.className = "preview";
    $preview.setAttribute("aria-busy", busy ? "true" : "false");
    const placeholder = document.createElement("span");
    placeholder.className = "preview-placeholder";
    placeholder.textContent = message || "No preview yet. Choose a source on the left.";
    $preview.replaceChildren(placeholder);
  }

  function disposePreparedPreview(preview) {
    if (preview && preview.url) {
      URL.revokeObjectURL(preview.url);
    }
  }

  function releasePreviewObjectURL() {
    if (activePreviewObjectURL) {
      URL.revokeObjectURL(activePreviewObjectURL);
      activePreviewObjectURL = null;
    }
  }

  function clearOutput(previewMessage) {
    lastDataURI = "";
    $dataURI.value = "";
    $copyButton.disabled = true;
    $outputMeta.textContent = "";
    $copyMessage.textContent = "";
    showPreviewPlaceholder(previewMessage);
  }

  function copyDataURI(event) {
    const uri = getDataURI();
    if (!uri || !event.clipboardData) return;
    event.clipboardData.setData("text/plain", uri);
    event.preventDefault();
    showCopySuccess();
  }

  async function copyFromButton() {
    const uri = getDataURI();
    if (!uri) {
      showStatus("There is no Data URI to copy yet.", { type: "error", timeout: 2500 });
      return;
    }

    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(uri);
        showCopySuccess();
        return;
      } catch (error) {
        // Fall through to the copy event fallback.
      }
    }

    const copied = document.execCommand("copy");
    if (!copied) {
      showStatus("Copy failed. Select the Data URI field and try again.", { type: "error", timeout: 3500 });
    }
  }

  function showCopySuccess() {
    clearTimeout(copyTimeoutId);
    $copyButton.classList.add("copy-success");
    $copyMessage.textContent = "Copied to clipboard.";
    copyTimeoutId = setTimeout(() => {
      $copyButton.classList.remove("copy-success");
      $copyMessage.textContent = "";
    }, 1600);
  }

  function getDataURI() {
    return lastDataURI || $dataURI.value || "";
  }

  function warnLargeFile(size) {
    if (!size || size < LARGE_FILE_WARNING_BYTES) return false;
    showStatus(`Large source (${formatBytes(size)}). Conversion may take a moment.`, {
      type: "info",
      loading: true,
      persist: true
    });
    return true;
  }

  function showReadyStatus(wasLarge) {
    showStatus(wasLarge ? "Large Data URI ready to copy." : "Data URI ready to copy.", {
      type: "info",
      timeout: 2500
    });
  }

  function showStatus(message, options) {
    const opts = options || {};
    const type = opts.type || "info";
    const loading = Boolean(opts.loading);
    const persist = Boolean(opts.persist);
    const timeout = typeof opts.timeout === "number" ? opts.timeout : 2000;

    clearTimeout(statusTimeoutId);
    $status.textContent = message || "";
    $status.className = "status-message";
    $status.setAttribute("role", type === "error" ? "alert" : "status");
    if (message) {
      $status.classList.add(type === "error" ? "is-error" : "is-info");
    }
    if (loading) {
      $status.classList.add("is-loading");
    }

    if (!persist && message) {
      statusTimeoutId = setTimeout(clearStatus, timeout);
    }
  }

  function clearStatus() {
    clearTimeout(statusTimeoutId);
    $status.textContent = "";
    $status.className = "status-message";
    $status.setAttribute("role", "status");
  }

  async function pasteFromClipboard(event, options) {
    const opts = options || {};
    if (event && event.type === "paste" && !opts.force && isEditableTarget(event.target)) {
      return;
    }

    let handled = false;
    if (opts.showFeedback) {
      showStatus("Reading the clipboard…", { type: "info", loading: true, persist: true });
    }

    if (event && event.clipboardData) {
      const items = Array.from(event.clipboardData.items || []);
      const fileItem = items.find(item => item.kind === "file");
      const file = fileItem ? fileItem.getAsFile() : event.clipboardData.files && event.clipboardData.files[0];

      if (file) {
        handled = await convertBlobSource(file, "clipboard", "Clipboard file");
      } else {
        const data = event.clipboardData.getData("text/plain");
        if (data) {
          handled = convertClipboardText(data);
        }
      }
    }

    if (!handled && navigator.clipboard && window.isSecureContext) {
      try {
        const blob = await readClipboardBlob();
        if (blob) {
          handled = await convertBlobSource(blob, "clipboard", "Clipboard file");
        } else {
          const data = await navigator.clipboard.readText();
          if (data) {
            handled = convertClipboardText(data);
          }
        }
      } catch (error) {
        // Continue to the keyboard paste fallback when available.
      }
    }

    if (!handled && opts.allowFallback && attemptPasteFallback()) {
      return;
    }

    if (!handled && opts.showFeedback) {
      showStatus("Clipboard access was unavailable. Press Ctrl+V to paste.", { type: "info", timeout: 3500 });
    }

    if (event && handled) {
      event.preventDefault();
    }
  }

  function convertClipboardText(data) {
    $text.value = data;
    const revision = beginSourceUpdate("clipboard", { keepText: true });
    return updateText(revision, "Clipboard text");
  }

  async function readClipboardBlob() {
    if (!navigator.clipboard || !navigator.clipboard.read) return null;

    let items;
    try {
      items = await navigator.clipboard.read();
    } catch (error) {
      return null;
    }

    for (const item of items) {
      const types = item.types || [];
      const preferredType =
        types.find(type => type.startsWith("image/")) ||
        types.find(type => type === "application/octet-stream");
      if (preferredType) {
        return item.getType(preferredType);
      }
    }
    return null;
  }

  function isEditableTarget(target) {
    if (!target) return false;
    if (target.isContentEditable) return true;
    const tag = target.tagName ? target.tagName.toLowerCase() : "";
    if (tag === "textarea") return true;
    if (tag === "input") {
      const type = (target.getAttribute("type") || "text").toLowerCase();
      return ["text", "url", "search", "email", "tel", "password", "number"].includes(type);
    }
    return false;
  }

  function createPasteProxy() {
    const proxy = document.createElement("textarea");
    proxy.className = "paste-proxy";
    proxy.setAttribute("aria-hidden", "true");
    proxy.tabIndex = -1;
    document.body.appendChild(proxy);
    proxy.addEventListener("paste", event => {
      void pasteFromClipboard(event, { force: true, showFeedback: true }).finally(restorePasteFallbackFocus);
    });
    return proxy;
  }

  function attemptPasteFallback() {
    const previousFocus = document.activeElement;
    pasteFallbackPreviousFocus = previousFocus;
    $pasteProxy.value = "";
    $pasteProxy.focus({ preventScroll: true });

    try {
      const triggered = document.execCommand("paste");
      if (!triggered && previousFocus && typeof previousFocus.focus === "function") {
        previousFocus.focus({ preventScroll: true });
        pasteFallbackPreviousFocus = null;
      }
      return triggered;
    } catch (error) {
      if (previousFocus && typeof previousFocus.focus === "function") {
        previousFocus.focus({ preventScroll: true });
      }
      pasteFallbackPreviousFocus = null;
      return false;
    }
  }

  function restorePasteFallbackFocus() {
    const previousFocus = pasteFallbackPreviousFocus;
    pasteFallbackPreviousFocus = null;
    if (previousFocus && typeof previousFocus.focus === "function") {
      previousFocus.focus({ preventScroll: true });
    }
  }

  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    deferredPrompt = event;
    $install.hidden = false;
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    $install.hidden = true;
    showStatus("App installed.", { type: "info", timeout: 2500 });
  });

  $install.addEventListener("click", async () => {
    if (!deferredPrompt) {
      $install.hidden = true;
      return;
    }

    const prompt = deferredPrompt;
    deferredPrompt = null;
    $install.hidden = true;
    await prompt.prompt();
    await prompt.userChoice;
  });

  if ("serviceWorker" in navigator) {
    try {
      await navigator.serviceWorker.register("sw.js", { scope: "./" });
    } catch (error) {
      console.warn("Service worker registration failed.", error);
    }
  }

  updateRemoteButtonState();
  showPreviewPlaceholder("No preview yet. Choose a source on the left.");
})();
