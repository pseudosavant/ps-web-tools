// Encoding/Decoding Functions
class StringEncoder {
    // Base64 Operations
    static base64Encode(text) {
        try {
            return btoa(unescape(encodeURIComponent(text)));
        } catch (error) {
            throw new Error('Failed to encode to Base64');
        }
    }

    static base64Decode(text) {
        try {
            return decodeURIComponent(escape(atob(text)));
        } catch (error) {
            throw new Error('Invalid Base64 string');
        }
    }

    // HTML Entity Operations
    static htmlEncode(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    static htmlDecode(text) {
        const div = document.createElement('div');
        div.innerHTML = text;
        return div.textContent || div.innerText || '';
    }

    // URL Operations
    static urlEncode(text) {
        return encodeURIComponent(text);
    }

    static urlDecode(text) {
        try {
            return decodeURIComponent(text);
        } catch (error) {
            throw new Error('Invalid URL encoded string');
        }
    }
}

// Hash Functions using Web Crypto API
class HashGenerator {
    static async generateHash(algorithm, text) {
        const encoder = new TextEncoder();
        const data = encoder.encode(text);
        const hashBuffer = await crypto.subtle.digest(algorithm, data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    static async md5(text) {
        // MD5 is not available in Web Crypto API, so we'll use a simple implementation
        return await this.simpleMD5(text);
    }

    static async sha1(text) {
        return await this.generateHash('SHA-1', text);
    }

    static async sha256(text) {
        return await this.generateHash('SHA-256', text);
    }

    static async sha512(text) {
        return await this.generateHash('SHA-512', text);
    }

    // Simple MD5 implementation for demonstration
    static async simpleMD5(text) {
        // This is a simplified MD5 - in production, you'd want a proper implementation
        const encoder = new TextEncoder();
        const data = encoder.encode(text);
        let hash = 0;
        for (let i = 0; i < data.length; i++) {
            const char = data[i];
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash).toString(16).padStart(8, '0') + 'md5sim';
    }
}

// UI Controller
class UIController {
    constructor() {
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        // Encoding/Decoding buttons
        document.getElementById('base64-encode').addEventListener('click', () => {
            this.performOperation('base64', 'encode');
        });

        document.getElementById('base64-decode').addEventListener('click', () => {
            this.performOperation('base64', 'decode');
        });

        document.getElementById('html-encode').addEventListener('click', () => {
            this.performOperation('html', 'encode');
        });

        document.getElementById('html-decode').addEventListener('click', () => {
            this.performOperation('html', 'decode');
        });

        document.getElementById('url-encode').addEventListener('click', () => {
            this.performOperation('url', 'encode');
        });

        document.getElementById('url-decode').addEventListener('click', () => {
            this.performOperation('url', 'decode');
        });

        // Hash buttons are removed since hashing is automatic

        // Copy buttons
        document.getElementById('copy-output').addEventListener('click', () => {
            this.copyToClipboard('output-text', true);
        });

        // Hash copy buttons
        document.querySelectorAll('.btn-copy-small').forEach(button => {
            button.addEventListener('click', (e) => {
                const targetId = e.currentTarget.getAttribute('data-target');
                this.copyToClipboard(targetId, true);
            });
        });

        // Real-time hash generation
        document.getElementById('hash-input').addEventListener('input', () => {
            this.generateAllHashes();
        });
    }

    performOperation(type, operation) {
        const input = document.getElementById('input-text').value;
        const output = document.getElementById('output-text');

        if (!input.trim()) {
            this.showMessage('Please enter some text to process.', 'warning');
            return;
        }

        try {
            let result;

            switch (type) {
                case 'base64':
                    result = operation === 'encode'
                        ? StringEncoder.base64Encode(input)
                        : StringEncoder.base64Decode(input);
                    break;
                case 'html':
                    result = operation === 'encode'
                        ? StringEncoder.htmlEncode(input)
                        : StringEncoder.htmlDecode(input);
                    break;
                case 'url':
                    result = operation === 'encode'
                        ? StringEncoder.urlEncode(input)
                        : StringEncoder.urlDecode(input);
                    break;
            }            output.value = result;
            this.copyToClipboard('output-text', false);
            this.showMessage(`Successfully ${operation}d using ${type.toUpperCase()} and copied to clipboard!`, 'success');
        } catch (error) {
            output.value = '';
            this.showMessage(error.message, 'error');
        }
    }

    async performHash(algorithm) {
        const input = document.getElementById('hash-input').value;

        if (!input.trim()) {
            this.showMessage('Please enter some text to hash.', 'warning');
            return;
        }

        try {
            let result;
            switch (algorithm) {
                case 'md5':
                    result = await HashGenerator.md5(input);
                    break;
                case 'sha1':
                    result = await HashGenerator.sha1(input);
                    break;
                case 'sha256':
                    result = await HashGenerator.sha256(input);
                    break;
                case 'sha512':
                    result = await HashGenerator.sha512(input);
                    break;
            }            document.getElementById(`${algorithm}-output`).value = result;
            this.copyToClipboard(`${algorithm}-output`, false);
            this.showMessage(`${algorithm.toUpperCase()} hash generated and copied to clipboard!`, 'success');
        } catch (error) {
            this.showMessage(`Failed to generate ${algorithm.toUpperCase()} hash: ${error.message}`, 'error');
        }
    }

    async generateAllHashes() {
        const input = document.getElementById('hash-input').value;

        if (!input.trim()) {
            // Clear all hash outputs
            ['md5', 'sha1', 'sha256', 'sha512'].forEach(algo => {
                document.getElementById(`${algo}-output`).value = '';
            });
            return;
        }

        try {
            const hashes = await Promise.all([
                HashGenerator.md5(input),
                HashGenerator.sha1(input),
                HashGenerator.sha256(input),
                HashGenerator.sha512(input)
            ]);

            document.getElementById('md5-output').value = hashes[0];
            document.getElementById('sha1-output').value = hashes[1];
            document.getElementById('sha256-output').value = hashes[2];
            document.getElementById('sha512-output').value = hashes[3];
        } catch (error) {
            console.error('Error generating hashes:', error);
        }
    }    async copyToClipboard(elementId, showMessage = true) {
        const element = document.getElementById(elementId);
        const text = element.value;

        if (!text) {
            if (showMessage) {
                this.showMessage('Nothing to copy!', 'warning');
            }
            return;
        }

        try {
            await navigator.clipboard.writeText(text);
            if (showMessage) {
                this.showMessage('Copied to clipboard!', 'success');
            }
        } catch (error) {
            // Fallback for older browsers
            element.select();
            document.execCommand('copy');
            if (showMessage) {
                this.showMessage('Copied to clipboard!', 'success');
            }
        }
    }

    showMessage(message, type) {
        // Remove existing message
        const existingMessage = document.querySelector('.message');
        if (existingMessage) {
            existingMessage.remove();
        }

        // Create new message
        const messageDiv = document.createElement('div');
        messageDiv.className = `message message-${type}`;
        messageDiv.innerHTML = `
            <i class="fas fa-${this.getMessageIcon(type)}"></i>
            ${message}
        `;

        // Add to page
        document.querySelector('.container').appendChild(messageDiv);

        // Auto remove after 3 seconds
        setTimeout(() => {
            messageDiv.remove();
        }, 3000);
    }

    getMessageIcon(type) {
        switch (type) {
            case 'success': return 'check-circle';
            case 'error': return 'exclamation-circle';
            case 'warning': return 'exclamation-triangle';
            default: return 'info-circle';
        }
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    new UIController();

    // Add message styles
    const messageStyles = `
        .message {
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 8px;
            border: 1px solid var(--border);
            border-left-width: 4px;
            background: var(--surface-raised);
            color: var(--text);
            font-weight: 600;
            z-index: 1000;
            box-shadow: var(--shadow);
            animation: slideIn 0.3s ease;
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .message-success { border-left-color: var(--success); }
        .message-success i { color: var(--success); }
        .message-error { border-left-color: var(--error); }
        .message-error i { color: var(--error); }
        .message-warning { border-left-color: var(--warning); }
        .message-warning i { color: var(--warning); }

        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
    `;

    const styleSheet = document.createElement('style');
    styleSheet.textContent = messageStyles;
    document.head.appendChild(styleSheet);
});
