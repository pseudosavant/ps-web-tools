// Global variables
let WORD_LIST = [];
let gameState = {
    greenLetters: ['', '', '', '', ''],
    yellowLetters: ['', '', '', '', ''],
    excludedLetters: '',
    remainingWords: [],
    optimalGuesses: [],
    letterFrequency: {},
    positionFrequency: [{}, {}, {}, {}, {}],
    positionTotals: [0, 0, 0, 0, 0],
    hintsBlurred: true
};

// --- Wordle Grid support ---
const GRID_ROWS = 6;
const GRID_COLS = 5;
const CELL_STATES = ['gray', 'yellow', 'green'];
let __restoringUrl = false; // guard to prevent history churn during restore
const rowRemainingCache = {
    signatures: Array(GRID_ROWS).fill(''),
    remaining: Array(GRID_ROWS).fill(null)
};
const gridCellCache = Array.from({ length: GRID_ROWS }, () => Array(GRID_COLS).fill(null));
let rowRemainingElements = Array(GRID_ROWS).fill(null);

function getGridCells() {
    return Array.from(document.querySelectorAll('.wordle-grid .grid-cell'));
}

function getCellIndex(cell) {
    return {
        row: parseInt(cell.getAttribute('data-row'), 10) || 0,
        col: parseInt(cell.getAttribute('data-col'), 10) || 0
    };
}

function clearCellState(cell) {
    cell.classList.remove('cell-gray', 'cell-yellow', 'cell-green');
    cell.removeAttribute('data-state');
}

function setCellState(cell, state) {
    clearCellState(cell);
    if (!state) return;
    cell.setAttribute('data-state', state);
    if (state === 'gray') cell.classList.add('cell-gray');
    if (state === 'yellow') cell.classList.add('cell-yellow');
    if (state === 'green') cell.classList.add('cell-green');
}

function getCellState(cell) {
    return cell.getAttribute('data-state') || '';
}

function cycleCellState(cell) {
    const current = getCellState(cell);
    // If empty, initialize to gray on first click
    if (!cell.value) return; // do not color empty cells
    const idx = CELL_STATES.indexOf(current);
    const next = CELL_STATES[(idx + 1) % CELL_STATES.length];
    setCellState(cell, next);
}

function initializeGrid() {
    const grid = document.querySelector('.wordle-grid');
    if (!grid) return;

    const cells = getGridCells();
    cells.forEach((cell) => {
        const { row, col } = getCellIndex(cell);
        if (row >= 0 && row < GRID_ROWS && col >= 0 && col < GRID_COLS) {
            gridCellCache[row][col] = cell;
        }

        // Prevent mouse selection highlight while still allowing focus
        cell.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.currentTarget.focus();
        });

        // Text input normalization and auto-advance
        cell.addEventListener('input', (e) => {
            const v = (e.target.value || '').toUpperCase().replace(/[^A-Z]/g, '');
            e.target.value = v.slice(0, 1);
            // Toggle has-letter class for cursor and styling
            if (e.target.value) {
                e.target.classList.add('has-letter');
                // Default new letters to gray state unless already colored
                if (!getCellState(e.target)) {
                    setCellState(e.target, 'gray');
                }
            } else {
                e.target.classList.remove('has-letter');
                clearCellState(e.target);
            }
            // Move right on entry
            if (e.target.value) {
                const { row, col } = getCellIndex(e.target);
                const nextCol = col + 1;
                if (nextCol < GRID_COLS) {
                    const next = grid.querySelector(`.grid-cell[data-row="${row}"][data-col="${nextCol}"]`);
                    if (next) next.focus();
                } else {
                    // Wrap to next row, first column
                    const nextRow = row + 1;
                    if (nextRow < GRID_ROWS) {
                        const next = grid.querySelector(`.grid-cell[data-row="${nextRow}"][data-col="0"]`);
                        if (next) next.focus();
                    }
                }
            }
            syncGridToInputs();
        });

        // Click to cycle color
        cell.addEventListener('click', (e) => {
            cycleCellState(e.currentTarget);
            syncGridToInputs();
        });

        // Keyboard navigation within grid
        cell.addEventListener('keydown', (e) => {
            const currentCell = e.currentTarget;
            const { row, col } = getCellIndex(currentCell);
            switch (e.key) {
                case 'Backspace':
                    if (!currentCell.value) {
                        const prevCol = col - 1;
                        if (prevCol >= 0) {
                            const prev = grid.querySelector(`.grid-cell[data-row="${row}"][data-col="${prevCol}"]`);
                            if (prev) prev.focus();
                        } else {
                            // Wrap to previous row, last column
                            const prevRow = row - 1;
                            if (prevRow >= 0) {
                                const prev = grid.querySelector(`.grid-cell[data-row="${prevRow}"][data-col="${GRID_COLS - 1}"]`);
                                if (prev) prev.focus();
                            }
                        }
                    }
                    // Clear state when emptied
                    setTimeout(() => {
                        if (!currentCell.value) {
                            clearCellState(currentCell);
                            currentCell.classList.remove('has-letter');
                        }
                        syncGridToInputs();
                    }, 0);
                    break;
                case 'ArrowLeft':
                    e.preventDefault();
                    if (col > 0) {
                        const prev = grid.querySelector(`.grid-cell[data-row="${row}"][data-col="${col - 1}"]`);
                        if (prev) prev.focus();
                    } else {
                        // Wrap to previous row, last column
                        const prevRow = row - 1;
                        if (prevRow >= 0) {
                            const prev = grid.querySelector(`.grid-cell[data-row="${prevRow}"][data-col="${GRID_COLS - 1}"]`);
                            if (prev) prev.focus();
                        }
                    }
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    if (col + 1 < GRID_COLS) {
                        const next = grid.querySelector(`.grid-cell[data-row="${row}"][data-col="${col + 1}"]`);
                        if (next) next.focus();
                    } else {
                        // Wrap to next row, first column
                        const nextRow = row + 1;
                        if (nextRow < GRID_ROWS) {
                            const next = grid.querySelector(`.grid-cell[data-row="${nextRow}"][data-col="0"]`);
                            if (next) next.focus();
                        }
                    }
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    if (row > 0) {
                        const up = grid.querySelector(`.grid-cell[data-row="${row - 1}"][data-col="${col}"]`);
                        if (up) up.focus();
                    }
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    if (row + 1 < GRID_ROWS) {
                        const down = grid.querySelector(`.grid-cell[data-row="${row + 1}"][data-col="${col}"]`);
                        if (down) down.focus();
                    }
                    break;
                case ' ': // space to cycle
                    e.preventDefault();
                    cycleCellState(e.currentTarget);
                    syncGridToInputs();
                    break;
            }
        });
    });

    rowRemainingElements = Array.from({ length: GRID_ROWS }, (_, row) =>
        document.querySelector(`.row-remaining[data-row="${row}"]`)
    );
}

