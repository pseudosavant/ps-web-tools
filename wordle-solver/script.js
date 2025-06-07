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
    hintsBlurred: true
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

// Load word list from CSV
async function loadWordList() {
    try {
        showLoading(true);
        const response = await fetch("./valid-words.csv");
        const text = await response.text();
        WORD_LIST = text.split('\n')
            .filter(word => word.length === 5)
            .map(word => word.toLowerCase().trim())
            .filter(word => word.length === 5); // Double check after trim
        
        gameState.remainingWords = [...WORD_LIST];
        showLoading(false);
        updateStats();
        updateDisplay();
        console.log(`Loaded ${WORD_LIST.length} words`);
    } catch (error) {
        showLoading(false);
        showError('Failed to load word list. Please ensure valid-words.csv is in the same directory.');
        console.error('Error loading word list:', error);
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
    const chars = [...document.querySelectorAll('.exactly')]
        .map((el) => el.value ? el.value : '.')
        .join('');
    return chars;
}

function getExactlyNot() {
    const chars = [...document.querySelectorAll('.exactly-not')]
        .map((el) => el.value ? `[^${el.value}]{1}` : '.')
        .join('');
    return chars;
}

function createHasValue() {
    const chars = [...document.querySelectorAll('.exactly, .exactly-not')]
        .map((el) => el.value)
        .join('')
        .toLowerCase();

    return uniqueChars(chars);
}

function uniqueChars(allChars) {
    const chars = {};
    [...allChars].forEach((char) => chars[char] = true);
    return Object.keys(chars).join('');
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

    const exactlyValue = getExactly().toLowerCase();
    const exactlyNotValue = getExactlyNot().toLowerCase();
    const notValue = document.querySelector('.not').value.toLowerCase();
    const hasValue = createHasValue();
    
    const exact = (s) => re(exactlyValue).test(s);
    const exactNot = (s) => re(exactlyNotValue).test(s);
    const not = (s) => re(`[^${notValue}]{5}`).test(s);
    const has = (s) => {
        const arr = [...hasValue];
        const mapped = arr.map((letter) => re(letter).test(s));
        const filtered = mapped.filter(isTrue);
        const containsAllLetters = filtered.length === hasValue.length;
        return containsAllLetters;
    }

    gameState.remainingWords = WORD_LIST
        .filter(not)
        .filter(exactNot)
        .filter(exact)
        .filter(has);
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
}

// Calculate optimal guesses using information theory
function calculateOptimalGuesses() {
    if (gameState.remainingWords.length === 0) {
        gameState.optimalGuesses = [];
        return;
    }

    if (gameState.remainingWords.length <= 2) {
        gameState.optimalGuesses = gameState.remainingWords.map(word => ({
            word,
            score: 1.0,
            type: 'answer'
        }));
        return;
    }

    // Get top words with highest frequency letters (like original code)
    const chars = characterDistribution(gameState.remainingWords);
    const maxChars = Math.max.apply(null, chars.map((c) => c[1]));
    const topChars = chars.filter((char, i) => i < 8).reduce((acc, cv) => acc + cv[0], '');
    const onlyTopChars = (s) => re(`[${topChars}]{5}`).test(s);
    const topCharWords = gameState.remainingWords.filter(onlyTopChars);

    // Combine with information theory for remaining words
    const candidates = [...new Set([...topCharWords, ...gameState.remainingWords, ...WORD_LIST])];
    const scored = candidates.slice(0, 100).map(word => ({ // Limit for performance
        word,
        score: calculateExpectedInformation(word),
        type: gameState.remainingWords.includes(word) ? 'answer' : 'guess'
    }));

    scored.sort((a, b) => b.score - a.score);
    gameState.optimalGuesses = scored.slice(0, 10);
}

// Calculate expected information gain for a guess
function calculateExpectedInformation(guess) {
    if (gameState.remainingWords.length <= 1) return 0;

    const outcomes = new Map();
    
    // For each possible answer, determine the feedback pattern
    gameState.remainingWords.forEach(answer => {
        const pattern = getResponsePattern(guess, answer);
        const key = pattern.join('');
        
        if (!outcomes.has(key)) {
            outcomes.set(key, []);
        }
        outcomes.get(key).push(answer);
    });

    // Calculate expected information (entropy reduction)
    let expectedInfo = 0;
    const totalWords = gameState.remainingWords.length;
    
    outcomes.forEach(group => {
        const probability = group.length / totalWords;
        const information = -Math.log2(probability);
        expectedInfo += probability * information;
    });

    return expectedInfo;
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
    [...document.querySelectorAll("input")].forEach((input) => {
        input.onkeydown = (e) => {
            if (e.key === "Enter" || e.key === "Tab") {
                e.preventDefault();
        
                if (e.shiftKey) {
                    tabAdvance(-1);
                } else {
                    tabAdvance(1);
                }
                
                updateUrl();
                restoreValuesFromUrl();
            }
        };
    });
}

// URL state management
function updateUrl() {
    const values = getInputValues();
    const query = values.map((value, idx) => `${idx}=${encodeURIComponent(value)}`).join('&');
    const url = new URL(location);
    url.search = query;
    
    history.pushState(values, null, url);
}

function restoreValuesFromUrl() {
    const params = new URL(location).searchParams;
    const entries = [...params.entries()];
    const $inputs = [...document.querySelectorAll('input[type="text"]')];
    
    const arr = []
    entries.forEach((entry) => {
        const key = entry[0];
        const value = decodeURIComponent(entry[1]);
        arr[key] = value;
    });
    
    restoreInputValues(arr);
}

function getInputValues() {
    const $inputs = [...document.querySelectorAll('input[type="text"]')];
    const values = $inputs.map(($el) => $el.value);
    
    return values;
}

function restoreInputValues(values) {
    if (values && values.length > 0) {
        const $inputs = [...document.querySelectorAll('input[type="text"]')];
        values.forEach((value, idx) => $inputs[idx].value = value);
    }
}

// Main analysis function
function analyzeWords() {
    if (WORD_LIST.length === 0) return;
    
    filterWords();
    calculateLetterFrequency();
    calculateOptimalGuesses();
    updateDisplay();
    updateUrl();
}

const debouncedAnalyze = debounce(analyzeWords, 100);

// Reset function
function resetInputs() {
    const $inputs = [...document.querySelectorAll('input[type="text"]')];
    $inputs.forEach((input) => input.value = '');
    
    gameState = {
        greenLetters: ['', '', '', '', ''],
        yellowLetters: ['', '', '', '', ''],
        excludedLetters: '',
        remainingWords: [...WORD_LIST],
        optimalGuesses: [],
        letterFrequency: {},
        positionFrequency: [{}, {}, {}, {}, {}],
        hintsBlurred: gameState.hintsBlurred // Preserve the blur setting
    };

    analyzeWords();
}

// Update all display elements
function updateDisplay() {
    updateStats();
    updateOptimalGuesses();
    updateLetterFrequency();
    updateHeatmap();
    updateRemainingWords();
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
            <span style="font-weight: bold;">${item.word.toUpperCase()}</span>
            <span class="word-score">
                ${item.score.toFixed(2)} 
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

// Get color for heatmap based on intensity (no longer used)
function getHeatmapColor(intensity) {
    const red = Math.round(255 * intensity);
    const green = Math.round(255 * (1 - intensity * 0.7));
    const blue = Math.round(255 * (1 - intensity));
    return `rgb(${red}, ${green}, ${blue})`;
}

// Update remaining words list
function updateRemainingWords() {
    const container = document.getElementById('remainingWordsList');
    
    if (gameState.remainingWords.length === 0) {
        container.innerHTML = '<div class="loading"><i class="fas fa-exclamation-triangle"></i> No words match the constraints</div>';
        return;
    }

    const wordsToShow = gameState.remainingWords.slice(0, 50); // Limit display for performance
    
    container.innerHTML = wordsToShow.map(word => 
        `<div class="word-item" onclick="selectGuess('${word}')">
            <span style="font-weight: bold;">${word.toUpperCase()}</span>
        </div>`
    ).join('') + 
    (gameState.remainingWords.length > 50 ? 
        `<div style="text-align: center; padding: 10px; color: #666; font-style: italic;">
            ... and ${gameState.remainingWords.length - 50} more words
        </div>` : '');
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
    if (!isInputFocused()) {
        switch (event.key) {
            case '?':
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
    // Input change listeners
    [...document.querySelectorAll('input[type="text"]')].forEach(
        (input) => input.oninput = debouncedAnalyze
    );

    // Single keydown handler for all inputs (navigation within sections)
    document.addEventListener('keydown', handleInputKeyDown);

    // Global keyboard shortcuts
    document.addEventListener('keydown', handleGlobalShortcuts);

    // Reset button
    document.querySelector('.reset').onclick = resetInputs;

    // Browser navigation
    window.onpopstate = (e) => {
        const values = e.state;
        restoreInputValues(values);
        analyzeWords();
    };

    // Modal close
    document.getElementById('shortcutsModal').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) {
            hideShortcuts();
        }
    });

    // Tab handling
    registerTabHandling();
}

// Initialize the application
async function initializeApp() {
    setupEventListeners();
    updateWordHintsDisplay(); // Set initial hints state
    await loadWordList();
    restoreValuesFromUrl();
    analyzeWords();
}

// Start the app when page loads
document.addEventListener('DOMContentLoaded', initializeApp);