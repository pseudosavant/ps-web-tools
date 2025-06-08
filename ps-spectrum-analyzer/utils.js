const BASE_FREQ = 440; // A4 = 440Hz
const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function calculateNoteFrequencies() {
    const frequencies = [];
    for (let octave = 0; octave <= 8; octave++) {
        NOTES.forEach((note, i) => {
            const n = i - 9 + (octave - 4) * 12;
            const freq = BASE_FREQ * Math.pow(2, n / 12);
            if (freq >= 20 && freq <= 20000) {
                frequencies.push({
                    note: note + octave,
                    frequency: freq
                });
            }
        });
    }
    return frequencies;
}

export function frequencyToX(frequency, canvas, isFullRange) {
    const minFreq = 20;
    const maxFreq = isFullRange ? 20000 : 500;
    const logMin = Math.log10(minFreq);
    const logMax = Math.log10(maxFreq);
    const logFreq = Math.log10(frequency);
    return (canvas.width * (logFreq - logMin)) / (logMax - logMin);
}

export function xToFrequency(x, canvas, isFullRange) {
    const minFreq = 20;
    const maxFreq = isFullRange ? 20000 : 500;
    const logMin = Math.log10(minFreq);
    const logMax = Math.log10(maxFreq);
    const logFreq = (x / canvas.width) * (logMax - logMin) + logMin;
    return Math.pow(10, logFreq);
}

export function findNearestNote(frequency, noteFrequencies) {
    if (!noteFrequencies?.length) return null;
    return noteFrequencies.reduce((closest, current) => {
        const currentDiff = Math.abs(current.frequency - frequency);
        const closestDiff = Math.abs(closest.frequency - frequency);
        return currentDiff < closestDiff ? current : closest;
    });
}

export function getFrequencyBin(frequency, sampleRate, fftSize) {
    return Math.round(frequency * fftSize / sampleRate);
}

export function getBinFrequency(bin, sampleRate, fftSize) {
    return bin * sampleRate / fftSize;
}