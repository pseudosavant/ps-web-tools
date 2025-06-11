const integrationSuite = new TestSuite('Integration Tests');

integrationSuite.test('should calculate optimal guesses from remaining words', async () => {
    // Setup test scenario
    WORD_LIST = ['about', 'house', 'mouse', 'table', 'cable'];
    gameState.remainingWords = ['house', 'mouse'];
    
    calculateOptimalGuesses();
    
    assert.greaterThan(gameState.optimalGuesses.length, 0, 'Should generate optimal guesses');
    assert.true(gameState.optimalGuesses.every(g => g.type === 'answer'), 'All guesses should be valid answers');
    
    // All suggested words should be from remaining words
    const suggestedWords = gameState.optimalGuesses.map(g => g.word);
    suggestedWords.forEach(word => {
        assert.includes(gameState.remainingWords, word, `Suggested word "${word}" should be in remaining words`);
    });
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
    calculateOptimalGuesses();
    
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
    assert.equals(gameState.optimalGuesses[0].score, 1.0, 'Should have perfect score');
});

integrationSuite.test('should handle no remaining words', () => {
    WORD_LIST = ['about', 'house'];
    gameState.remainingWords = [];
    
    calculateOptimalGuesses();
    
    assert.equals(gameState.optimalGuesses.length, 0, 'Should have no guesses when no words remain');
});
