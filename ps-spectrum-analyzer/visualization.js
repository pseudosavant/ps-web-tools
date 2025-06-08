import { frequencyToX, xToFrequency, findNearestNote } from './utils.js';
import { REFERENCE_LINES, FREQUENCY_LABELS } from './constants.js';

export function setupVisualization(analyzer) {
    setupCanvas(analyzer);
    setupTooltip(analyzer);
}

function setupCanvas(analyzer) {
    const resize = () => {
        const container = analyzer.elements.canvas.parentElement;
        const containerWidth = container.clientWidth - 40;
        analyzer.elements.canvas.width = containerWidth;
        analyzer.elements.canvas.height = 400;
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
    const xRatio = x / analyzer.elements.canvas.width;
    const logFreq = minLog + (maxLog - minLog) * xRatio;
    const freq = Math.pow(10, logFreq);
    
    // Find nearest bin
    const bin = Math.round(freq / binSize);
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
    analyzer.canvasCtx.fillStyle = '#2d2d2d';
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
    analyzer.canvasCtx.strokeStyle = '#4A90E2';
    analyzer.canvasCtx.moveTo(x, 0);
    analyzer.canvasCtx.lineTo(x, analyzer.elements.canvas.height);
    analyzer.canvasCtx.stroke();
    analyzer.canvasCtx.setLineDash([]);

    analyzer.canvasCtx.fillStyle = '#4A90E2';
    analyzer.canvasCtx.fillText(note, x, 15);
}

function drawReferenceLines(analyzer) {
    REFERENCE_LINES.forEach(line => {
        const y = analyzer.elements.canvas.height * (1 - (line.db + 90) / 90);
        
        // Draw the line
        analyzer.canvasCtx.beginPath();
        analyzer.canvasCtx.setLineDash([5, 5]);
        analyzer.canvasCtx.strokeStyle = line.color;
        analyzer.canvasCtx.moveTo(0, y);
        analyzer.canvasCtx.lineTo(analyzer.elements.canvas.width, y);
        analyzer.canvasCtx.stroke();
        analyzer.canvasCtx.setLineDash([]);

        // Draw the label
        analyzer.canvasCtx.font = '10px sans-serif';
        analyzer.canvasCtx.fillStyle = line.color;
        analyzer.canvasCtx.textAlign = 'left';
        analyzer.canvasCtx.fillText(line.label, 5, y - 2);
    });
}