// Convert grid content into existing inputs
function syncGridToInputs() {
    const grid = document.querySelector('.wordle-grid');
    if (!grid) return;

    const greenByPos = Array(GRID_COLS).fill('');
    const yellowByPos = Array.from({ length: GRID_COLS }, () => new Set());
    const grayLetters = new Set();
    const includedLetters = new Set(); // letters seen as green/yellow anywhere

    // Process from top to bottom; last green for a column wins naturally if earlier empty
    for (let row = 0; row < GRID_ROWS; row++) {
        for (let col = 0; col < GRID_COLS; col++) {
            const cell = getGridCell(row, col);
            if (!cell) continue;
            const letter = (cell.value || '').toLowerCase();
            if (!letter) continue;
            const state = getCellState(cell);
            if (state === 'green') {
                greenByPos[col] = letter; // overwrite with the latest explicit green
                includedLetters.add(letter);
            } else if (state === 'yellow') {
                yellowByPos[col].add(letter);
                includedLetters.add(letter);
            } else if (state === 'gray') {
                grayLetters.add(letter);
            }
        }
    }

    // Apply to UI inputs
    const greenInputs = document.querySelectorAll('#greenInputs .letter-input');
    greenByPos.forEach((ch, i) => {
        if (greenInputs[i]) greenInputs[i].value = ch.toUpperCase();
    });

    const yellowInputs = document.querySelectorAll('#yellowInputs .letter-input');
    yellowByPos.forEach((set, i) => {
        const str = Array.from(set).map(c => c.toUpperCase()).join('');
        if (yellowInputs[i]) yellowInputs[i].value = str;
    });

    // Excluded letters are gray letters not already included as green/yellow
    const excluded = Array.from(grayLetters)
        .filter(ch => !includedLetters.has(ch))
        .map(ch => ch.toUpperCase())
        .join('');

    // Persist constraints in state (no hidden legacy inputs required)
    gameState.greenLetters = greenByPos;
    gameState.yellowLetters = yellowByPos.map((set) => Array.from(set).join(''));
    gameState.excludedLetters = excluded;

    // Grid updates can happen on every keystroke; keep the UI responsive by
    // debouncing the expensive analysis/render step. During URL restore, run
    // immediately so history uses replaceState.
    if (__restoringUrl) {
        analyzeWords();
    } else {
        debouncedAnalyze();
    }
}

function refreshGridCaches() {
    const cells = getGridCells();
    cells.forEach((cell) => {
        const { row, col } = getCellIndex(cell);
        if (row >= 0 && row < GRID_ROWS && col >= 0 && col < GRID_COLS) {
            gridCellCache[row][col] = cell;
        }
    });

    rowRemainingElements = Array.from({ length: GRID_ROWS }, (_, row) =>
        document.querySelector(`.row-remaining[data-row="${row}"]`)
    );
}

function getGridCell(row, col) {
    const cached = gridCellCache[row] ? gridCellCache[row][col] : null;
    if (cached) return cached;
    const cell = document.querySelector(`.grid-cell[data-row="${row}"][data-col="${col}"]`);
    if (cell && row >= 0 && row < GRID_ROWS && col >= 0 && col < GRID_COLS) {
        gridCellCache[row][col] = cell;
    }
    return cell;
}

function getRowRemainingElement(row) {
    const cached = rowRemainingElements[row];
    if (cached) return cached;
    const element = document.querySelector(`.row-remaining[data-row="${row}"]`);
    if (element) {
        rowRemainingElements[row] = element;
    }
    return element;
}

function getRowSignature(row) {
    let signature = '';
    for (let col = 0; col < GRID_COLS; col++) {
        const cell = getGridCell(row, col);
        const letter = cell && cell.value ? cell.value.toUpperCase() : '.';
        const state = cell ? (getCellState(cell) || '') : '';
        signature += `${letter}:${state}|`;
    }
    return signature;
}

function isRowComplete(row) {
    for (let col = 0; col < GRID_COLS; col++) {
        const cell = getGridCell(row, col);
        const value = (cell && cell.value ? cell.value.trim() : '');
        if (!value || !/^[A-Z]$/i.test(value)) {
            return false;
        }
    }
    return true;
}

function buildConstraintsThroughRow(maxRow) {
    const greenByPos = Array(GRID_COLS).fill('');
    const yellowByPos = Array.from({ length: GRID_COLS }, () => new Set());
    const grayLetters = new Set();
    const includedLetters = new Set();

    for (let row = 0; row <= maxRow; row++) {
        for (let col = 0; col < GRID_COLS; col++) {
            const cell = getGridCell(row, col);
            if (!cell) continue;
            const letter = (cell.value || '').toLowerCase();
            if (!letter) continue;
            const state = getCellState(cell) || 'gray';
            if (state === 'green') {
                greenByPos[col] = letter;
                includedLetters.add(letter);
            } else if (state === 'yellow') {
                yellowByPos[col].add(letter);
                includedLetters.add(letter);
            } else if (state === 'gray') {
                grayLetters.add(letter);
            }
        }
    }

    const excluded = Array.from(grayLetters)
        .filter((ch) => !includedLetters.has(ch))
        .join('');

    return {
        greenLetters: greenByPos,
        yellowLetters: yellowByPos.map((set) => Array.from(set).join('')),
        excludedLetters: excluded
    };
}

function updateGuessRemainingCounts() {
    const rows = rowRemainingElements.filter(Boolean);
    if (!rows.length) {
        refreshGridCaches();
    }
    if (!rowRemainingElements.filter(Boolean).length) return;

    if (WORD_LIST.length === 0) {
        rowRemainingElements.forEach((row) => {
            if (!row) return;
            const pill = row.querySelector('.row-remaining-pill');
            if (pill) pill.textContent = '-';
            row.classList.add('is-empty');
        });
        rowRemainingCache.signatures = Array(GRID_ROWS).fill('');
        rowRemainingCache.remaining = Array(GRID_ROWS).fill(null);
        return;
    }

    const signatures = Array.from({ length: GRID_ROWS }, (_, row) => getRowSignature(row));
    const firstChanged = signatures.findIndex((sig, idx) => sig !== rowRemainingCache.signatures[idx]);

    if (firstChanged === -1) {
        return;
    }

    rowRemainingCache.signatures = signatures;

    let baseWords = firstChanged === 0 ? WORD_LIST : rowRemainingCache.remaining[firstChanged - 1];

    for (let row = firstChanged; row < GRID_ROWS; row++) {
        const rowDisplay = getRowRemainingElement(row);
        if (!rowDisplay) continue;
        const pill = rowDisplay.querySelector('.row-remaining-pill');
        if (!pill) continue;

        const rowComplete = isRowComplete(row);
        if (!baseWords || !rowComplete) {
            pill.textContent = '-';
            rowDisplay.classList.add('is-empty');
            rowRemainingCache.remaining[row] = null;
            baseWords = null;
            continue;
        }

        const constraints = buildConstraintsThroughRow(row);
        const remaining = filterWordsWithConstraints(constraints, baseWords);
        rowRemainingCache.remaining[row] = remaining;
        pill.textContent = remaining.length.toLocaleString();
        rowDisplay.classList.remove('is-empty');
        baseWords = remaining;
    }
}

