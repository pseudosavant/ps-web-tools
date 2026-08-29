import { frequencyToX, xToFrequency, findNearestNote } from './utils.js?v=5';
import { REFERENCE_LINES } from './constants.js?v=5';

export function setupVisualization(analyzer) {
    setupCanvas(analyzer);
    setupTooltip(analyzer);
}

function setupCanvas(analyzer) {
    updateCanvasPalette(analyzer);

    const resize = () => {
        const canvas = analyzer.elements.canvas;
        const rect = canvas.getBoundingClientRect();
        const width = Math.max(1, Math.floor(rect.width));
        const height = Math.max(1, Math.floor(rect.height));
        const pixelRatio = Math.max(1, window.devicePixelRatio || 1);
        const bitmapWidth = Math.max(1, Math.round(width * pixelRatio));
        const bitmapHeight = Math.max(1, Math.round(height * pixelRatio));

        if (canvas.width !== bitmapWidth || canvas.height !== bitmapHeight) {
            canvas.width = bitmapWidth;
            canvas.height = bitmapHeight;
        }

        analyzer.canvasPixelRatio = pixelRatio;
        analyzer.canvasCtx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
        analyzer.spectrumLayout = null;
        analyzer.updateAxes?.();

        if (!analyzer.isRunning) clearVisualization(analyzer);
    };

    resize();
    if ('ResizeObserver' in window) {
        analyzer.resizeObserver = new ResizeObserver(resize);
        analyzer.resizeObserver.observe(analyzer.elements.canvas);
    } else {
        window.addEventListener('resize', resize);
    }

    const colorScheme = window.matchMedia('(prefers-color-scheme: dark)');
    colorScheme.addEventListener?.('change', () => {
        requestAnimationFrame(() => {
            updateCanvasPalette(analyzer);
            renderCurrentVisualization(analyzer);
        });
    });
}

function updateCanvasPalette(analyzer) {
    const styles = getComputedStyle(analyzer.elements.visualizerContainer);
    const color = (property, fallback) => styles.getPropertyValue(property).trim() || fallback;

    analyzer.canvasPalette = {
        background: color('--visualizer-bg', '#f3faff'),
        spectrumLow: color('--visualizer-spectrum-low', '#1d6fa8'),
        spectrumHigh: color('--visualizer-spectrum-high', '#a3204c'),
        peak: color('--visualizer-peak', '#8a6500'),
        noteLine: color('--visualizer-note-line', 'rgba(29, 111, 168, 0.58)'),
        noteText: color('--visualizer-note-text', '#145a8a'),
        labelOutline: color('--visualizer-label-outline', 'rgba(243, 250, 255, 0.94)')
    };
}

function setupTooltip(analyzer) {
    const canvas = analyzer.elements.canvas;
    let hideTimer = null;
    let keyboardX = null;

    const hideTooltip = () => {
        window.clearTimeout(hideTimer);
        analyzer.elements.tooltip.style.display = 'none';
        analyzer.elements.tooltip.setAttribute('aria-hidden', 'true');
    };

    const showFromPointer = event => {
        if (!analyzer.analyser || !analyzer.frequencyData) return;
        const rect = canvas.getBoundingClientRect();
        showTooltip(analyzer, event.clientX - rect.left, event.clientY - rect.top);

        if (event.pointerType === 'touch') {
            window.clearTimeout(hideTimer);
            hideTimer = window.setTimeout(hideTooltip, 1800);
        }
    };

    canvas.addEventListener('pointermove', showFromPointer);
    canvas.addEventListener('pointerdown', showFromPointer);
    canvas.addEventListener('pointerleave', event => {
        if (event.pointerType !== 'touch') hideTooltip();
    });

    canvas.addEventListener('focus', () => {
        keyboardX = canvas.clientWidth / 2;
        showTooltip(analyzer, keyboardX, canvas.clientHeight / 2);
    });

    canvas.addEventListener('blur', hideTooltip);
    canvas.addEventListener('keydown', event => {
        if (!analyzer.analyser || !analyzer.frequencyData) return;
        const step = event.shiftKey ? 40 : 10;

        if (event.key === 'Home') keyboardX = 0;
        else if (event.key === 'End') keyboardX = canvas.clientWidth;
        else if (event.key === 'ArrowLeft') keyboardX = Math.max(0, (keyboardX ?? canvas.clientWidth / 2) - step);
        else if (event.key === 'ArrowRight') keyboardX = Math.min(canvas.clientWidth, (keyboardX ?? canvas.clientWidth / 2) + step);
        else return;

        event.preventDefault();
        showTooltip(analyzer, keyboardX, canvas.clientHeight / 2);
    });
}

