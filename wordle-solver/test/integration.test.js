const integrationSuite = new TestSuite('Integration Tests');

async function waitForOptimalGuesses() {
    for (let i = 0; i < 50; i++) {
        if (gameState.optimalGuesses.length > 0) return;
        await new Promise(resolve => setTimeout(resolve, 10));
    }
}

function setupGridForTest() {
    testData.setupDOM();

    let grid = document.querySelector('.wordle-grid');
    if (!grid) {
        grid = document.createElement('div');
        grid.className = 'wordle-grid';
        document.getElementById('testContainer').appendChild(grid);
    }

    grid.innerHTML = '';
    for (let row = 0; row < GRID_ROWS; row++) {
        for (let col = 0; col < GRID_COLS; col++) {
            const cell = document.createElement('input');
            cell.className = 'grid-cell';
            cell.type = 'text';
            cell.setAttribute('data-row', String(row));
            cell.setAttribute('data-col', String(col));
            grid.appendChild(cell);
        }
    }

    refreshGridCaches();
}

function setGridCellForTest(row, col, value, state) {
    const cell = getGridCell(row, col);
    cell.value = value;
    if (value) cell.classList.add('has-letter');
    if (state) setCellState(cell, state);
    return cell;
}

integrationSuite.test('should calculate optimal guesses from remaining words', async () => {
    // Setup test scenario
    WORD_LIST = ['about', 'house', 'mouse', 'table', 'cable'];
    gameState.remainingWords = ['house', 'mouse'];
    
    if (!calculationWorker) initializeWebWorker();
    calculateOptimalGuesses();
    await waitForOptimalGuesses();
    
    assert.greaterThan(gameState.optimalGuesses.length, 0, 'Should generate optimal guesses');
    assert.true(gameState.optimalGuesses.every(g => g.type === 'answer'), 'All guesses should be valid answers');
    
    // All suggested words should be from remaining words
    const suggestedWords = gameState.optimalGuesses.map(g => g.word);
    suggestedWords.forEach(word => {
        assert.includes(gameState.remainingWords, word, `Suggested word "${word}" should be in remaining words`);
    });
});

integrationSuite.test('should coalesce optimal guess requests while worker is busy', () => {
    const originalWorker = calculationWorker;
    const originalWorkerBusy = calculationWorkerBusy;
    const originalPendingRequest = pendingOptimalGuessRequest;
    const originalRequestId = calculationRequestId;
    const postedMessages = [];

    calculationWorker = {
        postMessage(message) {
            postedMessages.push(message);
        }
    };
    calculationWorkerBusy = false;
    pendingOptimalGuessRequest = null;
    calculationRequestId = 0;

    try {
        gameState.remainingWords = ['about', 'house', 'mouse'];
        calculateOptimalGuesses();
        assert.equals(postedMessages.length, 1, 'First request should be posted immediately');
        assert.true(calculationWorkerBusy, 'Worker should be marked busy after posting');

        gameState.remainingWords = ['house', 'mouse'];
        calculateOptimalGuesses();
        gameState.remainingWords = ['mouse', 'table'];
        calculateOptimalGuesses();

        assert.equals(postedMessages.length, 1, 'Busy worker should not receive stale intermediate requests');
        assert.equals(pendingOptimalGuessRequest.requestId, 3, 'Only the latest request should remain pending');

        calculationWorkerBusy = false;
        flushPendingOptimalGuessRequest();

        assert.equals(postedMessages.length, 2, 'Latest pending request should post after worker becomes available');
        assert.equals(postedMessages[1].data.requestId, 3, 'Posted pending request should be the latest one');
    } finally {
        calculationWorker = originalWorker;
        calculationWorkerBusy = originalWorkerBusy;
        pendingOptimalGuessRequest = originalPendingRequest;
        calculationRequestId = originalRequestId;
    }
});

integrationSuite.test('should apply prior green and yellow feedback to new grid entries', () => {
    initTestEnvironment();
    setupGridForTest();

    setGridCellForTest(0, 1, 'A', 'green');
    setGridCellForTest(0, 3, 'R', 'yellow');

    const knownGreenSamePosition = setGridCellForTest(1, 1, 'A', '');
    setCellStateFromPriorFeedback(knownGreenSamePosition);
    assert.equals(getCellState(knownGreenSamePosition), 'green', 'Known green in the same position should stay green');

    const knownGreenDifferentPosition = setGridCellForTest(1, 2, 'A', '');
    setCellStateFromPriorFeedback(knownGreenDifferentPosition);
    assert.equals(getCellState(knownGreenDifferentPosition), 'yellow', 'Known present letter in a different position should default to yellow');

    const knownYellow = setGridCellForTest(1, 4, 'R', '');
    setCellStateFromPriorFeedback(knownYellow);
    assert.equals(getCellState(knownYellow), 'yellow', 'Previously yellow letters should default to yellow');

    const unknownLetter = setGridCellForTest(1, 0, 'B', '');
    setCellStateFromPriorFeedback(unknownLetter);
    assert.equals(getCellState(unknownLetter), 'gray', 'Unknown letters should still default to gray');
});

