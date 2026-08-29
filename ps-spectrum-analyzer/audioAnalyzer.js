import {
    clearVisualization,
    resetPeakHold,
    setupVisualization,
    startDrawing,
    stopDrawing
} from './visualization.js?v=5';
import { setupUI } from './ui.js?v=5';
import { calculateNoteFrequencies } from './utils.js?v=5';

export class AudioAnalyzer {
    constructor() {
        this.initializeState();
        this.initializeElements();
        this.setupAnalyzer();
    }

    initializeState() {
        this.audioContext = null;
        this.sourceNode = null;
        this.analyser = null;
        this.mediaStream = null;
        this.animationFrameId = null;
        this.resizeObserver = null;
        this.frequencyData = null;
        this.peakHoldData = null;
        this.pixelData = null;
        this.peakPixelData = null;
        this.spectrumLayout = null;

        this.isRunning = false;
        this.isStarting = false;
        this.isStopping = false;
        this.isFrozen = false;
        this.hasAudioInput = true;
        this.showReferenceLines = true;
        this.showNoteOverlay = false;
        this.showPeakHold = true;
        this.isFullRange = true;
        this.autoGain = true;

        this.minDb = -90;
        this.maxDb = 0;
        this.targetLevel = -30;
        this.gainTimeConstant = 750;
        this.currentGainOffset = 0;

        this.peakHoldDecayPerSecond = 6;
        this.lastFrameTime = 0;
        this.lastSummaryTime = 0;
        this.lastSummaryText = 'Start the microphone to analyze its frequency spectrum.';
        this.noteFrequencies = [];
    }

    initializeElements() {
        this.elements = {
            canvas: document.getElementById('visualizer'),
            visualizerContainer: document.getElementById('visualizerPanel'),
            fullscreenButton: document.getElementById('fullscreenButton'),
            startButton: document.getElementById('startButton'),
            deviceSelect: document.getElementById('deviceSelect'),
            status: document.getElementById('status'),
            summary: document.getElementById('spectrumSummary'),
            freezeButton: document.getElementById('freezeButton'),
            resetPeaksButton: document.getElementById('resetPeaksButton'),
            showReferenceLines: document.getElementById('showReferenceLines'),
            showNoteOverlay: document.getElementById('showNoteOverlay'),
            showPeakHold: document.getElementById('showPeakHold'),
            autoGain: document.getElementById('autoGain'),
            freqRangeInputs: document.getElementsByName('freqRange'),
            tooltip: document.getElementById('tooltip'),
            freqAxis: document.getElementById('freqAxis'),
            dbAxis: document.getElementById('dbAxis')
        };

        this.canvasCtx = this.elements.canvas.getContext('2d');
    }

    setupAnalyzer() {
        setupUI(this);
        setupVisualization(this);
        this.updateControlState();
        void this.loadAudioDevices();

        this.deviceChangeHandler = () => {
            void this.loadAudioDevices();
        };
        navigator.mediaDevices?.addEventListener?.('devicechange', this.deviceChangeHandler);

        window.addEventListener('pagehide', () => {
            if (this.isRunning) void this.stop({ statusMessage: 'Stopped' });
        });
    }

    updateControlState() {
        const busy = this.isStarting || this.isStopping;
        this.elements.startButton.disabled = busy || !this.hasAudioInput;
        this.elements.startButton.textContent = this.isStarting
            ? 'Starting…'
            : this.isStopping
                ? 'Stopping…'
                : this.isRunning
                    ? 'Stop'
                    : 'Start Microphone';
        this.elements.freezeButton.disabled = !this.isRunning || busy;
        this.elements.freezeButton.textContent = this.isFrozen ? 'Resume Display' : 'Freeze Display';
        this.elements.deviceSelect.disabled = busy || !this.hasAudioInput;
        this.elements.resetPeaksButton.disabled = !this.showPeakHold || !this.peakHoldData;
    }

    async loadAudioDevices(preferredDeviceId = this.elements.deviceSelect.value) {
        if (!navigator.mediaDevices?.enumerateDevices) {
            this.hasAudioInput = false;
            this.replaceDeviceOptions([], 'Microphone access requires HTTPS or localhost.');
            this.elements.status.textContent = 'Microphone access is not supported in this context.';
            this.updateControlState();
            return;
        }

        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const audioDevices = devices.filter(device => device.kind === 'audioinput');
            this.hasAudioInput = audioDevices.length > 0;
            this.replaceDeviceOptions(audioDevices);

            if (preferredDeviceId && audioDevices.some(device => device.deviceId === preferredDeviceId)) {
                this.elements.deviceSelect.value = preferredDeviceId;
            }

            if (!this.hasAudioInput && !this.isRunning) {
                this.elements.status.textContent = 'No microphones were found.';
            }
        } catch (error) {
            this.hasAudioInput = false;
            this.replaceDeviceOptions([], 'Unable to list microphones');
            this.elements.status.textContent = `Error loading microphones: ${error.message}`;
        }

