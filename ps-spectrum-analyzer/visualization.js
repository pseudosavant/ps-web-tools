import { frequencyToX, xToFrequency, findNearestNote } from './utils.js';
import { REFERENCE_LINES, FREQUENCY_LABELS, CANVAS_BG } from './constants.js';

export function setupVisualization(analyzer) {
    setupCanvas(analyzer);
    setupTooltip(analyzer);
}

function setupCanvas(analyzer) {
    const resize = () => {
        const rect = analyzer.elements.canvas.getBoundingClientRect();
        analyzer.elements.canvas.width = Math.max(1, Math.floor(rect.width));
        analyzer.elements.canvas.height = Math.max(1, Math.floor(rect.height));
        analyzer.updateAxes?.();
    };
    
    resize();
    window.addEventListener('resize', resize);
}

function setupTooltip(analyzer) {
    analyzer.elements.canvas.addEventListener('mousemove', (e) => {
        handleTooltip(e, analyzer);
    });

    analyzer.elements.canvas.addEventListener('mouseout', () => {
        analyzer.elements.tooltip.style.display = 'none';
    });
}

function handleTooltip(e, analyzer) {
    if (!analyzer.analyser) return;

    const rect = analyzer.elements.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const canvasWidth = analyzer.elements.canvas.clientWidth || analyzer.elements.canvas.width;
    if (!canvasWidth) return;
    
    // Get frequency analysis data
    const bufferLength = analyzer.analyser.frequencyBinCount;
    const dataArray = new Float32Array(bufferLength);
    analyzer.analyser.getFloatFrequencyData(dataArray);
    
    // Calculate bin size and get closest bin
    const binSize = analyzer.audioContext.sampleRate / analyzer.analyser.fftSize;
    const minFreq = 20;
    const maxFreq = analyzer.isFullRange ? 20000 : 500;
    
    // Convert x position to logarithmic frequency
    const minLog = Math.log10(minFreq);
    const maxLog = Math.log10(maxFreq);
    const clampedX = Math.max(0, Math.min(x, canvasWidth));
    const xRatio = clampedX / canvasWidth;
    const logFreq = minLog + (maxLog - minLog) * xRatio;
    const freq = Math.pow(10, logFreq);
    
    // Find nearest bin
    const bin = Math.max(0, Math.min(bufferLength - 1, Math.round(freq / binSize)));
    const exactFreq = Math.round(bin * binSize);
    
    // Get amplitude from the FFT data
    const db = Math.max(-90, dataArray[bin]);
    
    let tooltipText = `${exactFreq}Hz: ${Math.round(db)}dB`;
    
    // Add nearest note information if available
    const nearestNote = findNearestNote(exactFreq, analyzer.noteFrequencies);
    if (nearestNote) {
        tooltipText += ` (${nearestNote.note})`;
    }
    
    const tooltip = analyzer.elements.tooltip;
    tooltip.style.display = 'block';
    tooltip.textContent = tooltipText;
    tooltip.style.left = (x + 10) + 'px';
    tooltip.style.top = (y - 20) + 'px';
}

export function draw(analyzer) {
    if (!analyzer.isRunning || analyzer.isFrozen) {
        requestAnimationFrame(() => draw(analyzer));
        return;
    }

    const bufferLength = analyzer.analyser.frequencyBinCount;
    const dataArray = new Float32Array(bufferLength);
    analyzer.analyser.getFloatFrequencyData(dataArray);

    clearCanvas(analyzer);
    updatePeakHold(analyzer, dataArray, bufferLength);
    const gainOffset = updateAutoGain(analyzer, dataArray);
    drawSpectrum(analyzer, dataArray, bufferLength, gainOffset);
    drawOverlays(analyzer);

    requestAnimationFrame(() => draw(analyzer));
}

function updateAutoGain(analyzer, dataArray) {
    if (!analyzer.autoGain) return 0;

    let sum = 0;
    let count = 0;
    for (let i = 0; i < dataArray.length; i++) {
        if (dataArray[i] > -90) {
            sum += dataArray[i];
            count++;
        }
    }
    const averageLevel = count > 0 ? sum / count : -90;
    const desiredGainOffset = analyzer.targetLevel - averageLevel;
    analyzer.currentGainOffset = analyzer.currentGainOffset * analyzer.gainSmoothingFactor + 
                              desiredGainOffset * (1 - analyzer.gainSmoothingFactor);
    return Math.min(60, Math.max(0, analyzer.currentGainOffset));
}

