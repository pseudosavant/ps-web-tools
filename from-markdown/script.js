const pendingLaunchFileHandles = [];
let onLaunchFiles = null;

if ('launchQueue' in window && typeof window.launchQueue.setConsumer === 'function') {
    window.launchQueue.setConsumer((launchParams) => {
        const files = (launchParams && launchParams.files) ? launchParams.files : [];
        if (!files.length) {
            return;
        }
        if (typeof onLaunchFiles === 'function') {
            onLaunchFiles(files);
        } else {
            pendingLaunchFileHandles.push(...files);
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    const editor = document.getElementById('editor');
    const previewFrame = document.getElementById('previewFrame');
    const convertClipboardBtn = document.getElementById('convertClipboardBtn');
    const copyHtmlBtn = document.getElementById('copyHtmlBtn');
    const clearBtn = document.getElementById('clearBtn');
    const pasteBtn = document.getElementById('pasteBtn');
    const copySuccessEl = document.getElementById('copySuccess');
    const pasteError = document.getElementById('pasteError');
    const sanitizedToggle = document.getElementById('sanitizedToggle');

    let currentHtml = '';

    async function registerServiceWorker() {
        if (!('serviceWorker' in navigator)) {
            return;
        }
        try {
            await navigator.serviceWorker.register('./sw.js');
        } catch (err) {
            console.log('Service worker registration failed:', err.message);
        }
    }

    function markdownToHtml(markdown) {
        if (!markdown.trim()) {
            return '';
        }
        return marked.parse(markdown, { mangle: false, headerIds: false });
    }

    function sanitizeHtml(html) {
        return DOMPurify.sanitize(html, {
            FORBID_TAGS: ['script', 'iframe', 'object', 'embed'],
            FORBID_ATTR: ['style'],
            ALLOW_UNKNOWN_PROTOCOLS: false
        });
    }

    function renderPreview(html) {
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        const frameCss = prefersDark
            ? 'body{background:#2a2a2a;color:#e0e0e0;}a{color:#7db8ff;}code,pre{background:#1f1f1f;color:#e0e0e0;border:1px solid #3a3a3a;}blockquote{border-left:4px solid #555;color:#cfcfcf;}table,th,td{border:1px solid #555;}th{background:#333;}'
            : 'body{background:#f5f5f5;color:#333;}a{color:#0066cc;}code,pre{background:#f0f0f0;color:#222;border:1px solid #ddd;}blockquote{border-left:4px solid #ccc;color:#555;}table,th,td{border:1px solid #ccc;}th{background:#f2f2f2;}';

        const srcDoc = `<!doctype html><html><head><meta charset="utf-8"><style>
            *{box-sizing:border-box}
            body{margin:0;padding:1rem;font-family:system-ui,-apple-system,sans-serif;line-height:1.5;overflow-wrap:anywhere}
            img{max-width:100%;height:auto}
            pre{padding:0.8rem;overflow:auto;border-radius:4px}
            code{padding:0.1rem 0.3rem;border-radius:3px}
            table{border-collapse:collapse;width:100%;margin:1rem 0}
            th,td{padding:0.5rem;text-align:left;vertical-align:top}
            ${frameCss}
        </style></head><body>${html}</body></html>`;

        previewFrame.setAttribute('sandbox', '');
        previewFrame.srcdoc = srcDoc;
    }

    function convertToHtml() {
        const parsedHtml = markdownToHtml(editor.value);
        currentHtml = sanitizedToggle.checked ? sanitizeHtml(parsedHtml) : parsedHtml;
        renderPreview(currentHtml);
    }

    function scheduleRenderSync() {
        setTimeout(() => {
            if (!editor.value.trim()) {
                return;
            }
            if (!currentHtml.trim()) {
                convertToHtml();
                return;
            }
            const bodyIsEmpty = !previewFrame.srcdoc || previewFrame.srcdoc.includes('<body></body>');
            if (bodyIsEmpty) {
                renderPreview(currentHtml);
            }
        }, 0);
    }

    function startStartupSyncWatcher() {
        let attempts = 0;
        const maxAttempts = 30;
        const intervalMs = 200;

        const timerId = setInterval(() => {
            attempts += 1;

            const hasMarkdown = Boolean(editor.value.trim());
            if (hasMarkdown) {
                const previewLooksEmpty = !previewFrame.srcdoc || previewFrame.srcdoc.includes('<body></body>');
                if (!currentHtml.trim() || previewLooksEmpty) {
                    convertToHtml();
                }
            }

            if (attempts >= maxAttempts) {
                clearInterval(timerId);
            }
        }, intervalMs);
    }

    function showTransientSuccess(message) {
        copySuccessEl.textContent = message;
        copySuccessEl.style.display = 'block';
        setTimeout(() => {
            copySuccessEl.style.display = 'none';
        }, 2000);
    }

    function extractPlainTextFromHtml(html) {
        const wrapper = document.createElement('div');
        wrapper.innerHTML = html;
        return wrapper.textContent || wrapper.innerText || '';
    }

    function isSupportedTextFile(file) {
        if (!file) return false;
        if (file.type && file.type.startsWith('text/')) {
            return true;
        }
        return /\.(txt|md|markdown|mdown|mkd)$/i.test(file.name || '');
    }

    async function loadMarkdownFile(file) {
        if (!isSupportedTextFile(file)) {
            pasteError.innerHTML = `
                <i class="fas fa-exclamation-triangle"></i>
                Unsupported file type. Drop a <kbd>.md</kbd> or <kbd>.txt</kbd> file.
            `;
            pasteError.style.display = 'block';
            setTimeout(() => {
                pasteError.style.display = 'none';
            }, 3000);
            return false;
        }

        try {
            const text = await file.text();
            editor.value = text;
            convertToHtml();
            scheduleRenderSync();
            showTransientSuccess(`Loaded ${file.name}`);
            return true;
        } catch (err) {
            pasteError.innerHTML = `
                <i class="fas fa-exclamation-triangle"></i>
                Unable to open that file.
            `;
            pasteError.style.display = 'block';
            setTimeout(() => {
                pasteError.style.display = 'none';
            }, 3000);
            return false;
        }
    }

    async function pasteFromClipboard({ autoConvertAfterPaste = true } = {}) {
        pasteError.style.display = 'none';

        try {
            if (!navigator.clipboard || !navigator.clipboard.read) {
                throw new Error('Clipboard read not supported');
            }

            const items = await navigator.clipboard.read();
            let text = '';
            let html = '';

            for (const item of items) {
                if (!text && item.types.includes('text/plain')) {
                    const blob = await item.getType('text/plain');
                    text = await blob.text();
                }

                if (!html && item.types.includes('text/html')) {
                    const blob = await item.getType('text/html');
                    html = await blob.text();
                }
            }

            if (text) {
                editor.value = text;
            } else if (html) {
                editor.value = extractPlainTextFromHtml(html);
            } else {
                throw new Error('No compatible clipboard data');
            }

            if (autoConvertAfterPaste) {
                setTimeout(convertToHtml, 100);
            }
            return true;
        } catch (err) {
            pasteError.innerHTML = `
                <i class="fas fa-exclamation-triangle"></i>
                Unable to read clipboard. Please use <kbd>Ctrl/Cmd+V</kbd> to paste.
            `;
            pasteError.style.display = 'block';
            setTimeout(() => {
                pasteError.style.display = 'none';
            }, 3000);
            return false;
        }
    }

    editor.addEventListener('paste', (e) => {
        e.preventDefault();
        const text = e.clipboardData.getData('text/plain');
        if (text) {
            editor.value = text;
        } else {
            const html = e.clipboardData.getData('text/html');
            editor.value = extractPlainTextFromHtml(html);
        }
        setTimeout(convertToHtml, 100);
    });

    editor.addEventListener('input', () => {
        clearTimeout(editor.convertTimeout);
        editor.convertTimeout = setTimeout(convertToHtml, 300);
    });

    editor.addEventListener('dragenter', (e) => {
        e.preventDefault();
        e.stopPropagation();
        editor.classList.add('drag-over');
    });

    editor.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        editor.classList.add('drag-over');
    });

    editor.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        editor.classList.remove('drag-over');
    });

    editor.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        editor.classList.remove('drag-over');

        const files = e.dataTransfer && e.dataTransfer.files;
        if (!files || !files.length) {
            return;
        }

        loadMarkdownFile(files[0]);
    });

    sanitizedToggle.addEventListener('change', () => {
        convertToHtml();
    });

    function isEditableElement(element) {
        if (!element) return false;
        if (element.isContentEditable) return true;
        const tag = element.tagName;
        if (tag === 'TEXTAREA') return true;
        if (tag === 'INPUT') {
            const type = (element.type || '').toLowerCase();
            return ['text', 'search', 'url', 'tel', 'email', 'password'].includes(type);
        }
        return false;
    }

    function canReadClipboard() {
        return Boolean(navigator.clipboard && navigator.clipboard.read);
    }

    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'v') {
            if (canReadClipboard()) {
                e.preventDefault();
                pasteBtn.click();
                return;
            }
            if (!isEditableElement(document.activeElement)) {
                e.preventDefault();
                pasteBtn.click();
            }
            return;
        }

        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'V') {
            e.preventDefault();
            pasteFromClipboard({ autoConvertAfterPaste: false }).then((didPaste) => {
                if (!didPaste) {
                    return;
                }
                convertToHtml();
                if (currentHtml.trim()) {
                    copyToClipboard(currentHtml, 'HTML copied to clipboard!');
                }
            });
        }

        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'C') {
            e.preventDefault();
            if (currentHtml.trim()) {
                copyHtmlBtn.click();
            }
        }

        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'X') {
            e.preventDefault();
            clearBtn.click();
        }
    });

    function initTooltips() {
        const tooltips = [
            { element: convertClipboardBtn, text: 'Paste, convert to HTML, and copy (Ctrl+Shift+V)' },
            { element: pasteBtn, text: 'Paste content from clipboard (Ctrl+V)' },
            { element: copyHtmlBtn, text: 'Copy HTML to clipboard (Ctrl+Shift+C)' },
            { element: clearBtn, text: 'Clear all content (Ctrl+Shift+X)' },
            { element: sanitizedToggle.parentElement, text: 'Sanitize generated HTML before preview/copy' }
        ];

        tooltips.forEach(({ element, text }) => {
            element.setAttribute('title', text);
            element.setAttribute('data-tooltip', text);
        });
    }

    async function copyToClipboard(text, message = 'Copied to clipboard!') {
        let copySuccess = false;

        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(text);
                copySuccess = true;
            }
        } catch (err) {
            console.log('Clipboard API copy failed:', err.message);
        }

        if (!copySuccess) {
            try {
                const textarea = document.createElement('textarea');
                textarea.value = text;
                textarea.setAttribute('readonly', '');
                textarea.style.position = 'absolute';
                textarea.style.left = '-9999px';
                document.body.appendChild(textarea);

                textarea.select();
                textarea.setSelectionRange(0, 99999);
                const success = document.execCommand('copy');
                document.body.removeChild(textarea);
                if (success) {
                    copySuccess = true;
                }
            } catch (err) {
                console.log('execCommand copy failed:', err.message);
            }
        }

        if (copySuccess) {
            showTransientSuccess(message);
        } else {
            pasteError.innerHTML = `
                <i class="fas fa-exclamation-triangle"></i>
                Copy failed. Please select the text and use <kbd>Ctrl+C</kbd> to copy manually.
            `;
            pasteError.style.display = 'block';
            setTimeout(() => {
                pasteError.style.display = 'none';
            }, 3000);
        }
    }

    pasteBtn.addEventListener('click', () => {
        editor.focus();
        pasteFromClipboard();
    });

    convertClipboardBtn.addEventListener('click', () => {
        editor.focus();
        pasteFromClipboard({ autoConvertAfterPaste: false }).then((didPaste) => {
            if (!didPaste) {
                return;
            }
            convertToHtml();
            if (currentHtml.trim()) {
                copyToClipboard(currentHtml, 'HTML copied to clipboard!');
            }
        });
    });

    copyHtmlBtn.addEventListener('click', () => {
        copyToClipboard(currentHtml, 'HTML copied to clipboard!');
    });

    clearBtn.addEventListener('click', () => {
        editor.value = '';
        currentHtml = '';
        renderPreview('');
        copySuccessEl.style.display = 'none';
    });

    async function handleLaunchFiles(files) {
        if (!files || !files.length) {
            return;
        }
        try {
            const firstHandle = files[0];
            const file = await firstHandle.getFile();
            await loadMarkdownFile(file);
            scheduleRenderSync();
            requestAnimationFrame(() => {
                scheduleRenderSync();
            });
        } catch (err) {
            pasteError.innerHTML = `
                <i class="fas fa-exclamation-triangle"></i>
                Unable to open launch file.
            `;
            pasteError.style.display = 'block';
            setTimeout(() => {
                pasteError.style.display = 'none';
            }, 3000);
        }
    }

    initTooltips();
    if (editor.value.trim()) {
        convertToHtml();
    } else {
        renderPreview('');
    }
    scheduleRenderSync();
    startStartupSyncWatcher();
    registerServiceWorker();

    window.addEventListener('pageshow', () => {
        scheduleRenderSync();
    });

    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            scheduleRenderSync();
        }
    });

    onLaunchFiles = (files) => {
        handleLaunchFiles(files);
    };

    if (pendingLaunchFileHandles.length) {
        const queued = pendingLaunchFileHandles.splice(0);
        handleLaunchFiles(queued);
    }
});
