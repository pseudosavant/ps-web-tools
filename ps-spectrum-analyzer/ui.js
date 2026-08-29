import { AXIS_LABELS, FREQUENCY_LABELS } from './constants.js?v=5';
import { frequencyToX } from './utils.js?v=5';

export function setupUI(analyzer) {
    setupEventListeners(analyzer);
    setupFullscreen(analyzer);
    analyzer.updateAxes = () => createAxisLabels(analyzer);
    createAxisLabels(analyzer);
}

function setupFullscreen(analyzer) {
    const { fullscreenButton, visualizerContainer } = analyzer.elements;
    const isSupported = Boolean(document.fullscreenEnabled && visualizerContainer?.requestFullscreen);
    let isFullscreen = false;

    if (!isSupported) {
        fullscreenButton.disabled = true;
        fullscreenButton.title = 'Full-screen mode is not supported by this browser.';
        return;
    }

    fullscreenButton.addEventListener('click', async () => {
        try {
            if (document.fullscreenElement === visualizerContainer) {
                await document.exitFullscreen();
            } else {
                await visualizerContainer.requestFullscreen();
            }
        } catch (error) {
            analyzer.elements.status.textContent = `Unable to change full-screen mode: ${error.message}`;
        }
    });

    const syncFullscreenState = () => {
        const nextIsFullscreen = document.fullscreenElement === visualizerContainer;
        if (nextIsFullscreen === isFullscreen) return;

        isFullscreen = nextIsFullscreen;
        fullscreenButton.textContent = isFullscreen ? 'Exit Full Screen' : 'Full Screen';
        fullscreenButton.setAttribute('aria-pressed', String(isFullscreen));
        visualizerContainer.classList.toggle('is-fullscreen', isFullscreen);
        analyzer.spectrumLayout = null;
        requestAnimationFrame(() => createAxisLabels(analyzer));

        analyzer.elements.status.textContent = isFullscreen
            ? 'Spectrum display is full screen. Press Escape to exit.'
            : 'Exited full-screen spectrum display.';
    };

    document.addEventListener('fullscreenchange', syncFullscreenState);

    // Fullscreen transitions resize the panel. This also keeps the toggle state
    // accurate in browsers that occasionally miss a fullscreenchange event.
    const fullscreenResizeObserver = new ResizeObserver(syncFullscreenState);
    fullscreenResizeObserver.observe(visualizerContainer);

    document.addEventListener('fullscreenerror', () => {
        analyzer.elements.status.textContent = 'The browser could not open the spectrum display full screen.';
    });
}

function setupEventListeners(analyzer) {
    const { elements } = analyzer;

    elements.startButton.addEventListener('click', async () => {
        if (analyzer.isRunning) await analyzer.stop();
        else await analyzer.start();
    });

    elements.freezeButton.addEventListener('click', () => {
        analyzer.toggleFreeze();
    });

    elements.deviceSelect.addEventListener('change', () => {
        void analyzer.switchDevice();
    });

    elements.showReferenceLines.addEventListener('change', event => {
        analyzer.showReferenceLines = event.target.checked;
    });

    elements.showNoteOverlay.addEventListener('change', event => {
        analyzer.showNoteOverlay = event.target.checked;
    });

    elements.showPeakHold.addEventListener('change', event => {
        analyzer.showPeakHold = event.target.checked;
        analyzer.resetPeaks({ announce: false });
    });

    elements.resetPeaksButton.addEventListener('click', () => {
        analyzer.resetPeaks();
    });

    elements.autoGain.addEventListener('change', event => {
        analyzer.autoGain = event.target.checked;
        analyzer.currentGainOffset = 0;
    });

    elements.freqRangeInputs.forEach(input => {
        input.addEventListener('change', event => {
            analyzer.isFullRange = event.target.value === 'full';
            analyzer.spectrumLayout = null;
            analyzer.currentGainOffset = 0;
            analyzer.resetPeaks({ announce: false });
            createAxisLabels(analyzer);
        });
    });
}

function createAxisLabels(analyzer) {
    updateFrequencyAxis(analyzer);
    updateDBAxis(analyzer);
}

function updateFrequencyAxis(analyzer) {
    syncFrequencyAxisLayout(analyzer);
    const frequencies = analyzer.isFullRange
        ? FREQUENCY_LABELS.FULL_RANGE
        : FREQUENCY_LABELS.LOW_RANGE;
    const axis = analyzer.elements.freqAxis;
    const canvas = analyzer.elements.canvas;
    const axisWidth = canvas.clientWidth;
    const labels = frequencies.map(({ freq, label }, index) => {
        const element = document.createElement('span');
        element.textContent = label;
        element.style.position = 'absolute';
        element.style.whiteSpace = 'nowrap';

        if (index === 0) {
            element.style.left = '0';
        } else if (index === frequencies.length - 1) {
            element.style.right = '0';
        } else {
            element.style.left = `${frequencyToX(freq, canvas, analyzer.isFullRange)}px`;
            element.style.transform = 'translateX(-50%)';
        }
        return element;
    });

    axis.replaceChildren(...labels);
    hideOverlappingLabels(labels, frequencies, canvas, axisWidth, analyzer.isFullRange);
}

function hideOverlappingLabels(labels, frequencies, canvas, axisWidth, isFullRange) {
    if (labels.length < 3 || !axisWidth) return;

    const gap = 8;
    const metrics = labels.map((label, index) => {
        const width = label.offsetWidth;
        if (index === 0) return { left: 0, right: width };
        if (index === labels.length - 1) return { left: axisWidth - width, right: axisWidth };

        const x = frequencyToX(frequencies[index].freq, canvas, isFullRange);
        return { left: x - width / 2, right: x + width / 2 };
    });

    labels.forEach(label => { label.hidden = true; });
    labels[0].hidden = false;

    let lastRight = metrics[0].right;
    const reservedLastLeft = metrics.at(-1).left;
    for (let index = 1; index < labels.length - 1; index++) {
        const metric = metrics[index];
        if (metric.left >= lastRight + gap && metric.right <= reservedLastLeft - gap) {
            labels[index].hidden = false;
            lastRight = metric.right;
        }
    }

    labels.at(-1).hidden = false;
}

function updateDBAxis(analyzer) {
    const labels = AXIS_LABELS.DB.map(label => {
        const element = document.createElement('span');
        element.textContent = label;
        return element;
    });
    analyzer.elements.dbAxis.replaceChildren(...labels);
}

function syncFrequencyAxisLayout(analyzer) {
    const canvas = analyzer.elements.canvas;
    const axis = analyzer.elements.freqAxis;
    const container = canvas?.parentElement;
    if (!canvas || !axis || !container) return;

    const canvasRect = canvas.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    axis.style.left = `${canvasRect.left - containerRect.left}px`;
    axis.style.width = `${canvasRect.width}px`;
    axis.style.right = 'auto';
    axis.style.padding = '0';
    axis.style.position = 'absolute';
}
