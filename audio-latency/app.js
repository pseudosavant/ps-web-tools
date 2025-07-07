class AudioLatencyTester {
  constructor() {
    this.audioContext = null;
    this.mediaStream = null;
    this.analyser = null;
    this.microphone = null;
    this.baseline = 0;
    this.isCalibrating = false;
    this.isTesting = false;
    this.isLocatingMic = false;
    this.continuousToneSource = null;
    this.scriptProcessor = null;
    
    this.init();
  }

  async init() {
    this.setupEventListeners();
    await this.refreshDevices();
    this.setupWaveform();
    this.vuMeter = document.getElementById('vuMeter');
  }

  setupEventListeners() {
    document.getElementById('refreshDevices').addEventListener('click', () => this.refreshDevices());
    document.getElementById('startTest').addEventListener('click', () => this.startLatencyTest());
    document.getElementById('calibrateBaseline').addEventListener('click', () => this.calibrateBaseline());
    document.getElementById('locateMic').addEventListener('click', () => this.toggleMicLocator());
  }

  async refreshDevices() {
    try {
      // Request permissions first to get device labels
      await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const devices = await navigator.mediaDevices.enumerateDevices();
      this.populateDeviceSelectors(devices);
      this.updateStatus('Devices refreshed successfully');
    } catch (error) {
      this.updateStatus('Error accessing devices: ' + error.message, 'error');
    }
  }

  populateDeviceSelectors(devices) {
    const audioOutput = document.getElementById('audioOutput');
    const speakerOutput = document.getElementById('speakerOutput');
    const audioInput = document.getElementById('audioInput');
    
    // Clear existing options
    audioOutput.innerHTML = '<option value="">Select Bluetooth audio device...</option>';
    speakerOutput.innerHTML = '<option value="">Select speaker for calibration...</option>';
    audioInput.innerHTML = '<option value="">Select microphone...</option>';

    let autoSelectedBluetooth = null;
    let autoSelectedSpeaker = null;
    let autoSelectedMic = null;

    devices.forEach(device => {
      const option = document.createElement('option');
      option.value = device.deviceId;
      
      // Use deviceId as fallback if label is empty
      const deviceName = device.label || `${device.kind} (${device.deviceId.slice(0, 8)}...)`;
      const lowerName = deviceName.toLowerCase();
      
      const isBluetooth = lowerName.includes('bluetooth') || 
                         lowerName.includes('wireless') ||
                         lowerName.includes('airpods') ||
                         lowerName.includes('buds');
      
      if (device.kind === 'audiooutput') {
        const outputOption1 = option.cloneNode();
        const outputOption2 = option.cloneNode();
        
        outputOption1.value = device.deviceId;
        outputOption1.textContent = `${deviceName} ${isBluetooth ? '🎧' : '🔊'}`;
        audioOutput.appendChild(outputOption1);
        
        outputOption2.value = device.deviceId;
        outputOption2.textContent = `${deviceName} ${isBluetooth ? '🎧' : '🔊'}`;
        speakerOutput.appendChild(outputOption2);
        
        // Auto-select logic for Bluetooth outputs (PC + iOS)
        if (!autoSelectedBluetooth && (
          lowerName.includes('headphone') ||    // PC: "Headphones"
          lowerName.includes('airpods') ||      // iOS: "AirPods Pro", "AirPods Max"
          lowerName.includes('buds') ||         // Various: "Galaxy Buds", "Pixel Buds"
          lowerName.includes('beats') ||        // iOS: "Beats Studio"
          lowerName.includes('bluetooth')       // Generic Bluetooth
        )) {
          autoSelectedBluetooth = device.deviceId;
        }
        
        // Auto-select logic for speakers (PC + iOS)
        if (!autoSelectedSpeaker && (
          lowerName.includes('speakers') ||     // PC: "Speakers"
          lowerName.includes('speaker') ||      // iOS: "iPhone Speaker", "iPad Speaker"
          lowerName.includes('built-in') ||     // iOS: "Built-in Output"
          lowerName.includes('internal') ||     // Some devices: "Internal Speakers"
          (lowerName.includes('iphone') && !isBluetooth) ||  // iOS: "iPhone"
          (lowerName.includes('ipad') && !isBluetooth)       // iOS: "iPad"
        )) {
          autoSelectedSpeaker = device.deviceId;
        }
        
      } else if (device.kind === 'audioinput') {
        option.textContent = `${deviceName} ${isBluetooth ? '🎧' : '🎤'}`;
        audioInput.appendChild(option);
        
        // Auto-select logic for microphones (PC + iOS)
        if (!autoSelectedMic && (
          lowerName.includes('microphone') ||   // PC: "Microphone"
          lowerName.includes('built-in') ||     // iOS: "Built-in Microphone"
          lowerName.includes('internal') ||     // Some devices: "Internal Microphone"
          (lowerName.includes('iphone') && !isBluetooth) ||  // iOS: "iPhone"
          (lowerName.includes('ipad') && !isBluetooth) ||    // iOS: "iPad"
          lowerName.includes('default')         // Generic: "Default"
        )) {
          autoSelectedMic = device.deviceId;
        }
      }
    });

    // Apply auto-selections with improved status messages
    if (autoSelectedBluetooth) {
      audioOutput.value = autoSelectedBluetooth;
      const selectedDevice = audioOutput.options[audioOutput.selectedIndex].textContent;
      this.updateStatus(`Auto-selected: ${selectedDevice}`);
    }
    
    if (autoSelectedSpeaker) {
      speakerOutput.value = autoSelectedSpeaker;
      const selectedDevice = speakerOutput.options[speakerOutput.selectedIndex].textContent;
      this.updateStatus(`Auto-selected for baseline: ${selectedDevice}`);
    }
    
    if (autoSelectedMic) {
      audioInput.value = autoSelectedMic;
      const selectedDevice = audioInput.options[audioInput.selectedIndex].textContent;
      this.updateStatus(`Auto-selected: ${selectedDevice}`);
    }
  }

  async initAudioContext() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
  }

  async setupMicrophone() {
    const audioInputSelect = document.getElementById('audioInput');
    const deviceId = audioInputSelect.value;
    
    if (!deviceId) {
      throw new Error('Please select a microphone');
    }

    const constraints = {
      audio: {
        deviceId: { exact: deviceId },
        sampleRate: 44100,
        channelCount: 1,
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        latency: 0.01 // Request low latency
      }
    };

    this.mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
    this.microphone = this.audioContext.createMediaStreamSource(this.mediaStream);
    
    // Use both ScriptProcessor for real-time analysis and AnalyserNode for visualization
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 4096;
    this.analyser.smoothingTimeConstant = 0;
    
    // ScriptProcessor for sample-accurate detection (deprecated but more accurate for timing)
    this.scriptProcessor = this.audioContext.createScriptProcessor(1024, 1, 1);
    
    this.microphone.connect(this.analyser);
    this.microphone.connect(this.scriptProcessor);
    this.scriptProcessor.connect(this.audioContext.destination);
  }

  async playContinuousTone(frequency = 1000, outputDeviceId = null) {
    if (this.continuousToneSource) {
      this.continuousToneSource.stop();
      this.continuousToneSource = null;
    }

    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.connect(gainNode);
    
    if (outputDeviceId && this.audioContext.setSinkId) {
      try {
        await this.audioContext.setSinkId(outputDeviceId);
      } catch (error) {
        console.warn('Could not set output device:', error);
      }
    }
    
    gainNode.connect(this.audioContext.destination);
    
    oscillator.frequency.value = frequency;
    oscillator.type = 'sine';
    gainNode.gain.value = 0.1; // Low volume for continuous tone
    
    oscillator.start();
    this.continuousToneSource = oscillator;
  }

  stopContinuousTone() {
    if (this.continuousToneSource) {
      this.continuousToneSource.stop();
      this.continuousToneSource = null;
    }
  }

  async toggleMicLocator() {
    if (this.isLocatingMic) {
      this.isLocatingMic = false;
      this.stopContinuousTone();
      this.cleanup();
      document.getElementById('locateMic').textContent = '🎤 Locate Mic';
      this.updateStatus('Mic locator stopped.');
      cancelAnimationFrame(this.vuMeterUpdateLoop);
      this.vuMeter.value = 0;
    } else {
      if (this.isTesting || this.isCalibrating) return;
      
      this.isLocatingMic = true;
      document.getElementById('locateMic').textContent = '🛑 Stop Locator';
      this.updateStatus('Playing tone. Adjust mic position...');
      
      try {
        await this.initAudioContext();
        await this.setupMicrophone();
        
        const outputDeviceId = document.getElementById('audioOutput').value;
        if (!outputDeviceId) throw new Error('Please select a Bluetooth output device');
        
        await this.playContinuousTone(1000, outputDeviceId);
        this.startVuMeter();
      } catch (error) {
        this.updateStatus('Mic locator failed: ' + error.message, 'error');
        this.isLocatingMic = false;
        document.getElementById('locateMic').textContent = '🎤 Locate Mic';
      }
    }
  }

  startVuMeter() {
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    
    const update = () => {
      if (!this.isLocatingMic) return;
      
      this.analyser.getByteTimeDomainData(dataArray);
      
      let max = 0;
      for (let i = 0; i < dataArray.length; i++) {
        const val = Math.abs(dataArray[i] - 128);
        if (val > max) max = val;
      }
      
      this.vuMeter.value = max * 2; // Scale to 0-255 range
      
      this.vuMeterUpdateLoop = requestAnimationFrame(update);
    };
    
    update();
  }

  async playTestTone(frequency = 1000, duration = 0.1, outputDeviceId = null, scheduledTime = null) {
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.connect(gainNode);
    
    // Try to set output device if supported
    if (outputDeviceId && this.audioContext.setSinkId) {
      try {
        await this.audioContext.setSinkId(outputDeviceId);
      } catch (error) {
        console.warn('Could not set output device:', error);
      }
    }
    
    gainNode.connect(this.audioContext.destination);
    
    // Schedule everything precisely
    const startTime = scheduledTime || this.audioContext.currentTime;
    const endTime = startTime + duration;
    
    oscillator.frequency.setValueAtTime(frequency, startTime);
    oscillator.type = 'sine';
    
    // Sharp attack and release for precise timing
    gainNode.gain.setValueAtTime(0, startTime);
    gainNode.gain.linearRampToValueAtTime(0.3, startTime + 0.005); // 5ms attack
    gainNode.gain.setValueAtTime(0.3, endTime - 0.005);
    gainNode.gain.linearRampToValueAtTime(0, endTime); // 5ms release
    
    oscillator.start(startTime);
    oscillator.stop(endTime);
    
    return startTime;
  }

  detectAudioOnset(targetFrequency = 1000, expectedPlayTime = null) {
    return new Promise((resolve, reject) => {
      const sampleRate = this.audioContext.sampleRate;
      const frameSize = 1024;
      
      // Convert frequency to bin for analysis
      const bufferLength = this.analyser.frequencyBinCount;
      const nyquist = sampleRate / 2;
      const binSize = nyquist / bufferLength;
      const targetBin = Math.round(targetFrequency / binSize);
      const binRange = 2;
      
      let baselineRMS = 0;
      let baselineSamples = 0;
      const maxBaselineSamples = Math.floor(sampleRate * 0.5 / frameSize); // 0.5 seconds of samples
      
      let detectionMade = false;
      const threshold = 0.01; // Much lower threshold for better sensitivity
      
      console.log(`🎯 Waiting for ${targetFrequency}Hz tone, expected at ${expectedPlayTime ? expectedPlayTime.toFixed(3) : 'unknown'}s`);
      
      // Use ScriptProcessor for sample-accurate timing
      this.scriptProcessor.onaudioprocess = (event) => {
        if (detectionMade) return;
        
        const inputBuffer = event.inputBuffer;
        const inputData = inputBuffer.getChannelData(0);
        const currentTime = this.audioContext.currentTime;
        
        // Calculate RMS of current frame
        let rms = 0;
        for (let i = 0; i < frameSize; i++) {
          rms += inputData[i] * inputData[i];
        }
        rms = Math.sqrt(rms / frameSize);
        
        // Also get frequency domain data for visualization
        const freqData = new Uint8Array(bufferLength);
        this.analyser.getByteFrequencyData(freqData);
        this.updateWaveform(freqData);
        
        // Calculate target frequency energy
        let targetEnergy = 0;
        for (let i = Math.max(0, targetBin - binRange); 
             i <= Math.min(bufferLength - 1, targetBin + binRange); i++) {
          targetEnergy += freqData[i];
        }
        targetEnergy /= (binRange * 2 + 1);
        
        // Establish baseline
        if (baselineSamples < maxBaselineSamples) {
          baselineRMS += rms;
          baselineSamples++;
          
          if (baselineSamples === maxBaselineSamples) {
            baselineRMS /= maxBaselineSamples;
            console.log(`📊 Baseline RMS: ${(baselineRMS * 1000).toFixed(2)}mV`);
          }
          return;
        }
        
        // Detection logic: use time-domain RMS for most accurate timing
        const rmsIncrease = rms / baselineRMS;
        const absoluteCheck = rms > threshold;
        const frequencyCheck = targetEnergy > 30; // Basic frequency validation
        
        // Log occasionally for debugging
        if (Math.floor(currentTime * 10) % 5 === 0 && currentTime % 0.5 < 0.1) {
          console.log(`📈 Current: RMS=${(rms*1000).toFixed(2)}mV (${rmsIncrease.toFixed(1)}x), freq=${targetEnergy.toFixed(1)}, time=${currentTime.toFixed(3)}s`);
        }
        
        // Trigger on significant RMS increase
        if ((rmsIncrease > 2.0 && absoluteCheck) || (rmsIncrease > 4.0)) {
          if (!detectionMade) {
            detectionMade = true;
            
            // Calculate more precise detection time
            // Look for the sample where energy first exceeded threshold
            let detectionSample = 0;
            const localThreshold = baselineRMS * 1.5;
            
            for (let i = 0; i < frameSize; i++) {
              const sampleSquared = inputData[i] * inputData[i];
              if (sampleSquared > localThreshold * localThreshold) {
                detectionSample = i;
                break;
              }
            }
            
            // Calculate precise detection time
            const frameStartTime = currentTime - (frameSize / sampleRate);
            const preciseDetectionTime = frameStartTime + (detectionSample / sampleRate);
            
            console.log(`✅ DETECTION: RMS ${(rms*1000).toFixed(2)}mV (${rmsIncrease.toFixed(1)}x baseline) at ${preciseDetectionTime.toFixed(4)}s`);
            
            this.scriptProcessor.onaudioprocess = null; // Stop processing
            resolve(preciseDetectionTime);
          }
        }
      };
      
      // Timeout safety
      setTimeout(() => {
        if (!detectionMade) {
          this.scriptProcessor.onaudioprocess = null;
          reject(new Error(`Detection timeout. Final baseline: ${(baselineRMS*1000).toFixed(2)}mV`));
        }
      }, 3000);
    });
  }

  async measureLatency(useBluetoothOutput = false) {
    await this.initAudioContext();
    await this.setupMicrophone();
    
    console.log(`🔬 ${useBluetoothOutput ? 'Bluetooth' : 'Baseline'} measurement starting...`);
    
    // Select output device
    const outputSelector = useBluetoothOutput ? 
      document.getElementById('audioOutput') : 
      document.getElementById('speakerOutput');
    const outputDeviceId = outputSelector.value;
    
    if (!outputDeviceId) {
      throw new Error(`Please select a ${useBluetoothOutput ? 'Bluetooth' : 'speaker'} output device`);
    }
    
    // Wait for microphone to settle
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const testFrequency = 1000;
    
    // Schedule tone to play in the future for precise timing
    const playTime = this.audioContext.currentTime + 0.5; // 500ms from now
    
    console.log(`⏰ Scheduling tone for ${playTime.toFixed(3)}s (in ${(playTime - this.audioContext.currentTime).toFixed(3)}s)`);
    
    // Start detection first
    const detectionPromise = this.detectAudioOnset(testFrequency, playTime);
    
    // Schedule the tone
    const actualPlayTime = await this.playTestTone(testFrequency, 0.2, outputDeviceId, playTime);
    
    try {
      const detectTime = await detectionPromise;
      const latencyMs = (detectTime - actualPlayTime) * 1000;
      
      console.log(`🎯 RESULT: Play=${actualPlayTime.toFixed(4)}s, Detect=${detectTime.toFixed(4)}s, Latency=${latencyMs.toFixed(2)}ms`);
      
      // Sanity check for reasonable latency values
      if (latencyMs < 0) {
        console.warn('⚠️ Negative latency detected - clock synchronization issue');
        return Math.abs(latencyMs);
      }
      
      if (latencyMs > 200) {
        console.warn(`⚠️ High latency detected: ${latencyMs.toFixed(1)}ms`);
      }
      
      return latencyMs;
      
    } catch (error) {
      console.error('❌ Detection failed:', error.message);
      throw error;
    }
  }

  async calibrateBaseline() {
    if (this.isCalibrating || this.isTesting) return;
    
    this.isCalibrating = true;
    this.updateStatus('Calibrating baseline latency with speakers...');
    
    try {
      this.baseline = await this.measureLatency(false); // Use speakers
      this.updateStatus(`Baseline calibration complete: ${this.baseline.toFixed(1)}ms`);
    } catch (error) {
      this.updateStatus('Calibration failed: ' + error.message, 'error');
      this.baseline = 0;
    } finally {
      this.isCalibrating = false;
      this.cleanup();
    }
  }

  async startLatencyTest() {
    if (this.isTesting || this.isCalibrating) return;
    
    this.isTesting = true;
    this.updateStatus('Measuring Bluetooth latency...');
    
    try {
      const rawLatency = await this.measureLatency(true); // Use Bluetooth
      const adjustedLatency = Math.max(0, rawLatency - this.baseline);
      
      this.displayResults(rawLatency, adjustedLatency);
      this.updateStatus('Test completed successfully');
    } catch (error) {
      this.updateStatus('Test failed: ' + error.message, 'error');
    } finally {
      this.isTesting = false;
      this.cleanup();
    }
  }

  displayResults(raw, adjusted) {
    const display = document.getElementById('latencyDisplay');
    const latencyValue = document.getElementById('latencyValue');
    const rawLatency = document.getElementById('rawLatency');
    const adjustedLatency = document.getElementById('adjustedLatency');
    
    latencyValue.textContent = `${adjusted.toFixed(1)} ms`;
    rawLatency.textContent = raw.toFixed(1);
    adjustedLatency.textContent = adjusted.toFixed(1);
    
    // Color coding based on latency
    display.className = 'latency-display';
    if (adjusted < 40) {
      display.classList.add('latency-good');
    } else if (adjusted < 100) {
      display.classList.add('latency-medium');
    } else {
      display.classList.add('latency-poor');
    }
    
    display.style.display = 'block';
  }

  setupWaveform() {
    const canvas = document.getElementById('waveform');
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    
    this.waveformCtx = ctx;
  }

  updateWaveform(dataArray) {
    if (!this.waveformCtx) return;
    
    const canvas = this.waveformCtx.canvas;
    const ctx = this.waveformCtx;
    
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#2196F3';
    ctx.beginPath();
    
    const sliceWidth = canvas.width / dataArray.length;
    let x = 0;
    
    for (let i = 0; i < dataArray.length; i++) {
      const v = dataArray[i] / 128.0;
      const y = v * canvas.height / 2;
      
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
      
      x += sliceWidth;
    }
    
    ctx.stroke();
  }

  updateStatus(message, type = 'info') {
    const status = document.getElementById('status');
    status.textContent = message;
    status.style.background = type === 'error' ? '#ffebee' : '#e3f2fd';
    status.style.color = type === 'error' ? '#c62828' : '#1565c0';
  }

  cleanup() {
    this.stopContinuousTone();
    if (this.scriptProcessor) {
      this.scriptProcessor.onaudioprocess = null;
      this.scriptProcessor.disconnect();
      this.scriptProcessor = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }
    if (this.microphone) {
      this.microphone.disconnect();
      this.microphone = null;
    }
    if (this.analyser) {
      this.analyser.disconnect();
      this.analyser = null;
    }
  }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
  new AudioLatencyTester();
});
