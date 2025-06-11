const scoringSuite = new TestSuite('Scoring Algorithms');

scoringSuite.test('should calculate letter frequency scores', () => {
    const score1 = calculateLetterFrequencyScore('about');
    const score2 = calculateLetterFrequencyScore('zzzzz');
    
    assert.greaterThan(score1, score2, 'Common letters should score higher than rare letters');
    assert.greaterThan(score1, 0, 'Score should be positive');
});

scoringSuite.test('should calculate position scores correctly', () => {
    // Setup position frequency data
    gameState.positionFrequency = [
        {'a': 10, 'b': 5},
        {'c': 8, 'd': 2},
        {'e': 15, 'f': 1},
        {'g': 12, 'h': 3},
        {'i': 20, 'j': 4}
    ];
    
    const score1 = calculatePositionScore('acegi'); // All most frequent letters
    const score2 = calculatePositionScore('bdfhj'); // All less frequent letters
    
    assert.greaterThan(score1, score2, 'Word with more frequent position letters should score higher');
});

scoringSuite.test('should handle empty position frequency gracefully', () => {
    gameState.positionFrequency = [{}, {}, {}, {}, {}];
    
    const score = calculatePositionScore('about');
    assert.equals(score, 0, 'Should return 0 for empty position frequency');
});

scoringSuite.test('should calculate information gain for small word sets', () => {
    gameState.remainingWords = ['house', 'mouse', 'douse'];
    
    const info1 = calculateExpectedInformation('house');
    const info2 = calculateExpectedInformation('about');
    
    // Information gain should be >= 0 (could be 0 if word is in remaining words)
    assert.true(info2 >= 0, 'Information gain should be non-negative');
});

scoringSuite.test('should use approximation for large word sets', () => {
    // Create large word set to trigger approximation
    gameState.remainingWords = Array(150).fill().map((_, i) => `word${i.toString().padStart(2, '0')}`);
    
    const info = calculateExpectedInformation('about');
    assert.true(info >= 0, 'Should return non-negative information gain even with approximation');
});

scoringSuite.test('should score common words higher', () => {
    const score1 = calculateLetterFrequencyScore('about'); // Common word
    const score2 = calculateLetterFrequencyScore('zyxwv'); // Uncommon letters
    
    assert.greaterThan(score1, score2, 'Common word should score higher');
});