// Performance optimization: Pattern cache and word frequency data
const patternCache = new Map();
const COMMON_WORDS = new Set(['about', 'above', 'abuse', 'actor', 'acute', 'admit', 'adopt', 'adult', 'after', 'again', 'agent', 'agree', 'ahead', 'alarm', 'album', 'alert', 'alien', 'align', 'alike', 'alive', 'allow', 'alone', 'along', 'alter', 'among', 'anger', 'angle', 'angry', 'apart', 'apple', 'apply', 'arena', 'argue', 'arise', 'array', 'aside', 'asset', 'audio', 'audit', 'avoid', 'awake', 'award', 'aware', 'badly', 'baker', 'bases', 'basic', 'beach', 'began', 'begin', 'being', 'below', 'bench', 'billy', 'birth', 'black', 'blame', 'blind', 'block', 'blood', 'board', 'boost', 'booth', 'bound', 'brain', 'brand', 'brass', 'brave', 'bread', 'break', 'breed', 'brief', 'bring', 'broad', 'broke', 'brown', 'build', 'built', 'buyer', 'cable', 'calif', 'carry', 'catch', 'cause', 'chain', 'chair', 'chaos', 'charm', 'chart', 'chase', 'cheap', 'check', 'chest', 'chief', 'child', 'china', 'chose', 'civil', 'claim', 'class', 'clean', 'clear', 'click', 'climb', 'clock', 'close', 'cloud', 'coach', 'coast', 'could', 'count', 'court', 'cover', 'craft', 'crash', 'crazy', 'cream', 'crime', 'cross', 'crowd', 'crown', 'crude', 'curve', 'cycle', 'daily', 'dance', 'dated', 'dealt', 'death', 'debut', 'delay', 'depth', 'doing', 'doubt', 'dozen', 'draft', 'drama', 'drank', 'dream', 'dress', 'drill', 'drink', 'drive', 'drove', 'dying', 'eager', 'early', 'earth', 'eight', 'elite', 'empty', 'enemy', 'enjoy', 'enter', 'entry', 'equal', 'error', 'event', 'every', 'exact', 'exist', 'extra', 'faith', 'false', 'fault', 'fiber', 'field', 'fifth', 'fifty', 'fight', 'final', 'first', 'fixed', 'flash', 'fleet', 'floor', 'fluid', 'focus', 'force', 'forth', 'forty', 'forum', 'found', 'frame', 'frank', 'fraud', 'fresh', 'front', 'fruit', 'fully', 'funny', 'giant', 'given', 'glass', 'globe', 'going', 'grace', 'grade', 'grand', 'grant', 'grass', 'grave', 'great', 'green', 'gross', 'group', 'grown', 'guard', 'guess', 'guest', 'guide', 'happy', 'harry', 'heart', 'heavy', 'hence', 'henry', 'horse', 'hotel', 'house', 'human', 'ideal', 'image', 'index', 'inner', 'input', 'issue', 'japan', 'jimmy', 'joint', 'jones', 'judge', 'known', 'label', 'large', 'laser', 'later', 'laugh', 'layer', 'learn', 'lease', 'least', 'leave', 'legal', 'level', 'lewis', 'light', 'limit', 'links', 'lives', 'local', 'loose', 'lower', 'lucky', 'lunch', 'lying', 'magic', 'major', 'maker', 'march', 'maria', 'match', 'maybe', 'mayor', 'meant', 'media', 'metal', 'might', 'minor', 'minus', 'mixed', 'model', 'money', 'month', 'moral', 'motor', 'mount', 'mouse', 'mouth', 'moved', 'movie', 'music', 'needs', 'never', 'newly', 'night', 'noise', 'north', 'noted', 'novel', 'nurse', 'occur', 'ocean', 'offer', 'often', 'order', 'other', 'ought', 'paint', 'panel', 'paper', 'party', 'peace', 'peter', 'phase', 'phone', 'photo', 'piano', 'piece', 'pilot', 'pitch', 'place', 'plain', 'plane', 'plant', 'plate', 'point', 'pound', 'power', 'press', 'price', 'pride', 'prime', 'print', 'prior', 'prize', 'proof', 'proud', 'prove', 'queen', 'quick', 'quiet', 'quite', 'radio', 'raise', 'range', 'rapid', 'ratio', 'reach', 'ready', 'realm', 'rebel', 'refer', 'relax', 'repay', 'reply', 'right', 'rigid', 'rival', 'river', 'robin', 'roger', 'roman', 'rough', 'round', 'route', 'royal', 'rural', 'scale', 'scene', 'scope', 'score', 'sense', 'serve', 'seven', 'shall', 'shape', 'share', 'sharp', 'sheet', 'shelf', 'shell', 'shift', 'shine', 'shirt', 'shock', 'shoot', 'short', 'shown', 'sides', 'sight', 'simon', 'sixth', 'sixty', 'sized', 'skill', 'sleep', 'slide', 'small', 'smart', 'smile', 'smith', 'smoke', 'snake', 'snow', 'solid', 'solve', 'sorry', 'sound', 'south', 'space', 'spare', 'speak', 'speed', 'spend', 'spent', 'split', 'spoke', 'sport', 'staff', 'stage', 'stake', 'stand', 'start', 'state', 'steam', 'steel', 'steep', 'steer', 'steve', 'stick', 'still', 'stock', 'stone', 'stood', 'store', 'storm', 'story', 'strip', 'stuck', 'study', 'stuff', 'style', 'sugar', 'suite', 'super', 'sweet', 'table', 'taken', 'taste', 'taxes', 'teach', 'teams', 'teeth', 'terry', 'texas', 'thank', 'theft', 'their', 'theme', 'there', 'these', 'thick', 'thing', 'think', 'third', 'those', 'three', 'threw', 'throw', 'thumb', 'tiger', 'tight', 'timer', 'tired', 'title', 'today', 'topic', 'total', 'touch', 'tough', 'tower', 'track', 'trade', 'train', 'treat', 'trend', 'trial', 'tribe', 'trick', 'tried', 'tries', 'truck', 'truly', 'trunk', 'trust', 'truth', 'twice', 'twin', 'twist', 'tyler', 'ultra', 'uncle', 'under', 'undue', 'union', 'unity', 'until', 'upper', 'upset', 'urban', 'usage', 'usual', 'valid', 'value', 'video', 'virus', 'visit', 'vital', 'vocal', 'voice', 'waste', 'watch', 'water', 'wave', 'ways', 'weird', 'welcome', 'western', 'wheel', 'where', 'which', 'while', 'white', 'whole', 'whose', 'woman', 'women', 'world', 'worry', 'worse', 'worst', 'worth', 'would', 'write', 'wrong', 'wrote', 'young', 'youth']);

// English letter frequency for better scoring
const ENGLISH_LETTER_FREQ = {
    'e': 0.12702, 't': 0.09056, 'a': 0.08167, 'o': 0.07507, 'i': 0.06966,
    'n': 0.06749, 's': 0.06327, 'h': 0.06094, 'r': 0.05987, 'd': 0.04253,
    'l': 0.04025, 'c': 0.02782, 'u': 0.02758, 'm': 0.02406, 'w': 0.02360,
    'f': 0.02228, 'g': 0.02015, 'y': 0.01974, 'p': 0.01929, 'b': 0.01292,
    'v': 0.00978, 'k': 0.00772, 'j': 0.00153, 'x': 0.00150, 'q': 0.00095, 'z': 0.00074
};

// Utility functions
const isTrue = (v) => v === true;
const re = (expStr) => new RegExp(expStr, 'i');
const isNumber = (v) => typeof v === 'number';

function debounce(func, wait, immediate) {
    var timeout;
    return function() {
        var context = this, args = arguments;
        var later = function() {
            timeout = null;
            if (!immediate) func.apply(context, args);
        };
        var callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        if (callNow) func.apply(context, args);
    };
}

// Load word list from JSON
async function loadWordList() {
    try {
        showLoading(true);
        console.log('Attempting to load word list from ./official-valid-words.json');
        
        const response = await fetch("./official-valid-words.json");
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const rawWords = await response.json();
        if (!Array.isArray(rawWords)) {
            throw new Error('Word list JSON must be an array of words.');
        }
        if (!rawWords.every(word => typeof word === 'string' && /^[a-z]{5}$/.test(word))) {
            throw new Error('Word list JSON must contain only lowercase 5-letter words.');
        }
        
        WORD_LIST = rawWords;
        gameState.remainingWords = [...WORD_LIST];
        showLoading(false);
        updateStats();
        updateDisplay();
        console.log(`Successfully loaded ${WORD_LIST.length} words`);
    } catch (error) {
        showLoading(false);
        console.error('Detailed error loading word list:', error);
        
        // Provide more specific error messages
        let errorMessage = 'Failed to load word list. ';
        if (error.message.includes('HTTP 404')) {
            errorMessage += 'The file "official-valid-words.json" was not found in the same directory as this HTML file.';
        } else if (error.message.includes('JSON')) {
            errorMessage += 'The JSON file was found but is not a valid array of lowercase 5-letter words. Please check the file format.';
        } else {
            errorMessage += `Error: ${error.message}`;
        }
        
        showError(errorMessage);
        
        // Try to provide a fallback or helpful suggestion
        console.log('Suggestion: Make sure "official-valid-words.json" exists in the same folder as index.html');
        console.log('The JSON should contain an array of words, like:');
        console.log('["arose", "about", "adieu", "audio"]');
    }
}