function showTooltip(analyzer, x, y) {
    if (!analyzer.analyser || !analyzer.audioContext || !analyzer.frequencyData) return;

    const canvas = analyzer.elements.canvas;
    const width = canvas.clientWidth;
    if (!width) return;

    const clampedX = Math.max(0, Math.min(x, width));
    const frequency = xToFrequency(clampedX, canvas, analyzer.isFullRange);
    const binSize = analyzer.audioContext.sampleRate / analyzer.analyser.fftSize;
    const bin = Math.max(
        0,
        Math.min(analyzer.frequencyData.length - 1, Math.round(frequency / binSize))
    );
    const exactFrequency = Math.round(bin * binSize);
    const rawDb = Number.isFinite(analyzer.frequencyData[bin])
        ? Math.max(analyzer.minDb, analyzer.frequencyData[bin])
        : analyzer.minDb;
    const displayDb = Math.max(
        analyzer.minDb,
        Math.min(analyzer.maxDb, rawDb + analyzer.currentGainOffset)
    );
    const nearestNote = findNearestNote(exactFrequency, analyzer.noteFrequencies);

    let text = `${exactFrequency}Hz: ${Math.round(displayDb)}dB display`;
    if (analyzer.autoGain) {
        text += ` (${Math.round(rawDb)}dB input, ${formatSigned(analyzer.currentGainOffset)}dB gain)`;
    }
    if (nearestNote) text += ` · ${nearestNote.note}`;

    const tooltip = analyzer.elements.tooltip;
    const container = canvas.parentElement;
    tooltip.textContent = text;
    tooltip.style.display = 'block';
    tooltip.setAttribute('aria-hidden', 'false');

    const canvasLeft = canvas.offsetLeft;
    const canvasTop = canvas.offsetTop;
    const desiredLeft = canvasLeft + clampedX + 10;
    const desiredTop = canvasTop + Math.max(0, y - 24);
    const maxLeft = Math.max(8, container.clientWidth - tooltip.offsetWidth - 8);
    const maxTop = Math.max(8, container.clientHeight - tooltip.offsetHeight - 8);
    tooltip.style.left = `${Math.max(8, Math.min(desiredLeft, maxLeft))}px`;
    tooltip.style.top = `${Math.max(8, Math.min(desiredTop, maxTop))}px`;
}

export function startDrawing(analyzer) {
    if (analyzer.animationFrameId !== null || !analyzer.isRunning || analyzer.isFrozen) return;

    const frame = timestamp => {
        analyzer.animationFrameId = null;
        if (!analyzer.isRunning || analyzer.isFrozen) return;

        const deltaSeconds = analyzer.lastFrameTime
            ? Math.min(0.25, Math.max(0, (timestamp - analyzer.lastFrameTime) / 1000))
            : 1 / 60;
        analyzer.lastFrameTime = timestamp;
        drawFrame(analyzer, timestamp, deltaSeconds);

        if (analyzer.isRunning && !analyzer.isFrozen) {
            analyzer.animationFrameId = requestAnimationFrame(frame);
        }
    };

    analyzer.lastFrameTime = 0;
    analyzer.animationFrameId = requestAnimationFrame(frame);
}

export function stopDrawing(analyzer) {
    if (analyzer.animationFrameId !== null) {
        cancelAnimationFrame(analyzer.animationFrameId);
        analyzer.animationFrameId = null;
    }
    analyzer.lastFrameTime = 0;
}

function drawFrame(analyzer, timestamp, deltaSeconds) {
    analyzer.analyser.getFloatFrequencyData(analyzer.frequencyData);
    const layout = ensureSpectrumLayout(analyzer);

    updatePeakHold(analyzer, layout, deltaSeconds);
    aggregateSpectrum(analyzer, layout);
    const gainOffset = updateAutoGain(analyzer, analyzer.pixelData, deltaSeconds);

    renderCurrentVisualization(analyzer, gainOffset);
    updateAccessibleSummary(analyzer, timestamp, gainOffset);
}

