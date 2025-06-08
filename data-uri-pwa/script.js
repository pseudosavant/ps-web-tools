(async function(global) {
  const $dataURI = $(".data-uri");

  const $local = $(".local");
  $local.on("change", updateLocal);

  const $remote = $(".remote");
  $remote.on("keyup", updateRemote);

  const $text = $(".text");
  $text.on("keyup", updateText);

  const $drop = $(".drop");
  $drop.on("drop", updateFileDrop);

  function updateLocal(e) {
    const file = $local.files[0];
    updateFile(file);
  }
  $local.parentNode.querySelector("button").addEventListener("click", e => {
    $local.click();
  });

  async function updateRemote(e) {
    const url = $(".remote").value;
    if (!url) return;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error("Network response was not ok");
      const blob = await res.blob();
      updateFile(blob);
    } catch (err) {
      alert("Failed to fetch remote file: " + err.message);
    }
  }

  function updateText(e) {
    const base64 = btoa(unescape(encodeURIComponent($text.value)));
    const type = "text/plain";

    const dataURI = `data:${type};base64,${base64}`;
    updateDataURI(dataURI, type);
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
    const reader = new FileReader();
    reader.addEventListener(
      "load",
      () => updateDataURI(reader.result, file.type),
      false
    );

    if (file) {
      reader.readAsDataURL(file);
    }
  }

  function updateDataURI(uri, type) {
    $dataURI.setAttribute("href", uri);

    const $preview = $(".preview");
    $preview.innerHTML = "";

    // Hide preview placeholder if present
    if ($preview.querySelector('.preview-placeholder')) {
      $preview.querySelector('.preview-placeholder').style.display = 'none';
    }

    const baseType = type.split("/")[0];

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
    const uri = $dataURI.href;
    if (e && e.clipboardData) {
      e.clipboardData.setData("text/plain", uri);
      e.preventDefault();
      showCopySuccess();
    }
  }
  $(document).on("copy", copyDataURI, false);
  $(".copy").on("click", () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText($dataURI.href).then(showCopySuccess);
    } else {
      document.execCommand("copy");
      showCopySuccess();
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

  async function pasteText(e) {
    const data = await navigator.clipboard.readText();
    $text.value = data;
    updateText();

    e.preventDefault();
  }
  $(document).on("paste", pasteText);
  $(".btn-paste").on("click", pasteText);

  /* Register the service worker */
  if ("serviceWorker" in navigator) {
    try {
      const reg = await navigator.serviceWorker.register("sw.js", {
        scope: "/"
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
  function showPreviewPlaceholder() {
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
      placeholder.style.display = '';
    }
  }

  // Call showPreviewPlaceholder on load
  document.addEventListener("DOMContentLoaded", showPreviewPlaceholder);
})(this);
