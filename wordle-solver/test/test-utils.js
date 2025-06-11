// Simple testing framework
class TestSuite {
    constructor(name) {
        this.name = name;
        this.tests = [];
        this.passed = 0;
        this.failed = 0;
    }

    test(description, testFn) {
        this.tests.push({ description, testFn });
    }

    async run() {
        console.log(`\n=== Running ${this.name} ===`);
        const results = [];
        
        for (const test of this.tests) {
            try {
                await test.testFn();
                this.passed++;
                results.push({ 
                    description: test.description, 
                    status: 'pass' 
                });
                console.log(`✅ ${test.description}`);
            } catch (error) {
                this.failed++;
                results.push({ 
                    description: test.description, 
                    status: 'fail', 
                    error: error.message 
                });
                console.error(`❌ ${test.description}: ${error.message}`);
            }
        }
        
        return results;
    }
}

// Assertion utilities
const assert = {
    equals(actual, expected, message = '') {
        if (actual !== expected) {
            throw new Error(`${message}\nExpected: ${expected}\nActual: ${actual}`);
        }
    },

    deepEquals(actual, expected, message = '') {
        if (JSON.stringify(actual) !== JSON.stringify(expected)) {
            throw new Error(`${message}\nExpected: ${JSON.stringify(expected)}\nActual: ${JSON.stringify(actual)}`);
        }
    },

    true(value, message = '') {
        if (value !== true) {
            throw new Error(`${message}\nExpected: true\nActual: ${value}`);
        }
    },

    false(value, message = '') {
        if (value !== false) {
            throw new Error(`${message}\nExpected: false\nActual: ${value}`);
        }
    },

    includes(array, item, message = '') {
        if (!Array.isArray(array) || !array.includes(item)) {
            throw new Error(`${message}\nExpected array to include: ${item}\nArray: ${JSON.stringify(array)}`);
        }
    },

    notIncludes(array, item, message = '') {
        if (!Array.isArray(array) || array.includes(item)) {
            throw new Error(`${message}\nExpected array not to include: ${item}\nArray: ${JSON.stringify(array)}`);
        }
    },

    greaterThan(actual, expected, message = '') {
        if (actual <= expected) {
            throw new Error(`${message}\nExpected ${actual} to be greater than ${expected}`);
        }
    },

    lessThan(actual, expected, message = '') {
        if (actual >= expected) {
            throw new Error(`${message}\nExpected ${actual} to be less than ${expected}`);
        }
    }
};

// Test data utilities
const testData = {
    sampleWords: ['about', 'acute', 'adieu', 'alone', 'argue', 'audio', 'house', 'mouse', 'table', 'water'],
    
    setupDOM() {
        // Create comprehensive DOM structure for testing
        if (!document.getElementById('testContainer')) {
            const testContainer = document.createElement('div');
            testContainer.id = 'testContainer';
            testContainer.innerHTML = `
                <div id="greenInputs">
                    <input class="exactly letter-input" value="">
                    <input class="exactly letter-input" value="">
                    <input class="exactly letter-input" value="">
                    <input class="exactly letter-input" value="">
                    <input class="exactly letter-input" value="">
                </div>
                <div id="yellowInputs">
                    <input class="exactly-not letter-input" value="">
                    <input class="exactly-not letter-input" value="">
                    <input class="exactly-not letter-input" value="">
                    <input class="exactly-not letter-input" value="">
                    <input class="exactly-not letter-input" value="">
                </div>
                <input class="not" value="">
                <div id="loadingIndicator"></div>
                <div id="optimalGuesses"></div>
                <div id="frequencyChart"></div>
                <div id="letterHeatmap"></div>
                <div id="remainingWordsList"></div>
                <div id="totalWords">0</div>
                <div id="remainingWords">0</div>
                <div id="eliminatedPercent">0%</div>
                <div id="shortcutsModal" style="display: none;"></div>
            `;
            document.body.appendChild(testContainer);
        }
    },

    setInputs(green = [], yellow = [], excluded = '') {
        this.setupDOM();
        
        const greenInputs = document.querySelectorAll('.exactly');
        const yellowInputs = document.querySelectorAll('.exactly-not');
        const excludedInput = document.querySelector('.not');
        
        greenInputs.forEach((input, i) => input.value = green[i] || '');
        yellowInputs.forEach((input, i) => input.value = yellow[i] || '');
        if (excludedInput) excludedInput.value = excluded;
    },

    resetInputs() {
        this.setInputs([], [], '');
    },

    cleanup() {
        const testContainer = document.getElementById('testContainer');
        if (testContainer) {
            testContainer.remove();
        }
    }
};

