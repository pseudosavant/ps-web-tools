class FrameRecall {
    constructor() {
        this.video = document.getElementById('videoElement');
        this.canvas = document.getElementById('captureCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.cameraSelect = document.getElementById('cameraSelect');
        this.secondsSelect = document.getElementById('secondsSelect');
        this.fpsSelect = document.getElementById('fpsSelect');
        this.resolutionSelect = document.getElementById('resolutionSelect');
        this.toggleBtn = document.getElementById('toggleBtn');
        this.framesContainer = document.getElementById('framesContainer');
        this.status = document.getElementById('status');
        this.settingsToggle = document.getElementById('settingsToggle');
        this.settingsPanel = document.getElementById('settingsPanel');
        
        this.isCapturing = false;
        this.frameBuffer = [];
        this.captureInterval = null;
        this.stream = null;
        
        this.init();
    }
    
    async init() {
        if (!this.checkBrowserSupport()) {
            return;
        }
        await this.loadCameras();
        this.setupEventListeners();
        this.registerServiceWorker();
    }
    
    checkBrowserSupport() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            this.updateStatus('❌ Camera access not supported. Please use HTTPS or localhost.');
            this.cameraSelect.innerHTML = '<option>Browser not supported</option>';
            return false;
        }
        
        if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
            this.updateStatus('⚠️ Camera access requires HTTPS or localhost. Current: ' + location.protocol);
            this.cameraSelect.innerHTML = '<option>HTTPS required</option>';
            return false;
        }
        
        return true;
    }
    
    async loadCameras() {
        try {
            // Request permission first
            await navigator.mediaDevices.getUserMedia({ video: true });
            
            const devices = await navigator.mediaDevices.enumerateDevices();
            const cameras = devices.filter(device => device.kind === 'videoinput');
            
            this.cameraSelect.innerHTML = '';
            
            if (cameras.length === 0) {
                this.cameraSelect.innerHTML = '<option>No cameras found</option>';
                this.updateStatus('No cameras detected on this device');
                return;
            }
            
            cameras.forEach((camera, index) => {
                const option = document.createElement('option');
                option.value = camera.deviceId;
                option.textContent = camera.label || `Camera ${index + 1}`;
                this.cameraSelect.appendChild(option);
            });
            
            this.cameraSelect.disabled = false;
            
            // Auto-select first camera and initialize it
            if (cameras.length > 0) {
                this.cameraSelect.value = cameras[0].deviceId;
                await this.selectCamera();
            }
            
        } catch (error) {
            console.error('Error loading cameras:', error);
            
            if (error.name === 'NotAllowedError') {
                this.updateStatus('❌ Camera permission denied. Please allow camera access and refresh.');
            } else if (error.name === 'NotFoundError') {
                this.updateStatus('❌ No cameras found on this device.');
            } else {
                this.updateStatus('❌ Error accessing cameras: ' + error.message);
            }
            
            this.cameraSelect.innerHTML = '<option>Camera access failed</option>';
        }
    }
    
    setupEventListeners() {
        this.cameraSelect.addEventListener('change', () => this.selectCamera());
        this.resolutionSelect.addEventListener('change', () => this.selectCamera());
        this.secondsSelect.addEventListener('change', () => this.updateCaptureSettings());
        this.fpsSelect.addEventListener('change', () => this.updateCaptureSettings());
        this.toggleBtn.addEventListener('click', () => this.toggleCapture());
        this.settingsToggle.addEventListener('click', () => this.toggleSettings());
    }
    
    toggleSettings() {
        this.settingsPanel.classList.toggle('collapsed');
        const icon = this.settingsToggle.querySelector('i');
        if (this.settingsPanel.classList.contains('collapsed')) {
            icon.className = 'fas fa-cog';
        } else {
            icon.className = 'fas fa-times';
        }
    }
    
    updateCaptureSettings() {
        this.fps = parseInt(this.fpsSelect.value);
        this.bufferDuration = parseInt(this.secondsSelect.value) * 1000;
        this.maxFrames = Math.ceil(this.fps * (this.bufferDuration / 1000));
    }
    
    getResolutionConstraints() {
        const resolution = this.resolutionSelect.value;
        switch (resolution) {
            case '480p':
                return { width: { ideal: 854 }, height: { ideal: 480 } };
            case '720p':
                return { width: { ideal: 1280 }, height: { ideal: 720 } };
            case '1080p':
                return { width: { ideal: 1920 }, height: { ideal: 1080 } };
            default:
                return { width: { ideal: 1280 }, height: { ideal: 720 } };
        }
    }
    
    async selectCamera() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
        }
        
        if (!this.cameraSelect.value) {
            this.toggleBtn.disabled = true;
            this.updateStatus('Select a camera to begin');
            return;
        }
        
        this.updateStatus('Loading camera...');
        
        try {
            const resolutionConstraints = this.getResolutionConstraints();
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    deviceId: { exact: this.cameraSelect.value },
                    ...resolutionConstraints
                }
            });
            
            this.video.srcObject = this.stream;
            
            // Use multiple events to ensure video loads properly
            const enableArmButton = () => {
                this.toggleBtn.disabled = false;
                this.updateStatus('Camera ready. Click "Arm Capture" to begin.');
            };
            
            // Wait for video to load before enabling arm button
            this.video.addEventListener('loadedmetadata', enableArmButton, { once: true });
            this.video.addEventListener('canplay', enableArmButton, { once: true });
            
            // Fallback timeout in case events don't fire
            setTimeout(() => {
                if (this.video.readyState >= 2) {
                    enableArmButton();
                }
            }, 1000);
            
            // Force video to play (some browsers require this)
            try {
                await this.video.play();
            } catch (playError) {
                console.log('Autoplay prevented, but video should still work');
                enableArmButton();
            }
            
        } catch (error) {
            console.error('Error accessing camera:', error);
            this.updateStatus('Error accessing camera: ' + error.message);
            this.toggleBtn.disabled = true;
        }
    }
    
    toggleCapture() {
        if (this.isCapturing) {
            this.stopCapture();
        } else {
            this.startCapture();
        }
    }
    
    startCapture() {
        if (!this.stream || this.video.readyState < 2) {
            this.updateStatus('Camera not ready. Please wait or try selecting camera again.');
            return;
        }
        
        // Update settings before starting
        this.updateCaptureSettings();
        
        this.isCapturing = true;
        this.frameBuffer = [];
        this.toggleBtn.innerHTML = '<i class="fas fa-stop-circle"></i> Stop & Show Frames';
        this.toggleBtn.title = 'Stop capturing and display the last few seconds of frames';
        this.cameraSelect.disabled = true;
        this.secondsSelect.disabled = true;
        this.fpsSelect.disabled = true;
        this.resolutionSelect.disabled = true;
        this.framesContainer.innerHTML = '';
        this.framesContainer.style.display = 'none';
        this.video.classList.add('recording');
        
        // Set canvas size to match video dimensions
        this.canvas.width = this.video.videoWidth || 640;
        this.canvas.height = this.video.videoHeight || 480;
        
        // Start capturing frames
        this.captureInterval = setInterval(() => {
            this.captureFrame();
        }, 1000 / this.fps);
        
        const seconds = this.bufferDuration / 1000;
        this.updateStatus(`🔴 Recording frames (${this.fps} FPS, ${seconds}s buffer)...`, true);
    }
    
    captureFrame() {
        if (!this.isCapturing || this.video.readyState < 2) return;
        
        // Draw current frame to canvas
        this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
        
        // Convert to blob for efficient storage
        this.canvas.toBlob((blob) => {
            if (blob) {
                const frame = {
                    blob: blob,
                    timestamp: Date.now(),
                    url: null // Will be created when displaying
                };
                
                // Add to circular buffer
                this.frameBuffer.push(frame);
                
                // Remove old frames (keep only last 2 seconds)
                if (this.frameBuffer.length > this.maxFrames) {
                    const removedFrame = this.frameBuffer.shift();
                    if (removedFrame.url) {
                        URL.revokeObjectURL(removedFrame.url);
                    }
                }
            }
        }, 'image/jpeg', 0.8);
    }
    
    stopCapture() {
        this.isCapturing = false;
        
        if (this.captureInterval) {
            clearInterval(this.captureInterval);
            this.captureInterval = null;
        }
        
        this.toggleBtn.innerHTML = '<i class="fas fa-play-circle"></i> Arm Capture';
        this.toggleBtn.title = 'Start capturing frames continuously';
        this.cameraSelect.disabled = false;
        this.secondsSelect.disabled = false;
        this.fpsSelect.disabled = false;
        this.resolutionSelect.disabled = false;
        this.video.classList.remove('recording');
        
        this.displayFrames();
        const seconds = this.bufferDuration / 1000;
        this.updateStatus(`Captured ${this.frameBuffer.length} frames from the last ${seconds} seconds`);
    }
    
    displayFrames() {
        this.framesContainer.innerHTML = '';
        
        if (this.frameBuffer.length === 0) {
            this.framesContainer.style.display = 'none';
            return;
        }
        
        this.framesContainer.style.display = 'grid';
        
        // Display frames in chronological order
        this.frameBuffer.forEach((frame, index) => {
            const frameDiv = document.createElement('div');
            frameDiv.className = 'frame-item';
            
            const img = document.createElement('img');
            frame.url = URL.createObjectURL(frame.blob);
            img.src = frame.url;
            img.alt = `Frame ${index + 1}`;
            img.style.cursor = 'pointer';
            
            // Add click handler for fullscreen
            img.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.showFullscreen(frame.url);
            });
            
            const timestamp = document.createElement('div');
            timestamp.className = 'frame-timestamp';
            const relativeTime = frame.timestamp - this.frameBuffer[this.frameBuffer.length - 1].timestamp;
            timestamp.textContent = `${relativeTime}ms`;
            
            frameDiv.appendChild(img);
            frameDiv.appendChild(timestamp);
            this.framesContainer.appendChild(frameDiv);
        });
    }
    
    showFullscreen(imageUrl) {
        console.log('Showing fullscreen for:', imageUrl); // Debug log
        
        // Create fullscreen overlay
        const overlay = document.createElement('div');
        overlay.className = 'fullscreen-overlay';
        
        const img = document.createElement('img');
        img.src = imageUrl;
        img.className = 'fullscreen-image';
        
        // Close fullscreen on click
        overlay.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            document.body.removeChild(overlay);
        });
        
        // Also close on Escape key
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                document.body.removeChild(overlay);
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);
        
        overlay.appendChild(img);
        document.body.appendChild(overlay);
    }
    
    updateStatus(message, isRecording = false) {
        this.status.textContent = message;
        this.status.className = isRecording ? 'status recording' : 'status';
    }
    
    async registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                await navigator.serviceWorker.register('sw.js');
                console.log('Service Worker registered');
            } catch (error) {
                console.log('Service Worker registration failed:', error);
            }
        }
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new FrameRecall();
});
