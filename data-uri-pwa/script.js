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
  $local.find("button").on("click", e => {
    $local.find("button").parentNode.click();
  });

  async function updateRemote(e) {
    const url = $(".remote").value;
    const res = await fetch(url);
    const blob = await res.blob();

    updateFile(blob);
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
        $preview.append($iframe);

        resizeIframe($iframe);
        break;
    }
  }

  function resizeIframe(iframe) {
    iframe.width = iframe.contentWindow.document.body.scrollWidth;
    iframe.height = iframe.contentWindow.document.body.scrollHeight;
  }

  function copyDataURI(e) {
    const uri = $dataURI.href;
    e.clipboardData.setData("text", uri);
    console.log("copied");
    e.preventDefault();
  }
  $(document).on("copy", copyDataURI, false);
  $(".copy").on("click", () => document.execCommand("copy"), false);

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
})(this);
