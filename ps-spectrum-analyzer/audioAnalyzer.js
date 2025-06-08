import { setupVisualization, draw } from './visualization.js';
import { setupUI } from './ui.js';
import { calculateNoteFrequencies } from './utils.js';

export class AudioAnalyzer {
    constructor() {
        this.initializeState();
        this.initializeElements();
        this.setupAnalyzer();
    }

    initializeState() {
        this.audioContext = null;
        this.analyser = null;
        this.mediaStream = null;
        this.isRunning = false;
        this.isFrozen = false;
        this.showReferenceLines = true;
        this.showNoteOverlay = true;
        this.showPeakHold = true;
        this.isFullRange = true;
        this.autoGain = true;
        
        // Auto-gain parameters
        this.minDb = -90;
        this.maxDb = 0;
        this.targetLevel = -30;
        this.gainSmoothingFactor = 0.95;
        this.currentGainOffset = 0;
        
        // Peak hold data
        this.peakHoldData = null;
        this.peakHoldDecay = 0.1;
        this.lastPeakResetTime = 0;
        this.peakHoldResetInterval = 10000;

        // Note frequencies will be calculated when audio starts
        this.noteFrequencies = [];
    }

    initializeElements() {
        this.elements = {
            canvas: document.getElementById('visualizer'),
            startButton: document.getElementById('startButton'),
            deviceSelect: document.getElementById('deviceSelect'),
            status: document.getElementById('status'),
            freezeButton: document.getElementById('freezeButton'),
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
        this.loadAudioDevices();
    }

    async loadAudioDevices() {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const audioDevices = devices.filter(device => device.kind === 'audioinput');
            
            this.elements.deviceSelect.innerHTML = audioDevices.map(device => 
                `<option value="${device.deviceId}">${device.label || 'Microphone ' + (device.deviceId)}</option>`
            ).join('');
        } catch (error) {
            this.elements.status.textContent = 'Error loading audio devices: ' + error.message;
        }
    }

    async start() {
        try {
            const constraints = {
                audio: {
                    deviceId: this.elements.deviceSelect.value ? { exact: this.elements.deviceSelect.value } : undefined,
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false
                }
            };

            this.mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const source = this.audioContext.createMediaStreamSource(this.mediaStream);
            
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 16384;
            this.analyser.smoothingTimeConstant = 0.85;
            
            this.peakHoldData = new Float32Array(this.analyser.frequencyBinCount);
            this.peakHoldData.fill(-Infinity);
            this.lastPeakResetTime = performance.now();
            
            this.noteFrequencies = calculateNoteFrequencies();
            
            source.connect(this.analyser);
            
            this.isRunning = true;
            this.elements.startButton.textContent = 'Stop';
            this.elements.status.textContent = 'Analyzing audio...';
            this.elements.freezeButton.disabled = false;
            
            draw(this);
        } catch (error) {
            this.elements.status.textContent = 'Error starting audio analysis: ' + error.message;
        }
    }

    stop() {
        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => track.stop());
        }
        if (this.audioContext) {
            this.audioContext.close();
        }
        
        this.isRunning = false;
        this.isFrozen = false;
        this.elements.startButton.textContent = 'Start Microphone';
        this.elements.freezeButton.textContent = 'Freeze Display';
        this.elements.freezeButton.disabled = true;
        this.elements.status.textContent = 'Stopped';
        
        if (this.peakHoldData) {
            this.peakHoldData.fill(-Infinity);
        }
        
        this.canvasCtx.fillStyle = '#2d2d2d';
        this.canvasCtx.fillRect(0, 0, this.elements.canvas.width, this.elements.canvas.height);
    }
}