function clearCanvas(analyzer) {
    analyzer.canvasCtx.fillStyle = CANVAS_BG;
    analyzer.canvasCtx.fillRect(0, 0, analyzer.elements.canvas.width, analyzer.elements.canvas.height);
}

function updatePeakHold(analyzer, dataArray, bufferLength) {
    if (!analyzer.showPeakHold) return;

    const currentTime = performance.now();
    
    if (currentTime - analyzer.lastPeakResetTime > analyzer.peakHoldResetInterval) {
        analyzer.peakHoldData.fill(-Infinity);
        analyzer.lastPeakResetTime = currentTime;
    }

    for (let i = 0; i < bufferLength; i++) {
        if (dataArray[i] > analyzer.peakHoldData[i]) {
            analyzer.peakHoldData[i] = dataArray[i];
        } else {
            analyzer.peakHoldData[i] = Math.max(-Infinity, analyzer.peakHoldData[i] - analyzer.peakHoldDecay);
        }
    }
}

function drawSpectrum(analyzer, dataArray, bufferLength, gainOffset) {
    const sampleRate = analyzer.audioContext.sampleRate;
    
    for (let i = 0; i < bufferLength; i++) {
        const frequency = i * sampleRate / analyzer.analyser.fftSize;
        if (frequency < 20) continue;
        if (frequency > (analyzer.isFullRange ? 20000 : 500)) break;

        const amplitudeWithGain = dataArray[i] + gainOffset;
        drawFrequencyBar(analyzer, frequency, amplitudeWithGain);
        if (analyzer.showPeakHold) {
            const peakWithGain = analyzer.peakHoldData[i] + gainOffset;
            drawPeakBar(analyzer, frequency, i, peakWithGain);
        }
    }
}

function drawFrequencyBar(analyzer, frequency, amplitude) {
    const x = frequencyToX(frequency, analyzer.elements.canvas, analyzer.isFullRange);
    const normalizedAmplitude = (amplitude + 90) / 90;
    const y = analyzer.elements.canvas.height - (normalizedAmplitude * analyzer.elements.canvas.height);

    const hue = 240 - (normalizedAmplitude * 60);
    analyzer.canvasCtx.fillStyle = `hsl(${hue}, 100%, 50%)`;
    
    const barWidth = analyzer.isFullRange ? 2 : 1;
    analyzer.canvasCtx.fillRect(x, y, barWidth, analyzer.elements.canvas.height - y);
}

function drawPeakBar(analyzer, frequency, index, amplitude) {
    const x = frequencyToX(frequency, analyzer.elements.canvas, analyzer.isFullRange);
    const normalizedPeakAmplitude = (amplitude + 90) / 90;
    const peakY = analyzer.elements.canvas.height - (normalizedPeakAmplitude * analyzer.elements.canvas.height);
    
    analyzer.canvasCtx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    analyzer.canvasCtx.fillRect(x, peakY, 2, 2);
}

function drawOverlays(analyzer) {
    if (analyzer.showNoteOverlay) {
        drawNoteOverlay(analyzer);
    }
    if (analyzer.showReferenceLines) {
        drawReferenceLines(analyzer);
    }
}

function drawNoteOverlay(analyzer) {
    analyzer.canvasCtx.font = '10px sans-serif';
    analyzer.canvasCtx.textAlign = 'center';
    
    let lastX = -Infinity;
    const spacing = 30;

    analyzer.noteFrequencies.forEach(({ note, frequency }) => {
        if (frequency < 20) return;
        if (analyzer.isFullRange && frequency > 20000) return;
        if (!analyzer.isFullRange && frequency > 500) return;

        const x = frequencyToX(frequency, analyzer.elements.canvas, analyzer.isFullRange);
        
        if (x - lastX >= spacing) {
            drawNoteLabel(analyzer, x, note);
            lastX = x;
        }
    });
}