function showLoading(show) {
    const indicator = document.getElementById('loadingIndicator');
    if (show) {
        indicator.classList.add('visible');
    } else {
        indicator.classList.remove('visible');
    }
}

function showError(message) {
    const container = document.querySelector('.container');
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${message}`;
    container.appendChild(errorDiv);
}

// Toggle word hints blur
function toggleWordHints() {
    gameState.hintsBlurred = !gameState.hintsBlurred;
    updateWordHintsDisplay();
}

function updateWordHintsDisplay() {
    const toggle = document.querySelector('.word-hints-toggle');
    const icon = toggle.querySelector('i');
    const text = document.getElementById('hintsToggleText');
    const sections = document.querySelectorAll('.word-hints-section');

    if (gameState.hintsBlurred) {
        toggle.classList.remove('active');
        icon.className = 'fas fa-eye-slash';
        text.textContent = 'Show Hints';
        sections.forEach(section => section.classList.remove('unblurred'));
    } else {
        toggle.classList.add('active');
        icon.className = 'fas fa-eye';
        text.textContent = 'Blur Hints';
        sections.forEach(section => section.classList.add('unblurred'));
    }
}
function getExactly() {
    return getExactlyFromConstraints(gameState);
}

function getExactlyNot() {
    return getExactlyNotFromConstraints(gameState);
}

function createHasValue() {
    return createHasValueFromConstraints(gameState);
}

function uniqueChars(allChars) {
    const chars = {};
    [...allChars].forEach((char) => chars[char] = true);
    return Object.keys(chars).join('');
}

function getExactlyFromConstraints(constraints) {
    const letters = Array.isArray(constraints.greenLetters) ? constraints.greenLetters : ['', '', '', '', ''];
    return letters.map((ch) => ch ? ch : '.').join('');
}

function getExactlyNotFromConstraints(constraints) {
    const lettersByPos = Array.isArray(constraints.yellowLetters) ? constraints.yellowLetters : ['', '', '', '', ''];
    return lettersByPos
        .map((letters) => letters ? `[^${letters}]{1}` : '.')
        .join('');
}

function createHasValueFromConstraints(constraints) {
    const greens = (Array.isArray(constraints.greenLetters) ? constraints.greenLetters : []).join('');
    const yellows = (Array.isArray(constraints.yellowLetters) ? constraints.yellowLetters : []).join('');
    return uniqueChars((greens + yellows).toLowerCase());
}

function filterWordsWithConstraints(constraints, baseWords = WORD_LIST) {
    if (!baseWords || baseWords.length === 0) return [];

    const exactlyValue = getExactlyFromConstraints(constraints).toLowerCase();
    const exactlyNotValue = getExactlyNotFromConstraints(constraints).toLowerCase();
    const notValue = (constraints.excludedLetters || '').toLowerCase();
    const hasValue = createHasValueFromConstraints(constraints);
    const exactRe = new RegExp(exactlyValue, 'i');
    const exactNotRe = new RegExp(exactlyNotValue, 'i');
    const notRe = new RegExp(`[^${notValue}]{5}`, 'i');
    const hasRegexes = hasValue ? [...hasValue].map((letter) => new RegExp(letter, 'i')) : [];
    const has = hasRegexes.length
        ? (s) => hasRegexes.every((regex) => regex.test(s))
        : () => true;

    return baseWords
        .filter((s) => notRe.test(s))
        .filter((s) => exactNotRe.test(s))
        .filter((s) => exactRe.test(s))
        .filter(has);
}

// Character distribution analysis
function characterDistribution(words) {
    const chars = {};
    
    words.forEach((word) => {
        [...word].forEach((char) => {
            chars[char] = (isNumber(chars[char]) ? chars[char] + 1 : 1)
        })
    });
    
    const entries = Object.entries(chars).sort((a, b) => b[1] - a[1]);
    return entries;
}

// Main word filtering logic (based on original code)
function filterWords() {
    if (WORD_LIST.length === 0) return;

    gameState.remainingWords = filterWordsWithConstraints({
        greenLetters: gameState.greenLetters,
        yellowLetters: gameState.yellowLetters,
        excludedLetters: gameState.excludedLetters
    });
}

// Calculate letter frequency for remaining words
function calculateLetterFrequency() {
    gameState.letterFrequency = {};
    gameState.positionFrequency = [{}, {}, {}, {}, {}];

    gameState.remainingWords.forEach(word => {
        const lettersSeen = new Set();
        
        for (let i = 0; i < 5; i++) {
            const letter = word[i];
            
            // Overall frequency (count each letter once per word)
            if (!lettersSeen.has(letter)) {
                gameState.letterFrequency[letter] = (gameState.letterFrequency[letter] || 0) + 1;
                lettersSeen.add(letter);
            }
            
            // Position-specific frequency
            gameState.positionFrequency[i][letter] = (gameState.positionFrequency[i][letter] || 0) + 1;
        }
    });

    gameState.positionTotals = gameState.positionFrequency.map((posFreq) =>
        Object.values(posFreq).reduce((sum, count) => sum + count, 0)
    );
}

// Enhanced word frequency scoring
function getWordFrequency(word) {
    if (COMMON_WORDS.has(word)) return 1.0;
    return 0.5; // Less common words get lower weight
}

// Letter frequency scoring (was missing)
function calculateLetterFrequencyScore(word) {
    const uniqueLetters = new Set(word);
    let score = 0;
    
    uniqueLetters.forEach(letter => {
        score += ENGLISH_LETTER_FREQ[letter] || 0.01;
    });
    
    return score;
}

// Position-based scoring (was missing)
function calculatePositionScore(word) {
    let score = 0;
    
    for (let i = 0; i < 5; i++) {
        const letter = word[i];
        const positionFreq = gameState.positionFrequency[i][letter] || 0;
        const totalWordsInPosition = Array.isArray(gameState.positionTotals)
            ? (gameState.positionTotals[i] || 0)
            : Object.values(gameState.positionFrequency[i]).reduce((sum, count) => sum + count, 0);
        
        if (totalWordsInPosition > 0) {
            score += positionFreq / totalWordsInPosition;
        }
    }
    
    return score / 5; // Average across positions
}

// Optimized pattern generation with caching
function getResponsePatternOptimized(guess, answer) {
    const key = `${guess}:${answer}`;
    if (patternCache.has(key)) {
        return patternCache.get(key);
    }
    
    const pattern = getResponsePattern(guess, answer);
    
    // Limit cache size to prevent memory issues
    if (patternCache.size > 10000) {
        const firstKey = patternCache.keys().next().value;
        patternCache.delete(firstKey);
    }
    
    patternCache.set(key, pattern);
    return pattern;
}

// Web Worker for heavy calculations
let calculationWorker = null;
let calculationRequestId = 0;
let calculationWorkerBusy = false;
let pendingOptimalGuessRequest = null;

const ANALYZE_DEBOUNCE_MS = 500;

function initializeWebWorker() {
    const workerCode = `
        // Worker code for heavy calculations
        const ENGLISH_LETTER_FREQ = {
            'e': 0.12702, 't': 0.09056, 'a': 0.08167, 'o': 0.07507, 'i': 0.06966,
            'n': 0.06749, 's': 0.06327, 'h': 0.06094, 'r': 0.05987, 'd': 0.04253,
            'l': 0.04025, 'c': 0.02782, 'u': 0.02758, 'm': 0.02406, 'w': 0.02360,
            'f': 0.02228, 'g': 0.02015, 'y': 0.01974, 'p': 0.01929, 'b': 0.01292,
            'v': 0.00978, 'k': 0.00772, 'j': 0.00153, 'x': 0.00150, 'q': 0.00095, 'z': 0.00074
        };

        function getCompositeWeights(remainingWordsCount) {
            if (remainingWordsCount > 50) {
                return { elimination: 0.6, entropy: 0.3, worstCase: 0.1 };
            } else if (remainingWordsCount > 10) {
                return { elimination: 0.65, entropy: 0.2, worstCase: 0.15 };
            }
            return { elimination: 0.7, entropy: 0.1, worstCase: 0.2 };
        }

        function calculateLetterFrequencyScore(word) {
            const uniqueLetters = new Set(word);
            let score = 0;
            uniqueLetters.forEach(letter => {
                score += ENGLISH_LETTER_FREQ[letter] || 0.01;
            });
            return score;
        }

        function calculatePositionFrequencies(words) {
            const positionFrequency = [{}, {}, {}, {}, {}];
            const positionTotals = [0, 0, 0, 0, 0];

            words.forEach(word => {
                for (let i = 0; i < 5; i++) {
                    const letter = word[i];
                    positionFrequency[i][letter] = (positionFrequency[i][letter] || 0) + 1;
                    positionTotals[i]++;
                }
            });

            return { positionFrequency, positionTotals };
        }

        function calculatePositionScore(word, positionData) {
            let score = 0;
            for (let i = 0; i < 5; i++) {
                const letter = word[i];
                const positionFreq = positionData.positionFrequency[i][letter] || 0;
                const totalWordsInPosition = positionData.positionTotals[i] || 0;
                if (totalWordsInPosition > 0) {
                    score += positionFreq / totalWordsInPosition;
                }
            }
            return score / 5;
        }

        function selectCandidatePool(remainingWords) {
            let candidatePool = [...remainingWords];
            const positionData = calculatePositionFrequencies(remainingWords);

            if (remainingWords.length > 500) {
                const quickScored = remainingWords.map(word => ({
                    word,
                    quickScore: calculateLetterFrequencyScore(word) + calculatePositionScore(word, positionData)
                })).sort((a, b) => b.quickScore - a.quickScore);

                candidatePool = quickScored.slice(0, 50).map(item => item.word);
            } else if (remainingWords.length > 200) {
                const quickScored = remainingWords.map(word => ({
                    word,
                    quickScore: calculateLetterFrequencyScore(word) + calculatePositionScore(word, positionData)
                })).sort((a, b) => b.quickScore - a.quickScore);

                candidatePool = quickScored.slice(0, 100).map(item => item.word);
            }

            if (candidatePool.length > 100) {
                candidatePool = candidatePool.slice(0, 100);
            }

            return candidatePool;
        }

        function getResponsePattern(guess, answer) {
            const pattern = ['gray', 'gray', 'gray', 'gray', 'gray'];
            const answerChars = answer.split('');
            const guessChars = guess.split('');
            
            // First pass: mark greens
            for (let i = 0; i < 5; i++) {
                if (guessChars[i] === answerChars[i]) {
                    pattern[i] = 'green';
                    answerChars[i] = null;
                    guessChars[i] = null;
                }
            }
            
            // Second pass: mark yellows
            for (let i = 0; i < 5; i++) {
                if (guessChars[i] !== null) {
                    const answerIndex = answerChars.indexOf(guessChars[i]);
                    if (answerIndex !== -1) {
                        pattern[i] = 'yellow';
                        answerChars[answerIndex] = null;
                    }
                }
            }
            
            return pattern;
        }

        function calculateGuessMetrics(guess, remainingWords) {
            const totalWords = remainingWords.length;
            if (totalWords <= 1) {
                return {
                    score: 100,
                    eliminationPercent: 100,
                    entropyBits: 0,
                    worstCaseRemaining: totalWords,
                    expectedRemaining: totalWords
                };
            }

            const outcomes = new Map();
            remainingWords.forEach(answer => {
                const pattern = getResponsePattern(guess, answer);
                const key = pattern.join('');
                outcomes.set(key, (outcomes.get(key) || 0) + 1);
            });

            let expectedRemaining = 0;
            let entropyBits = 0;
            let worstCaseRemaining = 0;
            outcomes.forEach(count => {
                const probability = count / totalWords;
                expectedRemaining += probability * count;
                entropyBits -= probability * Math.log2(probability);
                worstCaseRemaining = Math.max(worstCaseRemaining, count);
            });

            const eliminationPercent = 100 * (1 - expectedRemaining / totalWords);
            const maxEntropyBits = Math.log2(totalWords);
            const entropyScore = maxEntropyBits > 0 ? 100 * (entropyBits / maxEntropyBits) : 0;
            const worstCaseScore = 100 * (1 - worstCaseRemaining / totalWords);
            const weights = getCompositeWeights(totalWords);
            const score = (weights.elimination * eliminationPercent) +
                (weights.entropy * entropyScore) +
                (weights.worstCase * worstCaseScore);

            return {
                score,
                eliminationPercent,
                entropyBits,
                worstCaseRemaining,
                expectedRemaining
            };
        }

        self.onmessage = function(e) {
            const { type, data } = e.data;
            
            if (type === 'calculateOptimalGuesses') {
                const { remainingWords, requestId, startedAt } = data;
                const candidatePool = selectCandidatePool(remainingWords);
                
                const scored = candidatePool.map(word => ({
                    word,
                    ...calculateGuessMetrics(word, remainingWords),
                    type: remainingWords.includes(word) ? 'answer' : 'strategic'
                }));

                scored.sort((a, b) => b.score - a.score);
                
                self.postMessage({
                    type: 'optimalGuessesResult',
                    data: scored.slice(0, 10),
                    requestId,
                    startedAt,
                    candidateCount: candidatePool.length,
                    remainingCount: remainingWords.length
                });
            }
        };
    `;

    const blob = new Blob([workerCode], { type: 'application/javascript' });
    calculationWorker = new Worker(URL.createObjectURL(blob));
    
    calculationWorker.onmessage = function(e) {
        const { type, data, requestId, startedAt, candidateCount, remainingCount } = e.data;
        
        if (type === 'optimalGuessesResult') {
            calculationWorkerBusy = false;

            if (requestId === calculationRequestId) {
                gameState.optimalGuesses = data;
                updateOptimalGuesses();
                showLoading(false);
                logOptimalGuessTiming(startedAt, candidateCount, remainingCount, true);
            }

            flushPendingOptimalGuessRequest();
        }
    };

    calculationWorker.onerror = function(error) {
        console.error('Worker error:', error);
        calculationWorkerBusy = false;
        pendingOptimalGuessRequest = null;
        showLoading(false);
        showError('Optimal guess calculation failed. Please reload the page and try again.');
    };
}

function flushPendingOptimalGuessRequest() {
    if (!calculationWorker || calculationWorkerBusy || !pendingOptimalGuessRequest) return;

    const request = pendingOptimalGuessRequest;
    pendingOptimalGuessRequest = null;
    calculationWorkerBusy = true;

    calculationWorker.postMessage({
        type: 'calculateOptimalGuesses',
        data: request
    });
}

// Enhanced optimal guess calculation with Web Worker support
function calculateOptimalGuesses() {
    const startedAt = performance.now();
    const requestId = ++calculationRequestId;

    if (gameState.remainingWords.length === 0) {
        pendingOptimalGuessRequest = null;
        gameState.optimalGuesses = [];
        logOptimalGuessTiming(startedAt, 0, 0, false);
        return;
    }

    if (gameState.remainingWords.length === 1) {
        pendingOptimalGuessRequest = null;
        gameState.optimalGuesses = gameState.remainingWords.map(word => ({
            word,
            score: 100,
            eliminationPercent: 100,
            entropyBits: 0,
            worstCaseRemaining: 1,
            expectedRemaining: 1,
            type: 'answer'
        }));
        logOptimalGuessTiming(startedAt, 1, 1, false);
        return;
    }

    if (!calculationWorker) {
        console.error('Optimal guess worker is not initialized.');
        showError('Optimal guess worker is not available. Please reload the page and try again.');
        logOptimalGuessTiming(startedAt, 0, gameState.remainingWords.length, false);
        return;
    }

    pendingOptimalGuessRequest = {
        remainingWords: gameState.remainingWords,
        requestId,
        startedAt
    };
    flushPendingOptimalGuessRequest();
}

// Lightweight expected information calculation for performance
function calculateExpectedInformation(guess) {
    if (gameState.remainingWords.length <= 1) return 0;
    
    // For large sets, use approximation to avoid expensive calculations
    if (gameState.remainingWords.length > 100) {
        // Sample subset for approximation
        const sampleSize = Math.min(50, gameState.remainingWords.length);
        const sample = gameState.remainingWords.slice(0, sampleSize);
        
        const outcomes = new Map();
        sample.forEach(answer => {
            const pattern = getResponsePatternOptimized(guess, answer);
            const key = pattern.join('');
            outcomes.set(key, (outcomes.get(key) || 0) + 1);
        });
        
        let entropy = 0;
        const total = sample.length;
        outcomes.forEach(count => {
            const prob = count / total;
            entropy -= prob * Math.log2(prob);
        });
        
        return entropy;
    }

    // Use full calculation only for smaller sets
    const outcomes = new Map();
    
    gameState.remainingWords.forEach(answer => {
        const pattern = getResponsePatternOptimized(guess, answer);
        const key = pattern.join('');
        
        if (!outcomes.has(key)) {
            outcomes.set(key, []);
        }
        outcomes.get(key).push(answer);
    });

    let expectedInfo = 0;
    const totalWords = gameState.remainingWords.length;
    
    outcomes.forEach(group => {
        const probability = group.length / totalWords;
        if (probability > 0) {
            const information = -Math.log2(probability);
            expectedInfo += probability * information;
        }
    });

    return expectedInfo;
}

function getCompositeWeights(remainingWordsCount) {
    if (remainingWordsCount > 50) {
        return { elimination: 0.6, entropy: 0.3, worstCase: 0.1 };
    } else if (remainingWordsCount > 10) {
        return { elimination: 0.65, entropy: 0.2, worstCase: 0.15 };
    }
    return { elimination: 0.7, entropy: 0.1, worstCase: 0.2 };
}

function calculateGuessMetrics(guess) {
    const totalWords = gameState.remainingWords.length;
    if (totalWords <= 1) {
        return {
            score: 100,
            eliminationPercent: 100,
            entropyBits: 0,
            worstCaseRemaining: totalWords,
            expectedRemaining: totalWords
        };
    }

    const outcomes = new Map();
    gameState.remainingWords.forEach(answer => {
        const pattern = getResponsePatternOptimized(guess, answer);
        const key = pattern.join('');
        outcomes.set(key, (outcomes.get(key) || 0) + 1);
    });

    let expectedRemaining = 0;
    let entropyBits = 0;
    let worstCaseRemaining = 0;
    outcomes.forEach(count => {
        const probability = count / totalWords;
        expectedRemaining += probability * count;
        entropyBits -= probability * Math.log2(probability);
        worstCaseRemaining = Math.max(worstCaseRemaining, count);
    });

    const eliminationPercent = 100 * (1 - expectedRemaining / totalWords);
    const maxEntropyBits = Math.log2(totalWords);
    const entropyScore = maxEntropyBits > 0 ? 100 * (entropyBits / maxEntropyBits) : 0;
    const worstCaseScore = 100 * (1 - worstCaseRemaining / totalWords);
    const weights = getCompositeWeights(totalWords);
    const score = (weights.elimination * eliminationPercent) +
        (weights.entropy * entropyScore) +
        (weights.worstCase * worstCaseScore);

    return {
        score,
        eliminationPercent,
        entropyBits,
        worstCaseRemaining,
        expectedRemaining
    };
}

// Get response pattern for a guess against an answer
function getResponsePattern(guess, answer) {
    const pattern = ['gray', 'gray', 'gray', 'gray', 'gray'];
    const answerChars = answer.split('');
    const guessChars = guess.split('');
    
    // First pass: mark greens
    for (let i = 0; i < 5; i++) {
        if (guessChars[i] === answerChars[i]) {
            pattern[i] = 'green';
            answerChars[i] = null; // Mark as used
            guessChars[i] = null;
        }
    }
    
    // Second pass: mark yellows
    for (let i = 0; i < 5; i++) {
        if (guessChars[i] !== null) {
            const answerIndex = answerChars.indexOf(guessChars[i]);
            if (answerIndex !== -1) {
                pattern[i] = 'yellow';
                answerChars[answerIndex] = null; // Mark as used
            }
        }
    }
    
    return pattern;
}

// Navigation within green/yellow sections
function handleInputKeyDown(event) {
    const target = event.target;
    
    // Only handle navigation for green and yellow inputs
    if (!target.classList.contains('exactly') && !target.classList.contains('exactly-not')) {
        return;
    }
    
    const isGreenSection = target.classList.contains('exactly');
    const isYellowSection = target.classList.contains('exactly-not');
    
    if (isGreenSection || isYellowSection) {
        const selector = isGreenSection ? '#greenInputs .letter-input' : '#yellowInputs .letter-input';
        const inputs = document.querySelectorAll(selector);
        const currentIndex = Array.from(inputs).indexOf(target);
        
        switch (event.key) {
            case 'ArrowLeft':
                event.preventDefault();
                if (currentIndex > 0) {
                    inputs[currentIndex - 1].focus();
                    inputs[currentIndex - 1].select();
                }
                break;
            case 'ArrowRight':
                event.preventDefault();
                if (currentIndex < inputs.length - 1) {
                    inputs[currentIndex + 1].focus();
                    inputs[currentIndex + 1].select();
                }
                break;
            case 'Backspace':
                // If current input is empty, move to previous input
                if (!target.value && currentIndex > 0) {
                    event.preventDefault();
                    inputs[currentIndex - 1].focus();
                    inputs[currentIndex - 1].select();
                }
                break;
        }
    }
}

// Main analysis function
function analyzeWords() {
    if (WORD_LIST.length === 0) return;
    
    filterWords();
    calculateLetterFrequency();
    calculateOptimalGuesses();
    updateDisplay();
    scheduleUrlUpdate();
}

function logOptimalGuessTiming(startedAt, candidateCount, remainingCount, usedWorker) {
    const elapsed = performance.now() - startedAt;
    const thread = usedWorker ? 'worker' : 'main thread';
    console.log(
        `Optimal guess calculation took ${elapsed.toFixed(2)} ms ` +
        `(${thread}, ${candidateCount} candidates, ${remainingCount} remaining words)`
    );
}

// Backward-compatible helper: expected percentage of remaining answers eliminated.
function calculateExpectedEliminationScore(guess) {
    return calculateGuessMetrics(guess).eliminationPercent;
}

// Debounced analysis for high-frequency input (typing/cycling in the grid)
// Keep this high enough that normal typing does not repeatedly queue worker work.
const debouncedAnalyze = debounce(analyzeWords, ANALYZE_DEBOUNCE_MS);

// Reset function
function resetInputs() {
    const $inputs = [...document.querySelectorAll('input[type="text"]')];
    $inputs.forEach((input) => input.value = '');
    // Clear grid cell states
    document.querySelectorAll('.wordle-grid .grid-cell').forEach((cell) => {
        cell.value = '';
        cell.classList.remove('cell-gray', 'cell-yellow', 'cell-green');
        cell.classList.remove('has-letter');
        cell.removeAttribute('data-state');
    });
    
    gameState = {
        greenLetters: ['', '', '', '', ''],
        yellowLetters: ['', '', '', '', ''],
        excludedLetters: '',
        remainingWords: [...WORD_LIST],
        optimalGuesses: [],
        letterFrequency: {},
        positionFrequency: [{}, {}, {}, {}, {}],
        positionTotals: [0, 0, 0, 0, 0],
        hintsBlurred: gameState.hintsBlurred // Preserve the blur setting
    };

    analyzeWords();
}

// Update all display elements
function updateDisplay() {
    updateStats();
    updateGuessRemainingCounts();
    updateOptimalGuesses();
    updateLetterFrequency();
    updateHeatmap();
    debouncedUpdateRemainingWords();
}

// Update statistics
function updateStats() {
    document.getElementById('totalWords').textContent = WORD_LIST.length.toLocaleString();
    document.getElementById('remainingWords').textContent = gameState.remainingWords.length.toLocaleString();
    
    const eliminated = WORD_LIST.length - gameState.remainingWords.length;
    const eliminatedPercent = WORD_LIST.length > 0 ? ((eliminated / WORD_LIST.length) * 100).toFixed(1) : 0;
    document.getElementById('eliminatedPercent').textContent = eliminatedPercent + '%';
}

// Update optimal guesses list
function updateOptimalGuesses() {
    const container = document.getElementById('optimalGuesses');
    
    if (gameState.optimalGuesses.length === 0) {
        container.innerHTML = '<div class="loading"><i class="fas fa-info-circle"></i> Enter constraints to see optimal guesses</div>';
        return;
    }

    container.innerHTML = gameState.optimalGuesses.map(item => 
        `<div class="word-item" onclick="selectGuess('${item.word}')">
            <span class="word-label">${item.word.toUpperCase()}</span>
            <span class="word-score" title="Composite ${item.score.toFixed(2)}">
                <span>${item.eliminationPercent.toFixed(1)}% elim</span>
                <span>${item.entropyBits.toFixed(2)} bits</span>
                <span>worst ${item.worstCaseRemaining}</span>
                <i class="fas fa-${item.type === 'answer' ? 'star' : 'search'}" 
                   title="${item.type === 'answer' ? 'Possible answer' : 'Strategic guess'}"></i>
            </span>
        </div>`
    ).join('');
}

// Update letter frequency chart
function updateLetterFrequency() {
    const container = document.getElementById('frequencyChart');
    
    if (Object.keys(gameState.letterFrequency).length === 0) {
        container.innerHTML = '<div style="text-align: center; color: #666;">No data available</div>';
        return;
    }

    const sortedLetters = Object.entries(gameState.letterFrequency)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 15); // Show top 15 letters

    const maxCount = Math.max(...sortedLetters.map(([,count]) => count));

    container.innerHTML = sortedLetters.map(([letter, count]) => {
        const height = (count / maxCount) * 100;
        return `<div class="frequency-bar" style="height: ${height}%">
            <div class="frequency-label">${letter}</div>
            <div class="frequency-value">${count}</div>
        </div>`;
    }).join('');
}

// Update letter position heatmap
function updateHeatmap() {
    const container = document.getElementById('letterHeatmap');
    
    container.classList.remove('loading-state');

    const heatmapData = [];
    for (let pos = 0; pos < 5; pos++) {
        const posFreq = gameState.positionFrequency[pos];
        const topLetters = Object.entries(posFreq)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 3); // Get top 3 letters
        
        if (topLetters.length > 0) {
            const letterLines = topLetters.map(([letter, count]) => 
                `<div class="heatmap-letter-line">${letter.toUpperCase()} (${count})</div>`
            ).join('');
            
            heatmapData.push(`
                <div class="heatmap-cell">
                    ${letterLines}
                </div>
            `);
        } else {
            heatmapData.push(`
                <div class="heatmap-cell" style="background-color: #e3e3e1; color: #999;">
                    <div class="heatmap-letter-line">- (0)</div>
                </div>
            `);
        }
    }

    container.innerHTML = heatmapData.join('');
}

// Update remaining words list
function updateRemainingWords() {
    const container = document.getElementById('remainingWordsList');
    
    if (gameState.remainingWords.length === 0) {
        container.innerHTML = '<div class="loading"><i class="fas fa-exclamation-triangle"></i> No words match the constraints</div>';
        return;
    }

    // Display all remaining words
    container.innerHTML = gameState.remainingWords.map(word => 
        `<div class="word-item" onclick="selectGuess('${word}')">
            <span style="font-weight: bold;">${word.toUpperCase()}</span>
        </div>`
    ).join('');
}

const debouncedUpdateRemainingWords = debounce(updateRemainingWords, 150);

// URL state management
function updateUrl() {
    // Build ?guess=WORD&guess=WORD ... using only full 5-letter rows
    const guesses = [];
    for (let row = 0; row < GRID_ROWS; row++) {
        let word = '';
        for (let col = 0; col < GRID_COLS; col++) {
            const cell = getGridCell(row, col);
            const ch = (cell && cell.value) ? cell.value.toUpperCase() : '';
            word += ch;
        }
        if (word.length === 5 && /^[A-Z]{5}$/.test(word)) {
            guesses.push(word);
        }
    }

    const url = new URL(location.href);
    url.search = '';
    // For each full guess row, also include greens/yellows masks
    guesses.forEach((g, row) => {
        url.searchParams.append('guess', g);
        let maskG = '';
        let maskY = '';
        for (let col = 0; col < GRID_COLS; col++) {
            const cell = getGridCell(row, col);
            const state = cell ? (cell.getAttribute('data-state') || 'gray') : 'gray';
            maskG += state === 'green' ? '1' : '0';
            maskY += state === 'yellow' ? '1' : '0';
        }
        url.searchParams.append('greens', maskG);
        url.searchParams.append('yellows', maskY);
    });
    if (!__restoringUrl) {
        history.pushState(guesses, '', url);
    } else {
        history.replaceState(guesses, '', url);
    }
}

const debouncedUpdateUrl = debounce(updateUrl, 200);

function scheduleUrlUpdate() {
    if (__restoringUrl) {
        updateUrl();
        return;
    }
    debouncedUpdateUrl();
}

function restoreValuesFromUrl() {
    const params = new URL(location.href).searchParams;
    const guesses = params.getAll('guess');
    const greensList = params.getAll('greens');
    const yellowsList = params.getAll('yellows');

    // Clear grid first
    document.querySelectorAll('.wordle-grid .grid-cell').forEach((cell) => {
        cell.value = '';
        cell.classList.remove('has-letter', 'cell-gray', 'cell-yellow', 'cell-green');
        cell.removeAttribute('data-state');
    });

    // Apply guesses row-by-row with optional greens/yellows masks
    __restoringUrl = true;
    guesses.slice(0, GRID_ROWS).forEach((g, row) => {
        const word = (g || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 5);
        const gMask = (greensList[row] || '').replace(/[^01]/g, '').padEnd(5, '0').slice(0, 5);
        const yMask = (yellowsList[row] || '').replace(/[^01]/g, '').padEnd(5, '0').slice(0, 5);
        for (let col = 0; col < Math.min(word.length, GRID_COLS); col++) {
            const cell = getGridCell(row, col);
            if (!cell) continue;
            cell.value = word[col];
            cell.classList.add('has-letter');
            // Set state per masks; default to gray
            cell.classList.remove('cell-gray', 'cell-yellow', 'cell-green');
            cell.removeAttribute('data-state');
            if (gMask[col] === '1') {
                setCellState(cell, 'green');
            } else if (yMask[col] === '1') {
                setCellState(cell, 'yellow');
            } else if (cell.value) {
                setCellState(cell, 'gray');
            }
        }
    });

    // After restoring guesses, sync to inputs and analyze
    syncGridToInputs();
    __restoringUrl = false;
}

function getInputValues() {
    const $inputs = [...document.querySelectorAll('input[type="text"]:not(.grid-cell)')];
    const values = $inputs.map(($el) => $el.value);
    
    return values;
}

function restoreInputValues(values) {
    if (values && values.length > 0) {
        const $inputs = [...document.querySelectorAll('input[type="text"]:not(.grid-cell)')];
        values.forEach((value, idx) => $inputs[idx].value = value);
    }
}

// Navigation and input handling
function tabAdvance(amount = 1) {
    const $inputs = [...document.querySelectorAll('input[type="text"]')];
    const $focused = document.querySelector(':focus');
    const position = $inputs.indexOf($focused);
    
    const desiredPosition = position + amount;
    let $target;
    
    if (desiredPosition === $inputs.length) {
        $target = $inputs[0];  
    } else if (desiredPosition < 0) {
        const lastIndex = $inputs.length - 1;
        $target = $inputs[lastIndex];
    } else {
        $target = $inputs[desiredPosition];
    }

    $target.focus();
    
    if ($target.classList.contains('exactly')) {
        $target.selectionStart = 0;
        $target.selectionEnd = $target.value.length;
    } else {
        $target.selectionStart = $target.selectionEnd = $target.value.length;      
    }
}

function registerTabHandling() {
    [...document.querySelectorAll("input:not(.grid-cell)")].forEach((input) => {
        input.onkeydown = (e) => {
            if (e.key === "Enter" || e.key === "Tab") {
                e.preventDefault();
        
                if (e.shiftKey) {
                    tabAdvance(-1);
                } else {
                    tabAdvance(1);
                }
                
                // Keep URL derived from grid only
                scheduleUrlUpdate();
            }
        };
    });
}

// Global keyboard shortcuts
function handleGlobalShortcuts(event) {
    // Handle Alt+Ctrl combinations globally (work from anywhere)
    if (event.altKey && event.ctrlKey) {
        switch (event.key) {
            case 'g':
                event.preventDefault();
                const greenInput = document.querySelector('.exactly');
                if (greenInput) {
                    greenInput.focus();
                    greenInput.select();
                }
                return;
            case 'y':
                event.preventDefault();
                const yellowInput = document.querySelector('.exactly-not');
                if (yellowInput) {
                    yellowInput.focus();
                    yellowInput.select();
                }
                return;
            case 'e':
                event.preventDefault();
                const excludedInput = document.querySelector('.not');
                if (excludedInput) {
                    excludedInput.focus();
                    excludedInput.select();
                }
                return;
        }
    }
    
    // Handle Ctrl combinations
    if (event.ctrlKey && !event.altKey) {
        switch (event.key) {
            case 'h':
                event.preventDefault();
                toggleWordHints();
                return;
            case 'r':
                event.preventDefault();
                resetInputs();
                return;
        }
    } 
    
    // Handle other shortcuts
    // Allow help to open even when an input has focus.
    if (!event.ctrlKey && !event.altKey && !event.metaKey) {
        switch (event.key) {
            case '?':
                event.preventDefault();
                showShortcuts();
                return;
        }
    }
}

// Check if any input is currently focused
function isInputFocused() {
    const activeElement = document.activeElement;
    return activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA');
}

// Handle word selection (for future guess input)
function selectGuess(word) {
    console.log(`Selected word: ${word}`);
}

// Show/hide shortcuts modal
function showShortcuts() {
    document.getElementById('shortcutsModal').style.display = 'flex';
}

function hideShortcuts() {
    document.getElementById('shortcutsModal').style.display = 'none';
}

// Setup all event listeners
function setupEventListeners() {
    // Input change listeners - check if elements exist first
    const textInputs = document.querySelectorAll('input[type="text"]:not(.grid-cell)');
    if (textInputs.length > 0) {
        textInputs.forEach((input) => input.oninput = debouncedAnalyze);
    }

    // Single keydown handler for all inputs (navigation within sections)
    document.addEventListener('keydown', handleInputKeyDown);

    // Global keyboard shortcuts
    document.addEventListener('keydown', handleGlobalShortcuts);

    // Reset button - check if it exists
    const resetButton = document.querySelector('.reset');
    if (resetButton) {
        resetButton.onclick = resetInputs;
    }

    // Browser navigation
    window.onpopstate = (e) => {
        // Restore the grid from the URL parameters (guess/greens/yellows)
        restoreValuesFromUrl();
    };

    // Modal close - check if modal exists
    const shortcutsModal = document.getElementById('shortcutsModal');
    if (shortcutsModal) {
        shortcutsModal.addEventListener('click', (e) => {
            if (e.target === e.currentTarget) {
                hideShortcuts();
            }
        });
    }

    // Tab handling
    registerTabHandling();

    // Initialize Wordle grid interactions
    initializeGrid();
}

function focusFirstGridCellIfEmpty() {
    const cells = getGridCells();
    if (!cells.length) return;
    const hasAnyValue = cells.some((cell) => (cell.value || '').trim().length > 0);
    if (!hasAnyValue) {
        const first = document.querySelector('.grid-cell[data-row="0"][data-col="0"]');
        if (first) first.focus();
    }
}

// Initialize Web Worker when app starts
async function initializeApp() {
    // Check if we're in a test environment - don't initialize if so
    if (window.location.pathname.includes('/test/') || 
        document.title.includes('Test') ||
        typeof initTestEnvironment === 'function') {
        console.log('Test environment detected, skipping main app initialization');
        return;
    }

    setupEventListeners();
    updateWordHintsDisplay();
    
    // Initialize Web Worker for better performance
    if (typeof Worker !== 'undefined') {
        initializeWebWorker();
    } else {
        showError('Optimal guess worker is not available in this browser.');
    }
    
    await loadWordList();
    restoreValuesFromUrl();
    focusFirstGridCellIfEmpty();
    analyzeWords();
}

// Start the app when page loads - but only if not in test environment
document.addEventListener('DOMContentLoaded', () => {
    // Additional check to prevent initialization in test environment
    if (window.location.pathname.includes('/test/') || 
        document.title.includes('Test Suite')) {
        console.log('Skipping main app initialization in test environment');
        return;
    }
    
    initializeApp();
});
