document.addEventListener('DOMContentLoaded', () => {
    const editor = document.getElementById('editor');
    const output = document.getElementById('output');
    const copyMarkdownBtn = document.getElementById('copyMarkdownBtn');
    const clearBtn = document.getElementById('clearBtn');
    const pasteBtn = document.getElementById('pasteBtn');
    const copySuccessEl = document.getElementById('copySuccess');
    const pasteError = document.getElementById('pasteError');
    const simpleModeToggle = document.getElementById('simpleModeToggle');

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

    function sanitizeHtml(html) {
        const doc = new DOMParser().parseFromString(html, 'text/html');

        doc.querySelectorAll('script, style, link, meta, iframe, object, embed').forEach(element => {
            element.remove();
        });

        doc.querySelectorAll('*').forEach(element => {
            Array.from(element.attributes).forEach(attr => {
                const name = attr.name.toLowerCase();
                const value = attr.value.trim().toLowerCase();

                if (name.startsWith('on')) {
                    element.removeAttribute(attr.name);
                    return;
                }

                if ((name === 'href' || name === 'src') &&
                    (value.startsWith('javascript:') || value.startsWith('blob:'))) {
                    element.removeAttribute(attr.name);
                }
            });
        });

        return doc.body.innerHTML;
    }

    // Remove sticky header wrapper tables that lack data cells.
    function removeEmptyTables(root) {
        root.querySelectorAll('table').forEach(table => {
            if (!table.querySelector('td')) {
                table.remove();
            }
        });
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

    // Helpers to tailor Turndown output for list-heavy content.
    function isListParagraph(node) {
        return Boolean(node && node.nodeName === 'P' && node.parentNode && node.parentNode.nodeName === 'LI');
    }

    function nextRenderableSibling(node) {
        let sibling = node ? node.nextSibling : null;
        while (sibling) {
            if (sibling.nodeType === 3) {
                if (sibling.textContent.trim()) {
                    return sibling;
                }
            } else if (sibling.nodeType === 1) {
                if (!['SCRIPT', 'STYLE'].includes(sibling.nodeName)) {
                    if (sibling.nodeName === 'BR') {
                        sibling = sibling.nextSibling;
                        continue;
                    }
                    return sibling;
                }
            }
            sibling = sibling.nextSibling;
        }
        return null;
    }

    // Configure tighter list output to avoid unwanted blank lines.
    function configureTightListRules(service) {
        service.addRule('listParagraphSpacing', {
            filter: function(node) {
                return isListParagraph(node);
            },
            replacement: function(content, node) {
                const trimmed = content.trim();
                const next = nextRenderableSibling(node);

                if (!next) {
                    return trimmed;
                }

                if (next.nodeType === 1 && ['UL', 'OL'].includes(next.nodeName)) {
                    return trimmed;
                }

                if (next.nodeType === 1 && next.nodeName === 'P') {
                    return trimmed + '\n\n';
                }

                return trimmed + '\n';
            }
        });

        service.addRule('tightListItem', {
            filter: 'li',
            replacement: function(content, node, options) {
                const normalizedContent = content
                    .replace(/^[\n\s]+/, '')
                    .replace(/[\n\s]+$/, '')
                    .replace(/\n{3,}/g, '\n\n');

                let prefix = options.bulletListMarker + ' ';
                const parent = node.parentNode;
                if (parent && parent.nodeName === 'OL') {
                    const start = parent.getAttribute('start');
                    const index = Array.prototype.indexOf.call(parent.children, node);
                    const base = start ? Number(start) + index : index + 1;
                    prefix = base + '. ';
                }

                const indent = ' '.repeat(prefix.length);
                const indentedContent = normalizedContent
                    .split('\n')
                    .map((line, lineIndex) => {
                        if (lineIndex === 0) {
                            return line;
                        }
                        if (!line.trim()) {
                            return '';
                        }
                        return indent + line;
                    })
                    .join('\n');

                return prefix + indentedContent + '\n';
            }
        });

        service.addRule('tightList', {
            filter: ['ul', 'ol'],
            replacement: function(content, node) {
                const compacted = content
                    .replace(/\n{3,}/g, '\n\n')
                    .replace(/^\n+/, '')
                    .replace(/\n+$/, '\n');

                const isNested = node.parentNode && node.parentNode.nodeName === 'LI';
                if (isNested) {
                    return '\n' + compacted;
                }

                return '\n' + compacted + '\n';
            }
        });
    }

    configureTightListRules(fullTurndownService);
    configureTightListRules(simpleTurndownService);

    // Table rules for both services
    [fullTurndownService, simpleTurndownService].forEach((service, isSimple) => {
        const simpleMode = Boolean(isSimple);

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
            replacement: function(_, node) {
                const rows = Array.from(node.querySelectorAll('tr'));
                if (!rows.length) {
                    return '\n';
                }

                const extractCells = (row) => Array.from(row.querySelectorAll('th, td'));
                const headerCells = extractCells(rows[0]);
                const columnCounts = rows.map(row => extractCells(row).length);
                const maxColumns = Math.max(headerCells.length, ...columnCounts, 1);

                const normalizeCell = (cell) => {
                    if (!cell) return '';
                    if (simpleMode) {
                        return cell.textContent.replace(/\s+/g, ' ').trim().replace(/\|/g, '\\|');
                    }
                    const raw = service.turndown(cell.innerHTML);
                    const withBreaks = raw
                        .split(/\n+/)
                        .map(part => part.trim())
                        .filter(part => part.length)
                        .join('<br>');
                    return withBreaks.replace(/\|/g, '\\|');
                };

                const buildRow = (cells) => {
                    const normalized = cells.map(normalizeCell);
                    while (normalized.length < maxColumns) {
                        normalized.push('');
                    }
                    return '| ' + normalized.join(' | ') + ' |';
                };

                const headerLine = buildRow(headerCells);
                const separatorLine = '| ' + Array(maxColumns).fill('---').join(' | ') + ' |';
                const bodyLines = rows.slice(1).map(row => buildRow(extractCells(row)));

                return '\n' + [headerLine, separatorLine, ...bodyLines].join('\n') + '\n';
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
        const service = simpleModeToggle.checked ? simpleTurndownService : fullTurndownService;
        const html = simpleModeToggle.checked ? stripStyles(editor.innerHTML) : editor.innerHTML;
        const wrapper = document.createElement('div');
        wrapper.innerHTML = html;
        removeEmptyTables(wrapper);
        const markdown = service.turndown(wrapper.innerHTML);
        
        output.textContent = markdown
            .replace(/\n{3,}/g, '\n\n')
            .trim();
    }

    async function pasteFromClipboard() {
        pasteError.style.display = 'none';

        try {
            if (!navigator.clipboard || !navigator.clipboard.read) {
                throw new Error('Clipboard read not supported');
            }

            const items = await navigator.clipboard.read();
            let html = '';
            let text = '';

            for (const item of items) {
                if (!html && item.types.includes('text/html')) {
                    const blob = await item.getType('text/html');
                    html = await blob.text();
                }

                if (!text && item.types.includes('text/plain')) {
                    const blob = await item.getType('text/plain');
                    text = await blob.text();
                }
            }

            if (html) {
                editor.innerHTML = sanitizeHtml(html);
            } else if (text) {
                editor.innerText = text;
            } else {
                throw new Error('No compatible clipboard data');
            }

            setTimeout(autoConvert, 100);
        } catch (err) {
            pasteError.innerHTML = `
                <i class="fas fa-exclamation-triangle"></i> 
                Unable to read clipboard. Please use <kbd>Ctrl/Cmd+V</kbd> to paste.
            `;
            pasteError.style.display = 'block';
            setTimeout(() => {
                pasteError.style.display = 'none';
            }, 3000);
        }
    }

    // Handle paste with auto-convert
    editor.addEventListener('paste', (e) => {
        e.preventDefault();
        const html = e.clipboardData.getData('text/html');
        if (html) {
            editor.innerHTML = sanitizeHtml(html);
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
            { element: copyMarkdownBtn, text: 'Copy Markdown to clipboard (Ctrl+Shift+C)' },
            { element: clearBtn, text: 'Clear all content (Ctrl+Shift+X)' },
            { element: simpleModeToggle.parentElement, text: 'Remove formatting and create cleaner Markdown' }
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

    // Paste button
    pasteBtn.addEventListener('click', () => {
        editor.focus();
        pasteFromClipboard();
    });

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