integrationSuite.test('should cancel stale remaining word renders', () => {
    initTestEnvironment();

    const originalRequestIdleCallback = window.requestIdleCallback;
    const originalCancelIdleCallback = window.cancelIdleCallback;
    const callbacks = [];
    const cancelledIds = [];

    window.requestIdleCallback = (callback) => {
        callbacks.push(callback);
        return callbacks.length;
    };
    window.cancelIdleCallback = (id) => {
        cancelledIds.push(id);
    };

    try {
        gameState.remainingWords = Array.from({ length: 300 }, (_, idx) => `aa${String(idx).padStart(3, '0')}`).slice(0, 300);
        updateRemainingWords();

        gameState.remainingWords = ['about'];
        updateRemainingWords();

        callbacks[0]();
        assert.equals(document.querySelectorAll('#remainingWordsList .word-item').length, 0, 'Cancelled render should not append stale words');
        assert.includes(cancelledIds, 1, 'First idle render should be cancelled');

        callbacks[1]();
        assert.equals(document.querySelectorAll('#remainingWordsList .word-item').length, 1, 'Latest render should append current words');
    } finally {
        window.requestIdleCallback = originalRequestIdleCallback;
        window.cancelIdleCallback = originalCancelIdleCallback;
        cancelRemainingWordsRender();
    }
});

integrationSuite.test('should cap remaining words preview to ranked results', () => {
    initTestEnvironment();

    const originalRequestIdleCallback = window.requestIdleCallback;
    const originalCancelIdleCallback = window.cancelIdleCallback;
    const callbacks = [];

    window.requestIdleCallback = (callback) => {
        callbacks.push(callback);
        return callbacks.length;
    };
    window.cancelIdleCallback = () => {};

    try {
        gameState.remainingWords = Array.from({ length: 150 }, (_, idx) => {
            const first = String.fromCharCode(97 + Math.floor(idx / 26));
            const second = String.fromCharCode(97 + (idx % 26));
            return `aa${first}${second}e`;
        });
        calculateLetterFrequency();
        updateRemainingWords();

        callbacks[0]();

        assert.equals(document.querySelectorAll('#remainingWordsList .word-item').length, 100, 'Should render only the capped preview');
        assert.equals(document.querySelectorAll('#remainingWordsList .remaining-words-summary').length, 0, 'Preview should not render a separate summary row');
    } finally {
        window.requestIdleCallback = originalRequestIdleCallback;
        window.cancelIdleCallback = originalCancelIdleCallback;
        cancelRemainingWordsRender();
    }
});

integrationSuite.test('should update letter frequencies after filtering', () => {
    WORD_LIST = ['about', 'house', 'mouse', 'shout'];
    testData.setInputs(['', '', '', '', 't']); // Must end with 't'
    
    filterWords();
    calculateLetterFrequency();
    
    // Should only include words ending with 't'
    assert.includes(gameState.remainingWords, 'about', 'Should include "about"');
    assert.includes(gameState.remainingWords, 'shout', 'Should include "shout"');
    assert.notIncludes(gameState.remainingWords, 'house', 'Should exclude "house"');
    assert.notIncludes(gameState.remainingWords, 'mouse', 'Should exclude "mouse"');
    
    // Letter frequency should reflect filtered words
    assert.true(gameState.letterFrequency['t'] > 0, 'Letter "t" should have positive frequency');
});

integrationSuite.test('should handle complete workflow', async () => {
    // Simulate complete analysis workflow
    WORD_LIST = ['about', 'house', 'mouse', 'table', 'cable', 'fable'];
    testData.setInputs(['', 'a'], [], 'xyz'); // 'a' in position 1, exclude x,y,z
    
    // Run complete analysis
    filterWords();
    calculateLetterFrequency();
    if (!calculationWorker) initializeWebWorker();
    calculateOptimalGuesses();
    await waitForOptimalGuesses();
    
    // Verify filtering worked
    gameState.remainingWords.forEach(word => {
        assert.equals(word[1], 'a', `Word "${word}" should have 'a' in position 1`);
        assert.false(/[xyz]/.test(word), `Word "${word}" should not contain x, y, or z`);
    });
    
    // Verify we have suggestions
    assert.greaterThan(gameState.optimalGuesses.length, 0, 'Should have optimal guesses');
    
    // Verify letter frequencies are calculated
    assert.true(Object.keys(gameState.letterFrequency).length > 0, 'Should have letter frequencies');
});

integrationSuite.test('should handle edge case with very few remaining words', () => {
    WORD_LIST = ['about', 'shout'];
    gameState.remainingWords = ['about'];
    
    calculateOptimalGuesses();
    
    assert.equals(gameState.optimalGuesses.length, 1, 'Should have exactly one guess');
    assert.equals(gameState.optimalGuesses[0].word, 'about', 'Should suggest the only remaining word');
    assert.equals(gameState.optimalGuesses[0].score, 100, 'Should have perfect score');
});

integrationSuite.test('should handle no remaining words', () => {
    WORD_LIST = ['about', 'house'];
    gameState.remainingWords = [];
    
    calculateOptimalGuesses();
    
    assert.equals(gameState.optimalGuesses.length, 0, 'Should have no guesses when no words remain');
});