function ensureSpectrumLayout(analyzer) {
    const canvas = analyzer.elements.canvas;
    const width = Math.max(1, Math.floor(canvas.clientWidth));
    const maxFrequency = analyzer.isFullRange ? 20000 : 500;
    const sampleRate = analyzer.audioContext.sampleRate;
    const fftSize = analyzer.analyser.fftSize;
    const key = `${width}:${maxFrequency}:${sampleRate}:${fftSize}`;

    if (analyzer.spectrumLayout?.key === key) return analyzer.spectrumLayout;

    const binSize = sampleRate / fftSize;
    const minBin = Math.max(0, Math.ceil(20 / binSize));
    const maxBin = Math.min(
        analyzer.frequencyData.length - 1,
        Math.floor(maxFrequency / binSize)
    );
    const binPixels = new Int32Array(maxBin - minBin + 1);
    for (let bin = minBin; bin <= maxBin; bin++) {
        const frequency = bin * binSize;
        binPixels[bin - minBin] = Math.max(
            0,
            Math.min(width - 1, Math.floor(frequencyToX(frequency, canvas, analyzer.isFullRange)))
        );
    }

    const sampleBins = new Int32Array(width);
    for (let x = 0; x < width; x++) {
        const frequency = xToFrequency(x + 0.5, canvas, analyzer.isFullRange);
        sampleBins[x] = Math.max(
            minBin,
            Math.min(maxBin, Math.round(frequency / binSize))
        );
    }

    analyzer.pixelData = new Float32Array(width);
    analyzer.peakPixelData = new Float32Array(width);
    analyzer.spectrumLayout = {
        key,
        width,
        minBin,
        maxBin,
        binPixels,
        sampleBins
    };
    resetPeakHold(analyzer);
    return analyzer.spectrumLayout;
}

function aggregateSpectrum(analyzer, layout) {
    const { pixelData, peakPixelData, frequencyData, peakHoldData } = analyzer;
    pixelData.fill(-Infinity);
    peakPixelData.fill(-Infinity);

    for (let bin = layout.minBin; bin <= layout.maxBin; bin++) {
        const x = layout.binPixels[bin - layout.minBin];
        if (frequencyData[bin] > pixelData[x]) pixelData[x] = frequencyData[bin];
        if (analyzer.showPeakHold && peakHoldData[bin] > peakPixelData[x]) {
            peakPixelData[x] = peakHoldData[bin];
        }
    }

    for (let x = 0; x < layout.width; x++) {
        const sampleBin = layout.sampleBins[x];
        if (!Number.isFinite(pixelData[x])) pixelData[x] = frequencyData[sampleBin];
        if (analyzer.showPeakHold && !Number.isFinite(peakPixelData[x])) {
            peakPixelData[x] = peakHoldData[sampleBin];
        }
    }
}

function updateAutoGain(analyzer, visibleData, deltaSeconds) {
    if (!analyzer.autoGain) {
        analyzer.currentGainOffset = 0;
        return 0;
    }

    let sum = 0;
    let count = 0;
    for (const value of visibleData) {
        if (Number.isFinite(value) && value > analyzer.minDb) {
            sum += value;
            count++;
        }
    }

    const desiredOffset = count
        ? Math.max(-30, Math.min(60, analyzer.targetLevel - (sum / count)))
        : 0;
    const blend = 1 - Math.exp(-(deltaSeconds * 1000) / analyzer.gainTimeConstant);
    analyzer.currentGainOffset += (desiredOffset - analyzer.currentGainOffset) * blend;
    analyzer.currentGainOffset = Math.max(-30, Math.min(60, analyzer.currentGainOffset));
    return analyzer.currentGainOffset;
}

function updatePeakHold(analyzer, layout, deltaSeconds) {
    if (!analyzer.showPeakHold || !analyzer.peakHoldData) return;

    const decay = analyzer.peakHoldDecayPerSecond * deltaSeconds;
    for (let bin = layout.minBin; bin <= layout.maxBin; bin++) {
        const current = analyzer.frequencyData[bin];
        const peak = analyzer.peakHoldData[bin];
        analyzer.peakHoldData[bin] = current > peak ? current : Math.max(-Infinity, peak - decay);
    }
}

export function resetPeakHold(analyzer) {
    analyzer.peakHoldData?.fill(-Infinity);
    analyzer.peakPixelData?.fill(-Infinity);
}

export function clearVisualization(analyzer) {
    const width = analyzer.elements.canvas.clientWidth || 1;
    const height = analyzer.elements.canvas.clientHeight || 1;
    analyzer.canvasCtx.fillStyle = analyzer.canvasPalette?.background || '#f3faff';
    analyzer.canvasCtx.fillRect(0, 0, width, height);
}

