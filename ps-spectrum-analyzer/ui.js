import { AXIS_LABELS, FREQUENCY_LABELS } from './constants.js';
import { frequencyToX } from './utils.js';

export function setupUI(analyzer) {
    setupEventListeners(analyzer);
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
    // Get the appropriate frequency labels
    const frequencies = analyzer.isFullRange ? 
        FREQUENCY_LABELS.FULL_RANGE : 
        FREQUENCY_LABELS.LOW_RANGE;

    // Create label elements with precise positioning
    const labelElements = frequencies.map(({ freq, label }) => {
        const x = frequencyToX(freq, analyzer.elements.canvas, analyzer.isFullRange);
        return `<span style="position: absolute; left: ${x}px; transform: translateX(-50%); white-space: nowrap">${label}</span>`;
    });

    analyzer.elements.freqAxis.style.position = 'relative';
    analyzer.elements.freqAxis.innerHTML = labelElements.join('');
}

function updateDBAxis(analyzer) {
    analyzer.elements.dbAxis.innerHTML = AXIS_LABELS.DB.map(label => 
        `<span style="display: block">${label}</span>`
    ).join('');
}