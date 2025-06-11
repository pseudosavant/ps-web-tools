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

// Load word list from CSV
async function loadWordList() {
    try {
        showLoading(true);
        console.log('Attempting to load word list from ./valid-words.csv');
        
        const response = await fetch("./valid-words.csv");
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const text = await response.text();
        console.log(`Raw CSV text length: ${text.length}`);
        console.log(`First 200 characters: ${text.substring(0, 200)}`);
        
        // More robust parsing - handle different line endings and formats
        const words = text.split(/[\r\n]+/)
            .map(word => word.toLowerCase().trim())
            .filter(word => word.length === 5 && /^[a-z]+$/.test(word)); // Only alphabetic 5-letter words
        
        console.log(`Parsed ${words.length} valid words`);
        console.log(`First 10 words: ${words.slice(0, 10).join(', ')}`);
        
        if (words.length === 0) {
            throw new Error('No valid 5-letter words found in CSV file. Please check the file format.');
        }
        
        WORD_LIST = words;
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
            errorMessage += 'The file "valid-words.csv" was not found in the same directory as this HTML file.';
        } else if (error.message.includes('No valid')) {
            errorMessage += 'The CSV file was found but contains no valid 5-letter words. Please check the file format.';
        } else {
            errorMessage += `Error: ${error.message}`;
        }
        
        showError(errorMessage);
        
        // Try to provide a fallback or helpful suggestion
        console.log('Suggestion: Make sure "valid-words.csv" exists in the same folder as index.html');
        console.log('The CSV should contain one word per line, like:');
        console.log('arose\\nabout\\nadieu\\naudio\\n...');
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
        const totalWordsInPosition = Object.values(gameState.positionFrequency[i])
            .reduce((sum, count) => sum + count, 0);
        
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

// Adaptive weights based on game state
function getAdaptiveWeights(remainingWordsCount) {
    if (remainingWordsCount > 50) {
        // Early game: prioritize information gain
        return { information: 0.7, speed: 0.1, risk: 0.1, frequency: 0.1 };
    } else if (remainingWordsCount > 10) {
        // Mid game: balance information and speed
        return { information: 0.5, speed: 0.3, risk: 0.1, frequency: 0.1 };
    } else {
        // End game: prioritize solution speed and reduce risk
        return { information: 0.3, speed: 0.5, risk: 0.2, frequency: 0.0 };
    }
}

// Web Worker for heavy calculations
let calculationWorker = null;

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

        function calculateLetterFrequencyScore(word) {
            const uniqueLetters = new Set(word);
            let score = 0;
            uniqueLetters.forEach(letter => {
                score += ENGLISH_LETTER_FREQ[letter] || 0.01;
            });
            return score;
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

        function calculateExpectedInformation(guess, remainingWords) {
            if (remainingWords.length <= 1) return 0;
            
            const outcomes = new Map();
            
            remainingWords.forEach(answer => {
                const pattern = getResponsePattern(guess, answer);
                const key = pattern.join('');
                outcomes.set(key, (outcomes.get(key) || 0) + 1);
            });

            let expectedInfo = 0;
            const totalWords = remainingWords.length;
            
            outcomes.forEach(count => {
                const probability = count / totalWords;
                if (probability > 0) {
                    const information = -Math.log2(probability);
                    expectedInfo += probability * information;
                }
            });

            return expectedInfo;
        }

        self.onmessage = function(e) {
            const { type, data } = e.data;
            
            if (type === 'calculateOptimalGuesses') {
                const { candidatePool, remainingWords } = data;
                
                const scored = candidatePool.map(word => ({
                    word,
                    score: calculateLetterFrequencyScore(word) + 
                           (remainingWords.length <= 100 ? calculateExpectedInformation(word, remainingWords) * 0.1 : 0),
                    type: remainingWords.includes(word) ? 'answer' : 'strategic'
                }));

                scored.sort((a, b) => b.score - a.score);
                
                self.postMessage({
                    type: 'optimalGuessesResult',
                    data: scored.slice(0, 10)
                });
            }
        };
    `;

    const blob = new Blob([workerCode], { type: 'application/javascript' });
    calculationWorker = new Worker(URL.createObjectURL(blob));
    
    calculationWorker.onmessage = function(e) {
        const { type, data } = e.data;
        
        if (type === 'optimalGuessesResult') {
            gameState.optimalGuesses = data;
            updateOptimalGuesses();
            showLoading(false);
        }
    };
    
    calculationWorker.onerror = function(error) {
        console.error('Worker error:', error);
        showLoading(false);
        // Fallback to main thread calculation
        calculateOptimalGuessesSync();
    };
}

// Enhanced optimal guess calculation with Web Worker support
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

    // Show loading for heavy calculations
    if (gameState.remainingWords.length > 100) {
        showLoading(true);
    }

    // Performance optimization: heavily limit for large sets
    let candidatePool = [...gameState.remainingWords];
    
    // For very large sets, only consider a subset to prevent hanging
    if (gameState.remainingWords.length > 500) {
        const quickScored = gameState.remainingWords.map(word => ({
            word,
            quickScore: calculateLetterFrequencyScore(word)
        })).sort((a, b) => b.quickScore - a.quickScore);
        
        candidatePool = quickScored.slice(0, 50).map(item => item.word);
    } else if (gameState.remainingWords.length > 200) {
        const quickScored = gameState.remainingWords.map(word => ({
            word,
            quickScore: calculateLetterFrequencyScore(word) + calculatePositionScore(word)
        })).sort((a, b) => b.quickScore - a.quickScore);
        
        candidatePool = quickScored.slice(0, 100).map(item => item.word);
    }
    
    // Always limit total candidates to prevent performance issues
    if (candidatePool.length > 100) {
        candidatePool = candidatePool.slice(0, 100);
    }

    // Use Web Worker for heavy calculations
    if (calculationWorker && gameState.remainingWords.length > 50) {
        calculationWorker.postMessage({
            type: 'calculateOptimalGuesses',
            data: {
                candidatePool,
                remainingWords: gameState.remainingWords
            }
        });
        return;
    }

    // Fallback to synchronous calculation for small sets
    calculateOptimalGuessesSync(candidatePool);
}

// Synchronous calculation fallback
function calculateOptimalGuessesSync(candidatePool = null) {
    if (!candidatePool) {
        candidatePool = gameState.remainingWords.slice(0, 50);
    }

    const scored = candidatePool.map(word => ({
        word,
        score: calculateSimplifiedScore(word),
        type: gameState.remainingWords.includes(word) ? 'answer' : 'strategic'
    }));

    scored.sort((a, b) => {
        const scoreDiff = b.score - a.score;
        if (Math.abs(scoreDiff) < 0.05) {
            return a.type === 'answer' ? -1 : 1;
        }
        return scoreDiff;
    });

    gameState.optimalGuesses = scored.slice(0, 10);
    showLoading(false);
}

// Initialize Web Worker when app starts
async function initializeApp() {
    setupEventListeners();
    updateWordHintsDisplay();
    
    // Initialize Web Worker for better performance
    if (typeof Worker !== 'undefined') {
        initializeWebWorker();
    }
    
    await loadWordList();
    restoreValuesFromUrl();
    analyzeWords();
}

// Start the app when page loads
document.addEventListener('DOMContentLoaded', initializeApp);

// Simplified scoring for better performance
function calculateSimplifiedScore(word) {
    const remainingCount = gameState.remainingWords.length;
    
    // For large sets, use simple frequency-based scoring to avoid hanging
    if (remainingCount > 200) {
        return calculateLetterFrequencyScore(word) + calculatePositionScore(word);
    }
    
    // For medium sets, use lightweight scoring
    if (remainingCount > 50) {
        const letterScore = calculateLetterFrequencyScore(word);
        const positionScore = calculatePositionScore(word);
        const commonBonus = COMMON_WORDS.has(word) ? 0.1 : 0;
        return letterScore + positionScore + commonBonus;
    }
    
    // Only use full advanced scoring for small sets
    return calculateAdvancedScore(word);
}

// Multi-objective scoring function
function calculateAdvancedScore(word) {
    const weights = getAdaptiveWeights(gameState.remainingWords.length);
    
    const metrics = {
        information: calculateExpectedInformation(word),
        speed: calculateExpectedSolutionSteps(word),
        risk: calculateWorstCaseScenario(word),
        frequency: calculateLetterFrequencyScore(word)
    };
    
    // Normalize information score (it can be quite high)
    metrics.information = Math.min(metrics.information / 5, 1);
    
    // Calculate weighted combination
    let score = 0;
    Object.entries(metrics).forEach(([key, value]) => {
        score += value * weights[key];
    });
    
    // Add common word bonus
    if (COMMON_WORDS.has(word)) {
        score += 0.05;
    }
    
    return score;
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

// Simplified solution steps calculation
function calculateExpectedSolutionSteps(guess) {
    // Skip expensive variance calculation for large sets
    if (gameState.remainingWords.length > 100) {
        return 0.5; // Default neutral score
    }
    
    const outcomes = new Map();
    
    gameState.remainingWords.forEach(answer => {
        const pattern = getResponsePatternOptimized(guess, answer);
        const key = pattern.join('');
        outcomes.set(key, (outcomes.get(key) || 0) + 1);
    });
    
    const sizes = Array.from(outcomes.values());
    const maxSize = Math.max(...sizes);
    const totalWords = gameState.remainingWords.length;
    
    // Simple heuristic: prefer guesses that don't leave large groups
    return 1 - (maxSize / totalWords);
}

// Simplified risk calculation
function calculateWorstCaseScenario(guess) {
    // Skip for large sets to improve performance
    if (gameState.remainingWords.length > 100) {
        return 0.5; // Default neutral score
    }
    
    return calculateExpectedSolutionSteps(guess); // Reuse the simpler calculation
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