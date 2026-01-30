(async function(global) {
  const $dataURI = $(".data-uri");
  const $status = $(".status-message");
  const LARGE_FILE_WARNING_BYTES = 5 * 1024 * 1024;
  const LARGE_PREVIEW_BYTES = 1024 * 1024;
  let statusTimeoutId = null;
  let lastDataURI = "";
  let lastDataType = "";
  const $pasteProxy = createPasteProxy();

  const $local = $(".local");
  $local.on("change", updateLocal);

  const $fileButton = $(".btn-file");
  if ($fileButton) {
    $fileButton.on("click", () => $local.click());
  }

  const $dropWidget = $(".drop-widget");
  if ($dropWidget) {
    $dropWidget.on("click", () => $local.click());
  }

  const $remote = $(".remote");
  $remote.on("input", scheduleRemoteFetch);
  $remote.on("blur", () => triggerRemoteFetch(true));

  const $text = $(".text");
  $text.on("input", scheduleTextUpdate);
  $text.on("blur", () => triggerTextUpdate(true));

  const $drop = $(".drop");
  $drop.on("drop", updateFileDrop);

  function updateLocal(e) {
    const file = $local.files[0];
    updateFile(file);
  }
  let remoteDebounceId = null;
  let remoteAbortController = null;
  let textDebounceId = null;

  function scheduleRemoteFetch() {
    clearTimeout(remoteDebounceId);
    remoteDebounceId = setTimeout(() => {
      remoteDebounceId = null;
      triggerRemoteFetch(false);
    }, 250);
  }

  function scheduleTextUpdate() {
    clearTimeout(textDebounceId);
    textDebounceId = setTimeout(() => {
      textDebounceId = null;
      triggerTextUpdate(false);
    }, 200);
  }

  function triggerTextUpdate(immediate) {
    if (immediate) {
      clearTimeout(textDebounceId);
      textDebounceId = null;
    }
    updateText();
  }

  function triggerRemoteFetch(immediate) {
    if (immediate) {
      clearTimeout(remoteDebounceId);
      remoteDebounceId = null;
    }

    if (remoteAbortController) {
      remoteAbortController.abort();
      remoteAbortController = null;
    }

    const rawUrl = ($remote.value || "").trim();
    if (!rawUrl) {
      clearStatus();
      return;
    }

    const parsedUrl = parseRemoteUrl(rawUrl);
    if (!parsedUrl) {
      clearStatus();
      return;
    }

    remoteAbortController = new AbortController();
    showStatus("Fetching remote file...", { type: "info", loading: true, persist: true });
    fetchRemote(parsedUrl.href, remoteAbortController.signal);
  }

  function parseRemoteUrl(value) {
    try {
      const parsed = new URL(value);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return null;
      }
      return parsed;
    } catch (err) {
      return null;
    }
  }

  async function fetchRemote(url, signal) {
    try {
      const res = await fetch(url, { signal });
      if (!res.ok) throw new Error("Network response was not ok");
      const blob = await res.blob();
      updateFile(blob);
      showStatus("Remote file loaded.", { type: "info", timeout: 1500 });
    } catch (err) {
      if (err.name !== "AbortError") {
        showStatus("Failed to fetch remote file: " + err.message, { type: "error", timeout: 4000 });
      }
    }
  }

  function updateText(e) {
    const type = "text/plain";
    const result = textToDataURI($text.value || "", type);
    warnLargeFile(result.size);
    updateDataURI(result.uri, type, { size: result.size });
  }

  function textToDataURI(text, type) {
    const bytes = new TextEncoder().encode(text);
    const base64 = bytesToBase64(bytes);
    return {
      uri: `data:${type};charset=utf-8;base64,${base64}`,
      size: bytes.length
    };
  }

  function bytesToBase64(bytes) {
    let binary = "";
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode.apply(null, chunk);
    }
    return btoa(binary);
  }

  function updateFileDrop(e) {
    e.preventDefault();

    const dt = e.dataTransfer;
    const file =
      dt.items && e.dataTransfer.items[0].kind === "file"
        ? e.dataTransfer.items[0].getAsFile()
        : e.dataTransfer.files[0];
    updateFile(file);
  }

  const dragover = (function() {
    var t;

    return function(e) {
      e.preventDefault();

      $drop.classList.add("dropover");

      clearTimeout(t);
      t = setTimeout(() => $drop.classList.remove("dropover"), 100);
    };
  })();
  $drop.on("dragover", dragover);
  $drop.on("dragleave", () => $drop.classList.remove("dropover"));

  function updateFile(file) {
    if (!file) {
      showStatus("No file selected.", { type: "error", timeout: 2000 });
      return;
    }
    warnLargeFile(file.size);
    const reader = new FileReader();
    reader.addEventListener(
      "load",
      () => updateDataURI(reader.result, file.type, { size: file.size }),
      false
    );

    if (file) {
      reader.readAsDataURL(file);
    }
  }

  function updateDataURI(uri, type, options) {
    if (!uri) return;
    if (uri === lastDataURI && type === lastDataType) {
      return;
    }
    lastDataURI = uri;
    lastDataType = type;
    $dataURI.setAttribute("href", uri);

    const size = options && options.size ? options.size : uri.length;
    const $preview = $(".preview");
    $preview.innerHTML = "";

    if (size >= LARGE_PREVIEW_BYTES) {
      showPreviewPlaceholder("Rendering preview...");
      schedulePreviewRender(uri, type, size);
    } else {
      schedulePreviewRender(uri, type, size);
    }
  }

  function schedulePreviewRender(uri, type, size) {
    const render = () => renderPreview(uri, type);
    if (size >= LARGE_PREVIEW_BYTES && "requestIdleCallback" in window) {
      requestIdleCallback(render, { timeout: 700 });
    } else {
      setTimeout(render, 0);
    }
  }

  function renderPreview(uri, type) {
    const $preview = $(".preview");
    $preview.innerHTML = "";
    const safeType = type || "application/octet-stream";
    const baseType = safeType.split("/")[0];

    switch (baseType) {
      case "video":
        const $video = $("<video controls />");
        $video.src = uri;
        $preview.append($video);
        break;
      case "audio":
        const $audio = $("<audio controls />");
        $audio.src = uri;
        $preview.append($audio);
        break;
      case "image":
        const $img = $("<img>");
        $img.src = uri;
        $preview.append($img);
        break;
      case "text":
      default:
        const $iframe = $("<iframe/>");
        $iframe.setAttribute("sandbox", "");
        $iframe.src = uri;
        $iframe.onload = () => resizeIframe($iframe);
        $preview.append($iframe);
        break;
    }
  }

  function resizeIframe(iframe) {
    try {
      const doc = iframe.contentDocument || iframe.contentWindow.document;
      iframe.width = doc.body.scrollWidth;
      iframe.height = doc.body.scrollHeight;
    } catch (e) {
      // Ignore cross-origin errors
    }
  }

  // Improved copy-to-clipboard logic with visual feedback
  function copyDataURI(e) {
    const uri = getDataURI();
    if (!uri) return;
    if (e && e.clipboardData) {
      e.clipboardData.setData("text/plain", uri);
      e.preventDefault();
      showCopySuccess();
    }
  }
  $(document).on("copy", copyDataURI, false);
  $(".copy").on("click", async () => {
    const uri = getDataURI();
    if (!uri) {
      showCopyError("No data URI to copy.");
      return;
    }
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(uri);
        showCopySuccess();
        return;
      } catch (err) {
        // Fall back to execCommand below.
      }
    }
    const ok = document.execCommand("copy");
    if (ok) {
      showCopySuccess();
    } else {
      showCopyError("Copy failed.");
    }
  }, false);

  function showCopySuccess() {
    const btn = $(".copy");
    const msg = document.querySelector('.copy-message');
    btn.classList.add('copy-success');
    if (msg) {
      msg.textContent = "Copied!";
      msg.style.display = "inline";
    }
    setTimeout(() => {
      btn.classList.remove('copy-success');
      if (msg) msg.style.display = "none";
    }, 1200);
  }

  function showCopyError(text) {
    showStatus(text, { type: "error", timeout: 2500 });
  }

  function getDataURI() {
    return $dataURI.getAttribute("href") || "";
  }

  function warnLargeFile(size) {
    if (!size || size < LARGE_FILE_WARNING_BYTES) return;
    const label = formatBytes(size);
    showStatus(`Large file (${label}) may be slow to convert.`, { type: "info", timeout: 4000 });
  }

  function formatBytes(bytes) {
    const units = ["B", "KB", "MB", "GB"];
    let value = bytes;
    let unit = units[0];
    for (let i = 1; i < units.length && value >= 1024; i++) {
      value /= 1024;
      unit = units[i];
    }
    return `${value.toFixed(value >= 10 || unit === "B" ? 0 : 1)} ${unit}`;
  }

  function showStatus(message, options) {
    if (!$status) return;
    const opts = options || {};
    const type = opts.type || "info";
    const loading = Boolean(opts.loading);
    const persist = Boolean(opts.persist);
    const timeout = typeof opts.timeout === "number" ? opts.timeout : 2000;

    clearTimeout(statusTimeoutId);
    $status.textContent = message || "";
    $status.className = "status-message";
    $status.classList.add(type === "error" ? "is-error" : "is-info");
    if (loading) {
      $status.classList.add("is-loading");
    }

    if (!persist && message) {
      statusTimeoutId = setTimeout(() => {
        $status.textContent = "";
        $status.className = "status-message";
      }, timeout);
    }
  }

  function clearStatus() {
    if (!$status) return;
    clearTimeout(statusTimeoutId);
    $status.textContent = "";
    $status.className = "status-message";
  }

  async function pasteText(e, options) {
    const force = options && options.force;
    const showFeedback = options && options.showFeedback;
    const allowFallback = options && options.allowFallback;

    if (e && e.type === "paste" && !force && isEditableTarget(e.target)) {
      return;
    }

    let handled = false;

    if (showFeedback) {
      showStatus("Reading clipboard...", { type: "info", loading: true, persist: true });
    }

    if (e && e.clipboardData) {
      const items = Array.from(e.clipboardData.items || []);
      const fileItem = items.find(item => item.kind === "file");
      if (fileItem) {
        const file = fileItem.getAsFile();
        if (file) {
          updateFile(file);
          handled = true;
        }
      }

      if (!handled && e.clipboardData.files && e.clipboardData.files.length > 0) {
        updateFile(e.clipboardData.files[0]);
        handled = true;
      }

      if (!handled) {
        const data = e.clipboardData.getData("text/plain");
        if (data) {
          $text.value = data;
          updateText();
          handled = true;
        }
      }
    }

    if (!handled) {
      if (navigator.clipboard && window.isSecureContext) {
        try {
          const binaryHandled = await tryReadClipboardBinary();
          if (binaryHandled) {
            handled = true;
          } else {
            const data = await navigator.clipboard.readText();
            if (data) {
              $text.value = data;
              updateText();
              handled = true;
            }
          }
        } catch (err) {
          showCopyError("Clipboard access denied.");
          return;
        }
      } else {
        showCopyError("Clipboard access denied.");
        return;
      }
    }

    if (handled && showFeedback) {
      showStatus("Clipboard pasted.", { type: "info", timeout: 1500 });
    }

    if (!handled && allowFallback) {
      const triggered = attemptPasteFallback();
      if (triggered) {
        return;
      }
    }

    if (!handled && showFeedback) {
      showStatus("Press Ctrl+V to paste from the clipboard.", { type: "info", timeout: 3000 });
    }

    if (e && handled) {
      e.preventDefault();
    }
  }
  $(document).on("paste", e => pasteText(e, { showFeedback: false }));
  $(".btn-paste").on("click", e => pasteText(e, { force: true, showFeedback: true, allowFallback: true }));

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

  async function tryReadClipboardBinary() {
    if (!navigator.clipboard || !navigator.clipboard.read) {
      return false;
    }
    let items;
    try {
      items = await navigator.clipboard.read();
    } catch (err) {
      return false;
    }
    for (const item of items) {
      const types = item.types || [];
      const imageType = types.find(type => type.startsWith("image/"));
      if (imageType) {
        const blob = await item.getType(imageType);
        updateFile(blob);
        return true;
      }
      const octet = types.find(type => type === "application/octet-stream");
      if (octet) {
        const blob = await item.getType(octet);
        updateFile(blob);
        return true;
      }
    }
    return false;
  }

  function createPasteProxy() {
    const proxy = document.createElement("textarea");
    proxy.className = "paste-proxy";
    proxy.setAttribute("aria-hidden", "true");
    proxy.tabIndex = -1;
    document.body.appendChild(proxy);
    proxy.addEventListener("paste", e => pasteText(e, { force: true, showFeedback: true }));
    return proxy;
  }

  function attemptPasteFallback() {
    if (!$pasteProxy) return false;
    $pasteProxy.value = "";
    $pasteProxy.focus({ preventScroll: true });
    try {
      return document.execCommand("paste");
    } catch (err) {
      return false;
    }
  }

  /* Register the service worker */
  if ("serviceWorker" in navigator) {
    try {
      const reg = await navigator.serviceWorker.register("sw.js", {
        scope: "./"
      });
      if (reg.installing) {
        console.log("Service worker installing");
      } else if (reg.waiting) {
        console.log("Service worker installed");
      } else if (reg.active) {
        console.log("Service worker active");
      }
    } catch (e) {
      console.log(`Registration failed with ${e}`);
    }
  }

  /* Enable installing PWA */
  let deferredPrompt;

  window.addEventListener("beforeinstallprompt", function(e) {
    e.preventDefault();
    deferredPrompt = e;
    $install.style.display = 'block';
  });

  const $install = $(".install");
  $install.addEventListener("click", e => {
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then(choiceResult => {
      if (choiceResult.outcome === "accepted") {
        console.log("User accepted the A2HS prompt");
      } else {
        console.log("User dismissed the A2HS prompt");
      }
      deferredPrompt = null;
    });
  });

  // jQuery-like syntactic sugar. Only queries for one element. Does not loop over multiple like jQuery
  function $(query, baseElement) {
    var el;
    if (typeof query.nodeType === "string") {
      el = query;
    } else if (query[0] === "<") {
      const container = document.createElement("div");
      container.innerHTML = query;
      el = container.firstChild;
    } else if (typeof query === "string") {
      el = document.querySelector.apply(document, arguments);
    } else {
      el = query;
    }

    function addSugar(el) {
      if (el) {
        el.on = function $on(e, fn, ...args) {
          if (args.length > 0) {
            return el.addEventListener(e, fn, ...args);
          } else {
            return el.addEventListener(e, fn, false);
          }
        };

        el.trigger = (eventType, detail) => {
          detail = detail ? { detail: detail } : undefined;
          const e = new CustomEvent(eventType, detail);
          el.dispatchEvent(e);
        };

        el.hasClass = c => el.classList.contains(c);
        el.append = element => el.appendChild($(element));
        el.remove = () => el.parentNode.removeChild(el);
        el.find = q => $(q, el);
      }
      return el;
    }

    return addSugar(el);
  }

  // Show preview placeholder if no preview content
  function showPreviewPlaceholder(message) {
    const $preview = $(".preview");
    if ($preview && $preview.children.length === 0) {
      let placeholder = $preview.querySelector('.preview-placeholder');
      if (!placeholder) {
        placeholder = document.createElement('span');
        placeholder.className = 'preview-placeholder';
        placeholder.style.color = '#888';
        placeholder.textContent = 'No preview available. Select or drop a file above.';
        $preview.appendChild(placeholder);
      }
      if (message) {
        placeholder.textContent = message;
      } else {
        placeholder.textContent = 'No preview available. Select or drop a file above.';
      }
      placeholder.style.display = '';
    }
  }

  // Call showPreviewPlaceholder on load
  document.addEventListener("DOMContentLoaded", showPreviewPlaceholder);
})(this);