function renderCurrentVisualization(analyzer, gainOffset = analyzer.currentGainOffset) {
    clearVisualization(analyzer);
    if (!analyzer.pixelData || !analyzer.peakPixelData) return;

    drawSpectrum(analyzer, analyzer.pixelData, analyzer.peakPixelData, gainOffset);
    drawOverlays(analyzer);
}

function drawSpectrum(analyzer, data, peakData, gainOffset) {
    const height = analyzer.elements.canvas.clientHeight;
    const dbRange = analyzer.maxDb - analyzer.minDb;
    const spectrumGradient = analyzer.canvasCtx.createLinearGradient(0, height, 0, 0);
    spectrumGradient.addColorStop(0, analyzer.canvasPalette.spectrumLow);
    spectrumGradient.addColorStop(1, analyzer.canvasPalette.spectrumHigh);
    analyzer.canvasCtx.fillStyle = spectrumGradient;

    for (let x = 0; x < data.length; x++) {
        const displayDb = Math.max(analyzer.minDb, Math.min(analyzer.maxDb, data[x] + gainOffset));
        const normalized = (displayDb - analyzer.minDb) / dbRange;
        const y = height - (normalized * height);
        analyzer.canvasCtx.fillRect(x, y, 1, height - y);
    }

    if (analyzer.showPeakHold) {
        analyzer.canvasCtx.fillStyle = analyzer.canvasPalette.peak;
        for (let x = 0; x < peakData.length; x++) {
            if (!Number.isFinite(peakData[x])) continue;
            const peakDb = Math.max(analyzer.minDb, Math.min(analyzer.maxDb, peakData[x] + gainOffset));
            const peakY = height - (((peakDb - analyzer.minDb) / dbRange) * height);
            analyzer.canvasCtx.fillRect(x, peakY, 1, 2);
        }
    }
}

function drawOverlays(analyzer) {
    if (analyzer.showNoteOverlay) drawNoteOverlay(analyzer);
    if (analyzer.showReferenceLines) drawReferenceLines(analyzer);
}

function drawNoteOverlay(analyzer) {
    const height = analyzer.elements.canvas.clientHeight;
    analyzer.canvasCtx.font = '10px sans-serif';
    analyzer.canvasCtx.textAlign = 'center';

    let lastX = -Infinity;
    const spacing = 30;
    const maxFrequency = analyzer.isFullRange ? 20000 : 500;

    analyzer.noteFrequencies.forEach(({ note, frequency }) => {
        if (frequency < 20 || frequency > maxFrequency) return;
        const x = frequencyToX(frequency, analyzer.elements.canvas, analyzer.isFullRange);
        if (x - lastX < spacing) return;

        analyzer.canvasCtx.beginPath();
        analyzer.canvasCtx.setLineDash([2, 2]);
        analyzer.canvasCtx.strokeStyle = analyzer.canvasPalette.noteLine;
        analyzer.canvasCtx.moveTo(x, 0);
        analyzer.canvasCtx.lineTo(x, height);
        analyzer.canvasCtx.stroke();
        analyzer.canvasCtx.setLineDash([]);

        analyzer.canvasCtx.lineWidth = 3;
        analyzer.canvasCtx.strokeStyle = analyzer.canvasPalette.labelOutline;
        analyzer.canvasCtx.strokeText(note, x, 15);
        analyzer.canvasCtx.lineWidth = 1;
        analyzer.canvasCtx.fillStyle = analyzer.canvasPalette.noteText;
        analyzer.canvasCtx.fillText(note, x, 15);
        lastX = x;
    });
}

function drawReferenceLines(analyzer) {
    const width = analyzer.elements.canvas.clientWidth;
    const height = analyzer.elements.canvas.clientHeight;

    REFERENCE_LINES.forEach(line => {
        const y = height * (1 - (line.db - analyzer.minDb) / (analyzer.maxDb - analyzer.minDb));
        const lineColor = ensureContrast(line.color, analyzer.canvasPalette.background, 3);
        const labelColor = ensureContrast(line.color, analyzer.canvasPalette.background, 4.5);

        analyzer.canvasCtx.beginPath();
        analyzer.canvasCtx.setLineDash([5, 5]);
        analyzer.canvasCtx.strokeStyle = lineColor;
        analyzer.canvasCtx.lineWidth = line.db >= -6 ? 1.5 : 1;
        analyzer.canvasCtx.moveTo(0, y);
        analyzer.canvasCtx.lineTo(width, y);
        analyzer.canvasCtx.stroke();
        analyzer.canvasCtx.setLineDash([]);
        analyzer.canvasCtx.lineWidth = 1;

        analyzer.canvasCtx.font = '10px sans-serif';
        analyzer.canvasCtx.lineWidth = 3;
        analyzer.canvasCtx.strokeStyle = analyzer.canvasPalette.labelOutline;
        analyzer.canvasCtx.textAlign = 'left';
        analyzer.canvasCtx.strokeText(line.label, 5, y - 2);
        analyzer.canvasCtx.lineWidth = 1;
        analyzer.canvasCtx.fillStyle = labelColor;
        analyzer.canvasCtx.fillText(line.label, 5, y - 2);
    });
}

