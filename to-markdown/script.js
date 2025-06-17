document.addEventListener('DOMContentLoaded', () => {
    const editor = document.getElementById('editor');
    const output = document.getElementById('output');
    const convertBtn = document.getElementById('convertBtn');
    const copyMarkdownBtn = document.getElementById('copyMarkdownBtn');
    const clearBtn = document.getElementById('clearBtn');
    const pasteBtn = document.getElementById('pasteBtn');
    const copySuccessEl = document.getElementById('copySuccess');
    const pasteError = document.getElementById('pasteError');
    const simpleModeToggle = document.getElementById('simpleModeToggle');
    const jsonModeToggle = document.getElementById('jsonModeToggle');

    // Enhanced strip styles helper
    function stripStyles(html) {
        html = html.replace(/<!--[\s\S]*?-->/g, '');

        const div = document.createElement('div');
        div.innerHTML = html;
        
        const elementsToRemove = ['style', 'meta', 'link', 'script', 'colgroup', 'col'];
        elementsToRemove.forEach(tag => {
            div.querySelectorAll(tag).forEach(element => element.remove());
        });
        
        div.querySelectorAll('*').forEach(element => {
            Array.from(element.attributes).forEach(attr => {
                if (!['href', 'src'].includes(attr.name)) {
                    element.removeAttribute(attr.name);
                }
            });

            if (['span', 'div'].includes(element.tagName.toLowerCase()) && 
                !element.attributes.length && 
                element.parentElement) {
                while (element.firstChild) {
                    element.parentElement.insertBefore(element.firstChild, element);
                }
                element.remove();
            }
        });

        return div.innerHTML
            .replace(/^\s+|\s+$/g, '')
            .replace(/[\r\n]+/g, '\n')
            .replace(/[ \t]+/g, ' ')
            .replace(/<!--[\s\S]*?-->/g, '');
    }

    // Function to convert table to JSON structure
    function tableToJson(table) {
        const headers = [];
        const rows = table.querySelectorAll('tr');
        if (!rows.length) return null;

        rows[0].querySelectorAll('th, td').forEach(cell => {
            headers.push(cell.textContent.trim());
        });

        const data = [];
        for (let i = 1; i < rows.length; i++) {
            const row = {};
            const cells = rows[i].querySelectorAll('td');
            cells.forEach((cell, index) => {
                if (index < headers.length) {
                    row[headers[index]] = cell.textContent.trim();
                }
            });
            data.push(row);
        }

        return { headers, data };
    }

    // Function to convert HTML to markdown with JSON tables
    function convertWithJsonTables(html, isSimple = false) {
        const div = document.createElement('div');
        div.innerHTML = isSimple ? stripStyles(html) : html;
        
        div.querySelectorAll('table').forEach(table => {
            const jsonData = tableToJson(table);
            if (jsonData) {
                const pre = document.createElement('pre');
                const code = document.createElement('code');
                code.textContent = '```json\n' + 
                    JSON.stringify(jsonData, null, 2) + 
                    '\n```';
                pre.appendChild(code);
                table.replaceWith(pre);
            }
        });

        const service = isSimple ? simpleTurndownService : fullTurndownService;
        return service.turndown(div.innerHTML);
    }

    const baseConfig = {
        headingStyle: 'atx',
        bulletListMarker: '-',
        codeBlockStyle: 'fenced',
        hr: '---'
    };

    const fullTurndownService = new TurndownService({
        ...baseConfig,
        strongDelimiter: '**'
    });

    const simpleTurndownService = new TurndownService({
        ...baseConfig,
        strongDelimiter: '*'
    });

    // Table rules for both services
    [fullTurndownService, simpleTurndownService].forEach((service, isSimple) => {
        service.addRule('tableCell', {
            filter: ['th', 'td'],
            replacement: function(content, node) {
                return ' ' + (isSimple ? node.textContent : content).trim() + ' |';
            }
        });

        service.addRule('tableRow', {
            filter: 'tr',
            replacement: function(content) {
                return '|' + content + '\n';
            }
        });

        service.addRule('table', {
            filter: 'table',
            replacement: function(content, node) {
                const rows = node.querySelectorAll('tr');
                if (!rows.length) return content;

                let output = '\n';
                const headerCells = rows[0].querySelectorAll('th, td');
                const separator = '|' + Array(headerCells.length + 1).join(' --- |');

                output += content;
                if (!output.includes('---')) {
                    const firstLineEnd = output.indexOf('\n');
                    output = output.slice(0, firstLineEnd + 1) + 
                            separator + '\n' + 
                            output.slice(firstLineEnd + 1);
                }
                output = output.replace(/\n+$/, '\n');
                output = output.replace(/^\n+/, '\n');
                return output;
            }
        });
    });

    // Simplified mode specific rules
    simpleTurndownService.remove('image');
    ['style', 'script', 'strike', 'sup', 'sub'].forEach(tag => {
        simpleTurndownService.remove(tag);
    });

    // Auto-convert function
    function autoConvert() {
        if (editor.innerHTML.trim()) {
            convertToMarkdown();
        } else {
            output.textContent = '';
        }
    }

    // Convert function (extracted for reuse)
    function convertToMarkdown() {
        let markdown;
        if (jsonModeToggle.checked) {
            markdown = convertWithJsonTables(editor.innerHTML, simpleModeToggle.checked);
        } else {
            const service = simpleModeToggle.checked ? simpleTurndownService : fullTurndownService;
            const html = simpleModeToggle.checked ? stripStyles(editor.innerHTML) : editor.innerHTML;
            markdown = service.turndown(html);
        }
        
        output.textContent = markdown.replace(/\n\n+/g, '\n\n').trim();
    }

    // Handle paste with auto-convert
    editor.addEventListener('paste', (e) => {
        e.preventDefault();
        const html = e.clipboardData.getData('text/html');
        if (html) {
            editor.innerHTML = html;
        } else {
            const text = e.clipboardData.getData('text/plain');
            editor.innerText = text;
        }
        
        // Auto-convert after paste
        setTimeout(autoConvert, 100);
    });

    // Auto-convert on input changes
    editor.addEventListener('input', () => {
        // Debounce auto-convert for performance
        clearTimeout(editor.convertTimeout);
        editor.convertTimeout = setTimeout(autoConvert, 300);
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Ctrl/Cmd + Enter: Convert
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            convertToMarkdown();
        }
        
        // Ctrl/Cmd + Shift + V: Paste button
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'V') {
            e.preventDefault();
            pasteBtn.click();
        }
        
        // Ctrl/Cmd + Shift + C: Copy markdown
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'C') {
            e.preventDefault();
            if (output.textContent.trim()) {
                copyMarkdownBtn.click();
            }
        }
        
        // Ctrl/Cmd + Shift + X: Clear all
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'X') {
            e.preventDefault();
            clearBtn.click();
        }
    });

    // Initialize tooltips
    function initTooltips() {
        const tooltips = [
            { element: pasteBtn, text: 'Paste content from clipboard (Ctrl+Shift+V)' },
            { element: convertBtn, text: 'Convert to Markdown (Ctrl+Enter)' },
            { element: copyMarkdownBtn, text: 'Copy Markdown to clipboard (Ctrl+Shift+C)' },
            { element: clearBtn, text: 'Clear all content (Ctrl+Shift+X)' },
            { element: simpleModeToggle.parentElement, text: 'Remove formatting and create cleaner Markdown' },
            { element: jsonModeToggle.parentElement, text: 'Convert tables to JSON format instead of Markdown tables' }
        ];

        tooltips.forEach(({ element, text }) => {
            element.setAttribute('title', text);
            element.setAttribute('data-tooltip', text);
        });
    }

    // Enhanced copy to clipboard for markdown (works in more environments) - FIXED
    async function copyToClipboard(text, message = 'Copied to clipboard!') {
        let copySuccess = false;
        
        try {
            // Strategy 1: Modern Clipboard API (secure contexts)
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(text);
                copySuccess = true;
            }
        } catch (err) {
            console.log('Clipboard API copy failed:', err.message);
        }
        
        // Strategy 2: execCommand fallback
        if (!copySuccess) {
            try {
                const textarea = document.createElement('textarea');
                textarea.value = text;
                textarea.setAttribute('readonly', '');
                textarea.style.position = 'absolute';
                textarea.style.left = '-9999px';
                document.body.appendChild(textarea);
                
                textarea.select();
                textarea.setSelectionRange(0, 99999); // For mobile devices
                
                const success = document.execCommand('copy');
                document.body.removeChild(textarea);
                
                if (success) {
                    copySuccess = true;
                }
            } catch (err) {
                console.log('execCommand copy failed:', err.message);
            }
        }
        
        // Show appropriate message - FIXED: use copySuccessEl instead of copySuccess
        if (copySuccess) {
            copySuccessEl.textContent = message;
            copySuccessEl.style.display = 'block';
            setTimeout(() => {
                copySuccessEl.style.display = 'none';
            }, 2000);
        } else {
            // Show fallback instructions
            pasteError.innerHTML = `
                <i class="fas fa-exclamation-triangle"></i> 
                Copy failed. Please select the text and use <kbd>Ctrl+C</kbd> to copy manually.
            `;
            pasteError.style.display = 'block';
            setTimeout(() => {
                pasteError.style.display = 'none';
            }, 3000);
        }
    }

    // Convert button
    convertBtn.addEventListener('click', convertToMarkdown);

    // Copy markdown button
    copyMarkdownBtn.addEventListener('click', () => {
        copyToClipboard(output.textContent, 'Markdown copied to clipboard!');
    });

    // Clear button
    clearBtn.addEventListener('click', () => {
        editor.innerHTML = '';
        output.textContent = '';
        copySuccessEl.style.display = 'none';
    });

    // Initialize tooltips
    initTooltips();
});