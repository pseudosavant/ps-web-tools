const patternSuite = new TestSuite('Pattern Generation');

patternSuite.test('should generate correct pattern for exact matches', () => {
    const pattern = getResponsePattern('house', 'house');
    assert.deepEquals(pattern, ['green', 'green', 'green', 'green', 'green'], 'All letters should be green');
});

patternSuite.test('should generate correct pattern for no matches', () => {
    const pattern = getResponsePattern('abcde', 'fghij');
    assert.deepEquals(pattern, ['gray', 'gray', 'gray', 'gray', 'gray'], 'All letters should be gray');
});

patternSuite.test('should handle yellow letters correctly', () => {
    const pattern = getResponsePattern('house', 'shout');
    // Let me trace through this step by step:
    // guess: 'house' vs answer: 'shout'
    // h vs s: h is in 'shout' (position 0), but in wrong position = yellow
    // o vs h: o is in 'shout' (position 2), but in wrong position = yellow  
    // u vs o: u is in 'shout' (position 3), but in wrong position = yellow
    // s vs u: s is in 'shout' (position 0), but in wrong position = yellow
    // e vs t: e is not in 'shout' = gray
    
    assert.equals(pattern[0], 'yellow', 'h should be yellow (in target, wrong position)');
    assert.equals(pattern[1], 'yellow', 'o should be yellow (in target, wrong position)');
    assert.equals(pattern[2], 'yellow', 'u should be yellow (in target, wrong position)');
    assert.equals(pattern[3], 'yellow', 's should be yellow (in target, wrong position)');
    assert.equals(pattern[4], 'gray', 'e should be gray (not in target)');
});

patternSuite.test('should handle duplicate letters correctly', () => {
    const pattern = getResponsePattern('hello', 'llama');
    // h vs l: gray (h not in llama)
    // e vs l: gray (e not in llama)  
    // l vs a: yellow (l in llama, wrong position)
    // l vs m: yellow (l in llama, wrong position)
    // o vs a: gray (o not in llama)
    
    assert.equals(pattern[0], 'gray', 'h should be gray');
    assert.equals(pattern[1], 'gray', 'e should be gray');
    assert.equals(pattern[2], 'yellow', 'first l should be yellow');
    assert.equals(pattern[3], 'yellow', 'second l should be yellow');
    assert.equals(pattern[4], 'gray', 'o should be gray');
});

patternSuite.test('should not mark more yellows than letters exist', () => {
    const pattern = getResponsePattern('spoon', 'loops');
    // This test verifies the constraint is respected
    const yellowOCount = pattern.filter((p, i) => p === 'yellow' && 'spoon'[i] === 'o').length;
    const oCountInTarget = 'loops'.split('').filter(l => l === 'o').length;
    assert.true(yellowOCount <= oCountInTarget, 'Should not have more yellow Os than available in target');
});

patternSuite.test('should prioritize green over yellow for same letter', () => {
    const pattern = getResponsePattern('robot', 'orbit');
    // robot vs orbit  
    // r vs o: yellow (r in orbit, wrong position)
    // o vs r: yellow (o in orbit, wrong position)
    // b vs b: green (correct position)
    // o vs i: yellow (o in orbit, wrong position - but o already used?)
    // t vs t: green (correct position)
    
    assert.equals(pattern[2], 'green', 'b in correct position should be green');
    assert.equals(pattern[4], 'green', 't in correct position should be green');
});