function drawNoteLabel(analyzer, x, note) {
    analyzer.canvasCtx.beginPath();
    analyzer.canvasCtx.setLineDash([2, 2]);
    analyzer.canvasCtx.strokeStyle = 'rgba(125, 211, 252, 0.8)';
    analyzer.canvasCtx.moveTo(x, 0);
    analyzer.canvasCtx.lineTo(x, analyzer.elements.canvas.height);
    analyzer.canvasCtx.stroke();
    analyzer.canvasCtx.setLineDash([]);

    analyzer.canvasCtx.lineWidth = 3;
    analyzer.canvasCtx.strokeStyle = 'rgba(15, 23, 42, 0.9)';
    analyzer.canvasCtx.strokeText(note, x, 15);
    analyzer.canvasCtx.lineWidth = 1;
    analyzer.canvasCtx.fillStyle = '#7dd3fc';
    analyzer.canvasCtx.fillText(note, x, 15);
}

function drawReferenceLines(analyzer) {
    REFERENCE_LINES.forEach(line => {
        const y = analyzer.elements.canvas.height * (1 - (line.db + 90) / 90);
        const lineColor = ensureContrast(line.color, CANVAS_BG, 3);
        const labelColor = ensureContrast(line.color, CANVAS_BG, 4.5);
        
        // Draw the line
        analyzer.canvasCtx.beginPath();
        analyzer.canvasCtx.setLineDash([5, 5]);
        analyzer.canvasCtx.strokeStyle = lineColor;
        analyzer.canvasCtx.lineWidth = line.db >= -6 ? 1.5 : 1;
        analyzer.canvasCtx.moveTo(0, y);
        analyzer.canvasCtx.lineTo(analyzer.elements.canvas.width, y);
        analyzer.canvasCtx.stroke();
        analyzer.canvasCtx.setLineDash([]);
        analyzer.canvasCtx.lineWidth = 1;

        // Draw the label
        analyzer.canvasCtx.font = '10px sans-serif';
        analyzer.canvasCtx.lineWidth = 3;
        analyzer.canvasCtx.strokeStyle = 'rgba(15, 23, 42, 0.9)';
        analyzer.canvasCtx.textAlign = 'left';
        analyzer.canvasCtx.strokeText(line.label, 5, y - 2);
        analyzer.canvasCtx.lineWidth = 1;
        analyzer.canvasCtx.fillStyle = labelColor;
        analyzer.canvasCtx.fillText(line.label, 5, y - 2);
    });
}

function ensureContrast(foreground, background, minRatio) {
    const fg = hexToRgb(foreground);
    const bg = hexToRgb(background);
    if (!fg || !bg) return foreground;

    const current = contrastRatio(fg, bg);
    if (current >= minRatio) return foreground;

    const white = { r: 255, g: 255, b: 255 };
    const black = { r: 0, g: 0, b: 0 };
    const toward = contrastRatio(white, bg) >= contrastRatio(black, bg) ? white : black;

    let low = 0;
    let high = 1;
    let best = fg;
    for (let i = 0; i < 20; i++) {
        const mid = (low + high) / 2;
        const candidate = mixRgb(fg, toward, mid);
        const ratio = contrastRatio(candidate, bg);
        if (ratio >= minRatio) {
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
    if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null;
    return { r, g, b };
}

function rgbToHex({ r, g, b }) {
    const toHex = (channel) => channel.toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function mixRgb(a, b, t) {
    const mix = (start, end) => Math.round(start + (end - start) * t);
    return { r: mix(a.r, b.r), g: mix(a.g, b.g), b: mix(a.b, b.b) };
}

function contrastRatio(fg, bg) {
    const l1 = relativeLuminance(fg);
    const l2 = relativeLuminance(bg);
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
}

function relativeLuminance({ r, g, b }) {
    const toLinear = (value) => {
        const srgb = value / 255;
        return srgb <= 0.03928 ? srgb / 12.92 : Math.pow((srgb + 0.055) / 1.055, 2.4);
    };
    const rl = toLinear(r);
    const gl = toLinear(g);
    const bl = toLinear(b);
    return 0.2126 * rl + 0.7152 * gl + 0.0722 * bl;
}
