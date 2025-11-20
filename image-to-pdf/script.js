import { PDFDocument } from 'https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.esm.min.js';

const state = {
    images: [],
    nextId: 1,
    quality: 0.95,
    passthrough: true
};

const elements = {
    fileInput: document.querySelector('#fileInput'),
    browseButton: document.querySelector('#browseButton'),
    dropZone: document.querySelector('#dropZone'),
    gallery: document.querySelector('#gallery'),
    emptyState: document.querySelector('#emptyState'),
    qualitySlider: document.querySelector('#qualitySlider'),
    qualityValue: document.querySelector('#qualityValue'),
    passthroughToggle: document.querySelector('#passthroughToggle'),
    downloadButton: document.querySelector('#downloadButton'),
    resetButton: document.querySelector('#resetButton'),
    statusText: document.querySelector('#statusText'),
    installButton: document.querySelector('#installButton')
};

let draggedCardId = null;
let deferredInstallPrompt = null;

init();

function init() {
    bindFileInputs();
    bindControls();
    bindDragAndDrop();
    setupInstallPrompt();
    registerServiceWorker();
    elements.qualityValue.textContent = Number(elements.qualitySlider.value).toFixed(2);
    setStatus('Waiting for images.');
}

function bindFileInputs() {
    elements.browseButton.addEventListener('click', () => elements.fileInput.click());

    elements.fileInput.addEventListener('change', (event) => {
        handleFiles(event.target.files);
        elements.fileInput.value = '';
    });

    elements.dropZone.addEventListener('click', (event) => {
        if (event.target === elements.fileInput) {
            return;
        }
        if (elements.browseButton.contains(event.target)) {
            return;
        }
        event.preventDefault();
        elements.fileInput.click();
    });

    elements.dropZone.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') {
            return;
        }
        event.preventDefault();
        elements.fileInput.click();
    });
}

function bindControls() {
    elements.dropZone.addEventListener('dragover', (event) => {
        event.preventDefault();
        elements.dropZone.classList.add('dragover');
    });

    elements.dropZone.addEventListener('dragleave', () => {
        elements.dropZone.classList.remove('dragover');
    });

    elements.dropZone.addEventListener('drop', (event) => {
        event.preventDefault();
        elements.dropZone.classList.remove('dragover');
        if (event.dataTransfer?.files?.length) {
            handleFiles(event.dataTransfer.files);
        }
    });

    elements.qualitySlider.addEventListener('input', (event) => {
        const value = Number(event.target.value);
        state.quality = value;
        elements.qualityValue.textContent = value.toFixed(2);
    });

    elements.passthroughToggle.addEventListener('change', (event) => {
        state.passthrough = event.target.checked;
        setStatus(state.passthrough ? 'Passthrough enabled for maximum quality.' : 'Optimization enabled. Images will be recompressed.');
    });

    elements.downloadButton.addEventListener('click', handleDownloadClick);
    elements.resetButton.addEventListener('click', resetApp);
}

function bindDragAndDrop() {
    elements.gallery.addEventListener('dragstart', (event) => {
        const card = event.target.closest('.image-card');
        if (!card) return;
        draggedCardId = card.dataset.id;
        card.classList.add('dragging');
        event.dataTransfer.effectAllowed = 'move';
    });

    elements.gallery.addEventListener('dragend', (event) => {
        const card = event.target.closest('.image-card');
        if (card) {
            card.classList.remove('dragging');
        }
        draggedCardId = null;
        clearDragHighlights();
    });

    elements.gallery.addEventListener('dragover', (event) => {
        event.preventDefault();
        const card = event.target.closest('.image-card');
        if (!card) return;
        card.classList.add('dragover');
    });

    elements.gallery.addEventListener('dragleave', (event) => {
        const card = event.target.closest('.image-card');
        if (card) {
            card.classList.remove('dragover');
        }
    });

    elements.gallery.addEventListener('drop', (event) => {
        event.preventDefault();
        const card = event.target.closest('.image-card');
        if (!card || draggedCardId === null) return;
        reorderImages(draggedCardId, card.dataset.id);
        clearDragHighlights();
    });

    elements.gallery.addEventListener('click', (event) => {
        const removeButton = event.target.closest('.remove-button');
        if (!removeButton) return;
        const id = removeButton.closest('.image-card')?.dataset.id;
        if (id) {
            removeImage(id);
        }
    });
}

function setupInstallPrompt() {
    window.addEventListener('beforeinstallprompt', (event) => {
        event.preventDefault();
        deferredInstallPrompt = event;
        elements.installButton.hidden = false;
    });

    elements.installButton?.addEventListener('click', async () => {
        if (!deferredInstallPrompt) return;
        deferredInstallPrompt.prompt();
        await deferredInstallPrompt.userChoice;
        deferredInstallPrompt = null;
        elements.installButton.hidden = true;
    });
}

function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('sw.js').catch((error) => {
                console.warn('Service worker registration failed:', error);
            });
        });
    }
}

function handleFiles(fileList) {
    const files = Array.from(fileList).filter((file) => /image\/(png|jpe?g)/i.test(file.type));
    if (!files.length) {
        setStatus('No supported files detected. Please add PNG or JPEG images.');
        return;
    }

    Promise.all(files.map(createImageEntry))
        .then((entries) => {
            state.images.push(...entries);
            renderGallery();
            setStatus(`${state.images.length} image${state.images.length === 1 ? '' : 's'} ready.`);
        })
        .catch((error) => {
            console.error(error);
            setStatus('One or more images could not be loaded.');
        });
}

