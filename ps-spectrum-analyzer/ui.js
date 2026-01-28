import { AXIS_LABELS, FREQUENCY_LABELS } from './constants.js';
import { frequencyToX } from './utils.js';

export function setupUI(analyzer) {
    setupEventListeners(analyzer);
    analyzer.updateAxes = () => createAxisLabels(analyzer);
    createAxisLabels(analyzer);
}

function setupEventListeners(analyzer) {
    const { elements } = analyzer;

    elements.startButton?.addEventListener('click', () => {
        if (analyzer.isRunning) {
            analyzer.stop();
        } else {
            analyzer.start();
        }
    });

    elements.freezeButton?.addEventListener('click', () => {
        analyzer.isFrozen = !analyzer.isFrozen;
        elements.freezeButton.textContent = analyzer.isFrozen ? 'Resume Display' : 'Freeze Display';
    });

    elements.showReferenceLines?.addEventListener('change', (e) => {
        analyzer.showReferenceLines = e.target.checked;
    });

    elements.showNoteOverlay?.addEventListener('change', (e) => {
        analyzer.showNoteOverlay = e.target.checked;
    });

    elements.showPeakHold?.addEventListener('change', (e) => {
        analyzer.showPeakHold = e.target.checked;
        if (analyzer.showPeakHold && analyzer.peakHoldData) {
            analyzer.peakHoldData.fill(-Infinity);
            analyzer.lastPeakResetTime = performance.now();
        }
    });

    elements.autoGain?.addEventListener('change', (e) => {
        analyzer.autoGain = e.target.checked;
        if (analyzer.autoGain) {
            analyzer.currentGainOffset = 0;
        }
    });

    if (elements.freqRangeInputs) {
        elements.freqRangeInputs.forEach(input => {
            input?.addEventListener('change', (e) => {
                analyzer.isFullRange = e.target.value === 'full';
                createAxisLabels(analyzer);
            });
        });
    }
}

function createAxisLabels(analyzer) {
    updateFrequencyAxis(analyzer);
    updateDBAxis(analyzer);
}

function updateFrequencyAxis(analyzer) {
    syncFrequencyAxisLayout(analyzer);

    // Get the appropriate frequency labels
    const frequencies = analyzer.isFullRange ? 
        FREQUENCY_LABELS.FULL_RANGE : 
        FREQUENCY_LABELS.LOW_RANGE;

    // Create label elements with precise positioning
    const labelElements = frequencies.map(({ freq, label }) => {
        const x = frequencyToX(freq, analyzer.elements.canvas, analyzer.isFullRange);
        return `<span style="position: absolute; left: ${x}px; transform: translateX(-50%); white-space: nowrap">${label}</span>`;
    });

    analyzer.elements.freqAxis.innerHTML = labelElements.join('');
}

function updateDBAxis(analyzer) {
    analyzer.elements.dbAxis.innerHTML = AXIS_LABELS.DB.map(label => 
        `<span style="display: block">${label}</span>`
    ).join('');
}

function syncFrequencyAxisLayout(analyzer) {
    const canvas = analyzer.elements.canvas;
    const axis = analyzer.elements.freqAxis;
    const container = canvas?.parentElement;
    if (!canvas || !axis || !container) return;

    const canvasRect = canvas.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const left = canvasRect.left - containerRect.left;

    axis.style.left = `${left}px`;
    axis.style.width = `${canvasRect.width}px`;
    axis.style.right = 'auto';
    axis.style.padding = '0';
    axis.style.position = 'absolute';
}