        this.updateControlState();
    }

    replaceDeviceOptions(audioDevices, emptyMessage = 'No microphones found') {
        const options = [];

        if (!audioDevices.length) {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = emptyMessage;
            options.push(option);
        } else {
            audioDevices.forEach((device, index) => {
                const option = document.createElement('option');
                option.value = device.deviceId;
                option.textContent = device.label
                    || (device.deviceId ? `Microphone ${index + 1}` : 'Default microphone');
                options.push(option);
            });
        }

        this.elements.deviceSelect.replaceChildren(...options);
    }

    async start() {
        if (this.isRunning || this.isStarting || this.isStopping || !this.hasAudioInput) return;

        this.isStarting = true;
        this.elements.status.textContent = 'Requesting microphone access…';
        this.updateControlState();

        let stream = null;
        let context = null;
        let source = null;

        try {
            const selectedDeviceId = this.elements.deviceSelect.value;
            const constraints = {
                audio: {
                    deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined,
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false
                }
            };

            stream = await navigator.mediaDevices.getUserMedia(constraints);
            context = new (window.AudioContext || window.webkitAudioContext)();
            if (context.state === 'suspended') await context.resume();

            source = context.createMediaStreamSource(stream);
            const analyser = context.createAnalyser();
            analyser.fftSize = 16384;
            analyser.smoothingTimeConstant = 0.85;
            analyser.minDecibels = this.minDb;
            analyser.maxDecibels = this.maxDb;
            source.connect(analyser);

            this.mediaStream = stream;
            this.audioContext = context;
            this.sourceNode = source;
            this.analyser = analyser;
            this.frequencyData = new Float32Array(analyser.frequencyBinCount);
            this.peakHoldData = new Float32Array(analyser.frequencyBinCount);
            this.peakHoldData.fill(-Infinity);
            this.noteFrequencies = calculateNoteFrequencies();
            this.spectrumLayout = null;
            this.currentGainOffset = 0;
            this.lastFrameTime = 0;
            this.lastSummaryTime = 0;
            this.isRunning = true;
            this.isFrozen = false;

            const activeDeviceId = stream.getAudioTracks()[0]?.getSettings?.().deviceId;
            void this.loadAudioDevices(activeDeviceId || selectedDeviceId);

            this.elements.status.textContent = 'Analyzing microphone audio locally…';
            startDrawing(this);
        } catch (error) {
            await this.releaseAudioResources({
                sourceNode: source,
                analyser: this.analyser,
                mediaStream: stream,
                audioContext: context
            });

            stopDrawing(this);
            this.isRunning = false;
            this.isFrozen = false;
            this.mediaStream = null;
            this.audioContext = null;
            this.sourceNode = null;
            this.analyser = null;
            this.frequencyData = null;
            this.peakHoldData = null;
            this.pixelData = null;
            this.peakPixelData = null;
            this.spectrumLayout = null;
            this.elements.status.textContent = this.friendlyStartError(error);
        } finally {
            this.isStarting = false;
            this.updateControlState();
        }
    }

    friendlyStartError(error) {
        switch (error?.name) {
            case 'NotAllowedError':
            case 'SecurityError':
                return 'Microphone access was denied. Allow access and try again.';
            case 'NotFoundError':
                return 'No usable microphone was found.';
            case 'NotReadableError':
                return 'The microphone is unavailable or already in use.';
            case 'OverconstrainedError':
                return 'The selected microphone is no longer available.';
            default:
                return `Unable to start audio analysis: ${error?.message || 'Unknown error'}`;
        }
    }

    async stop({ statusMessage = 'Stopped' } = {}) {
        if (this.isStopping) return;

        this.isStopping = true;
        this.isRunning = false;
        this.isFrozen = false;
        stopDrawing(this);
        this.updateControlState();

        try {
            await this.releaseAudioResources();
        } finally {
            this.mediaStream = null;
            this.audioContext = null;
            this.sourceNode = null;
            this.analyser = null;
            this.frequencyData = null;
            this.peakHoldData = null;
            this.pixelData = null;
            this.peakPixelData = null;
            this.spectrumLayout = null;
            this.currentGainOffset = 0;
            this.elements.status.textContent = statusMessage;
            this.lastSummaryText = 'Spectrum stopped.';
            this.elements.summary.textContent = this.lastSummaryText;
            this.elements.canvas.setAttribute('aria-label', 'Live audio frequency spectrum. Spectrum stopped.');
            clearVisualization(this);
            this.isStopping = false;
            this.updateControlState();
        }
    }

    toggleFreeze() {
        if (!this.isRunning) return;

        this.isFrozen = !this.isFrozen;
        if (this.isFrozen) {
            stopDrawing(this);
            this.elements.status.textContent = 'Display frozen; microphone analysis is paused.';
        } else {
            this.lastFrameTime = 0;
            this.elements.status.textContent = 'Analyzing microphone audio locally…';
            startDrawing(this);
        }
        this.updateControlState();
    }

    async switchDevice() {
        if (!this.isRunning || this.isStarting || this.isStopping) return;
        await this.stop({ statusMessage: 'Switching microphone…' });
        await this.start();
    }

    async releaseAudioResources({
        sourceNode = this.sourceNode,
        analyser = this.analyser,
        mediaStream = this.mediaStream,
        audioContext = this.audioContext
    } = {}) {
        try { sourceNode?.disconnect(); } catch {}
        try { analyser?.disconnect(); } catch {}
        mediaStream?.getTracks().forEach(track => track.stop());
        if (audioContext && audioContext.state !== 'closed') {
            try { await audioContext.close(); } catch {}
        }
    }

    resetPeaks({ announce = true } = {}) {
        resetPeakHold(this);
        if (announce && this.isRunning) this.elements.status.textContent = 'Peak hold reset.';
        this.updateControlState();
    }
}