function createImageEntry(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            resolve({
                id: String(state.nextId++),
                name: file.name,
                type: file.type,
                file,
                dataUrl: reader.result
            });
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
    });
}

function renderGallery() {
    elements.gallery.innerHTML = '';
    if (!state.images.length) {
        elements.emptyState.style.display = 'block';
        elements.downloadButton.disabled = true;
        return;
    }

    elements.emptyState.style.display = 'none';
    state.images.forEach((entry, index) => {
        const card = document.createElement('article');
        card.className = 'image-card';
        card.draggable = true;
        card.dataset.id = entry.id;
        card.innerHTML = `
            <div class="page-number">Page ${index + 1}</div>
            <img src="${entry.dataUrl}" alt="Preview of ${sanitize(entry.name)}">
            <div class="filename" title="${sanitize(entry.name)}">${truncate(entry.name)}</div>
            <footer>
                <span>${entry.type.replace('image/', '').toUpperCase()}</span>
                <button type="button" class="remove-button" aria-label="Remove ${sanitize(entry.name)}">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </footer>
        `;
        elements.gallery.appendChild(card);
    });

    elements.downloadButton.disabled = false;
}

function truncate(name, max = 22) {
    return name.length > max ? `${name.slice(0, max - 3)}...` : name;
}

function sanitize(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function removeImage(id) {
    state.images = state.images.filter((entry) => entry.id !== id);
    renderGallery();
    setStatus(state.images.length ? `${state.images.length} image${state.images.length === 1 ? '' : 's'} remaining.` : 'All images removed.');
}

function reorderImages(sourceId, targetId) {
    if (sourceId === targetId) return;
    const fromIndex = state.images.findIndex((entry) => entry.id === sourceId);
    const toIndex = state.images.findIndex((entry) => entry.id === targetId);
    if (fromIndex === -1 || toIndex === -1) return;
    const [moved] = state.images.splice(fromIndex, 1);
    state.images.splice(toIndex, 0, moved);
    renderGallery();
}

async function handleDownloadClick() {
    if (!state.images.length) return;
    const originalLabel = elements.downloadButton.innerHTML;
    elements.downloadButton.disabled = true;
    elements.downloadButton.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i><span>Preparing...</span>';
    setStatus('Preparing PDF. This may take a moment...');

    try {
        const pdfBytes = await buildPdf();
        triggerDownload(pdfBytes);
        setStatus('PDF generated successfully.');
    } catch (error) {
        console.error(error);
        setStatus('Failed to build PDF. Please try again.');
    } finally {
        elements.downloadButton.innerHTML = originalLabel;
        elements.downloadButton.disabled = !state.images.length;
    }
}

async function buildPdf() {
    const pdfDoc = await PDFDocument.create();
    const pageWidth = 612; // US Letter portrait
    const pageHeight = 792;

    for (const entry of state.images) {
        const { bytes, type } = await prepareImage(entry);
        const pdfImage = type === 'image/png'
            ? await pdfDoc.embedPng(bytes)
            : await pdfDoc.embedJpg(bytes);

        const page = pdfDoc.addPage([pageWidth, pageHeight]);
        const { width, height } = pdfImage.scale(1);
        const scale = Math.min(pageWidth / width, pageHeight / height);
        const scaledWidth = width * scale;
        const scaledHeight = height * scale;
        const x = (pageWidth - scaledWidth) / 2;
        const y = (pageHeight - scaledHeight) / 2;

        page.drawImage(pdfImage, { x, y, width: scaledWidth, height: scaledHeight });
    }

    return pdfDoc.save();
}

async function prepareImage(entry) {
    if (state.passthrough) {
        const buffer = await entry.file.arrayBuffer();
        return { bytes: new Uint8Array(buffer), type: entry.type };
    }
    const blob = await reencodeToJpeg(entry.dataUrl, state.quality);
    const buffer = await blob.arrayBuffer();
    return { bytes: new Uint8Array(buffer), type: 'image/jpeg' };
}

function reencodeToJpeg(dataUrl, quality) {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = image.width;
            canvas.height = image.height;
            const context = canvas.getContext('2d');
            context.drawImage(image, 0, 0);
            canvas.toBlob((blob) => {
                if (!blob) {
                    reject(new Error('Failed to encode image.'));
                    return;
                }
                resolve(blob);
            }, 'image/jpeg', clampQuality(quality));
        };
        image.onerror = () => reject(new Error('Image could not be optimized.'));
        image.src = dataUrl;
    });
}

function clampQuality(value) {
    if (Number.isNaN(value)) return 0.95;
    return Math.min(1, Math.max(0, value));
}

function triggerDownload(pdfBytes) {
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `images-${new Date().toISOString().slice(0, 10)}.pdf`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function resetApp() {
    state.images = [];
    state.nextId = 1;
    state.quality = 0.95;
    state.passthrough = true;
    elements.qualitySlider.value = '0.95';
    elements.qualityValue.textContent = '0.95';
    elements.passthroughToggle.checked = true;
    renderGallery();
    setStatus('App reset. Ready for new images.');
}

function setStatus(message) {
    elements.statusText.textContent = message;
}

function clearDragHighlights() {
    elements.gallery.querySelectorAll('.image-card.dragover').forEach((card) => card.classList.remove('dragover'));
}