// Mock DOM functions that might not exist in test environment
const mockDOMFunctions = {
    // Mock showLoading function
    showLoading: function(show) {
        const indicator = document.getElementById('loadingIndicator');
        if (indicator) {
            if (show) {
                indicator.classList.add('visible');
            } else {
                indicator.classList.remove('visible');
            }
        }
    },

    // Mock showError function  
    showError: function(message) {
        console.warn('Mock showError:', message);
    },

    // Mock update functions that might fail
    updateStats: function() {
        const totalEl = document.getElementById('totalWords');
        const remainingEl = document.getElementById('remainingWords');
        const eliminatedEl = document.getElementById('eliminatedPercent');
        
        if (totalEl) totalEl.textContent = WORD_LIST ? WORD_LIST.length : 0;
        if (remainingEl) remainingEl.textContent = gameState?.remainingWords?.length || 0;
        if (eliminatedEl) eliminatedEl.textContent = '0%';
    },

    updateOptimalGuesses: function() {
        const container = document.getElementById('optimalGuesses');
        if (container) {
            container.innerHTML = gameState?.optimalGuesses?.length > 0 ? 
                `${gameState.optimalGuesses.length} guesses` : 'No guesses';
        }
    },

    updateLetterFrequency: function() {
        const container = document.getElementById('frequencyChart');
        if (container) {
            container.innerHTML = 'Frequency chart';
        }
    },

    updateHeatmap: function() {
        const container = document.getElementById('letterHeatmap');
        if (container) {
            container.innerHTML = 'Heatmap';
        }
    },

    updateRemainingWords: function() {
        const container = document.getElementById('remainingWordsList');
        if (container) {
            container.innerHTML = gameState?.remainingWords?.length > 0 ? 
                `${gameState.remainingWords.length} words` : 'No words';
        }
    }
};

// Override functions that might not work in test environment
if (typeof window !== 'undefined') {
    // Override problematic functions with mocks
    window.showLoading = mockDOMFunctions.showLoading;
    window.showError = mockDOMFunctions.showError;
    window.updateStats = mockDOMFunctions.updateStats;
    window.updateOptimalGuesses = mockDOMFunctions.updateOptimalGuesses;
    window.updateLetterFrequency = mockDOMFunctions.updateLetterFrequency;
    window.updateHeatmap = mockDOMFunctions.updateHeatmap;
    window.updateRemainingWords = mockDOMFunctions.updateRemainingWords;
    
    // Mock URL functions
    window.updateUrl = function() { /* no-op in tests */ };
    window.restoreValuesFromUrl = function() { /* no-op in tests */ };
    window.getInputValues = function() { return []; };
    window.restoreInputValues = function() { /* no-op in tests */ };
}

// Initialize test environment
function initTestEnvironment() {
    testData.setupDOM();
    
    // Reset global state
    if (typeof WORD_LIST !== 'undefined') {
        WORD_LIST = testData.sampleWords.slice();
    }
    
    if (typeof gameState !== 'undefined') {
        gameState = {
            greenLetters: ['', '', '', '', ''],
            yellowLetters: ['', '', '', '', ''],
            excludedLetters: '',
            remainingWords: [],
            optimalGuesses: [],
            letterFrequency: {},
            positionFrequency: [{}, {}, {}, {}, {}],
            hintsBlurred: true
        };
    }
}

// Suppress console output during tests
const originalConsole = { ...console };
window.suppressConsole = () => {
    console.log = () => {};
    console.error = () => {};
    console.warn = () => {};
};

window.restoreConsole = () => {
    Object.assign(console, originalConsole);
};