function updateAccessibleSummary(analyzer, timestamp, gainOffset) {
    if (timestamp - analyzer.lastSummaryTime < 2500) return;
    analyzer.lastSummaryTime = timestamp;

    let strongestX = 0;
    let strongestDb = -Infinity;
    for (let x = 0; x < analyzer.pixelData.length; x++) {
        if (analyzer.pixelData[x] > strongestDb) {
            strongestDb = analyzer.pixelData[x];
            strongestX = x;
        }
    }

    let summary;
    if (!Number.isFinite(strongestDb) || strongestDb <= analyzer.minDb) {
        summary = 'Live spectrum. No measurable signal is currently detected.';
    } else {
        const frequency = Math.round(
            xToFrequency(strongestX + 0.5, analyzer.elements.canvas, analyzer.isFullRange)
        );
        const displayDb = Math.max(
            analyzer.minDb,
            Math.min(analyzer.maxDb, strongestDb + gainOffset)
        );
        const nearestNote = findNearestNote(frequency, analyzer.noteFrequencies);
        summary = `Live spectrum. Strongest frequency is about ${frequency} hertz`;
        if (nearestNote) summary += `, near ${nearestNote.note}`;
        summary += `, at ${Math.round(displayDb)} displayed decibels.`;
        if (analyzer.autoGain) {
            const roundedGain = Math.round(gainOffset);
            summary += ` Auto-gain is ${formatSigned(gainOffset)} ${Math.abs(roundedGain) === 1 ? 'decibel' : 'decibels'}.`;
        }
    }

    analyzer.lastSummaryText = summary;
    analyzer.elements.summary.textContent = summary;
    analyzer.elements.canvas.setAttribute('aria-label', `Live audio frequency spectrum. ${summary}`);
}

function formatSigned(value) {
    const rounded = Math.round(value);
    return rounded > 0 ? `+${rounded}` : String(rounded);
}

function ensureContrast(foreground, background, minRatio) {
    const fg = hexToRgb(foreground);
    const bg = hexToRgb(background);
    if (!fg || !bg) return foreground;
    if (contrastRatio(fg, bg) >= minRatio) return foreground;

    const white = { r: 255, g: 255, b: 255 };
    const black = { r: 0, g: 0, b: 0 };
    const toward = contrastRatio(white, bg) >= contrastRatio(black, bg) ? white : black;
    let low = 0;
    let high = 1;
    let best = fg;

    for (let i = 0; i < 20; i++) {
        const mid = (low + high) / 2;
        const candidate = mixRgb(fg, toward, mid);
        if (contrastRatio(candidate, bg) >= minRatio) {
            best = candidate;
            high = mid;
        } else {
            low = mid;
        }
    }
    return rgbToHex(best);
}

function hexToRgb(hex) {
    if (typeof hex !== 'string') return null;
    const value = hex.replace('#', '').trim();
    if (value.length !== 6) return null;
    const r = parseInt(value.slice(0, 2), 16);
    const g = parseInt(value.slice(2, 4), 16);
    const b = parseInt(value.slice(4, 6), 16);
    return [r, g, b].some(Number.isNaN) ? null : { r, g, b };
}

function rgbToHex({ r, g, b }) {
    const toHex = channel => channel.toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function mixRgb(a, b, amount) {
    const mix = (start, end) => Math.round(start + (end - start) * amount);
    return { r: mix(a.r, b.r), g: mix(a.g, b.g), b: mix(a.b, b.b) };
}

function contrastRatio(first, second) {
    const firstLuminance = relativeLuminance(first);
    const secondLuminance = relativeLuminance(second);
    const lighter = Math.max(firstLuminance, secondLuminance);
    const darker = Math.min(firstLuminance, secondLuminance);
    return (lighter + 0.05) / (darker + 0.05);
}

function relativeLuminance({ r, g, b }) {
    const toLinear = value => {
        const srgb = value / 255;
        return srgb <= 0.03928 ? srgb / 12.92 : Math.pow((srgb + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}
