let allTestSuites = [];
let totalTests = 0;
let totalPassed = 0;
let totalFailed = 0;

// Register all test suites
function registerTestSuites() {
    allTestSuites = [
        wordFilteringSuite,
        patternSuite,
        scoringSuite,
        integrationSuite
    ];
}

// Run all tests and display results
async function runAllTests() {
    console.clear();
    
    // Initialize test environment
    initTestEnvironment();
    suppressConsole(); // Suppress console output during tests
    
    registerTestSuites();
    
    const startTime = performance.now();
    totalTests = 0;
    totalPassed = 0;
    totalFailed = 0;
    
    const summaryEl = document.getElementById('summary');
    const resultsEl = document.getElementById('test-results');
    
    summaryEl.innerHTML = '⏳ Running tests...';
    resultsEl.innerHTML = '';
    
    const allResults = [];
    
    try {
        for (const suite of allTestSuites) {
            const results = await suite.run();
            allResults.push({
                suiteName: suite.name,
                results: results,
                passed: suite.passed,
                failed: suite.failed
            });
            
            totalTests += suite.tests.length;
            totalPassed += suite.passed;
            totalFailed += suite.failed;
        }
    } catch (error) {
        console.error('Error running tests:', error);
    }
    
    const endTime = performance.now();
    const duration = Math.round(endTime - startTime);
    
    restoreConsole(); // Restore console output
    
    // Clean up test environment
    testData.cleanup();
    
    // Display summary
    const passRate = totalTests > 0 ? Math.round((totalPassed / totalTests) * 100) : 0;
    summaryEl.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
                📊 <strong>${totalPassed}/${totalTests}</strong> tests passed 
                (<strong>${passRate}%</strong>) in <strong>${duration}ms</strong>
            </div>
            <div style="color: ${totalFailed === 0 ? '#4CAF50' : '#f44336'};">
                ${totalFailed === 0 ? '✅ All tests passed!' : `❌ ${totalFailed} test(s) failed`}
            </div>
        </div>
    `;
    
    // Display detailed results
    resultsEl.innerHTML = allResults.map(suite => `
        <div class="test-suite">
            <div class="test-suite-header">
                ${suite.suiteName} (${suite.passed}/${suite.results.length} passed)
            </div>
            ${suite.results.map(test => `
                <div class="test-case ${test.status === 'pass' ? 'test-pass' : 'test-fail'}">
                    <div>
                        <div>${test.description}</div>
                        ${test.error ? `<div class="error-details">${test.error}</div>` : ''}
                    </div>
                    <div class="test-status ${test.status}">${test.status.toUpperCase()}</div>
                </div>
            `).join('')}
        </div>
    `).join('');
    
    // Log results to console for CI/automation
    console.log(`\n🏁 Test Summary: ${totalPassed}/${totalTests} passed (${passRate}%) in ${duration}ms`);
    if (totalFailed > 0) {
        console.error(`❌ ${totalFailed} test(s) failed`);
    } else {
        console.log('✅ All tests passed!');
    }
}

// Automatically run tests if this is being run in a headless environment
if (typeof document !== 'undefined' && document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        // Auto-run tests if URL parameter is present
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('auto') === 'true') {
            setTimeout(() => runAllTests(), 1000);
        }
    });
}
